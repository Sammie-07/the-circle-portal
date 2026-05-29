import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/member-notes?member_id=xxx
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const member_id = searchParams.get('member_id')
  if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  const { data } = await supabase
    .from('member_notes')
    .select('content, updated_at')
    .eq('member_id', member_id)
    .single()

  return NextResponse.json({ content: data?.content ?? '', updated_at: data?.updated_at ?? null })
}

// PUT /api/member-notes — upsert (member saves their own, admin can also save)
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { member_id, content } = await request.json()
  if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  const { error } = await supabase
    .from('member_notes')
    .upsert({ member_id, content: content ?? '', updated_at: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
