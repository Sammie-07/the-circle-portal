import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const EDITOR_ROLES = new Set(['owner', 'admin', 'manager'])

// PATCH /api/clarity-calls/[id] — partial update of title/video_url/call_date/notes
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, string | null> = {}

  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    updates.title = title
  }
  if (body.video_url !== undefined) {
    const videoUrl = typeof body.video_url === 'string' ? body.video_url.trim() : ''
    if (!videoUrl) return NextResponse.json({ error: 'Video URL cannot be empty' }, { status: 400 })
    updates.video_url = videoUrl
  }
  if (body.call_date !== undefined) updates.call_date = body.call_date || null
  if (body.notes !== undefined) {
    updates.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('clarity_calls')
    .update(updates)
    .eq('id', id)
    .select('id, member_id, title, video_url, call_date, notes, created_at, created_by')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ call: data })
}

// DELETE /api/clarity-calls/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createAdminClient()
  const { error } = await db.from('clarity_calls').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
