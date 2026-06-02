import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type TeamRole = 'admin' | 'manager' | 'support'

// POST — invite a team member with a specific role
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { email, name, role = 'admin' } = await request.json() as { email: string; name?: string; role?: TeamRole }
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const { error: insertError } = await supabase
    .from('admin_invites')
    .upsert({ email, invited_by: user.id, intended_role: role })

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
    return NextResponse.json({ error: `Invite registered but email failed: ${otpError.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, sent_to: email, role })
}

// DELETE — remove a team member (demote to member role)
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { profileId, email } = await request.json()
  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 })

  // Prevent removing yourself
  if (profileId === user.id) {
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 })
  }

  // Prevent removing owners
  const { data: target } = await supabase.from('profiles').select('role').eq('id', profileId).single()
  if (target?.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 400 })
  }

  // Demote to member
  await supabase.from('profiles').update({ role: 'member' }).eq('id', profileId)

  // Remove from admin_invites so they can't re-login and get team access
  if (email) {
    await supabase.from('admin_invites').delete().eq('email', email)
  }

  return NextResponse.json({ success: true })
}
