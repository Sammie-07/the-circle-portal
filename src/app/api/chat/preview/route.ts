import { createClient } from '@/lib/supabase/server'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { searchBrain, buildBrainContext, buildCanonicalFacts } from '@/lib/brain-search'
import { getTeamAgentCount } from '@/lib/settings'
import { GOGO_SYSTEM_PROMPT, makeDashCleaner, parseAttachmentFile, buildAttachmentContent } from '@/lib/gogo-chat'

export const maxDuration = 120

const STAFF_ROLES = ['owner', 'admin', 'manager', 'support', 'tech']

// POST — ephemeral admin-preview chat. Answers live from Gogo's Brain.
// Persists NOTHING and never looks up a member record.
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!STAFF_ROLES.includes(profile?.role ?? '')) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await request.json()
  const content: string = (body.content ?? '').trim()
  const history: { role: 'user' | 'assistant'; content: string }[] =
    Array.isArray(body.history) ? body.history : []
  const attachmentName: string | null = body.attachmentName ?? null
  const attachmentTextRaw: string | null = body.attachmentText ?? null
  const attachmentText: string | null = attachmentTextRaw
    ? attachmentTextRaw.slice(0, 20000)
    : null
  // Photo or PDF sent as the real file (the model sees it, not just its text).
  const attachmentFile = parseAttachmentFile(body.attachmentFile)

  if (!content && !attachmentText && !attachmentFile) {
    return new Response('Content required', { status: 400 })
  }

  const turnContent = content || '(see attached file)'

  // Brain search — proceed without context on failure.
  let brainContext = ''
  try {
    const chunks = await searchBrain(turnContent)
    brainContext = buildBrainContext(chunks)
  } catch (err) {
    console.error('Brain search failed:', err)
  }

  const canonicalFacts = buildCanonicalFacts(await getTeamAgentCount())

  const systemWithContext = `${GOGO_SYSTEM_PROMPT}

${canonicalFacts}

${brainContext
  ? `GOGO'S BRAIN — RELEVANT KNOWLEDGE:\n\n${brainContext}`
  : 'No relevant context was found in Gogo\'s knowledge base for this query.'
}`

  const claudeMessages: { role: 'user' | 'assistant'; content: ReturnType<typeof buildAttachmentContent> }[] = [
    ...history.map(m => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    })),
    // Make the model SEE the attachment on the current user message.
    { role: 'user', content: buildAttachmentContent(turnContent, attachmentName, attachmentFile, attachmentText) },
  ]

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = getAnthropic().messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 3000,
          system: systemWithContext,
          messages: claudeMessages,
        })

        const dashes = makeDashCleaner()
        claudeStream.on('text', (text: string) => {
          controller.enqueue(new TextEncoder().encode(dashes.push(text)))
        })

        await claudeStream.finalMessage()
        const tail = dashes.flush()
        if (tail) controller.enqueue(new TextEncoder().encode(tail))
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
