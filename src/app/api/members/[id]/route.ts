import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Roles permitted to edit a member's profile (mirrors admin layout staff gate, minus read-only support)
const EDITOR_ROLES = ['owner', 'admin', 'manager']
// Deleting a member is more sensitive than editing — owner/admin only
const DELETER_ROLES = ['owner', 'admin']
const EDITABLE_FIELDS = ['name', 'email', 'cohort', 'status', 'phone', 'city', 'instagram', 'website', 'bio', 'join_date'] as const
const VALID_STATUS = ['active', 'inactive', 'graduated']

// PATCH — staff edit of a member's profile
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  const updates: Record<string, string | null> = {}
  for (const key of EDITABLE_FIELDS) {
    if (key in body) updates[key] = body[key] ?? null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Validation
  if ('name' in updates && (!updates.name || !updates.name.trim())) {
    return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
  }
  if ('email' in updates) {
    if (!updates.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
  }
  if ('status' in updates && updates.status && !VALID_STATUS.includes(updates.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  // join_date drives the member's program quarter — accept a YYYY-MM-DD date or null.
  if ('join_date' in updates && updates.join_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(updates.join_date) || Number.isNaN(new Date(updates.join_date + 'T00:00:00').getTime())) {
      return NextResponse.json({ error: 'Invalid program start date' }, { status: 400 })
    }
  }

  // Role check above is the security boundary. Use admin client so RLS doesn't block manager edits.
  const db = createAdminClient()
  const { data, error } = await db
    .from('members')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A member with that email already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ member: data })
}

// DELETE — permanently remove a member, their auth account, and storage. Owner/admin only.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!DELETER_ROLES.includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createAdminClient()

  const { data: member } = await db.from('members').select('id, user_id').eq('id', id).single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Delete the member row — cascades weekly_logs + reports.
  const { error: delError } = await db.from('members').delete().eq('id', id)
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  // Delete the auth account if linked — profiles row cascades from auth.users deletion.
  if (member.user_id) {
    const { error: authError } = await db.auth.admin.deleteUser(member.user_id)
    if (authError) console.warn('[MemberDelete] auth user deletion failed:', authError.message)
  }

  // Best-effort storage cleanup — never fail the request on storage errors.
  try {
    const { data: files } = await db.storage.from('blueprints').list(id)
    if (files && files.length > 0) {
      await db.storage.from('blueprints').remove(files.map(f => `${id}/${f.name}`))
    }
  } catch (err) {
    console.warn('[MemberDelete] storage cleanup failed:', err instanceof Error ? err.message : String(err))
  }

  return NextResponse.json({ ok: true })
}
