import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ENTRY_FIELDS = 'id, title, content, created_at, updated_at'

// PATCH /api/member-note-entries/[id] — update title/content.
// RLS ensures the member can only update their own entry.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { title?: unknown; content?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: { title?: string; content?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  if (typeof body.title === 'string') update.title = body.title.trim() || 'Untitled note'
  if (typeof body.content === 'string') update.content = body.content

  const { data, error } = await supabase
    .from('member_note_entries')
    .update(update)
    .eq('id', id)
    .select(ENTRY_FIELDS)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ entry: data })
}

// DELETE /api/member-note-entries/[id] — delete the entry (RLS scopes to own).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('member_note_entries')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
