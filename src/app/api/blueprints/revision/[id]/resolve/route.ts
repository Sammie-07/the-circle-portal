import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/blueprints/revision/[id]/resolve  { action: 'approve' | 'reject' }
// Records the admin's decision on a submitted revision request.
//  - 'approve' here just clears the notice (used for "Mark as reviewed"); the
//    revised draft is published separately via .../publish.
//  - 'reject' dismisses the request AND discards the pending draft (if any),
//    leaving the live blueprint untouched.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'tech', 'admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { action } = await request.json() as { action?: string }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const { data: revision } = await supabase
    .from('blueprint_revisions')
    .select('id, member_id, status')
    .eq('id', id)
    .single()

  if (!revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
  if (revision.status !== 'submitted') {
    return NextResponse.json({ error: `Revision is ${revision.status}, not submitted` }, { status: 400 })
  }

  const { error } = await supabase
    .from('blueprint_revisions')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Rejecting discards the pending draft this revision produced (only if the
  // draft still belongs to this revision — don't clobber a newer one).
  if (action === 'reject') {
    await supabase
      .from('members')
      .update({ blueprint_draft_html: null, blueprint_draft_generated_at: null, blueprint_draft_revision_id: null })
      .eq('id', revision.member_id)
      .eq('blueprint_draft_revision_id', id)
  }

  return NextResponse.json({ success: true })
}
