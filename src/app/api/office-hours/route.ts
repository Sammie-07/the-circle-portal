import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Roles permitted to manage office hours (mirrors clarity calls edit gate)
const EDITOR_ROLES = new Set(['owner', 'admin', 'manager'])

// GET /api/office-hours — list ALL office hours (global, no memberId)
// Any authenticated user may read.
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Any authenticated user can read. Use admin client so RLS doesn't block reads.
  const db = createAdminClient()
  const { data, error } = await db
    .from('office_hours')
    .select('id, title, video_url, call_date, notes, created_at, created_by')
    .order('call_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ calls: data ?? [] })
}

// POST /api/office-hours — create a global office hours recording
// Body: { title, video_url, call_date?, notes? }
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const video_url = typeof body.video_url === 'string' ? body.video_url.trim() : ''
  const call_date = body.call_date || null
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

  if (!title || !video_url) {
    return NextResponse.json(
      { error: 'title and video_url are required' },
      { status: 400 }
    )
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('office_hours')
    .insert({ title, video_url, call_date, notes, created_by: user.id })
    .select('id, title, video_url, call_date, notes, created_at, created_by')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ call: data }, { status: 201 })
}
