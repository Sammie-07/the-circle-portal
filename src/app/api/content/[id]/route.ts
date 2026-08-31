import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const STAFF = ['owner', 'admin', 'manager']

async function requireStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { userId: user.id }
}

interface Body {
  caption?: string
  hashtags?: string
  slides?: unknown
  art_direction?: string
  platform?: string
  status?: string
  feedback?: string
}

// PATCH /api/content/[id] — edit copy and/or change status (approve/reject/posted).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff()
  if ('error' in gate) return gate.error
  const { id } = await params

  let body: Body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.caption === 'string') { patch.caption = body.caption; patch.edited = true }
  if (typeof body.hashtags === 'string') { patch.hashtags = body.hashtags; patch.edited = true }
  if (Array.isArray(body.slides)) { patch.slides = body.slides; patch.edited = true }
  if (typeof body.art_direction === 'string') { patch.art_direction = body.art_direction; patch.edited = true }
  if (typeof body.feedback === 'string') patch.feedback = body.feedback.trim() || null
  if (body.platform && ['instagram', 'facebook', 'both'].includes(body.platform)) patch.platform = body.platform
  if (body.status && ['draft', 'approved', 'rejected', 'posted'].includes(body.status)) {
    patch.status = body.status
    if (body.status === 'approved') patch.approved_by = gate.userId
    if (body.status === 'posted') patch.posted_at = new Date().toISOString()
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('content_posts').update(patch).eq('id', id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, post: data })
}

// DELETE /api/content/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff()
  if ('error' in gate) return gate.error
  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('content_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
