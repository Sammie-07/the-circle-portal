import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface Answer { question: string; answer: string }

// POST /api/blueprint-revision/[token]/submit
// Public — authenticated by the unguessable token only (service-role client,
// same pattern as the weekly check-in). The member submits their new
// idea/direction; we save it, confirm instantly, and notify admins that a
// revision has been requested. The admin then generates the updated blueprint
// with one click from the member's page (a visible, reliable step).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: revision } = await supabase
    .from('blueprint_revisions')
    .select('id, member_id, status')
    .eq('token', token)
    .single()

  if (!revision) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (revision.status !== 'sent') return NextResponse.json({ error: 'Already submitted' }, { status: 400 })

  const body = await request.json() as { answers?: Answer[] }
  const answers = (body.answers ?? []).filter(a => a && typeof a.answer === 'string')

  if (!answers.some(a => a.answer.trim())) {
    return NextResponse.json({ error: 'Please answer at least one question' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('blueprint_revisions')
    .update({ answers, submitted_at: new Date().toISOString(), status: 'submitted' })
    .eq('id', revision.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Notify admins (best-effort — never fail the member's submission over it).
  try {
    await notifyAdmins(supabase, revision.member_id, answers)
  } catch (err) {
    console.error('[Revision] notify failed:', err instanceof Error ? err.message : String(err))
  }

  return NextResponse.json({ success: true })
}

async function notifyAdmins(supabase: SupabaseClient, memberId: string, answers: Answer[]) {
  const { data: member } = await supabase.from('members').select('name').eq('id', memberId).single()
  const memberName = member?.name ?? 'A member'

  await supabase.from('admin_notifications').insert({
    type: 'revision_submitted',
    member_id: memberId,
    member_name: memberName,
    emoji: '📝',
    title: `${memberName} requested a blueprint revision`,
    body: 'Open their blueprint to generate the update, then publish it.',
    dedupe_key: `revision:${memberId}:${Date.now()}`,
  })

  const { data: teamProfiles } = await supabase
    .from('profiles')
    .select('email')
    .in('role', ['owner', 'admin', 'manager'])

  const adminEmails = (teamProfiles ?? []).map(p => p.email).filter(Boolean)

  if (adminEmails.length > 0 && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
    const html = buildNotificationEmail(memberName, answers)
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
            subject: `${memberName} requested a blueprint revision`,
            content: [{ type: 'text/html', value: html }],
          }),
        })
      )
    )
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildNotificationEmail(memberName: string, answers: Answer[]): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'
  const answersHtml = answers.map(a => `
    <tr><td style="padding:14px 0;border-bottom:1px solid #1A1A1A;">
      <p style="margin:0 0 6px;font-size:11px;color:#C9A227;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">${esc(a.question)}</p>
      <p style="margin:0;font-size:14px;color:#CCCCCC;line-height:1.6;">${a.answer.trim() ? esc(a.answer).replace(/\n/g, '<br>') : '<span style="color:#555;">— no answer —</span>'}</p>
    </td></tr>`).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#090909;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#090909;padding:40px 20px;">
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
          <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#C9A227;">Blueprint Revision</p>
        </td></tr>

        <tr><td style="padding-bottom:20px;">
          <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;color:#FFFFFF;font-weight:normal;">
            ${esc(memberName)} requested a revision.
          </h1>
          <p style="margin:8px 0 0;font-size:13px;color:#999;line-height:1.6;">Open their blueprint in the portal, generate the update from these answers, then publish it.</p>
        </td></tr>

        <tr><td>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0E0E0E;border:1px solid #1A1A1A;border-radius:6px;padding:4px 18px;">
            ${answersHtml}
          </table>
        </td></tr>

        <tr><td style="padding-top:28px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#C9A227;border-radius:6px;">
                <a href="${appUrl}/admin" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#090909;text-decoration:none;">
                  Open Portal →
                </a>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="border-top:1px solid #1A1A1A;padding-top:24px;margin-top:32px;">
          <p style="margin:0;font-size:12px;color:#444444;">The Circle · Admin Notification</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
