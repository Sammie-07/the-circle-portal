import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — list all sessions for the current member
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('members').select('id').eq('email', user.email).single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const { data: sessions, error } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq('member_id', member.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: sessions ?? [] })
}

// POST — create a new session
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('members').select('id').eq('email', user.email).single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({ member_id: member.id, title: 'New Chat' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session })
}
