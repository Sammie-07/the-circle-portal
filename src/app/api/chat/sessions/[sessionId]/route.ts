import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('members').select('id').eq('email', user.email).single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Verify ownership before deleting
  const { data: session } = await supabase
    .from('chat_sessions').select('id').eq('id', sessionId).eq('member_id', member.id).single()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
