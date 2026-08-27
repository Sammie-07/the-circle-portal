import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// POST — verify an email login code and establish the session (cookies
// are set on the SSR client). Returns the role-appropriate redirect path.
export async function POST(request: Request) {
  let email: string
  let token: string
  try {
    const body = await request.json()
    email = String(body.email ?? '').trim()
    token = String(body.token ?? '').trim().replace(/\s+/g, '')
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!email || !token) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
  }

  const supabase = await createClient()

  // The OTP paired with a magic link verifies under type 'email'; fall back to
  // 'magiclink' across Supabase versions so a valid code always works.
  let verified = false
  for (const type of ['email', 'magiclink'] as EmailOtpType[]) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type })
    if (!error) { verified = true; break }
  }
  if (!verified) {
    return NextResponse.json({ error: 'That code is invalid or has expired. Request a new one.' }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Could not establish a session. Please try again.' }, { status: 400 })
  }

  // Ensure a profile row exists (mirrors /auth/confirm).
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile) {
    await supabase.from('profiles').insert({ id: user.id, role: 'member', full_name: user.email })
  }

  // Code/link are used only for first-time setup or a password reset, so send
  // them to choose a password next.
  return NextResponse.json({ success: true, redirect: '/set-password' })
}
