import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, after } from 'next/server'
import { editBlueprintForRevision } from '@/lib/blueprint-shell'

// The AI edit can take a while, so give the function room. `after()` runs the
// edit + notification once the member already has their confirmation.
export const maxDuration = 300
export const runtime = 'nodejs'

interface Answer { question: string; answer: string }

// POST /api/blueprint-revision/[token]/submit
// Public — authenticated by the unguessable token only (service-role client,
// same pattern as the weekly check-in). The member submits their new
// idea/direction; we save it and confirm immediately. Then, in the background,
// we EDIT their existing blueprint to accommodate the changes and, once that's
// done, notify admins to review the updated draft and send it live.
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

  // Edit the blueprint into a DRAFT, THEN notify admins — after the member's response.
  after(async () => {
    try {
      await applyRevisionAndNotify(supabase, revision.member_id, revision.id, answers)
    } catch (err) {
      console.error('[Revision] background apply failed:', err instanceof Error ? err.message : String(err))
    }
  })

  return NextResponse.json({ success: true })
}

// Edit the member's existing blueprint to accommodate their new direction and
// store the result as a DRAFT (leaving the live blueprint untouched so the member
// sees no gap), then notify admins that a draft is ready to review and publish.
async function applyRevisionAndNotify(
  supabase: SupabaseClient,
  memberId: string,
  revisionId: string,
  answers: Answer[]
) {
  const { data: member } = await supabase
    .from('members')
    .select('name, blueprint_html')
    .eq('id', memberId)
    .single()

  const memberName = member?.name ?? 'A member'
  let applied = false

  if (member?.blueprint_html) {
    try {
      const newHtml = await editBlueprintForRevision({
        existingHtml: member.blueprint_html,
        memberName,
        answers,
      })

      // Store as a draft only — the live blueprint stays exactly as-is until an
      // admin publishes the draft. No archiving here; that happens at publish,
      // when the live version is actually replaced.
      await supabase
        .from('members')
        .update({
          blueprint_draft_html: newHtml,
          blueprint_draft_generated_at: new Date().toISOString(),
          blueprint_draft_revision_id: revisionId,
        })
        .eq('id', memberId)

      applied = true
    } catch (err) {
      console.error('[Revision] blueprint edit failed:', err instanceof Error ? err.message : String(err))
      applied = false
    }
  }

  await notifyAdmins(supabase, memberName, memberId, answers, applied)
}

async function notifyAdmins(
  supabase: SupabaseClient,
  memberName: string,
  memberId: string,
  answers: Answer[],
  applied: boolean
) {
  const title = applied
    ? `${memberName}'s revised blueprint draft is ready`
    : `${memberName} submitted a blueprint revision`
  const bellBody = applied
    ? 'Preview the draft, then publish it to make it live for them.'
    : 'Auto-update didn’t run — open their blueprint to regenerate.'

  // Bell notification (appears in the admin top-bar bell). Dedupe per member so
  // repeat runs don't stack; the newest submission is what matters.
  await supabase.from('admin_notifications').insert({
    type: 'revision_submitted',
    member_id: memberId,
    member_name: memberName,
    emoji: '📝',
    title,
    body: bellBody,
    dedupe_key: `revision:${memberId}:${Date.now()}`,
  })

  // Email admins
  const { data: teamProfiles } = await supabase
    .from('profiles')
    .select('email')
    .in('role', ['owner', 'admin', 'manager'])

  const adminEmails = (teamProfiles ?? []).map(p => p.email).filter(Boolean)

  if (adminEmails.length > 0 && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
    const html = buildNotificationEmail(memberName, answers, applied)
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
            subject: title,
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

function buildNotificationEmail(memberName: string, answers: Answer[], applied: boolean): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'
  const lead = applied
    ? 'A revised draft of their blueprint is ready. Preview it in the portal, then publish it to make it live for them.'
    : 'The automatic update did not run, so open their blueprint and regenerate it from these answers.'

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
            ${esc(memberName)} updated their direction.
          </h1>
          <p style="margin:8px 0 0;font-size:13px;color:#999;line-height:1.6;">${lead}</p>
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
                  Review in Portal →
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
