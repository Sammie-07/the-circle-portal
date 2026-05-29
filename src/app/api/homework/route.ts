import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/homework?member_id=xxx — list homework for a member (admin or own)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const member_id = searchParams.get('member_id')
  if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('homework')
    .select('*')
    .eq('member_id', member_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ homework: data })
}

// POST /api/homework — create homework item (admin only)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await request.json()
  const { member_id, title, description, due_date, type } = body

  if (!member_id || !title) return NextResponse.json({ error: 'member_id and title required' }, { status: 400 })

  const { data, error } = await supabase
    .from('homework')
    .insert({
      member_id,
      title: title.trim(),
      description: description?.trim() || null,
      due_date: due_date || null,
      type: type || 'homework',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}
