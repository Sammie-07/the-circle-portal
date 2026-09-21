import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/blueprints/revision/generate
// Admin creates (or reuses) a tokenized revision-questionnaire link for a member.
// The member fills it out at /blueprint-revision/<token>; on submit it comes back
// for admin approval. Copy-link only — no email is sent from here.
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'tech', 'admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const { data: member } = await supabase.from('members').select('id').eq('id', memberId).single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Reuse an outstanding (not-yet-submitted) link if one exists, so repeated
  // clicks don't pile up dead links. Otherwise create a fresh one.
  const { data: existing } = await supabase
    .from('blueprint_revisions')
    .select('token')
    .eq('member_id', memberId)
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let token = existing?.token as string | undefined

  if (!token) {
    const { data: created, error } = await supabase
      .from('blueprint_revisions')
      .insert({ member_id: memberId, status: 'sent', created_by: user.id })
      .select('token')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    token = created.token
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'
  return NextResponse.json({ url: `${appUrl}/blueprint-revision/${token}` })
}
