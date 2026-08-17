import { createClient } from '@supabase/supabase-js'
import { brandedEmail, sendEmail } from '@/lib/email'
import { thisWeekTuesday } from '@/lib/office-hours'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'

// Monday 9am ET — remind admins to set whether there's a Tuesday office-hours
// call this week (so members see the right thing: Join button or no-meeting note).
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { tuesdayISO } = thisWeekTuesday()
  const tuesdayLabel = new Date(tuesdayISO + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // Has anyone already set it this week?
  const { data: existing } = await supabase
    .from('office_hours_weeks')
    .select('status, has_meeting, rescheduled_date, rescheduled_time')
    .eq('week_of', tuesdayISO)
    .maybeSingle()

  const statusLabel = (() => {
    if (!existing) return null
    const s = existing.status ?? (existing.has_meeting ? 'meeting' : 'no_meeting')
    if (s === 'no_meeting') return 'No meeting'
    if (s === 'rescheduled') {
      const day = existing.rescheduled_date
        ? new Date(existing.rescheduled_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
        : 'another day'
      return `Rescheduled to ${day}${existing.rescheduled_time ? ` at ${existing.rescheduled_time} ET` : ''}`
    }
    return 'Meeting as usual'
  })()

  const { data: admins } = await supabase
    .from('profiles')
    .select('email')
    .in('role', ['owner', 'admin', 'manager'])

  const recipients = (admins ?? []).map((a) => a.email).filter(Boolean) as string[]

  const html = brandedEmail({
    eyebrow: 'Office Hours',
    heading: 'Will there be a call this week?',
    body: [
      `It's Monday. Please confirm whether <strong style="color:#FFFFFF;">Tuesday Office Hours</strong> are happening this week (${tuesdayLabel}, 12 noon ET).`,
      existing
        ? `This week is currently set to: <strong style="color:#FFFFFF;">${statusLabel}</strong>. You can change it from Settings.`
        : `It hasn't been set yet — if you do nothing, members will see the usual &ldquo;Join the Zoom&rdquo; button on Tuesday.`,
      `Open Settings to confirm a meeting, mark the week off, or reschedule it to another day/time (members see the matching notice).`,
    ],
    cta: { text: 'Set This Week →', url: `${APP_URL}/admin/settings` },
    footer: 'The Circle · Admin Portal',
  })

  const results = await Promise.allSettled(
    recipients.map((email) =>
      sendEmail(email, `Office Hours this week? (${tuesdayLabel})`, html)
        .catch((err: unknown) => console.error(`Failed to send to ${email}:`, err))
    )
  )

  return NextResponse.json({
    success: true,
    week_of: tuesdayISO,
    already_set: !!existing,
    admins_emailed: results.length,
  })
}
