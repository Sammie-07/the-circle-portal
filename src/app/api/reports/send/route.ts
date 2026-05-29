import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function buildEmail(memberName: string, periodLabel: string, periodType: string, reportUrl: string): string {
  const typeLabel = periodType === 'monthly' ? 'Monthly' : periodType === 'quarterly' ? 'Quarterly' : 'Annual'
  const firstName = memberName.split(' ')[0]

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your ${periodLabel} Circle Report</title>
</head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:48px 24px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:36px;height:36px;border-radius:50%;border:2px solid #CC1F1F;margin:0 auto 12px;display:inline-flex;align-items:center;justify-content:center;">
        <div style="width:6px;height:6px;border-radius:50%;background:#CC1F1F;"></div>
      </div>
      <p style="color:#C9A227;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;margin:0;">
        The Circle &middot; Coaching Program
      </p>
    </div>

    <!-- Divider -->
    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,162,39,0.35),transparent);margin-bottom:36px;"></div>

    <!-- Heading -->
    <h1 style="color:#F5F5F5;font-family:Georgia,serif;font-size:26px;font-weight:normal;margin:0 0 8px;text-align:center;">
      Your ${typeLabel} Report Is Ready
    </h1>
    <p style="color:#555;font-size:13px;text-align:center;margin:0 0 36px;letter-spacing:0.05em;">
      ${periodLabel}
    </p>

    <!-- Body copy -->
    <p style="color:#888;font-size:15px;line-height:1.7;margin:0 0 12px;">
      ${firstName},
    </p>
    <p style="color:#888;font-size:15px;line-height:1.7;margin:0 0 32px;">
      Your ${periodLabel.toLowerCase()} progress report is ready. It reflects your attendance, homework, and where you stand against your blueprint — written in Gogo&rsquo;s voice after reviewing your data.
    </p>

    <!-- CTA button -->
    <div style="text-align:center;margin-bottom:40px;">
      <a href="${reportUrl}" style="
        display:inline-block;
        background:#C9A227;color:#0D0D0D;
        font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;
        letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;
        padding:14px 36px;border-radius:3px;
      ">
        Read Your Report &rarr;
      </a>
    </div>

    <p style="color:#444;font-size:13px;line-height:1.6;text-align:center;margin:0 0 8px;">
      Or copy this link into your browser:
    </p>
    <p style="text-align:center;margin:0 0 40px;">
      <a href="${reportUrl}" style="color:#C9A227;font-size:12px;word-break:break-all;text-decoration:none;">${reportUrl}</a>
    </p>

    <!-- Divider -->
    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(42,42,42,0.8),transparent);margin-bottom:24px;"></div>

    <p style="color:#333;font-size:11px;text-align:center;letter-spacing:0.1em;margin:0;">
      THE CIRCLE &middot; GOGOBETHKE.COM &middot; CONFIDENTIAL
    </p>
  </div>
</body>
</html>`
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const { report_id } = await request.json()
    if (!report_id) return NextResponse.json({ error: 'report_id required' }, { status: 400 })

    const { data: report } = await supabase
      .from('reports')
      .select('*, members(name, email)')
      .eq('id', report_id)
      .single()

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const member = report.members as { name: string; email: string }
    if (!member?.email) return NextResponse.json({ error: 'Member has no email address on file' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://circle.gogobethke.com'
    const reportUrl = `${appUrl}/r/${report.share_token}`

    const subject = `Your ${report.period_label} Circle Report`

    const sgPayload = {
      personalizations: [
        {
          to: [{ email: member.email, name: member.name }],
          subject,
        },
      ],
      from: {
        email: process.env.SENDGRID_FROM_EMAIL ?? 'adriana@gogosrealestate.com',
        name: 'The Circle · Gogo Bethke',
      },
      subject,
      content: [{ type: 'text/html', value: buildEmail(member.name, report.period_label, report.period_type, reportUrl) }],
    }

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
      console.error('[Report Send] SendGrid error:', err)
      return NextResponse.json({ error: err }, { status: 500 })
    }

    await supabase
      .from('reports')
      .update({ sent_at: new Date().toISOString(), sent_by: user.id })
      .eq('id', report_id)

    return NextResponse.json({ success: true, sent_to: member.email })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Report Send] Unhandled error:', msg)
    return NextResponse.json({ error: `Unexpected error: ${msg}` }, { status: 500 })
  }
}
