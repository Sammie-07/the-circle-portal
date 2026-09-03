import type { SupabaseClient } from '@supabase/supabase-js'
import { highlightsBetween } from '@/lib/survey'
import type { SurveyAnswers } from '@/lib/survey-questions'

// A "signal" is one noteworthy thing a member (or the community) did that's
// worth a social post. The scanner turns raw activity into these; the generator
// turns each into a finished post. `dedupeKey` guarantees we never regenerate
// the same win twice.

export type ContentSourceType = 'member_win' | 'community' | 'takeaway' | 'educational'

export interface ContentSignal {
  sourceType: ContentSourceType
  memberId: string | null
  memberName: string | null
  theme: string // income | credit | debt | business | homework | takeaway | community | ...
  dedupeKey: string
  summary: string // short admin-facing label, e.g. "Sean · income +45% in Sep"
  data: Record<string, unknown> // structured facts for the prompt
}

interface RawResponse {
  period_month: string
  answers: SurveyAnswers
  status: string
}

function monthLabel(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Map a survey highlight key to a coarse content theme.
function themeForKey(key: string): string {
  if (key === 'total_income' || key === 'income_sources') return 'income'
  if (key === 'credit_score') return 'credit'
  if (key === 'total_debt') return 'debt'
  if (key === 'investments_value' || key === 'has_investments') return 'investing'
  if (['real_estate_properties', 'active_llcs', 'vas'].includes(key)) return 'business'
  return 'growth'
}

// Map an achievement key to a coarse content theme.
export function themeForAchievement(key: string): string {
  if (key.startsWith('attendance') || key.startsWith('perfect_month') || key.startsWith('survey_streak')) return 'consistency'
  if (key.startsWith('blueprint')) return 'planning'
  if (key.startsWith('tenure')) return 'journey'
  return 'growth'
}

interface AchievementSignalRow {
  member_id: string
  achievement_key: string
  title: string
  body: string
  created_at: string
  members: { name: string; is_internal: boolean; status: string } | null
}

interface MemberRow {
  id: string
  name: string
  is_internal: boolean
  status: string
  blueprint_generated_at: string | null
  survey_responses: RawResponse[] | null
  homework: { completed: boolean }[] | null
}

/**
 * Scan recent member activity into content signals. Includes internal/test
 * accounts that have real data (so demos work); the caller filters if needed.
 */
export async function scanRecentSignals(admin: SupabaseClient): Promise<ContentSignal[]> {
  const { data: members } = await admin
    .from('members')
    .select('id, name, is_internal, status, blueprint_generated_at, survey_responses ( period_month, answers, status ), homework ( completed )')
    .eq('status', 'active')

  const rows = (members ?? []) as MemberRow[]
  const signals: ContentSignal[] = []

  // Community aggregation accumulators (this uses each member's latest month).
  let totalClosings = 0
  let totalIncome = 0
  let membersWithWins = 0
  let latestMonthSeen = ''
  const themesPresent = new Set<string>()

  for (const m of rows) {
    if (m.is_internal) continue // never feature internal/test accounts publicly
    const name = m.name ?? 'A Circle member'
    const responses = (m.survey_responses ?? [])
      .filter((r) => r.status === 'complete')
      .slice()
      .sort((a, b) => a.period_month.localeCompare(b.period_month))

    const latest = responses[responses.length - 1]
    const prev = responses[responses.length - 2]

    // --- Member wins from the latest survey pair (reuses the highlight engine) ---
    if (latest && prev) {
      if (latest.period_month > latestMonthSeen) latestMonthSeen = latest.period_month
      const hs = highlightsBetween(latest.answers, prev.answers).filter((h) => h.tone === 'win')
      if (hs.length) membersWithWins++
      for (const h of hs) {
        const theme = themeForKey(h.key)
        themesPresent.add(theme)
        signals.push({
          sourceType: 'member_win',
          memberId: m.id,
          memberName: name,
          theme,
          dedupeKey: `win:${m.id}:${latest.period_month}:${h.key}`,
          summary: `${name} · ${h.message}`,
          data: {
            member: name,
            month: monthLabel(latest.period_month),
            metric: h.label,
            change: h.message,
            latest: latest.answers[h.key] ?? null,
            previous: prev.answers[h.key] ?? null,
          },
        })
      }
    }

    // --- Latest takeaway → quote/value post ---
    if (latest) {
      const t = latest.answers['takeaway']
      if (typeof t === 'string' && t.trim().length > 12) {
        signals.push({
          sourceType: 'takeaway',
          memberId: m.id,
          memberName: name,
          theme: 'takeaway',
          dedupeKey: `takeaway:${m.id}:${latest.period_month}`,
          summary: `${name} · takeaway (${monthLabel(latest.period_month)})`,
          data: { member: name, month: monthLabel(latest.period_month), takeaway: t.trim() },
        })
      }
      // Community accumulation from latest month.
      const closings = Number(latest.answers['closings'])
      const income = Number(latest.answers['total_income'])
      if (Number.isFinite(closings)) totalClosings += closings
      if (Number.isFinite(income)) totalIncome += income
    }

    // --- Homework completion milestones (every 5 completed) ---
    const completed = (m.homework ?? []).filter((h) => h.completed).length
    const bucket = Math.floor(completed / 5) * 5
    if (bucket >= 5) {
      themesPresent.add('homework')
      signals.push({
        sourceType: 'member_win',
        memberId: m.id,
        memberName: name,
        theme: 'homework',
        dedupeKey: `hw:${m.id}:${bucket}`,
        summary: `${name} · ${bucket}+ homeworks completed`,
        data: { member: name, completed: bucket, note: 'consistent execution / doing the work' },
      })
    }

    // --- Blueprint: they have a personalized 12-month plan (journey/proof post) ---
    if (m.blueprint_generated_at) {
      themesPresent.add('planning')
      signals.push({
        sourceType: 'member_win',
        memberId: m.id,
        memberName: name,
        theme: 'blueprint',
        dedupeKey: `blueprint:${m.id}`,
        summary: `${name} · has a custom 12-month blueprint`,
        data: {
          member: name,
          milestone: 'has a personalized 12-month blueprint mapping their next year',
          note: 'committed to The Circle, has a clear roadmap and is executing on it',
        },
      })
    }
  }

  // --- Milestone achievements → member_win posts ---
  // The achievements engine already detected these celebrations; surface the
  // milestone ones as postable wins. Skip survey financial wins and raw homework
  // totals (they have dedicated signals above) so we never double-post one win.
  {
    const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
    const { data: achs } = await admin
      .from('achievements')
      .select('member_id, achievement_key, title, body, created_at, members!inner ( name, is_internal, status )')
      .eq('tier', 'milestone')
      .eq('backfilled', false) // launch-banked wins never generate content
      .gte('created_at', cutoff)
    for (const a of (achs ?? []) as unknown as AchievementSignalRow[]) {
      const mem = a.members
      if (!mem || mem.is_internal || mem.status !== 'active') continue
      if (a.achievement_key.startsWith('survey_win_') || a.achievement_key.startsWith('homework_total_')) continue
      const theme = themeForAchievement(a.achievement_key)
      themesPresent.add(theme)
      signals.push({
        sourceType: 'member_win',
        memberId: a.member_id,
        memberName: mem.name,
        theme,
        dedupeKey: `achv:${a.member_id}:${a.achievement_key}`,
        summary: `${mem.name} · ${a.title}`,
        data: {
          member: mem.name,
          milestone: a.title,
          detail: a.body,
          note: 'a milestone worth celebrating publicly — consistency, discipline, and doing the work in The Circle',
        },
      })
    }
  }

  // --- Community / aggregate post for the current period ---
  if (latestMonthSeen && (totalClosings > 0 || membersWithWins > 0)) {
    signals.push({
      sourceType: 'community',
      memberId: null,
      memberName: null,
      theme: 'community',
      dedupeKey: `community:${latestMonthSeen}`,
      summary: `Community roundup · ${monthLabel(latestMonthSeen)}`,
      data: {
        month: monthLabel(latestMonthSeen),
        totalClosings,
        totalIncome,
        membersWithWins,
      },
    })
  }

  // --- Educational posts: one per theme present this cycle, grounded in the Brain ---
  const currentMonthKey = latestMonthSeen || new Date().toISOString().slice(0, 7)
  for (const theme of themesPresent) {
    signals.push({
      sourceType: 'educational',
      memberId: null,
      memberName: null,
      theme,
      dedupeKey: `edu:${theme}:${currentMonthKey}`,
      summary: `Educational · ${theme}`,
      data: { theme, context: 'Members are actively making progress in this area right now.' },
    })
  }

  return signals
}
