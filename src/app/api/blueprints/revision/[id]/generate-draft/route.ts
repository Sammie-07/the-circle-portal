import { createClient } from '@/lib/supabase/server'
import { editBlueprintForRevision } from '@/lib/blueprint-shell'
import { NextResponse } from 'next/server'

// The AI edit takes ~30-90s, so give the function room.
export const maxDuration = 300
export const runtime = 'nodejs'

// POST /api/blueprints/revision/[id]/generate-draft
// Admin action: edit the member's existing blueprint to accommodate their
// submitted answers, storing the result as a DRAFT (the live blueprint is left
// untouched until the admin publishes). Returns the draft HTML for preview.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let noteBody: { note?: string } = {}
  try { noteBody = await request.json() } catch { /* no body is fine */ }
  const adminNote = (noteBody.note ?? '').trim()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'tech', 'admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { data: revision } = await supabase
    .from('blueprint_revisions')
    .select('id, member_id, status, answers, admin_notes')
    .eq('id', id)
    .single()

  if (!revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
  if (revision.status !== 'submitted') {
    return NextResponse.json({ error: `This revision is ${revision.status}, not awaiting a draft` }, { status: 400 })
  }

  const answers = Array.isArray(revision.answers) ? revision.answers : []
  if (!answers.some((a: { answer?: string }) => a?.answer?.trim())) {
    return NextResponse.json({ error: 'This revision has no answers to work from' }, { status: 400 })
  }

  const { data: member } = await supabase
    .from('members')
    .select('name, blueprint_html, blueprint_draft_html, blueprint_draft_revision_id')
    .eq('id', revision.member_id)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (!member.blueprint_html) {
    return NextResponse.json({ error: 'This member has no blueprint yet — generate one first, then apply revisions.' }, { status: 400 })
  }

  // Regenerate with a note BUILDS ON the current draft for this revision, so each
  // fix accumulates. (It used to re-edit the live blueprint every time, which
  // threw away the previous draft's changes: "fixed one thing, removed another".)
  const priorNotes: string[] = Array.isArray(revision.admin_notes)
    ? (revision.admin_notes as unknown[]).filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    : []
  const hasDraft = !!member.blueprint_draft_html && member.blueprint_draft_revision_id === revision.id
  const mode: 'initial' | 'refine' = hasDraft && adminNote ? 'refine' : 'initial'
  const baseHtml = mode === 'refine' ? (member.blueprint_draft_html as string) : member.blueprint_html

  let draftHtml: string
  let warning: string | null = null
  let rawOut = '' // TEMP debug capture of the model's raw output
  try {
    const result = await editBlueprintForRevision({
      existingHtml: baseHtml,
      memberName: member.name,
      answers,
      adminNote: adminNote || undefined,
      priorNotes: mode === 'refine' ? priorNotes : [],
      mode,
      captureRaw: (r) => { rawOut = r },
    })
    draftHtml = result.html
    const issues: string[] = []
    if (result.missed > 0) {
      issues.push(`${result.missed} of ${result.total} requested change${result.total === 1 ? '' : 's'} couldn't be placed. Check the preview; Regenerate with the missing part if needed.`)
    }
    if (result.keptRatio < 0.9) {
      issues.push(`About ${Math.round((1 - result.keptRatio) * 100)}% of the blueprint's text was removed. Check the preview for anything missing before publishing.`)
    }
    warning = issues.length ? issues.join(' ') : null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Revision] generate-draft edit failed:', msg)
    try { await supabase.from('blueprint_revisions').update({ debug_raw: `ERR: ${msg}\n---\n${rawOut}`.slice(0, 60000) }).eq('id', revision.id) } catch {}
    return NextResponse.json({ error: `Could not generate the updated blueprint: ${msg}` }, { status: 500 })
  }
  // TEMP: also persist raw on success, to inspect what a good run looks like.
  try { await supabase.from('blueprint_revisions').update({ debug_raw: `OK\n---\n${rawOut}`.slice(0, 60000) }).eq('id', revision.id) } catch {}

  const { error: updateError } = await supabase
    .from('members')
    .update({
      blueprint_draft_html: draftHtml,
      blueprint_draft_generated_at: new Date().toISOString(),
      blueprint_draft_revision_id: revision.id,
    })
    .eq('id', revision.member_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Remember this note so the next Regenerate keeps it applied. A fresh generate
  // from the live blueprint (no note) starts the note history over.
  const nextNotes = mode === 'refine' ? [...priorNotes, adminNote] : adminNote ? [adminNote] : []
  await supabase.from('blueprint_revisions').update({ admin_notes: nextNotes }).eq('id', revision.id)

  return NextResponse.json({ success: true, draft_html: draftHtml, warning, notes: nextNotes })
}
