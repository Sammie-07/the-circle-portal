// Achievement detection engine.
//
// Two layers:
//   1. Deterministic RULES — reliable, predictable, no false celebrations. Each
//      rule emits a candidate whenever the member CURRENTLY qualifies for a
//      stable key; the DB's unique(member_id, achievement_key) guarantees it is
//      only ever awarded once. So rules are simple "does this hold now?" checks.
//   2. An AI CATCH-ALL — a Claude pass that flags anything notable the rules
//      don't cover, grounded in the member's real data, capped and guard-railed
//      so it stays special (award-once, significance floor, no duplicate keys).
//
// Awarding is idempotent via insert-ignore. Only `milestone`-tier achievements
// trigger an email (with a per-member cooldown). Everything pops confetti
// in-portal via the AchievementGate.

import type { SupabaseClient } from '@supabase/supabase-js'
import { highlightsBetween } from '@/lib/survey'
import type { SurveyAnswers } from '@/lib/survey-questions'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { brandedEmail, sendEmail } from '@/lib/email'

export type Tier = 'small' | 'milestone'

// Test accounts always experience achievements (confetti, emails, a Replay
// button) regardless of the live flag — so the feature can be demoed on a real
// login while it stays invisible to every real member.
export const ACHIEVEMENT_TEST_EMAILS = new Set<string>(['akinwandesammy02@gmail.com'])
export function isAchievementTester(email: string | null | undefined): boolean {
  return !!email && ACHIEVEMENT_TEST_EMAILS.has(email.toLowerCase())
}

// Global launch switch. Until app_settings.achievements_live === 'true', the
// only accounts that earn/see/receive achievements are the test accounts above.
export async function achievementsLive(admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin.from('app_settings').select('value').eq('key', 'achievements_live').maybeSingle()
  return data?.value === 'true'
}

export interface AchievementCandidate {
  key: string
  title: string
  body: string
  emoji: string
  tier: Tier
  source?: 'rule' | 'ai'
  badgeKey?: string
  metadata?: Record<string, unknown>
}

export interface AchievementRow extends AchievementCandidate {
  id: string
  member_id: string
  created_at: string
}

interface HomeworkRow {
  completed: boolean
  completed_at: string | null
  source: string | null
  created_at: string
}
interface WeeklyLogRow {
  week_of: string
  showed_up: boolean
  questions_asked: number
}
interface SurveyRow {
  period_month: string
  answers: SurveyAnswers
  status: string
  completed_at: string | null
}
export interface MemberData {
  id: string
  name: string
  email: string
  join_date: string | null
  homework: HomeworkRow[]
  logs: WeeklyLogRow[]
  surveys: SurveyRow[]
}

