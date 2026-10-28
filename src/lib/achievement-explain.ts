import type { SupabaseClient } from '@supabase/supabase-js'
import { SURVEY_QUESTION_BY_KEY } from '@/lib/survey-questions'

// Explains an awarded achievement to the admin: what it means and exactly what
// the member did to earn it (which homework, which calls, which survey change),
// worked out from the member's real records. Used by the admin notification bell.

export interface AchievementExplanation {
  id: string
  memberId: string
  memberName: string
  title: string
  emoji: string | null
  tier: string
  awardedAt: string
  /** The message the member saw. */
  memberMessage: string
  /** Plain-English rule: what this achievement is for. */
  meaning: string
  /** What the member actually did (most recent / most relevant first). */
  evidence: string[]
  /** Caveats worth knowing (old AI awards, launch backfill, ...). */
  note: string | null
}

interface Hw { title: string; completed: boolean; completed_at: string | null; source: string | null }
interface Log { week_of: string; showed_up: boolean; questions_asked: number | null }
interface Survey { period_month: string; status: string; completed_at: string | null; answers: Record<string, unknown> }

const day = (iso: string | null | undefined) =>
  iso ? new Date(iso.length <= 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'unknown date'
const month = (iso: string) => new Date(iso.slice(0, 7) + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthKey = (iso: string) => iso.slice(0, 7)
const sourceLabel = (s: string | null) => (s === 'blueprint' ? 'blueprint step' : s === 'call' ? 'from a call' : s === 'financial' ? 'financial task' : 'assignment')

function fmtAnswer(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return 'not answered'
  const q = SURVEY_QUESTION_BY_KEY[key]
  if (q?.type === 'currency' && typeof v === 'number') return `$${Math.round(v).toLocaleString('en-US')}`
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return String(v)
}

function homeworkList(done: Hw[], n: number): string[] {
  return done.slice(0, n).map((h) => `Completed "${h.title}" (${sourceLabel(h.source)}) on ${day(h.completed_at)}`)
}

export async function explainAchievement(admin: SupabaseClient, achievementId: string): Promise<AchievementExplanation | null> {
  const { data: a } = await admin
    .from('achievements')
    .select('id, member_id, achievement_key, title, body, emoji, tier, metadata, backfilled, created_at')
    .eq('id', achievementId)
    .maybeSingle()
  if (!a) return null

  const memberId = a.member_id as string
  const [{ data: member }, { data: hw }, { data: logs }, { data: surveys }] = await Promise.all([
    admin.from('members').select('name, join_date').eq('id', memberId).maybeSingle(),
    admin.from('homework').select('title, completed, completed_at, source').eq('member_id', memberId),
    admin.from('weekly_logs').select('week_of, showed_up, questions_asked').eq('member_id', memberId),
    admin.from('survey_responses').select('period_month, status, completed_at, answers').eq('member_id', memberId),
  ])

  const key = a.achievement_key as string
  // Explain with what had happened WHEN it was awarded (a Sep "5 assignments"
  // badge shouldn't list October homework). Small buffer: awards are written a
  // moment after the action that triggered them.
  const cutoff = new Date(new Date(a.created_at as string).getTime() + 5 * 60_000).toISOString()
  const cutoffDay = cutoff.slice(0, 10)
  const done = ((hw ?? []) as Hw[])
    .filter((h) => h.completed && (!h.completed_at || h.completed_at <= cutoff))
    .sort((x, y) => String(y.completed_at ?? '').localeCompare(String(x.completed_at ?? '')))
  const weeks = ((logs ?? []) as Log[])
    .filter((w) => w.week_of <= cutoffDay)
    .sort((x, y) => x.week_of.localeCompare(y.week_of))
  const attended = weeks.filter((w) => w.showed_up)
  const done_surveys = ((surveys ?? []) as Survey[])
    .filter((s) => s.status === 'complete' && (!s.completed_at || s.completed_at <= cutoff))
    .sort((x, y) => x.period_month.localeCompare(y.period_month))

  let meaning = ''
  let evidence: string[] = []
  let note: string | null = null
  let m: RegExpMatchArray | null

  if (key === 'homework_first') {
    meaning = 'Their first completed assignment in the portal.'
    const first = [...done].reverse()[0]
    evidence = first ? [`Completed "${first.title}" (${sourceLabel(first.source)}) on ${day(first.completed_at)}`] : []
  } else if ((m = key.match(/^homework_total_(\d+)$/))) {
    meaning = `They have completed ${m[1]} assignments in total.`
    evidence = [`${done.length} assignments completed when this was awarded. The most recent ones:`, ...homeworkList(done, 5)]
  } else if (key === 'homework_all_clear') {
    meaning = 'They finished every open assignment (at least 3 completed, none left open).'
    evidence = [`${done.length} completed, 0 open at the time.`, ...homeworkList(done, 3)]
  } else if (key === 'attendance_first') {
    meaning = 'The first coaching call they were marked present for.'
    evidence = attended[0] ? [`Marked present for the call in the week of ${day(attended[0].week_of)}`] : []
  } else if ((m = key.match(/^attendance_streak_(\d+)$/))) {
    const n = Number(m[1])
    meaning = `${n} tracked coaching calls in a row, none missed.`
    evidence = attended.slice(-n).map((w) => `Present: week of ${day(w.week_of)}`)
  } else if ((m = key.match(/^attendance_total_(\d+)$/))) {
    meaning = `${m[1]} coaching calls attended in total.`
    evidence = [`${attended.length} calls attended by then. Most recent: ${attended.slice(-5).map((w) => day(w.week_of)).join(', ')}`]
  } else if ((m = key.match(/^perfect_month_(\d{4}-\d{2})$/))) {
    meaning = `Present for every tracked call in ${month(m[1])} (at least 3 calls).`
    const mk = m[1]
    evidence = weeks.filter((w) => monthKey(w.week_of) === mk).map((w) => `${w.showed_up ? 'Present' : 'Missed'}: week of ${day(w.week_of)}`)
  } else if (key === 'comeback') {
    meaning = 'Came back to the calls after missing 2 or more weeks in a row.'
    for (let i = 2; i < weeks.length; i++) {
      if (weeks[i].showed_up && !weeks[i - 1].showed_up && !weeks[i - 2].showed_up) {
        evidence = [`Missed ${day(weeks[i - 2].week_of)} and ${day(weeks[i - 1].week_of)}, back on ${day(weeks[i].week_of)}`]
        break
      }
    }
  } else if ((m = key.match(/^questions_(\d+)$/))) {
    meaning = `${m[1]} questions brought to the coaching calls in total (as logged each week).`
    const total = weeks.reduce((s, w) => s + (w.questions_asked ?? 0), 0)
    evidence = [`${total} questions logged across ${weeks.length} tracked weeks by then.`]
  } else if (key === 'blueprint_started' || key === 'blueprint_complete' || (m = key.match(/^blueprint_pct_(\d+)$/))) {
    const bpAll = ((hw ?? []) as Hw[]).filter((h) => h.source === 'blueprint')
    const bpDone = done.filter((h) => h.source === 'blueprint')
    meaning = key === 'blueprint_started'
      ? 'They completed their first step of the 12-month blueprint.'
      : key === 'blueprint_complete'
        ? 'Every step of their 12-month blueprint is complete.'
        : `${m?.[1]}% of their 12-month blueprint steps are complete.`
    evidence = [`${bpDone.length} of ${bpAll.length} blueprint steps done.`, ...homeworkList(bpDone, key === 'blueprint_started' ? 1 : 4)]
  } else if (key === 'survey_first') {
    meaning = 'They completed their first monthly progress check-in.'
    const s = done_surveys[0]
    evidence = s ? [`${month(s.period_month)} check-in submitted on ${day(s.completed_at)}`] : []
  } else if ((m = key.match(/^survey_total_(\d+)$/)) || (m = key.match(/^survey_streak_(\d+)$/))) {
    meaning = key.startsWith('survey_streak') ? `${m[1]} monthly check-ins in a row, no month missed.` : `${m[1]} monthly check-ins completed in total.`
    evidence = done_surveys.slice(-Number(m[1])).map((s) => `${month(s.period_month)} check-in submitted on ${day(s.completed_at)}`)
  } else if ((m = key.match(/^survey_win_(\d{4}-\d{2}-\d{2})_(.+)$/))) {
    const [, period, field] = m
    const label = SURVEY_QUESTION_BY_KEY[field]?.label ?? field
    meaning = 'A real improvement in their monthly check-in compared with the month before.'
    const idx = done_surveys.findIndex((s) => s.period_month === period)
    const cur = done_surveys[idx]
    const prev = idx > 0 ? done_surveys[idx - 1] : null
    evidence = [`${a.body}`]
    if (cur) {
      evidence.push(prev
        ? `"${label}": ${fmtAnswer(field, prev.answers?.[field])} in ${month(prev.period_month)} → ${fmtAnswer(field, cur.answers?.[field])} in ${month(cur.period_month)}`
        : `"${label}": ${fmtAnswer(field, cur.answers?.[field])} in ${month(cur.period_month)} (their first check-in, so there was no earlier month to compare)`)
    }
    note = 'Survey numbers are self-reported by the member.'
    if (!prev) note = 'This was awarded from their FIRST check-in, before the Oct 16 fix: it reflects where they already were, not progress. New ones need an earlier month to compare.'
  } else if ((m = key.match(/^tenure_(\w+)$/))) {
    const label: Record<string, string> = { '1mo': '1 month', '3mo': '3 months', '6mo': '6 months', '1yr': '1 year' }
    meaning = `Time in The Circle: ${label[m[1]] ?? m[1]} since joining.`
    evidence = member?.join_date ? [`Joined on ${day(member.join_date as string)}`] : []
  } else if (key.startsWith('ai_')) {
    meaning = 'Awarded by the old automatic AI step (switched off on Oct 16), not by a tracked action.'
    evidence = [`What it said: ${a.body}`]
    note = 'This was based on what the member reported in their monthly survey, not on homework or calls the portal tracked. No new ones are given out this way.'
  } else {
    meaning = 'An achievement earned in the portal.'
    evidence = [a.body as string]
  }

  if (a.backfilled) {
    note = 'Recorded when achievements launched, for something they had already done before then (it was not celebrated to them).'
  }

  return {
    id: a.id as string,
    memberId,
    memberName: (member?.name as string) ?? 'Member',
    title: a.title as string,
    emoji: (a.emoji as string) ?? null,
    tier: a.tier as string,
    awardedAt: a.created_at as string,
    memberMessage: a.body as string,
    meaning,
    evidence: evidence.length ? evidence : ['No matching records found (the data may have changed since it was awarded).'],
    note,
  }
}
