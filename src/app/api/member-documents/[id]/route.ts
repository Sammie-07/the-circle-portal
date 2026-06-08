import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const EDITOR_ROLES = new Set(['owner', 'admin', 'manager'])
const DOC_TYPES = new Set(['contract', 'disc', 'application', 'headshot', 'other'])

const DOC_FIELDS =
  'id, member_id, doc_type, title, file_path, file_name, mime_type, size_bytes, uploaded_at, uploaded_by'

// DELETE — remove a document (storage object + row). Roles: owner/admin/manager.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createAdminClient()

  const { data: doc } = await db
    .from('member_documents')
    .select('id, file_path')
    .eq('id', id)
    .single()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  // Best-effort storage cleanup — never fail the request on a storage error.
  try {
    await db.storage.from('member-documents').remove([doc.file_path])
  } catch (err) {
    console.warn('[MemberDocumentDelete] storage cleanup failed:', err instanceof Error ? err.message : String(err))
  }

  const { error } = await db.from('member_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// PATCH — update title and/or doc_type. Roles: owner/admin/manager.
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
  const updates: Record<string, string> = {}

  if ('title' in body) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    updates.title = title
  }
  if ('doc_type' in body) {
    if (typeof body.doc_type !== 'string' || !DOC_TYPES.has(body.doc_type)) {
      return NextResponse.json({ error: 'Invalid doc_type' }, { status: 400 })
    }
    updates.doc_type = body.doc_type
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('member_documents')
    .update(updates)
    .eq('id', id)
    .select(DOC_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ document: data })
}