// ── helpers ────────────────────────────────────────────────────────────────
function monthKey(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d.length <= 10 ? d + 'T12:00:00' : d) : d
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
}
function monthName(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Rule engine ──────────────────────────────────────────────────────────────
export function computeRuleAchievements(data: MemberData): AchievementCandidate[] {
  const out: AchievementCandidate[] = []
  const now = new Date()

  // ---- Homework ----
  const doneHw = data.homework.filter((h) => h.completed)
  const completedCount = doneHw.length
  const openCount = data.homework.filter((h) => !h.completed).length

  if (completedCount >= 1) {
    out.push({ key: 'homework_first', emoji: '🎯', tier: 'small', title: 'First one down', body: 'You completed your first assignment. This is exactly how momentum starts — keep it rolling.' })
  }
  for (const t of [5, 10, 25, 50, 100]) {
    if (completedCount >= t) {
      out.push({
        key: `homework_total_${t}`,
        emoji: t >= 100 ? '👑' : t >= 50 ? '🏆' : t >= 25 ? '🔥' : '⚡',
        tier: t >= 25 ? 'milestone' : 'small',
        title: `${t} assignments done`,
        body: `You've completed ${t} assignments in The Circle. That's the compounding effect of showing up and doing the work.`,
        badgeKey: `homework_${t}`,
      })
    }
  }
  if (completedCount >= 3 && openCount === 0) {
    out.push({ key: 'homework_all_clear', emoji: '🧹', tier: 'small', title: 'All caught up', body: "You've cleared every open assignment. Inbox zero on your homework — beautiful." })
  }

  // ---- Attendance (weekly_logs = tracked weeks) ----
  const logs = [...data.logs].sort((a, b) => a.week_of.localeCompare(b.week_of))
  const attended = logs.filter((l) => l.showed_up)
  const attendedCount = attended.length

  if (attendedCount >= 1) {
    out.push({ key: 'attendance_first', emoji: '🎙️', tier: 'small', title: 'You showed up', body: 'You made it to your first office hours. Presence is the whole game — proud of you.' })
  }
  // current streak = trailing run of showed_up from the most recent tracked week
  let streak = 0
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].showed_up) streak++
    else break
  }
  for (const t of [4, 8, 12]) {
    if (streak >= t) {
      out.push({
        key: `attendance_streak_${t}`,
        emoji: t >= 8 ? '🔥' : '📈',
        tier: t >= 8 ? 'milestone' : 'small',
        title: `${t}-week attendance streak`,
        body: `${t} office hours in a row. Consistency like this is what separates the members who transform from the ones who don't.`,
        badgeKey: `streak_${t}`,
      })
    }
  }
  for (const t of [10, 25]) {
    if (attendedCount >= t) {
      out.push({ key: `attendance_total_${t}`, emoji: '⭐', tier: t >= 25 ? 'milestone' : 'small', title: `${t} calls attended`, body: `You've shown up to ${t} coaching calls. The room notices who keeps coming back.` })
    }
  }
  // Perfect month — every tracked week that month attended (min 3 weeks)
  const byMonth = new Map<string, WeeklyLogRow[]>()
  for (const l of logs) {
    const k = monthKey(l.week_of)
    const arr = byMonth.get(k) ?? []
    arr.push(l)
    byMonth.set(k, arr)
  }
  const thisMonth = monthKey(now)
  for (const [mk, weeks] of byMonth) {
    if (mk === thisMonth) continue // don't award the in-progress month early
    if (weeks.length >= 3 && weeks.every((w) => w.showed_up)) {
      out.push({
        key: `perfect_month_${mk}`,
        emoji: '🏅',
        tier: 'milestone',
        title: `Perfect ${monthName(mk).split(' ')[0]}`,
        body: `You didn't miss a single office hours in ${monthName(mk)}. A perfect month — that's elite consistency.`,
        badgeKey: 'perfect_month',
      })
    }
  }
  // Comeback — attended again after missing 2+ tracked weeks in a row (award once)
  {
    const seq = logs.map((l) => l.showed_up)
    for (let i = 2; i < seq.length; i++) {
      if (seq[i] && !seq[i - 1] && !seq[i - 2]) {
        out.push({ key: 'comeback', emoji: '💪', tier: 'small', title: 'Welcome back', body: 'You came back after some time away — and that takes more strength than never leaving. Let’s go.' })
        break
      }
    }
  }
  // Curiosity — total questions asked
  const questions = logs.reduce((s, l) => s + (l.questions_asked || 0), 0)
  for (const t of [10, 25]) {
    if (questions >= t) {
      out.push({ key: `questions_${t}`, emoji: '💡', tier: 'small', title: `${t} questions asked`, body: `You've brought ${t} questions to the room. The members who ask are the members who grow.` })
    }
  }

  // ---- Blueprint (blueprint-source homework = the 12-month plan) ----
  const bpTasks = data.homework.filter((h) => h.source === 'blueprint')
  if (bpTasks.length >= 3) {
    const bpDone = bpTasks.filter((h) => h.completed).length
    const pct = bpDone / bpTasks.length
    if (bpDone >= 1) out.push({ key: 'blueprint_started', emoji: '🧭', tier: 'small', title: 'Blueprint underway', body: 'You completed your first step on your 12-month blueprint. The plan is in motion.' })
    for (const t of [25, 50, 75] as const) {
      if (pct >= t / 100) {
        out.push({ key: `blueprint_pct_${t}`, emoji: t >= 50 ? '🗺️' : '🧭', tier: t >= 50 ? 'milestone' : 'small', title: `Blueprint ${t}% complete`, body: `You're ${t}% of the way through your 12-month blueprint. Real, measurable progress on the plan Gogo built with you.`, badgeKey: `blueprint_${t}` })
      }
    }
    if (bpDone === bpTasks.length) {
      out.push({ key: 'blueprint_complete', emoji: '🏆', tier: 'milestone', title: 'Blueprint complete', body: 'You finished every step of your 12-month blueprint. This is what you came here to do — and you did it.', badgeKey: 'blueprint_100' })
    }
  }

  // ---- Monthly survey ----
  const completedSurveys = data.surveys
    .filter((s) => s.status === 'complete')
    .sort((a, b) => a.period_month.localeCompare(b.period_month))
  const surveyCount = completedSurveys.length
  if (surveyCount >= 1) out.push({ key: 'survey_first', emoji: '📝', tier: 'small', title: 'First check-in done', body: 'You completed your first monthly progress check-in. This is how you and Gogo track the real story.' })
  for (const t of [3, 6, 12]) {
    if (surveyCount >= t) out.push({ key: `survey_total_${t}`, emoji: '📊', tier: t >= 6 ? 'milestone' : 'small', title: `${t} check-ins completed`, body: `${t} monthly check-ins in the books. You're building a track record of your own growth.` })
  }
  // Survey completion streak (consecutive months)
  {
    let s = 0
    const months = completedSurveys.map((r) => r.period_month)
    for (let i = months.length - 1; i >= 0; i--) {
      if (i === months.length - 1) { s = 1; continue }
      const cur = new Date(months[i + 1] + 'T12:00:00')
      const prev = new Date(months[i] + 'T12:00:00')
      const diff = (cur.getUTCFullYear() - prev.getUTCFullYear()) * 12 + (cur.getUTCMonth() - prev.getUTCMonth())
      if (diff === 1) s++
      else break
    }
    for (const t of [3, 6]) {
      if (s >= t) out.push({ key: `survey_streak_${t}`, emoji: '🔗', tier: 'milestone', title: `${t}-month check-in streak`, body: `${t} monthly check-ins in a row without missing one. That discipline is the leading indicator of everything else.` })
    }
  }
  // Real-life wins from the latest survey vs the prior one (income, credit, debt, growth)
  if (completedSurveys.length >= 1) {
    const cur = completedSurveys[completedSurveys.length - 1]
    const prev = completedSurveys.length >= 2 ? completedSurveys[completedSurveys.length - 2] : null
    for (const h of highlightsBetween(cur.answers, prev?.answers ?? null)) {
      if (h.tone !== 'win') continue
      out.push({
        key: `survey_win_${cur.period_month}_${h.key}`,
        emoji: '🚀',
        tier: 'milestone',
        title: 'Real progress this month',
        body: h.message,
        metadata: { highlight: h.key, period: cur.period_month },
      })
    }
  }

  // ---- Tenure ----
  if (data.join_date) {
    const joined = new Date(data.join_date + 'T12:00:00')
    const days = daysBetween(joined, now)
    const tenures: Array<[number, string, string, Tier, string]> = [
      [30, 'tenure_1mo', 'One month in', 'small', 'You’ve been in The Circle for a month. The compounding is just getting started.'],
      [90, 'tenure_3mo', '90 days strong', 'milestone', 'Three months in The Circle. This is where the habits you’ve built start to show up in the numbers.'],
      [180, 'tenure_6mo', 'Halfway there', 'milestone', 'Six months in — you’re halfway through the program. Look how far you’ve already come.'],
      [365, 'tenure_1yr', 'A full year', 'milestone', 'A full year in The Circle. You showed up for yourself, again and again. That’s everything.'],
    ]
    for (const [d, key, title, tier, body] of tenures) {
      if (days >= d) out.push({ key, emoji: tier === 'milestone' ? '🎖️' : '📅', tier, title, body, badgeKey: key })
    }
  }

  return out.map((c) => ({ ...c, source: 'rule' as const }))
}

