import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Roles permitted to edit a member's profile (mirrors admin layout staff gate, minus read-only support)
const EDITOR_ROLES = ['owner', 'admin', 'manager']
const EDITABLE_FIELDS = ['name', 'email', 'cohort', 'status', 'phone', 'city', 'instagram', 'website', 'bio'] as const
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
