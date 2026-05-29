import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { name, email, cohort } = await request.json()
  if (!name || !email) {
    return NextResponse.json({ error: 'name and email required' }, { status: 400 })
  }

  // Check if member already exists
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'A member with this email already exists' }, { status: 409 })
  }

  // Create the member record
  const { data: member, error: memberError } = await supabase
    .from('members')
    .insert({ name, email, cohort: cohort || null })
    .select()
    .single()

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // Send magic link — member gets a one-click login email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  })

  if (otpError) {
    // Member record created, magic link failed — still a partial success
    console.error('Magic link failed:', otpError.message)
    return NextResponse.json({
      member,
      warning: `Member added but login email failed: ${otpError.message}. They can still log in at the portal.`,
    })
  }

  return NextResponse.json({ member, invited: true })
}
