import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ENTRY_FIELDS = 'id, title, content, created_at, updated_at'

// GET /api/member-note-entries — list the current member's note entries.
// RLS restricts rows to the owning member; the member is resolved by email.
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()

  if (!member) return NextResponse.json({ entries: [] })

  const { data, error } = await supabase
    .from('member_note_entries')
    .select(ENTRY_FIELDS)
    .eq('member_id', member.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entries: data ?? [] })
}

// POST /api/member-note-entries — create a new entry for the current member.
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  let body: { title?: unknown; content?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine — defaults apply
  }

  const title = typeof body.title === 'string' && body.title.trim() ? body.title : 'Untitled note'
  const content = typeof body.content === 'string' ? body.content : ''

  const { data, error } = await supabase
    .from('member_note_entries')
    .insert({ member_id: member.id, title, content })
    .select(ENTRY_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entry: data }, { status: 201 })
}
