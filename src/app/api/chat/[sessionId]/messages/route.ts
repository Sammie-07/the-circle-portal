import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { searchBrain, buildBrainContext, CANONICAL_FACTS } from '@/lib/brain-search'
import { GOGO_SYSTEM_PROMPT as SYSTEM_PROMPT } from '@/lib/gogo-chat'

export const maxDuration = 60

// GET — load messages for a session
export async function GET(
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

  // Verify ownership
  const { data: session } = await supabase
    .from('chat_sessions').select('id').eq('id', sessionId).eq('member_id', member.id).single()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: messages ?? [] })
}

// POST — send a message and stream the response
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: member } = await supabase
    .from('members').select('id').eq('email', user.email).single()
  if (!member) return new Response('Member not found', { status: 404 })

  // Verify session belongs to this member
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id, title')
    .eq('id', sessionId)
    .eq('member_id', member.id)
    .single()
  if (!session) return new Response('Session not found', { status: 404 })

  const body = await request.json()
  const rawContent: string = (body.content ?? '').trim()
  const attachmentName: string | null = body.attachmentName ?? null
  const attachmentTextRaw: string | null = body.attachmentText ?? null
  const attachmentText: string | null = attachmentTextRaw
    ? attachmentTextRaw.slice(0, 20000)
    : null

  if (!rawContent && !attachmentText) {
    return new Response('Content required', { status: 400 })
  }

  // Synthesize default content when only an attachment was sent
  const content = rawContent || '(see attached file)'

  // Save user message — append a marker for the attachment, never the file body
  const savedContent = attachmentName
    ? `${content}\n\n📎 Attached: ${attachmentName}`
    : content
  await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'user', content: savedContent })

  // Auto-title session from first message
  if (session.title === 'New Chat') {
    const title = content.slice(0, 52) + (content.length > 52 ? '…' : '')
    await supabase.from('chat_sessions').update({ title }).eq('id', sessionId)
  }

  // Load recent conversation history (last 20 messages for context)
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(20)

  const conversationHistory = (history ?? []).reverse()

  // Parallel: embed query + (optionally) no-op — brain search uses OpenAI
  let brainContext = ''
  try {
    const chunks = await searchBrain(content)
    brainContext = buildBrainContext(chunks)
  } catch (err) {
    console.error('Brain search failed:', err)
    // Proceed without brain context — will trigger the "not found" response
  }

  const systemWithContext = `${SYSTEM_PROMPT}

${CANONICAL_FACTS}

${brainContext
  ? `GOGO'S BRAIN — RELEVANT KNOWLEDGE:\n\n${brainContext}`
  : 'No relevant context was found in Gogo\'s knowledge base for this query.'
}`

  const claudeMessages: { role: 'user' | 'assistant'; content: string }[] =
    conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  // Make the model SEE the attached file by appending its text to the last
  // user message — for the model only. The saved/displayed transcript stays
  // clean (it only carries the "📎 Attached: ..." marker).
  if (attachmentText) {
    for (let i = claudeMessages.length - 1; i >= 0; i--) {
      if (claudeMessages[i].role === 'user') {
        claudeMessages[i] = {
          ...claudeMessages[i],
          content:
            claudeMessages[i].content +
            `\n\n[Attached file: ${attachmentName ?? 'file'}]\n${attachmentText}`,
        }
        break
      }
    }
  }

  let fullResponse = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = getAnthropic().messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 1500,
          system: systemWithContext,
          messages: claudeMessages,
        })

        claudeStream.on('text', (text: string) => {
          // Hard-strip em dashes at the stream level — no exceptions
          const clean = text.replace(/—/g, ',').replace(/--/g, ',')
          fullResponse += clean
          controller.enqueue(new TextEncoder().encode(clean))
        })

        await claudeStream.finalMessage()

        // Persist the assistant's response BEFORE closing the stream. On
        // serverless the function can be frozen the moment the response stream
        // closes, so a post-close insert was being dropped — that's why
        // assistant replies vanished on reload. Insert first, then close.
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          role: 'assistant',
          content: fullResponse,
        })
        await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId)

        controller.close()
      } catch (err) {
        console.error('Stream error:', err)
        controller.enqueue(
          new TextEncoder().encode('\n\nSomething went wrong. Please try again.')
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  })
}