// ── AI catch-all ──────────────────────────────────────────────────────────────
// Feeds a compact activity summary to Claude and asks for up to 2 ADDITIONAL
// celebration-worthy achievements the rules don't already cover. Guard-railed:
// must be backed by the data, no duplicate keys/titles, warm and in Gogo's voice.
export async function computeAiAchievements(
  data: MemberData,
  existingKeys: Set<string>,
  existingTitles: Set<string>
): Promise<AchievementCandidate[]> {
  const doneHw = data.homework.filter((h) => h.completed)
  const attended = data.logs.filter((l) => l.showed_up)
  const latestSurvey = data.surveys.filter((s) => s.status === 'complete').slice(-1)[0]
  const summary = {
    tenureDays: data.join_date ? daysBetween(new Date(data.join_date + 'T12:00:00'), new Date()) : null,
    homeworkCompleted: doneHw.length,
    homeworkOpen: data.homework.filter((h) => !h.completed).length,
    callsAttended: attended.length,
    weeksTracked: data.logs.length,
    questionsAsked: data.logs.reduce((s, l) => s + (l.questions_asked || 0), 0),
    surveysCompleted: data.surveys.filter((s) => s.status === 'complete').length,
    latestSurveyAnswers: latestSurvey?.answers ?? null,
    alreadyAwarded: [...existingKeys],
  }

  const prompt = `You are Gogo Bethke's coaching portal, deciding whether a member has done anything genuinely worth celebrating that isn't already covered.

Member activity (JSON):
${JSON.stringify(summary, null, 2)}

Rules that ALREADY fire automatically (do NOT duplicate these): first/total homework, homework all-clear, attendance first/streaks/totals, perfect months, comeback, questions milestones, blueprint start/percent/complete, survey first/totals/streaks, survey financial wins (income up, credit up, debt down, added LLC/VA/property), tenure milestones.

Propose AT MOST 2 additional achievements ONLY if the data clearly supports something notable and special that the above rules miss (e.g. an unusually strong combination, a standout single data point, a rare consistency pattern). If nothing extra is truly worth celebrating, return an empty array — that is the correct and common answer. Never invent facts not in the data. Never celebrate something trivial.

Return STRICT JSON only, no prose:
{"achievements":[{"key":"short_snake_case_unique","title":"<= 40 chars","body":"1-2 warm sentences, second person, in Gogo's direct, high-energy, money-mindset voice","emoji":"single emoji","tier":"small|milestone"}]}`

  try {
    const anthropic = getAnthropic()
    const res = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return []
    const parsed = JSON.parse(match[0]) as { achievements?: Array<Partial<AchievementCandidate>> }
    const list = Array.isArray(parsed.achievements) ? parsed.achievements.slice(0, 2) : []
    const out: AchievementCandidate[] = []
    for (const a of list) {
      if (!a.key || !a.title || !a.body) continue
      const key = `ai_${String(a.key).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40)}`
      const title = String(a.title).slice(0, 60)
      if (existingKeys.has(key) || existingTitles.has(title.toLowerCase())) continue
      out.push({
        key,
        title,
        body: String(a.body).slice(0, 400),
        emoji: typeof a.emoji === 'string' && a.emoji ? a.emoji.slice(0, 4) : '✨',
        tier: a.tier === 'milestone' ? 'milestone' : 'small',
        source: 'ai',
      })
    }
    return out
  } catch {
    return []
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────
export async function loadMemberData(admin: SupabaseClient, memberId: string): Promise<MemberData | null> {
  const { data: member } = await admin
    .from('members')
    .select('id, name, email, join_date, status, is_internal')
    .eq('id', memberId)
    .maybeSingle()
  // Internal/test accounts are allowed to earn achievements (so the feature can
  // be demoed on a real login); the content machine still skips them publicly.
  if (!member || member.status !== 'active') return null

  const [{ data: homework }, { data: logs }, { data: surveys }] = await Promise.all([
    admin.from('homework').select('completed, completed_at, source, created_at').eq('member_id', memberId),
    admin.from('weekly_logs').select('week_of, showed_up, questions_asked').eq('member_id', memberId),
    admin.from('survey_responses').select('period_month, answers, status, completed_at').eq('member_id', memberId),
  ])

  return {
    id: member.id,
    name: member.name,
    email: member.email,
    join_date: member.join_date,
    homework: (homework ?? []) as HomeworkRow[],
    logs: (logs ?? []) as WeeklyLogRow[],
    surveys: (surveys ?? []) as SurveyRow[],
  }
}

// ── Award (insert-ignore) ─────────────────────────────────────────────────────
async function awardCandidates(admin: SupabaseClient, memberId: string, candidates: AchievementCandidate[]): Promise<AchievementRow[]> {
  if (candidates.length === 0) return []
  // Dedupe by key within this batch (rules can't collide, but AI + rules might).
  const seen = new Set<string>()
  const rows = candidates
    .filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)))
    .map((c) => ({
      member_id: memberId,
      achievement_key: c.key,
      title: c.title,
      body: c.body,
      emoji: c.emoji,
      tier: c.tier,
      source: c.source ?? 'rule',
      badge_key: c.badgeKey ?? null,
      metadata: c.metadata ?? {},
    }))

  // ON CONFLICT DO NOTHING — .select() returns only the newly inserted rows.
  const { data, error } = await admin
    .from('achievements')
    .upsert(rows, { onConflict: 'member_id,achievement_key', ignoreDuplicates: true })
    .select('id, member_id, achievement_key, title, body, emoji, tier, source, badge_key, metadata, created_at')
  if (error) return []
  return (data ?? []).map((r) => ({
    id: r.id,
    member_id: r.member_id,
    key: r.achievement_key,
    title: r.title,
    body: r.body,
    emoji: r.emoji,
    tier: r.tier,
    source: r.source,
    badgeKey: r.badge_key ?? undefined,
    metadata: r.metadata ?? {},
    created_at: r.created_at,
  }))
}

