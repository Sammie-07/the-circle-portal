import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Staff roles that may list/download any member's documents
const STAFF_ROLES = new Set(['owner', 'admin', 'manager', 'support'])
// Roles that may upload/delete/edit documents
const EDITOR_ROLES = new Set(['owner', 'admin', 'manager'])
const DOC_TYPES = new Set(['contract', 'disc', 'application', 'headshot', 'other'])

const DOC_FIELDS =
  'id, member_id, doc_type, title, file_path, file_name, mime_type, size_bytes, uploaded_at, uploaded_by'

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file'
}

// GET /api/member-documents?memberId=<uuid> — list a member's documents.
// Access: staff role OR the member who owns the documents (matched by email).
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('memberId')
  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isStaff = STAFF_ROLES.has(profile?.role ?? '')

  const db = createAdminClient()

  if (!isStaff) {
    // Must be the owning member: their members row (by email) must match memberId.
    const { data: ownMember } = await db
      .from('members')
      .select('id')
      .eq('email', user.email)
      .single()
    if (!ownMember || ownMember.id !== memberId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { data, error } = await db
    .from('member_documents')
    .select(DOC_FIELDS)
    .eq('member_id', memberId)
    .order('doc_type', { ascending: true })
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach uploader info (name + role) so the backend can see who uploaded each
  // file — i.e. distinguish member-uploaded from staff-uploaded documents.
  const docs = data ?? []
  const uploaderIds = [...new Set(docs.map((d) => d.uploaded_by).filter(Boolean))]
  let uploaders: Record<string, { full_name: string | null; role: string | null }> = {}
  if (uploaderIds.length) {
    const { data: profs } = await db
      .from('profiles')
      .select('id, full_name, role')
      .in('id', uploaderIds as string[])
    uploaders = Object.fromEntries(
      (profs ?? []).map((p) => [p.id, { full_name: p.full_name, role: p.role }])
    )
  }
  const withUploader = docs.map((d) => ({
    ...d,
    uploader_name: d.uploaded_by ? uploaders[d.uploaded_by]?.full_name ?? null : null,
    uploader_role: d.uploaded_by ? uploaders[d.uploaded_by]?.role ?? null : null,
  }))

  return NextResponse.json({ documents: withUploader })
}

// POST /api/member-documents — upload a document for a member (multipart/form-data).
// Roles: owner/admin/manager.
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isEditor = EDITOR_ROLES.has(profile?.role ?? '')

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const member_id = form.get('member_id')
  const doc_type = form.get('doc_type')
  const titleRaw = form.get('title')
  const file = form.get('file')

  if (!member_id || typeof member_id !== 'string') {
    return NextResponse.json({ error: 'member_id required' }, { status: 400 })
  }
  if (typeof doc_type !== 'string' || !DOC_TYPES.has(doc_type)) {
    return NextResponse.json({ error: 'Invalid doc_type' }, { status: 400 })
  }
  const title = typeof titleRaw === 'string' ? titleRaw.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  const db = createAdminClient()

  const { data: member } = await db.from('members').select('id').eq('id', member_id).single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Editors (owner/admin/manager) may upload for any member. Everyone else may
  // only upload to their OWN member record (matched by email).
  if (!isEditor) {
    const { data: ownMember } = await db
      .from('members')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()
    if (!ownMember || ownMember.id !== member_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const safeName = sanitizeFileName(file.name)
  const path = `${member_id}/${crypto.randomUUID()}-${safeName}`

  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await db.storage
    .from('member-documents')
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
  }

  const { data, error } = await db
    .from('member_documents')
    .insert({
      member_id,
      doc_type,
      title,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select(DOC_FIELDS)
    .single()

  if (error) {
    // Roll back the orphaned storage object (best-effort).
    await db.storage.from('member-documents').remove([path]).catch(() => {})
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ document: data }, { status: 201 })
}
