import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const STAFF_ROLES = new Set(['owner', 'admin', 'manager', 'support', 'tech'])

// POST /api/homework/[id]/note — save a note, optionally auto-create a follow-up task via Claude
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const note = typeof body.note === 'string' ? body.note.trim() : ''

  const admin = createAdminClient()

  // Fetch the homework row
  const { data: row, error: rowErr } = await admin
    .from('homework')
    .select('id, member_id, title, description')
    .eq('id', id)
    .single()
  if (rowErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Access check: staff role, OR the owning member (member_id maps to a members row whose email === user.email)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isStaff = STAFF_ROLES.has(profile?.role ?? '')

  let hasAccess = isStaff
  if (!hasAccess) {
    const { data: ownerMember } = await admin
      .from('members')
      .select('id, email')
      .eq('id', row.member_id)
      .single()
    hasAccess = !!ownerMember && !!user.email &&
      ownerMember.email?.toLowerCase() === user.email.toLowerCase()
  }
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Save the note (empty string allowed to clear). Stamp when it was written so
  // the admin views can show the note's date; clear the stamp when the note is cleared.
  const { error: saveErr } = await admin
    .from('homework')
    .update({ notes: note, notes_at: note ? new Date().toISOString() : null })
    .eq('id', id)
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  // No note content → nothing to analyze
  if (!note) return NextResponse.json({ ok: true, note, created: false })

  // Analyze with Claude; any failure here still leaves the note saved.
  try {
    const prompt = `A member of a coaching program is working on this task:

Title: ${row.title}
Description: ${row.description || '(none)'}

They just wrote this note about it:
"""
${note}
"""

Decide whether the note contains a NEW, concrete, actionable follow-up the member should track as a SEPARATE task (not merely a comment, reflection, or status update on the existing task). Be conservative: only flag a follow-up when there is a clear, specific action.

Respond ONLY with compact JSON, no prose, no code fences:
{"create": boolean, "title": string (<= 80 chars, imperative), "description": string or null}

If there is no clear new action, respond {"create": false, "title": "", "description": null}.`

    const resp = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = resp.content
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()

    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    let parsed: { create?: boolean; title?: string; description?: string | null } = {}
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Try to extract the first JSON object
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    }

    const title = typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 80) : ''
    if (parsed.create !== true || !title) {
      return NextResponse.json({ ok: true, note, created: false })
    }

    // Compute next sort_order for this member
    const { data: maxRow } = await admin
      .from('homework')
      .select('sort_order')
      .eq('member_id', row.member_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSort = (maxRow?.sort_order ?? -1) + 1

    const description = typeof parsed.description === 'string' && parsed.description.trim()
      ? parsed.description.trim()
      : null

    const { data: task, error: insertErr } = await admin
      .from('homework')
      .insert({
        member_id: row.member_id,
        title,
        description,
        type: 'task',
        source: 'ai_followup',
        auto_suggested: true,
        completed: false,
        created_by: user.id,
        sort_order: nextSort,
        source_note_homework_id: id,
      })
      .select('id, title, description, due_date, type, completed, completed_at, notes, auto_suggested, source_note_homework_id')
      .single()

    if (insertErr || !task) {
      return NextResponse.json({ ok: true, note, created: false })
    }

    return NextResponse.json({ ok: true, note, created: true, task })
  } catch {
    // AI or creation failed — note is already saved.
    return NextResponse.json({ ok: true, note, created: false })
  }
}
