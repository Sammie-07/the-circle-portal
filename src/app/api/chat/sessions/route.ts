import { createClient } from '@/lib/supabase/server'
import { resolveChatOwner } from '@/lib/chatOwner'
import { NextResponse } from 'next/server'

// GET — list all sessions for the current chat owner (member OR staff)
export async function GET() {
  const supabase = await createClient()
  const owner = await resolveChatOwner(supabase)
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sessions, error } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq(owner.ownerCol, owner.ownerId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: sessions ?? [] })
}

// POST — create a new session for the current chat owner (member OR staff)
export async function POST() {
  const supabase = await createClient()
  const owner = await resolveChatOwner(supabase)
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({ [owner.ownerCol]: owner.ownerId, title: 'New Chat' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session })
}
