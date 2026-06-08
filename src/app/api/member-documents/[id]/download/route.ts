import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Staff roles that may download any member's documents
const STAFF_ROLES = new Set(['owner', 'admin', 'manager', 'support'])

// GET — verify access, then redirect to a short-lived signed URL from the
// PRIVATE member-documents bucket. Files are never served publicly.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const { data: doc } = await db
    .from('member_documents')
    .select('id, member_id, file_path')
    .eq('id', id)
    .single()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isStaff = STAFF_ROLES.has(profile?.role ?? '')

  if (!isStaff) {
    // Must be the owning member: the document's member row email === user email.
    const { data: member } = await db
      .from('members')
      .select('email')
      .eq('id', doc.member_id)
      .single()
    if (!member || member.email !== user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { data: signed, error } = await db.storage
    .from('member-documents')
    .createSignedUrl(doc.file_path, 60)

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'Could not create download link' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
