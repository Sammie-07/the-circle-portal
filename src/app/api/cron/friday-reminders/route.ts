import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export const maxDuration = 60

async function sendEmail(to: string, subject: string, html: string) {
  return fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: process.env.SENDGRID_FROM_EMAIL! },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  })
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'

function getMondayOfCurrentWeek(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  return monday.toISOString().split('T')[0]
}

function getWeekLabel(monday: string): string {
  const d = new Date(monday + 'T00:00:00Z')
  const friday = new Date(d)
  friday.setUTCDate(d.getUTCDate() + 4)
  return friday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function memberEmailHtml(name: string, checkinUrl: string, weekLabel: string): string {
  const firstName = name.split(' ')[0]
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:28px;height:28px;border:1.5px solid #CC1F1F;border-radius:50%;text-align:center;vertical-align:middle;">
                <div style="width:8px;height:8px;background:#CC1F1F;border-radius:50%;margin:auto;margin-top:9px;"></div>
              </td>
              <td style="padding-left:10px;font-family:Georgia,serif;font-size:15px;color:#FFFFFF;">The Circle</td>
            </tr>
          </table>
        </td></tr>

        <!-- Eyebrow -->
        <tr><td style="padding-bottom:8px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#C9A227;">Weekly Check-In</p>
        </td></tr>

        <!-- Heading -->
        <tr><td style="padding-bottom:24px;">
          <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;color:#FFFFFF;font-weight:normal;">
            It's Friday, ${firstName}.
          </h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding-bottom:32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#AAAAAA;">
            Time to check in. Your weekly survey is ready.
          </p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#AAAAAA;">
            Mark what you got done this week. Leave a note if there's something I need to know.
            Three minutes. That's it.
          </p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#AAAAAA;">
            Week of <strong style="color:#FFFFFF;">${weekLabel}</strong>
          </p>
        </td></tr>

        <!-- CTA Button -->
        <tr><td style="padding-bottom:40px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#C9A227;border-radius:6px;">
                <a href="${checkinUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#0D0D0D;text-decoration:none;">
                  Open My Check-In →
                </a>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Divider -->
        <tr><td style="border-top:1px solid #2A2A2A;padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#444444;">
            The Circle · 12-Month Coaching Program ·
            <a href="${checkinUrl}" style="color:#C9A227;text-decoration:none;">${checkinUrl}</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function adminEmailHtml(memberCount: number, weekLabel: string, portalUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:28px;height:28px;border:1.5px solid #CC1F1F;border-radius:50%;text-align:center;vertical-align:middle;">
                <div style="width:8px;height:8px;background:#CC1F1F;border-radius:50%;margin:auto;margin-top:9px;"></div>
              </td>
              <td style="padding-left:10px;font-family:Georgia,serif;font-size:15px;color:#FFFFFF;">The Circle</td>
            </tr>
          </table>
        </td></tr>

        <!-- Eyebrow -->
        <tr><td style="padding-bottom:8px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#C9A227;">Admin Reminder</p>
        </td></tr>

        <!-- Heading -->
        <tr><td style="padding-bottom:24px;">
          <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;color:#FFFFFF;font-weight:normal;">
            Friday. Two things.
          </h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding-bottom:32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#AAAAAA;">
            Week of <strong style="color:#FFFFFF;">${weekLabel}</strong>
          </p>
          <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
            <tr>
              <td style="padding:16px;background:#1A1A1A;border:1px solid #2A2A2A;border-radius:6px;">
                <p style="margin:0 0 8px;font-size:13px;color:#C9A227;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">1. Log this week's attendance</p>
                <p style="margin:0;font-size:14px;color:#888888;line-height:1.5;">
                  Open each member's page in the portal and log whether they showed up to the call this week.
                </p>
              </td>
            </tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="width:100%;">
            <tr>
              <td style="padding:16px;background:#1A1A1A;border:1px solid #2A2A2A;border-radius:6px;">
                <p style="margin:0 0 8px;font-size:13px;color:#C9A227;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">2. Check-in emails sent</p>
                <p style="margin:0;font-size:14px;color:#888888;line-height:1.5;">
                  Weekly Check-In emails just went out to <strong style="color:#FFFFFF;">${memberCount} member${memberCount !== 1 ? 's' : ''}</strong>.
                  Check back later today to see who submitted.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- CTA Button -->
        <tr><td style="padding-bottom:40px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#C9A227;border-radius:6px;">
                <a href="${portalUrl}/admin" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#0D0D0D;text-decoration:none;">
                  Open Portal →
                </a>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Divider -->
        <tr><td style="border-top:1px solid #2A2A2A;padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#444444;">The Circle · Admin Portal</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function GET(request: Request) {
  // Verify the request comes from Vercel Cron (standard pattern).
  // Reject if the secret is unset or the header doesn't match.
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const weekOf = getMondayOfCurrentWeek()
  const weekLabel = getWeekLabel(weekOf)

  // 1. Get members who should receive a check-in: active AND already invited to
  //    the portal. Members are created before they're given access (no login link
  //    sent yet) — those must NOT get a check-in until they've been invited
  //    (`invited_at` is stamped by the invite endpoints).
  const { data: members } = await supabase
    .from('members')
    .select('id, name, email')
    .not('email', 'is', null)
    .eq('status', 'active')
    .not('invited_at', 'is', null)

  const activeMembers = members ?? []

  // 2. Generate check-in tokens + send member emails
  const memberEmails: Promise<unknown>[] = []

  for (const member of activeMembers) {
    if (!member.email) continue

    const token = randomUUID()

    // Upsert: create new checkin for this week (or refresh token if not yet submitted)
    const { data: existing } = await supabase
      .from('weekly_checkins')
      .select('id, submitted_at, token')
      .eq('member_id', member.id)
      .eq('week_of', weekOf)
      .single()

    let checkinToken = token

    if (existing) {
      if (existing.submitted_at) {
        // Already submitted this week, use existing token for the link
        checkinToken = existing.token
      } else {
        // Not yet submitted: refresh token
        await supabase
          .from('weekly_checkins')
          .update({ token })
          .eq('id', existing.id)
        checkinToken = token
      }
    } else {
      // Create new checkin for this week
      await supabase
        .from('weekly_checkins')
        .insert({ member_id: member.id, week_of: weekOf, token })
    }

    const checkinUrl = `${APP_URL}/checkin/${checkinToken}`
    const html = memberEmailHtml(member.name, checkinUrl, weekLabel)

    memberEmails.push(
      sendEmail(member.email, `Your Circle Check-In is Ready — ${weekLabel}`, html)
        .catch((err: unknown) => console.error(`Failed to send to ${member.email}:`, err))
    )
  }

  await Promise.allSettled(memberEmails)

  // 3. Send admin reminder emails
  const { data: admins } = await supabase
    .from('profiles')
    .select('email')
    .in('role', ['owner', 'tech', 'admin', 'manager'])

  const adminEmails: Promise<unknown>[] = []

  for (const admin of (admins ?? [])) {
    if (!admin.email) continue
    const html = adminEmailHtml(activeMembers.length, weekLabel, APP_URL)
    adminEmails.push(
      sendEmail(admin.email, `Friday Reminder: Log Attendance + Check-Ins Sent`, html)
        .catch((err: unknown) => console.error(`Failed to send admin email to ${admin.email}:`, err))
    )
  }

  await Promise.allSettled(adminEmails)

  return NextResponse.json({
    success: true,
    week_of: weekOf,
    members_emailed: activeMembers.length,
    admins_emailed: (admins ?? []).length,
  })
}