// ── Admin notifications ───────────────────────────────────────────────────────
// A running feed for admins: a member was celebrated, and (separately) a post
// was drafted from a celebration. Both insert-ignore on dedupe_key so they're
// written exactly once.
async function writeCelebrationNotifications(admin: SupabaseClient, data: MemberData, awarded: AchievementRow[]) {
  if (awarded.length === 0) return
  const rows = awarded.map((a) => ({
    type: 'celebration',
    member_id: data.id,
    member_name: data.name,
    achievement_id: a.id,
    emoji: a.emoji,
    title: `${data.name} earned “${a.title}”`,
    body: a.tier === 'milestone' ? 'Milestone reached' : 'Achievement earned',
    dedupe_key: `celebrated:${a.id}`,
  }))
  await admin.from('admin_notifications').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
}

// Scan recent achievement-driven content drafts and log a "post drafted" admin
// notification for any that don't have one yet. Called after content generation.
export async function reconcileAchievementPostNotifications(admin: SupabaseClient) {
  const { data: posts } = await admin
    .from('content_posts')
    .select('id, member_id, dedupe_key, trigger_summary')
    .like('dedupe_key', 'achv:%')
    .order('created_at', { ascending: false })
    .limit(40)
  if (!posts || posts.length === 0) return

  const { data: existing } = await admin
    .from('admin_notifications')
    .select('post_id')
    .in('post_id', posts.map((p) => p.id))
  const have = new Set((existing ?? []).map((e) => e.post_id))

  const rows = posts
    .filter((p) => !have.has(p.id))
    .map((p) => ({
      type: 'post_created',
      member_id: p.member_id,
      member_name: (p.trigger_summary as string | null)?.split(' · ')[0] ?? null,
      post_id: p.id,
      emoji: '📸',
      title: p.trigger_summary ? `Post drafted — ${p.trigger_summary}` : 'Post drafted from a milestone',
      body: 'Ready to review in Content.',
      dedupe_key: `post:${p.id}`,
    }))
  if (rows.length > 0) await admin.from('admin_notifications').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
}

