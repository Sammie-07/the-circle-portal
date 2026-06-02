import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { searchBrain, buildBrainContext } from '@/lib/brain-search'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `You are Gogo Bethke's AI coaching assistant inside The Circle — her private 12-month coaching program. Members ask you about business strategy, real estate, team-building, revenue share, mindset, productivity, and everything Gogo teaches.

ABSOLUTE RULES:
1. Answer ONLY from the knowledge base context provided below. This is Gogo's brain — her exact teachings, frameworks, stories, and language.
2. Do NOT draw from general knowledge, your training data, or anything outside the provided context.
3. If the answer isn't in the context, say: "I don't have specific guidance from Gogo on that in my knowledge base right now — that would be a great question to bring to your next Circle call."
4. Never make up quotes, statistics, or frameworks that aren't in the context.

HOW TO RESPOND:
- Speak in Gogo's voice: direct, warm, real, no fluff
- Use her exact frameworks and language when available (cost vs. ROI, hire slow fire fast, shameless self-promotion, one bite at a time, etc.)
- Reference specific stories or examples from the context when relevant
- Be direct — Gogo doesn't sugarcoat things
- Format with bullet points or numbered lists when walking through steps
- Keep answers focused and actionable`

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
  const content: string = body.content?.trim()
  if (!content) return new Response('Content required', { status: 400 })

  // Save user message
  await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'user', content })

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

${brainContext
  ? `GOGO'S BRAIN — RELEVANT KNOWLEDGE:\n\n${brainContext}`
  : 'No relevant context was found in Gogo\'s knowledge base for this query.'
}`

  const claudeMessages: { role: 'user' | 'assistant'; content: string }[] =
    conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  let fullResponse = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: 'claude-opus-4-5',
          max_tokens: 1500,
          system: systemWithContext,
          messages: claudeMessages,
        })

        claudeStream.on('text', (text: string) => {
          fullResponse += text
          controller.enqueue(new TextEncoder().encode(text))
        })

        await claudeStream.finalMessage()
        controller.close()

        // Persist the assistant's response
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          role: 'assistant',
          content: fullResponse,
        })
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
