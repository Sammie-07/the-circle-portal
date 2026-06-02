import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type TeamRole = 'admin' | 'manager' | 'support'

// PATCH — change a team member's role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'admin'].includes(me?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { role } = await request.json() as { role: TeamRole }
  if (!['admin', 'manager', 'support'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Get target profile
  const { data: target } = await supabase.from('profiles').select('role').eq('id', profileId).single()
  if (!target) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Only owner can change an admin's role
  if (target.role === 'admin' && me?.role !== 'owner') {
    return NextResponse.json({ error: 'Only the owner can change an admin\'s role' }, { status: 403 })
  }

  // Cannot change owner's role
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Cannot change the owner\'s role' }, { status: 400 })
  }

  await supabase.from('profiles').update({ role }).eq('id', profileId)

  // Also update admin_invites so future logins get the right role
  const { data: targetUser } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', profileId)
    .single()

  if (targetUser?.email) {
    await supabase
      .from('admin_invites')
      .update({ intended_role: role })
      .eq('email', targetUser.email)
  }

  return NextResponse.json({ success: true, role })
}
