import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// POST — submit a weekly check-in (public, authenticated by token only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: checkin } = await supabase
    .from('weekly_checkins')
    .select('id, member_id, week_of, submitted_at')
    .eq('token', token)
    .single()

  if (!checkin) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (checkin.submitted_at) return NextResponse.json({ error: 'Already submitted' }, { status: 400 })

  const body = await request.json() as { completedIds: string[]; shownIds: string[]; comments: string }
  const { completedIds = [], shownIds = [], comments = '' } = body

  const completedSet = new Set(completedIds)

  // Update homework completion status for all shown tasks
  if (shownIds.length > 0) {
    if (completedIds.length > 0) {
      await supabase
        .from('homework')
        .update({ completed: true })
        .in('id', completedIds)
        .eq('member_id', checkin.member_id)
    }

    const uncheckedIds = shownIds.filter(id => !completedSet.has(id))
    if (uncheckedIds.length > 0) {
      await supabase
        .from('homework')
        .update({ completed: false })
        .in('id', uncheckedIds)
        .eq('member_id', checkin.member_id)
    }
  }

  // Mark checkin submitted
  await supabase
    .from('weekly_checkins')
    .update({ submitted_at: new Date().toISOString(), comments: comments || null })
    .eq('id', checkin.id)

  // ── Notify admins ──────────────────────────────────────────────────────────

  // Get member name
  const { data: member } = await supabase
    .from('members')
    .select('name')
    .eq('id', checkin.member_id)
    .single()

  // Get homework details for shown tasks
  const { data: homeworkItems } = await supabase
    .from('homework')
    .select('id, title')
    .in('id', shownIds)

  // Get all admin + manager emails
  const { data: teamProfiles } = await supabase
    .from('profiles')
    .select('email')
    .in('role', ['owner', 'admin', 'manager'])

  const adminEmails = (teamProfiles ?? []).map(p => p.email).filter(Boolean)

  if (adminEmails.length > 0 && member) {
    const weekLabel = getWeekLabel(checkin.week_of)
    const memberName = member.name
    const completedTasks = (homeworkItems ?? []).filter(h => completedSet.has(h.id))
    const missedTasks = (homeworkItems ?? []).filter(h => !completedSet.has(h.id))

    const html = buildNotificationEmail(memberName, weekLabel, completedTasks, missedTasks, comments)

    await Promise.allSettled(
      adminEmails.map(email =>
        fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: process.env.SENDGRID_FROM_EMAIL! },
            subject: `${memberName} submitted their Weekly Check-In`,
            content: [{ type: 'text/html', value: html }],
          }),
        })
      )
    )
  }

  return NextResponse.json({ success: true })
}

function getWeekLabel(weekOf: string): string {
  const d = new Date(weekOf + 'T00:00:00Z')
  const friday = new Date(d)
  friday.setUTCDate(d.getUTCDate() + 4)
  return friday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function buildNotificationEmail(
  memberName: string,
  weekLabel: string,
  completedTasks: { id: string; title: string }[],
  missedTasks: { id: string; title: string }[],
  comments: string
): string {
  const completedHtml = completedTasks.length > 0
    ? completedTasks.map(t => `
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #2A2A2A;">
            <span style="color:#C9A227;margin-right:8px;">✓</span>
            <span style="color:#FFFFFF;font-size:14px;">${t.title}</span>
          </td>
        </tr>`).join('')
    : `<tr><td style="padding:8px 0;color:#555555;font-size:13px;">No tasks completed</td></tr>`

  const missedHtml = missedTasks.length > 0
    ? missedTasks.map(t => `
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #2A2A2A;">
            <span style="color:#555555;margin-right:8px;">✗</span>
            <span style="color:#888888;font-size:14px;">${t.title}</span>
          </td>
        </tr>`).join('')
    : ''

  const commentsHtml = comments
    ? `
      <tr><td style="padding-top:24px;">
        <p style="margin:0 0 8px;font-size:11px;color:#C9A227;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Notes from ${memberName.split(' ')[0]}</p>
        <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-left:3px solid #C9A227;border-radius:4px;padding:14px;">
          <p style="margin:0;font-size:14px;color:#CCCCCC;line-height:1.6;">${comments.replace(/\n/g, '<br>')}</p>
        </div>
      </td></tr>`
    : ''

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <tr><td style="padding-bottom:28px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:26px;height:26px;border:1.5px solid #CC1F1F;border-radius:50%;text-align:center;">
                <div style="width:8px;height:8px;background:#CC1F1F;border-radius:50%;margin:8px auto 0;"></div>
              </td>
              <td style="padding-left:10px;font-family:Georgia,serif;font-size:14px;color:#FFFFFF;">The Circle</td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding-bottom:6px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#C9A227;">Weekly Check-In</p>
        </td></tr>

        <tr><td style="padding-bottom:24px;">
          <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;color:#FFFFFF;font-weight:normal;">
            ${memberName} checked in.
          </h1>
          <p style="margin:6px 0 0;font-size:13px;color:#555555;">Week of ${weekLabel}</p>
        </td></tr>

        <tr><td style="padding-bottom:6px;">
          <p style="margin:0;font-size:11px;color:#C9A227;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">
            Completed (${completedTasks.length}/${completedTasks.length + missedTasks.length})
          </p>
        </td></tr>

        <tr><td style="padding-bottom:16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:6px;padding:4px 16px;">
            ${completedHtml}
            ${missedHtml}
          </table>
        </td></tr>

        ${commentsHtml}

        <tr><td style="padding-top:28px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#C9A227;border-radius:6px;">
                <a href="${appUrl}/admin" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#0D0D0D;text-decoration:none;">
                  Open Portal →
                </a>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="border-top:1px solid #2A2A2A;padding-top:24px;margin-top:32px;">
          <p style="margin:0;font-size:12px;color:#444444;">The Circle · Admin Notification</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
