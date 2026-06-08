import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const STAFF_ROLES = new Set(['owner', 'admin', 'manager', 'support', 'tech'])

// POST /api/homework/[id]/followup — manually create a follow-up task from a note.
// Body: { title: string, description?: string|null, note?: string }
// (no AI; the member decides this should become a task)
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : ''
  const description =
    typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null
  const note = typeof body.note === 'string' ? body.note.trim() : undefined

  if (!title) return NextResponse.json({ error: 'A title is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: row, error: rowErr } = await admin
    .from('homework')
    .select('id, member_id')
    .eq('id', id)
    .single()
  if (rowErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Access: staff, or the owning member (member_id -> members row whose email === user.email)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  let hasAccess = STAFF_ROLES.has(profile?.role ?? '')
  if (!hasAccess) {
    const { data: ownerMember } = await admin
      .from('members').select('email').eq('id', row.member_id).single()
    hasAccess = !!ownerMember && !!user.email &&
      ownerMember.email?.toLowerCase() === user.email.toLowerCase()
  }
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Optionally persist the note text on the source task too
  if (note !== undefined) {
    await admin.from('homework').update({ notes: note }).eq('id', id)
  }

  // Next sort_order for this member
  const { data: maxRow } = await admin
    .from('homework')
    .select('sort_order')
    .eq('member_id', row.member_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextSort = (maxRow?.sort_order ?? -1) + 1

  const { data: task, error: insertErr } = await admin
    .from('homework')
    .insert({
      member_id: row.member_id,
      title,
      description,
      type: 'task',
      auto_suggested: true,
      completed: false,
      created_by: user.id,
      sort_order: nextSort,
      source_note_homework_id: id,
    })
    .select('id, title, description, due_date, type, completed, completed_at, notes, auto_suggested, source_note_homework_id')
    .single()

  if (insertErr || !task) {
    return NextResponse.json({ error: insertErr?.message ?? 'Could not create task' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, note, task })
}