// ── Milestone email (with per-member cooldown) ───────────────────────────────
const EMAIL_COOLDOWN_DAYS = 2

async function maybeSendMilestoneEmail(admin: SupabaseClient, data: MemberData, newlyAwarded: AchievementRow[]) {
  const milestones = newlyAwarded.filter((a) => a.tier === 'milestone')
  if (milestones.length === 0) return

  // Cooldown: skip if this member got any achievement email in the last N days.
  const since = new Date(Date.now() - EMAIL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('achievements')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', data.id)
    .gte('emailed_at', since)
  if ((count ?? 0) > 0) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://the-circle-portal.vercel.app'
  const top = milestones[0]
  const firstName = (data.name || '').split(' ')[0] || 'there'
  const listHtml =
    milestones.length > 1
      ? `<ul style="margin:0 0 8px;padding-left:18px;color:#AAAAAA;font-size:15px;line-height:1.7;">${milestones
          .map((m) => `<li><strong style="color:#E8CF7A;">${m.emoji} ${m.title}</strong> — ${m.body}</li>`)
          .join('')}</ul>`
      : undefined

  const html = brandedEmail({
    eyebrow: 'You just unlocked something',
    heading: `${top.emoji} ${milestones.length > 1 ? 'New milestones' : top.title}`,
    body:
      milestones.length > 1
        ? [`${firstName}, you hit a few milestones in The Circle.`]
        : [`${firstName}, ${top.body}`, 'Open your portal to see your celebration.'],
    bodyHtml: listHtml,
    cta: { text: 'See it in your portal', url: `${appUrl}/dashboard` },
    footer: 'The Circle · 12-Month Coaching Program',
  })

  try {
    await sendEmail(data.email, milestones.length > 1 ? 'You hit new milestones in The Circle 🎉' : `${top.title} 🎉`, html)
    await admin.from('achievements').update({ emailed_at: new Date().toISOString() }).in('id', milestones.map((m) => m.id))
  } catch {
    // best-effort; the in-portal confetti still fires
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────
export async function detectForMember(
  admin: SupabaseClient,
  memberId: string,
  opts: { includeAi?: boolean; email?: boolean; backfill?: boolean } = {}
): Promise<AchievementRow[]> {
  const data = await loadMemberData(admin, memberId)
  if (!data) return []

  const ruleCandidates = computeRuleAchievements(data)

  // Backfill mode (one-time at launch): record every CURRENT qualifying
  // achievement as already seen + emailed so nothing pops or emails for things
  // the member accomplished before the feature existed. Only genuinely new
  // milestones after this celebrate. Rules only, no AI, no content.
  if (opts.backfill) {
    const awarded = await awardCandidates(admin, memberId, ruleCandidates)
    if (awarded.length > 0) {
      const nowIso = new Date().toISOString()
      await admin.from('achievements').update({ seen_at: nowIso, emailed_at: nowIso }).in('id', awarded.map((a) => a.id))
    }
    return awarded
  }

  // Launch gate: until the feature is flipped live, only test accounts earn,
  // get emailed, or feed content. Backfill (above) bypasses this deliberately.
  if (!isAchievementTester(data.email) && !(await achievementsLive(admin))) return []

  let aiCandidates: AchievementCandidate[] = []
  if (opts.includeAi) {
    // Only bother the model once the member has some real activity to judge.
    const hasActivity = data.homework.some((h) => h.completed) || data.logs.length > 0 || data.surveys.some((s) => s.status === 'complete')
    if (hasActivity) {
      const { data: existing } = await admin.from('achievements').select('achievement_key, title').eq('member_id', memberId)
      const existingKeys = new Set<string>([...ruleCandidates.map((c) => c.key), ...((existing ?? []).map((e) => e.achievement_key))])
      const existingTitles = new Set<string>([...ruleCandidates.map((c) => c.title.toLowerCase()), ...((existing ?? []).map((e) => (e.title as string).toLowerCase()))])
      aiCandidates = await computeAiAchievements(data, existingKeys, existingTitles)
    }
  }

  const awarded = await awardCandidates(admin, memberId, [...ruleCandidates, ...aiCandidates])

  if (awarded.length > 0) {
    await writeCelebrationNotifications(admin, data, awarded)
    if (opts.email) await maybeSendMilestoneEmail(admin, data, awarded)
  }
  return awarded
}
