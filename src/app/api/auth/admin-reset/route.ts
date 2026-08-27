import { createClient } from '@/lib/supabase/server'
import { generateSigninLink } from '@/lib/auth-links'
import { brandedEmail, sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// POST — admin action: email a member a password reset link. Clicking it (through
// the /auth/confirm interstitial) verifies them and drops them on /set-password to
// choose a new password. Code stays as the fallback if the link ever fails.
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const { data: member } = await supabase.from('members').select('name').eq('email', email).maybeSingle()
  const firstName = (member?.name || '').split(' ')[0] || 'there'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'
  let link: string
  try {
    link = await generateSigninLink(email, appUrl, member?.name, 'reset')
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not generate reset link' }, { status: 500 })
  }

  const html = brandedEmail({
    eyebrow: 'Password Reset',
    heading: `Reset your Circle password, ${firstName}.`,
    body: [
      `Here's a link to reset your password for The Circle member portal.`,
      `Click below to verify it's you and choose a new password. If you weren't expecting this, you can safely ignore this email.`,
    ],
    cta: { text: 'Reset My Password →', url: link },
    note: 'If the button ever bounces you to the login page, use "Forgot your password?" there to reset it with a code instead.',
  })

  const sendRes = await sendEmail(email, 'Reset your Circle password', html, { disableClickTracking: true })
  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => '')
    return NextResponse.json({ error: `Email failed to send. ${detail}`.trim() }, { status: 500 })
  }

  return NextResponse.json({ success: true, sent_to: email })
}
