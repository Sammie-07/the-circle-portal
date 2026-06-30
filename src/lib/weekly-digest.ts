import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { brandedEmail } from '@/lib/email'

// Builds the Tuesday-morning "what members did this past week" digest for the
// team (Gogo + admins) — a narrative per member ahead of office hours.

interface TaskLite {
  title: string
  type: 'homework' | 'task'
  completed: boolean
  completed_at: string | null
  due_date: string | null
  notes: string | null
}

interface DueTask {
  title: string
  due_date: string
  days: number // days until due (negative = overdue)
}

interface MemberDigest {
  id: string
  name: string
  cohort: string | null
  completedThisWeek: { title: string; type: string }[]
  outstanding: number
  overdue: number
  dueSoon: DueTask[] // open, due within the next 5 days
  overdueWeek: DueTask[] // open, overdue by a week or more
  notes: { title: string; note: string }[]
  attendance: { showedUp: boolean; homeworkDone: boolean; questions: number; note: string | null } | null
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Plain, deterministic narrative used as a fallback when AI is unavailable.
function deterministicNarrative(m: MemberDigest): string {
  const parts: string[] = []
  if (m.completedThisWeek.length > 0) {
    parts.push(`Completed ${m.completedThisWeek.length} task${m.completedThisWeek.length === 1 ? '' : 's'} this week: ${m.completedThisWeek.map((t) => t.title).join('; ')}.`)
  } else {
    parts.push('No tasks marked complete this past week.')
  }
  if (m.attendance) {
    parts.push(m.attendance.showedUp ? 'Showed up to the call.' : 'Missed the call.')
  }
  if (m.notes.length > 0) {
    parts.push(`Left ${m.notes.length} note${m.notes.length === 1 ? '' : 's'} in the portal.`)
  }
  if (m.outstanding > 0) {
    parts.push(`${m.outstanding} task${m.outstanding === 1 ? '' : 's'} still open${m.overdue > 0 ? ` (${m.overdue} overdue)` : ''}.`)
  }
  return parts.join(' ')
}

// Ask Claude for a warm, factual 2–4 sentence narrative per member.
async function generateNarratives(members: MemberDigest[]): Promise<Record<string, string>> {
  if (!process.env.ANTHROPIC_API_KEY || members.length === 0) return {}
  try {
    const anthropic = getAnthropic()
    const payload = members.map((m) => ({
      id: m.id,
      name: m.name,
      completed_this_week: m.completedThisWeek.map((t) => t.title),
      attended_call: m.attendance ? m.attendance.showedUp : null,
      homework_done_flag: m.attendance ? m.attendance.homeworkDone : null,
      questions_asked: m.attendance ? m.attendance.questions : null,
      portal_notes: m.notes.map((n) => `${n.title}: ${n.note}`),
      tasks_outstanding: m.outstanding,
      tasks_overdue: m.overdue,
    }))

    const prompt = `You are writing the weekly internal team digest for "The Circle" (Gogo Bethke's real-estate coaching program). It goes to Gogo and the admins on Tuesday morning, before office hours, to bring them up to speed on what each member did in the PAST WEEK.

For EACH member below, write a 2 to 4 sentence narrative summary of their past week: what they completed, the comments/notes they left in the portal (quote or paraphrase the meaningful ones), their call attendance, and what's still outstanding. Be warm but factual and specific — this is a team briefing, not marketing. If a member has no activity, say so plainly (e.g. "Quiet week — nothing logged."). Never use em dashes. Write in third person about the member.

Return ONLY a valid JSON object mapping each member's "id" to their narrative string. No markdown, no commentary.

MEMBERS:
${JSON.stringify(payload, null, 2)}`

    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(cleaned) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function buildWeeklyDigest(): Promise<{ subject: string; html: string; memberCount: number }> {
  const db = createAdminClient()
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 7)
  const weekAgoMs = weekAgo.getTime()
  const todayMs = now.getTime()

  const { data: members } = await db
    .from('members')
    .select('id, name, cohort')
    .eq('status', 'active')
    .not('invited_at', 'is', null)
    .eq('is_internal', false) // exclude staff/test accounts from the team digest
    .order('name', { ascending: true })

  const memberList = (members ?? []) as { id: string; name: string; cohort: string | null }[]
  const ids = memberList.map((m) => m.id)

  const homeworkRes = ids.length
    ? await db.from('homework').select('member_id, title, type, completed, completed_at, due_date, notes').in('member_id', ids)
    : { data: [] as Record<string, unknown>[] }
  const logsRes = ids.length
    ? await db.from('weekly_logs').select('member_id, week_of, showed_up, homework_done, questions_asked, notes')
        .in('member_id', ids).gte('week_of', isoDay(weekAgo)).order('week_of', { ascending: false })
    : { data: [] as Record<string, unknown>[] }

  const homeworkByMember = new Map<string, TaskLite[]>()
  for (const h of (homeworkRes.data ?? []) as (TaskLite & { member_id: string })[]) {
    const arr = homeworkByMember.get(h.member_id) ?? []
    arr.push(h)
    homeworkByMember.set(h.member_id, arr)
  }
  // Latest log per member within the window.
  const latestLog = new Map<string, { showed_up: boolean; homework_done: boolean; questions_asked: number; notes: string | null }>()
  for (const l of (logsRes.data ?? []) as { member_id: string; showed_up: boolean; homework_done: boolean; questions_asked: number; notes: string | null }[]) {
    if (!latestLog.has(l.member_id)) latestLog.set(l.member_id, l) // first = most recent (sorted desc)
  }

  // Day baseline for due-date math (compare at midnight to avoid time-of-day skew).
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const daysUntil = (due: string) =>
    Math.round((new Date(due + 'T00:00:00').getTime() - todayMidnight) / 86400000)

  const digests: MemberDigest[] = memberList.map((m) => {
    const tasks = homeworkByMember.get(m.id) ?? []
    const completedThisWeek = tasks
      .filter((t) => t.completed && t.completed_at && new Date(t.completed_at).getTime() >= weekAgoMs)
      .map((t) => ({ title: t.title, type: t.type }))
    const open = tasks.filter((t) => !t.completed)
    const overdue = open.filter((t) => t.due_date && new Date(t.due_date + 'T00:00:00').getTime() < todayMs).length

    // Open tasks with a due date, classified for the briefing.
    const dated = open
      .filter((t): t is TaskLite & { due_date: string } => !!t.due_date)
      .map((t) => ({ title: t.title, due_date: t.due_date, days: daysUntil(t.due_date) }))
    const dueSoon = dated
      .filter((t) => t.days >= 0 && t.days <= 5)
      .sort((a, b) => a.days - b.days)
    const overdueWeek = dated
      .filter((t) => t.days <= -7)
      .sort((a, b) => a.days - b.days) // most overdue first

    const notes = tasks
      .filter((t) => t.notes && t.notes.trim())
      .map((t) => ({ title: t.title, note: t.notes!.trim() }))
    const log = latestLog.get(m.id)
    return {
      id: m.id,
      name: m.name,
      cohort: m.cohort,
      completedThisWeek,
      outstanding: open.length,
      overdue,
      dueSoon,
      overdueWeek,
      notes,
      attendance: log ? { showedUp: log.showed_up, homeworkDone: log.homework_done, questions: log.questions_asked ?? 0, note: log.notes } : null,
    }
  })

  const narratives = await generateNarratives(digests)

  // Build the per-member HTML sections.
  const sections = digests
    .map((m) => {
      const narrative = narratives[m.id]?.trim() || deterministicNarrative(m)
      const chips: string[] = []
      chips.push(`${m.completedThisWeek.length} done this week`)
      if (m.attendance) chips.push(m.attendance.showedUp ? 'Attended call' : 'Missed call')
      if (m.outstanding > 0) chips.push(`${m.outstanding} open${m.overdue > 0 ? `, ${m.overdue} overdue` : ''}`)
      const chipHtml = chips
        .map((c) => `<span style="display:inline-block;font-size:11px;color:#AAAAAA;border:1px solid #2A2A2A;border-radius:4px;padding:2px 8px;margin:0 6px 6px 0;">${esc(c)}</span>`)
        .join('')

      const notesHtml = m.notes.length
        ? `<div style="margin-top:8px;border-left:2px solid rgba(201,162,39,0.4);padding-left:10px;">
             ${m.notes.map((n) => `<p style="margin:0 0 6px;font-size:13px;color:#999999;"><span style="color:#C9A227;">“</span>${esc(n.note)}<span style="color:#C9A227;">”</span> <span style="color:#666;">— on “${esc(n.title)}”</span></p>`).join('')}
           </div>`
        : ''

      // Due-soon and overdue task lists — surfaced explicitly so the team can
      // chase them at office hours, independent of the AI narrative.
      const dueLabel = (days: number) => (days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : `due in ${days} days`)
      const overdueLabel = (days: number) => `${Math.abs(days)} days overdue`
      const taskListHtml = (heading: string, color: string, items: DueTask[], labeller: (d: number) => string) =>
        items.length
          ? `<div style="margin-top:10px;">
               <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${color};">${esc(heading)}</p>
               ${items.map((t) => `<p style="margin:0 0 3px;font-size:13px;color:#CCCCCC;">• ${esc(t.title)} <span style="color:#777;">(${esc(labeller(t.days))})</span></p>`).join('')}
             </div>`
          : ''
      const overdueHtml = taskListHtml(`Overdue a week or more (${m.overdueWeek.length})`, '#CC1F1F', m.overdueWeek, overdueLabel)
      const dueSoonHtml = taskListHtml(`Due in the next 5 days (${m.dueSoon.length})`, '#C9A227', m.dueSoon, dueLabel)

      return `<div style="padding:16px 0;border-bottom:1px solid #1E1E1E;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:18px;color:#FFFFFF;">${esc(m.name)}${m.cohort ? ` <span style="font-family:Helvetica Neue,Arial,sans-serif;font-size:12px;color:#666;">· ${esc(m.cohort)}</span>` : ''}</p>
        <div style="margin-bottom:8px;">${chipHtml}</div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#CCCCCC;">${esc(narrative)}</p>
        ${notesHtml}
        ${overdueHtml}
        ${dueSoonHtml}
      </div>`
    })
    .join('')

  const weekRange = `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const html = brandedEmail({
    eyebrow: 'Weekly Member Digest',
    heading: 'This week in The Circle',
    body: [
      `Here's where every member stands going into today's office hours — what they completed, what they said in the portal, and what's still open. Week of <strong style="color:#FFFFFF;">${weekRange}</strong>.`,
    ],
    bodyHtml: sections || '<p style="color:#888;font-size:14px;">No active members to report on yet.</p>',
    footer: 'The Circle · Admin Briefing',
  })

  return { subject: `The Circle — Weekly Member Digest (${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`, html, memberCount: memberList.length }
}
