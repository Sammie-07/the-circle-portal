import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { brandedEmail, sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'
import { etParts, firstMondayDay, windowForMonth } from '@/lib/survey'
import { getSurveyAllowlist, isEmailInSurveyRollout } from '@/lib/settings'

export const runtime = 'nodejs'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'
const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

// Daily cron. On the first Monday of the month it opens the monthly progress
// survey and emails every active member; on the Wednesday, Friday and Sunday of
// that same week it re-nudges anyone who still hasn't completed it (every 2 days
// through the end of the send week). Idempotent via the survey_periods row.
export async function GET(request: Request) {
  // Auth: the Vercel cron secret, OR a staff session (so an admin can verify the
  // schedule is armed from the browser). On a non-send day this is a safe no-op.
  const cronAuthed = request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  if (!cronAuthed) {
    const sb = await createServerClient()
    const { data: { user } } = await sb.auth.getUser()
    let ok = false
    if (user) {
      const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
      ok = STAFF.includes(p?.role ?? '')
    }
    if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Automated sending is intentionally OFF while the survey is under review.
  // The monthly survey is sent manually from Admin → Settings ("Send this
  // month's survey"), via /api/surveys/send. To re-enable automation later,
  // set SURVEYS_CRON_ENABLED=true and re-add the cron to vercel.json.
  if (process.env.SURVEYS_CRON_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, action: 'disabled', reason: 'manual send only' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const { y, m, day } = etParts(now)
  const fm = firstMondayDay(y, m)
  const win = windowForMonth(now)

  const isSendDay = day === fm
  const reminderDays = [fm + 2, fm + 4, fm + 6] // Wed, Fri, Sun
  const isReminderDay = reminderDays.includes(day)

  if (!isSendDay && !isReminderDay) {
    return NextResponse.json({ ok: true, action: 'none', reason: 'not a survey day' })
  }

  const todayIso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const monthName = new Date(win.periodMonth + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Active, invited, real members.
  const { data: members } = await supabase
    .from('members')
    .select('id, name, email, is_internal')
    .eq('status', 'active')
    .not('invited_at', 'is', null)
    .not('email', 'is', null)

  // Rollout gate: during limited testing (allowlist set) survey ONLY the
  // allowlisted emails — including an internal test account, so it gets the full
  // email experience. At full launch (no allowlist) exclude internal accounts.
  const allowlist = await getSurveyAllowlist()
  const realMembers = (members ?? []).filter((m2) =>
    allowlist
      ? isEmailInSurveyRollout(m2.email as string, allowlist)
      : !m2.is_internal
  )

  // Ensure the period row exists.
  const { data: period } = await supabase
    .from('survey_periods')
    .select('period_month, sent_at, reminded_on')
    .eq('period_month', win.periodMonth)
    .maybeSingle()

  // ---- SEND DAY ----
  if (isSendDay) {
    if (period?.sent_at) {
      return NextResponse.json({ ok: true, action: 'send', reason: 'already sent this month' })
    }
    await supabase.from('survey_periods').upsert(
      {
        period_month: win.periodMonth,
        opened_on: win.openedOn,
        week_end: win.weekEnd,
        sent_at: now.toISOString(),
      },
      { onConflict: 'period_month' }
    )

    let sent = 0
    for (const mem of realMembers) {
      const html = brandedEmail({
        eyebrow: `${monthName} · Progress Check`,
        heading: 'Your monthly check-in is ready',
        body: [
          `Hi ${mem.name?.split(' ')[0] ?? 'there'},`,
          'It only takes about 3 minutes. A few quick numbers on your income, closings, debt, credit and business let Gogo and the team track your growth month over month, and give you real proof of how far you have come.',
          'Tap below to open your portal and complete this month’s progress check.',
        ],
        cta: { text: 'Complete my progress check', url: `${APP_URL}/dashboard` },
        note: 'You will be asked to complete it as soon as you open your portal.',
      })
      try {
        await sendEmail(mem.email as string, `Your ${monthName} progress check is ready`, html)
        sent++
      } catch {
        /* one bad address must not stop the batch */
      }
    }
    return NextResponse.json({ ok: true, action: 'send', month: win.periodMonth, sent })
  }

  // ---- REMINDER DAY ----
  if (!period?.sent_at) {
    return NextResponse.json({ ok: true, action: 'remind', reason: 'month never opened' })
  }
  const remindedOn: string[] = (period.reminded_on as string[]) ?? []
  if (remindedOn.includes(todayIso)) {
    return NextResponse.json({ ok: true, action: 'remind', reason: 'already reminded today' })
  }

  // Who has completed this month already?
  const { data: done } = await supabase
    .from('survey_responses')
    .select('member_id')
    .eq('period_month', win.periodMonth)
    .eq('status', 'complete')
  const doneIds = new Set((done ?? []).map((r) => r.member_id))

  const pending = realMembers.filter((mem) => !doneIds.has(mem.id))

  let sent = 0
  for (const mem of pending) {
    const html = brandedEmail({
      eyebrow: `${monthName} · Progress Check`,
      heading: 'A quick reminder',
      body: [
        `Hi ${mem.name?.split(' ')[0] ?? 'there'},`,
        `You have not finished your ${monthName} progress check yet. It takes about 3 minutes and your answers save as you go.`,
        'Tap below to finish it, this is how we track your wins and keep you on pace.',
      ],
      cta: { text: 'Finish my progress check', url: `${APP_URL}/dashboard` },
    })
    try {
      await sendEmail(mem.email as string, `Reminder: your ${monthName} progress check`, html)
      sent++
    } catch {
      /* ignore individual failures */
    }
  }

  await supabase
    .from('survey_periods')
    .update({ reminded_on: [...remindedOn, todayIso] })
    .eq('period_month', win.periodMonth)

  return NextResponse.json({ ok: true, action: 'remind', month: win.periodMonth, pending: pending.length, sent })
}
