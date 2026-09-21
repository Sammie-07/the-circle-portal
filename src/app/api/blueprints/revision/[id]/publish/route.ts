import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/blueprints/revision/[id]/publish
// Promotes a revision's draft blueprint to live: archives the current live
// version, swaps the draft into blueprint_html, marks it sent to the member
// (which publishes it to their portal), clears the draft, marks the revision
// approved, and emails the member that their updated blueprint is ready.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'tech', 'admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { data: revision } = await supabase
    .from('blueprint_revisions')
    .select('id, member_id, status')
    .eq('id', id)
    .single()

  if (!revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
  if (revision.status !== 'submitted') {
    return NextResponse.json({ error: `Revision is ${revision.status}, not submitted` }, { status: 400 })
  }

  const { data: member } = await supabase
    .from('members')
    .select('name, email, blueprint_html, blueprint_data, blueprint_generated_at, blueprint_sent_to_member_at, blueprint_draft_html, blueprint_draft_generated_at, blueprint_share_token')
    .eq('id', revision.member_id)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (!member.blueprint_draft_html) {
    return NextResponse.json({ error: 'No revised draft to publish' }, { status: 400 })
  }

  // Archive the current live blueprint before the draft replaces it.
  if (member.blueprint_html) {
    const { error: archiveError } = await supabase.from('blueprint_versions').insert({
      member_id: revision.member_id,
      html: member.blueprint_html,
      data: member.blueprint_data ?? null,
      source: 'pre-revision',
      generated_at: member.blueprint_generated_at ?? null,
      sent_to_member_at: member.blueprint_sent_to_member_at ?? null,
    })
    if (archiveError) console.error('[Revision publish] archive failed (non-fatal):', archiveError.message)
  }

  const now = new Date().toISOString()
  const shareToken = member.blueprint_share_token ?? crypto.randomUUID()
  const newHtml = member.blueprint_draft_html

  const { error: updateError } = await supabase
    .from('members')
    .update({
      blueprint_html: newHtml,
      blueprint_generated_at: member.blueprint_draft_generated_at ?? now,
      blueprint_share_token: shareToken,
      blueprint_sent_to_member_at: now, // publishes to the member's portal
      blueprint_draft_html: null,
      blueprint_draft_generated_at: null,
      blueprint_draft_revision_id: null,
    })
    .eq('id', revision.member_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase
    .from('blueprint_revisions')
    .update({ status: 'approved', reviewed_at: now, reviewed_by: user.id })
    .eq('id', revision.id)

  // Email the member that their updated blueprint is live (best-effort).
  let emailed = false
  if (member.email && process.env.SENDGRID_API_KEY) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://circle.gogobethke.com'
    const blueprintUrl = `${baseUrl}/b/${shareToken}`
    try {
      const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: member.email, name: member.name }] }],
          from: {
            email: process.env.SENDGRID_FROM_EMAIL ?? 'admin@gogosrealestate.com',
            name: 'The Circle · Gogo Bethke',
          },
          subject: `Your updated Circle Blueprint is ready, ${member.name}`,
          content: [{ type: 'text/html', value: buildMemberEmail(member.name, blueprintUrl) }],
        }),
      })
      emailed = sgRes.ok
      if (!sgRes.ok) console.error('[Revision publish] SendGrid error:', await sgRes.text())
    } catch (e) {
      console.error('[Revision publish] email failed (non-fatal):', e instanceof Error ? e.message : String(e))
    }
  }

  return NextResponse.json({ success: true, blueprint_html: newHtml, share_token: shareToken, emailed })
}

function buildMemberEmail(memberName: string, blueprintUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#090909;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:48px 32px;">
    <div style="text-align:center;margin-bottom:40px;">
      <div style="width:44px;height:44px;border-radius:50%;border:2px solid #CC1F1F;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <div style="width:8px;height:8px;border-radius:50%;background:#CC1F1F;"></div>
      </div>
      <p style="color:#C9A227;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;margin:0;">The Circle · Coaching Program</p>
    </div>
    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,162,39,0.4),transparent);margin-bottom:40px;"></div>
    <h1 style="color:#fff;font-family:Georgia,serif;font-size:26px;font-weight:normal;margin:0 0 20px;line-height:1.2;">Your Blueprint Has Been Updated</h1>
    <p style="color:#aaa;font-size:15px;line-height:1.7;margin:0 0 28px;">
      Based on the new direction you shared, your 12-month business blueprint has been updated. Everything else stays as it was, only the parts tied to your new focus have changed.
    </p>
    <div style="text-align:center;margin:36px 0;">
      <a href="${blueprintUrl}" style="display:inline-block;background:#C9A227;color:#090909;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.05em;text-decoration:none;padding:14px 36px;border-radius:3px;">Open Your Updated Blueprint →</a>
    </div>
    <p style="color:#555;font-size:11px;text-align:center;margin:0 0 4px;">Or copy this link:</p>
    <p style="color:#666;font-size:11px;text-align:center;word-break:break-all;margin:0 0 40px;">${blueprintUrl}</p>
    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(42,42,42,0.8),transparent);margin-bottom:24px;"></div>
    <p style="color:#444;font-size:11px;text-align:center;margin:0;letter-spacing:0.1em;">THE CIRCLE · GOGOBETHKE.COM · CONFIDENTIAL</p>
  </div>
</body>
</html>`
}
