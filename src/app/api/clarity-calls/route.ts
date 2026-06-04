import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Roles permitted to manage clarity calls (mirrors member edit gate)
const EDITOR_ROLES = new Set(['owner', 'admin', 'manager'])

// GET /api/clarity-calls?memberId=<uuid> — list a member's clarity calls
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('memberId')
  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  // Role check above is the security boundary. Use admin client so RLS doesn't block manager reads.
  const db = createAdminClient()
  const { data, error } = await db
    .from('clarity_calls')
    .select('id, member_id, title, video_url, call_date, notes, created_at, created_by')
    .eq('member_id', memberId)
    .order('call_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ calls: data ?? [] })
}

// POST /api/clarity-calls — create a clarity call for a member
// Body: { member_id, title, video_url, call_date?, notes? }
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const member_id = body.member_id
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const video_url = typeof body.video_url === 'string' ? body.video_url.trim() : ''
  const call_date = body.call_date || null
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

  if (!member_id || !title || !video_url) {
    return NextResponse.json(
      { error: 'member_id, title, and video_url are required' },
      { status: 400 }
    )
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('clarity_calls')
    .insert({ member_id, title, video_url, call_date, notes, created_by: user.id })
    .select('id, member_id, title, video_url, call_date, notes, created_at, created_by')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ call: data }, { status: 201 })
}
