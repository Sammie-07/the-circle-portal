import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function buildEmailHtml(opts: {
  memberName: string
  recipientType: 'gogo' | 'member'
  blueprintUrl: string
}): string {
  const { memberName, recipientType, blueprintUrl } = opts

  const heading = recipientType === 'gogo'
    ? `Blueprint Ready for Review`
    : `Your 12-Month Business Blueprint`

  const body = recipientType === 'gogo'
    ? `<p style="color:#aaa;font-size:15px;line-height:1.7;margin:0 0 28px;">
        The clarity call blueprint for <strong style="color:#fff;">${memberName}</strong> has been generated and is ready for your review.
       </p>`
    : `<p style="color:#aaa;font-size:15px;line-height:1.7;margin:0 0 28px;">
        Your personalized 12-month business plan is ready. Gogo has put together everything we discussed on your clarity call — your strengths, your challenges, your hire sequence, and your full quarterly roadmap.
       </p>`

  const buttonLabel = recipientType === 'gogo' ? 'Review Blueprint →' : 'Open Your Blueprint →'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:48px 32px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:40px;">
      <div style="width:44px;height:44px;border-radius:50%;border:2px solid #CC1F1F;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <div style="width:8px;height:8px;border-radius:50%;background:#CC1F1F;"></div>
      </div>
      <p style="color:#C9A227;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;margin:0;">
        The Circle · Coaching Program
      </p>
    </div>

    <!-- Divider -->
    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,162,39,0.4),transparent);margin-bottom:40px;"></div>

    <!-- Heading -->
    <h1 style="color:#fff;font-family:Georgia,serif;font-size:26px;font-weight:normal;margin:0 0 20px;line-height:1.2;">
      ${heading}
    </h1>

    <!-- Body -->
    ${body}

    <!-- CTA Button -->
    <div style="text-align:center;margin:36px 0;">
      <a href="${blueprintUrl}" style="display:inline-block;background:#C9A227;color:#0D0D0D;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.05em;text-decoration:none;padding:14px 36px;border-radius:3px;">
        ${buttonLabel}
      </a>
    </div>

    <!-- URL fallback -->
    <p style="color:#555;font-size:11px;text-align:center;margin:0 0 4px;">Or copy this link:</p>
    <p style="color:#666;font-size:11px;text-align:center;word-break:break-all;margin:0 0 40px;">
      ${blueprintUrl}
    </p>

    <!-- Divider -->
    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(42,42,42,0.8),transparent);margin-bottom:24px;"></div>

    <!-- Footer -->
    <p style="color:#444;font-size:11px;text-align:center;margin:0;letter-spacing:0.1em;">
      THE CIRCLE · GOGOBETHKE.COM · CONFIDENTIAL
    </p>
  </div>
</body>
</html>`
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { member_id, recipient } = await request.json()
  if (!member_id || !recipient) return NextResponse.json({ error: 'member_id and recipient required' }, { status: 400 })
  if (!['gogo', 'member'].includes(recipient)) return NextResponse.json({ error: 'recipient must be gogo or member' }, { status: 400 })

  const { data: member } = await supabase.from('members').select('*').eq('id', member_id).single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (!member.blueprint_html) return NextResponse.json({ error: 'Blueprint not generated yet' }, { status: 400 })
  if (!member.blueprint_share_token) return NextResponse.json({ error: 'Blueprint share token missing' }, { status: 400 })

  const toEmail = recipient === 'gogo'
    ? (process.env.GOGO_EMAIL ?? 'gogosrealestate@gmail.com')
    : member.email

  if (!toEmail) return NextResponse.json({ error: 'Member has no email address on file' }, { status: 400 })

  const toName = recipient === 'gogo' ? 'Gogo Bethke' : member.name

  const subject = recipient === 'gogo'
    ? `Blueprint Ready for Review — ${member.name}`
    : `Your 12-Month Circle Blueprint is Ready, ${member.name}`

  // Build the blueprint URL — use the public share link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://circle.gogobethke.com'
  const blueprintUrl = `${baseUrl}/b/${member.blueprint_share_token}`

  const emailHtml = buildEmailHtml({
    memberName: member.name,
    recipientType: recipient as 'gogo' | 'member',
    blueprintUrl,
  })

  const sgPayload = {
    personalizations: [
      {
        to: [{ email: toEmail, name: toName }],
        subject,
      },
    ],
    from: {
      email: process.env.SENDGRID_FROM_EMAIL ?? 'admin@gogosrealestate.com',
      name: 'The Circle · Gogo Bethke',
    },
    subject,
    content: [{ type: 'text/html', value: emailHtml }],
  }

  // Mark as sent BEFORE calling SendGrid so the portal is never blocked by email failures.
  // For member sends, this also publishes the blueprint to their portal.
  const now = new Date().toISOString()
  const updateField = recipient === 'gogo'
    ? { blueprint_sent_to_gogo_at: now }
    : { blueprint_sent_to_member_at: now }

  await supabase.from('members').update(updateField).eq('id', member_id)

  const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sgPayload),
  })

  if (!sgRes.ok) {
    const err = await sgRes.text()
    console.error('[Blueprint Send] SendGrid error:', err)
    // Timestamp is already saved — portal access is live. Email failed but that's recoverable.
    return NextResponse.json({ error: `Email failed to send: ${err}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, sent_to: toEmail })
}
