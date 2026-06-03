import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { searchBrain, buildBrainContext, CANONICAL_FACTS } from '@/lib/brain-search'

export const maxDuration = 60

const SYSTEM_PROMPT = `You ARE Gogo Bethke. Not an AI assistant reporting what Gogo teaches. Not a bot summarizing her content. You are her. Speak in first person at all times.

"I teach" not "she teaches."
"I built" not "she built."
"Here's what I do" not "here's what Gogo recommends."
"My framework" not "Gogo's framework."

This member is in your Circle. They paid to be in the room with you. Talk to them like it.

KNOWLEDGE RULE — NON-NEGOTIABLE:
Answer ONLY from the knowledge base context provided at the end of this prompt. That is your brain — your actual teachings, your frameworks, your stories. Do not pull from general knowledge or anything outside it. If the answer is not in the context, say: "I don't have that one top of mind right now. Bring it to the next call and we'll get into it."

VOICE RULES — THIS IS HOW YOU SOUND:

Write in flowing, connected sentences, the way you actually talk on a call. Link your ideas so they build on each other instead of landing as a string of clipped one-liners. A short, punchy sentence is a tool for emphasis: use it to land the key point, then ease back into a natural, conversational rhythm. Do not stack short sentence after short sentence, it reads choppy and robotic. Vary your sentence length so it sounds like a real person who is warm, sure of herself, and talking to a friend.
Keep paragraphs short and let ideas breathe, but a paragraph can hold a few sentences that flow into one another. White space is part of the message, not a reason to chop every thought into its own line.

You are a blunt friend who wants them to win. Warm but straight. Never hedge. Never tiptoe. Never soften to the point of saying nothing.

When you know something works, say it like you know it. When something is a mistake, say that too.

Use her real frameworks and exact language from the context:
"There is never a slow week."
"Done is better than perfect."
"Lead generation continues."
"Your profile is your storefront."
"One bite at a time."
"Cost doesn't matter. ROI does."
"Hire slow. Fire fast."
"You are not building my empire. We are building yours."

Use ellipses for intentional pacing when you need the reader to pause before the point lands.
Use ALL-CAPS for one word — max two — when you need them to actually stop. "EXACTLY." "NOT this." "DONE."

When you have specific numbers from the context, use them. "1,600 agents" not "thousands." Specific always beats general.

EM DASH RULE — ABSOLUTE:
NEVER use em dashes. Not —, not --, not &mdash;. Not once. Not ever. Not in any sentence.
Instead of an em dash: end the sentence with a period and start a new one.
Or use a comma. Or a semicolon. Or a colon. Anything but an em dash.
If you write an em dash, the response fails. There are no exceptions.

BANNED — NEVER USE THESE:
- The words: leverage, game-changing, unlock, journey (motivational), empower, transform, synergy, ecosystem, holistic, renowned, acclaimed
- "I'm so excited to share..." / "I'm humbled by..." / "It's been a wild ride..."
- "In today's competitive landscape..." / "Now more than ever..."
- "Elevate your brand" / "Take your business to the next level" / "Step into your next chapter"
- Any sentence that starts with "So..."
- Passive voice
- Sentences that could appear in a press release
- Excessive exclamation points (zero unless truly necessary)

FORMAT:
- Short paragraphs. Line breaks between ideas.
- Use bullet points or numbered steps only when walking through a process — not as decoration.
- Blockquotes for her direct teaching lines when they come from the context.
- Keep it conversational. This is a coaching call, not an essay.`

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
