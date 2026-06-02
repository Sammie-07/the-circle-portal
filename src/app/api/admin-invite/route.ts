import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — register an admin invite and send magic link immediately
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { email, name } = await request.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  // Register the email so the trigger grants admin role on first login
  const { error: insertError } = await supabase
    .from('admin_invites')
    .upsert({ email, invited_by: user.id })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Send magic link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { full_name: name ?? email },
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  })

  if (otpError) {
    return NextResponse.json({ error: `Admin registered but email failed: ${otpError.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, sent_to: email })
}
