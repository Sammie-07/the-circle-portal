import { createClient } from '@/lib/supabase/server'
import { generateSigninLink } from '@/lib/auth-links'
import { brandedEmail, sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type TeamRole = 'admin' | 'manager' | 'support'

const ROLE_LABEL: Record<string, string> = {
  admin: 'an Admin',
  manager: 'a Manager',
  support: 'Support',
}

// POST — invite a team member with a specific role
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'tech', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { email, name, role = 'admin' } = await request.json() as { email: string; name?: string; role?: TeamRole }
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const { error: insertError } = await supabase
    .from('admin_invites')
    .upsert({ email, invited_by: user.id, intended_role: role })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Generate a sign-in link and send our own branded email (no plain Supabase email).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  let link: string
  try {
    link = await generateSigninLink(email, appUrl, name ?? email)
  } catch (err) {
    return NextResponse.json({ error: `Invite registered but link failed: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 500 })
  }

  const firstName = (name || '').split(' ')[0] || 'there'
  const html = brandedEmail({
    eyebrow: 'Team Invitation',
    heading: `You're on the team, ${firstName}.`,
    body: [
      `You've been added to The Circle admin portal as <strong style="color:#FFFFFF;">${ROLE_LABEL[role] ?? 'a team member'}</strong>.`,
      `From here you'll help run the program: members, reports, attendance, payments, and more.`,
      `Click below to sign in and get started.`,
    ],
    cta: { text: 'Accept & Sign In →', url: link },
    note: 'For security this sign-in link expires after about an hour. If it stops working, ask to be re-invited.',
    footer: 'The Circle · Admin Portal',
  })

  const sendRes = await sendEmail(email, "You've been added to The Circle team", html)
  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => '')
    return NextResponse.json({ error: `Invite registered but email failed. ${detail}`.trim() }, { status: 500 })
  }

  return NextResponse.json({ success: true, sent_to: email, role })
}

// DELETE — remove a team member (demote to member role)
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'tech', 'admin'].includes(profile?.role ?? '')) {
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
