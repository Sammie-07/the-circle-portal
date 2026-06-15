import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — send a portal magic link to an existing member
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'admin', 'manager'].includes(profile?.role ?? '')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const { data: member } = await supabase.from('members').select('id, name, invited_at').eq('email', email).single()
  if (!member) return NextResponse.json({ error: 'No member found with this email' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  })

  if (otpError) {
    return NextResponse.json({ error: otpError.message }, { status: 500 })
  }

  // Mark the member as invited (first time only) so the Friday check-in cron
  // starts including them. Best-effort — the invite already went out.
  if (!member.invited_at) {
    await supabase
      .from('members')
      .update({ invited_at: new Date().toISOString() })
      .eq('id', member.id)
  }

  return NextResponse.json({ success: true, sent_to: email })
}
