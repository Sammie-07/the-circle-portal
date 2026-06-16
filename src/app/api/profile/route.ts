import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePortalContext } from '@/lib/portalContext'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  // Resolve the same portal context the profile page uses: normally the caller's
  // own member record; during staff impersonation, the member being previewed.
  // This makes "Save Changes" target the right person in both cases.
  const ctx = await resolvePortalContext()
  if (!ctx.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.member) {
    return NextResponse.json({ error: 'No member profile found for your account.' }, { status: 404 })
  }
  const memberId = ctx.member.id as string

  const body = await request.json()

  // Only allow safe editable fields — not email (login email), not admin-only fields
  const allowed = ['name', 'phone', 'city', 'instagram', 'website', 'bio']
  const updates: Record<string, string | null> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] ?? null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // The `members` table has no RLS policy letting a member update their own row
  // (only admins can), so use the service-role client. The target member id comes
  // from the resolved context above, so a member can only edit their own profile.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('members')
    .update(updates)
    .eq('id', memberId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No member profile found for your account.' }, { status: 404 })

  return NextResponse.json({ member: data })
}
