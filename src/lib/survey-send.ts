import { createAdminClient } from '@/lib/supabase/admin'
import { brandedEmail, sendEmail } from '@/lib/email'
import { windowForMonth } from '@/lib/survey'
import { getSurveyAllowlist, isEmailInSurveyRollout } from '@/lib/settings'

// Sends the monthly "Circle Progress Check" — the email to eligible members AND
// (by stamping survey_periods.sent_at) the signal that activates the in-portal
// popup for the current month. Shared by the manual admin button. Automated
// sending is currently OFF (see the disabled cron); this is the only send path.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'

export interface SurveySendResult {
  month: string
  monthName: string
  sent: number
  recipients: number
  alreadySent: boolean
  resent: boolean
}

function monthNameOf(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Current month's period status (has it been sent yet?), for the Settings card. */
export async function getCurrentPeriodStatus(
  now: Date = new Date()
): Promise<{ periodMonth: string; monthName: string; sentAt: string | null }> {
  const admin = createAdminClient()
  const win = windowForMonth(now)
  const { data } = await admin
    .from('survey_periods')
    .select('sent_at')
    .eq('period_month', win.periodMonth)
    .maybeSingle()
  return { periodMonth: win.periodMonth, monthName: monthNameOf(win.periodMonth), sentAt: (data?.sent_at as string) ?? null }
}

/**
 * Send / activate the current month's survey. Idempotent: if already sent this
 * month it no-ops unless `force` (a deliberate resend). Respects the rollout
 * allowlist exactly like the (disabled) cron did.
 */
export async function sendMonthlySurvey(
  now: Date = new Date(),
  opts: { force?: boolean } = {}
): Promise<SurveySendResult> {
  const admin = createAdminClient()
  const win = windowForMonth(now)
  const monthName = monthNameOf(win.periodMonth)

  const { data: period } = await admin
    .from('survey_periods')
    .select('sent_at')
    .eq('period_month', win.periodMonth)
    .maybeSingle()

  const already = !!period?.sent_at
  if (already && !opts.force) {
    return { month: win.periodMonth, monthName, sent: 0, recipients: 0, alreadySent: true, resent: false }
  }

  // Active, invited members; allowlist gates who actually gets it during rollout.
  const { data: members } = await admin
    .from('members')
    .select('id, name, email, is_internal')
    .eq('status', 'active')
    .not('invited_at', 'is', null)
    .not('email', 'is', null)

  const allowlist = await getSurveyAllowlist()
  const realMembers = (members ?? []).filter((m) =>
    allowlist ? isEmailInSurveyRollout(m.email as string, allowlist) : !m.is_internal
  )

  // Stamp the period (this is what makes the portal popup go live for the month).
  await admin.from('survey_periods').upsert(
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

  return { month: win.periodMonth, monthName, sent, recipients: realMembers.length, alreadySent: already, resent: already && !!opts.force }
}
