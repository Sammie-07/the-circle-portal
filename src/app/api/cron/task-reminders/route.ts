import { createClient } from '@supabase/supabase-js'
import { brandedEmail, sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'

// Reminder window: start nudging 3 days before a task is due, and keep going for
// a few days past the deadline (a short grace), then stop so we never spam.
const DAYS_BEFORE = 3
const DAYS_AFTER = 3

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Task {
  id: string
  title: string
  description: string | null
  due_date: string
  member_id: string
}

// One line per task, sorted by due date, with a clear urgency label.
function taskListHtml(tasks: Task[], todayMs: number): string {
  const rows = tasks
    .slice()
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((t) => {
      const days = Math.round((new Date(t.due_date + 'T00:00:00').getTime() - todayMs) / 86400000)
      const label =
        days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
        : days === 0 ? 'Due today'
        : `Due in ${days} day${days === 1 ? '' : 's'}`
      const color = days < 0 ? '#ff8080' : days <= 1 ? '#C9A227' : '#AAAAAA'
      const dateStr = new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      return `
        <tr>
          <td style="padding:12px 16px;border:1px solid #1A1A1A;border-bottom:none;background:#0E0E0E;">
            <div style="font-size:15px;color:#FFFFFF;font-weight:600;">${t.title}</div>
            ${t.description ? `<div style="font-size:13px;color:#888888;margin-top:2px;">${t.description}</div>` : ''}
            <div style="font-size:12px;color:${color};margin-top:6px;font-weight:600;">${label} · ${dateStr}</div>
          </td>
        </tr>`
    })
    .join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-bottom:1px solid #1A1A1A;">${rows}</table>`
}

// Daily — email each member a single bundled reminder of their tasks that are
// close to (or just past) their deadline. One email per member per day.
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const from = new Date(today); from.setDate(today.getDate() - DAYS_AFTER)
  const to = new Date(today); to.setDate(today.getDate() + DAYS_BEFORE)

  // Active, invited members with an email.
  const { data: members } = await supabase
    .from('members')
    .select('id, name, email')
    .eq('status', 'active')
    .not('invited_at', 'is', null)
    .not('email', 'is', null)

  const memberList = (members ?? []) as { id: string; name: string; email: string }[]
  if (memberList.length === 0) {
    return NextResponse.json({ success: true, reminded: 0 })
  }

  // Incomplete tasks with a due date inside the reminder window.
  const { data: tasks } = await supabase
    .from('homework')
    .select('id, title, description, due_date, member_id')
    .eq('completed', false)
    .not('due_date', 'is', null)
    .gte('due_date', isoDay(from))
    .lte('due_date', isoDay(to))
    .in('member_id', memberList.map((m) => m.id))

  const byMember = new Map<string, Task[]>()
  for (const t of (tasks ?? []) as Task[]) {
    const arr = byMember.get(t.member_id) ?? []
    arr.push(t)
    byMember.set(t.member_id, arr)
  }

  const sends: Promise<unknown>[] = []
  let reminded = 0

  for (const member of memberList) {
    const memberTasks = byMember.get(member.id)
    if (!memberTasks || memberTasks.length === 0) continue
    reminded++

    const firstName = (member.name || '').split(' ')[0] || 'there'
    const count = memberTasks.length
    const html = brandedEmail({
      eyebrow: 'Task Reminder',
      heading: `${firstName}, you've got ${count === 1 ? 'a task' : `${count} tasks`} close to deadline.`,
      body: [
        `Here ${count === 1 ? 'is the task' : 'are the tasks'} from your blueprint and calls that ${count === 1 ? 'is' : 'are'} coming due. Knock ${count === 1 ? 'it' : 'them'} out and check ${count === 1 ? 'it' : 'them'} off in your portal.`,
      ],
      bodyHtml: taskListHtml(memberTasks, todayMs),
      cta: { text: 'Open My Tasks →', url: `${APP_URL}/dashboard#homework` },
      note: "You're getting this because these tasks are due soon. Once you complete them (or they're more than a few days past), they'll drop off these reminders.",
    })

    sends.push(
      sendEmail(member.email, `Tasks close to deadline — ${count} to do`, html)
        .catch((err: unknown) => console.error(`Failed to remind ${member.email}:`, err))
    )
  }

  await Promise.allSettled(sends)

  return NextResponse.json({ success: true, reminded })
}
