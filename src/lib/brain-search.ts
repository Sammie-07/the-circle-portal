import { createClient } from '@supabase/supabase-js'
import { getOpenAI } from '@/lib/ai'

const brainSupabase = createClient(
  process.env.BRAIN_SUPABASE_URL!,
  process.env.BRAIN_SUPABASE_ANON_KEY!
)

export interface BrainChunk {
  id: string
  content: string
  title: string
  section: string
  source_file: string
  similarity: number
}

export async function searchBrain(query: string, matchCount = 8): Promise<BrainChunk[]> {
  const embedRes = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })
  const embedding = embedRes.data[0].embedding

  const { data, error } = await brainSupabase.rpc('match_brain_chunks', {
    query_embedding: embedding,
    match_count: matchCount,
    match_threshold: 0.3,
  })

  if (error) {
    console.error('Brain search error:', error)
    return []
  }

  return data ?? []
}

export function buildBrainContext(chunks: BrainChunk[]): string {
  if (chunks.length === 0) return ''
  return chunks
    .map(c => `[${c.title}${c.section ? ' — ' + c.section : ''}]\n${sanitizeBrainText(c.content)}`)
    .join('\n\n---\n\n')
}

// Canonical facts that OVERRIDE the knowledge base when it conflicts.
// The raw transcripts are auto-transcribed and misspell names.
// Canonical facts injected into every chat to override stale/mis-transcribed
// info in the knowledge base. The agent count is editable from the admin
// Settings page (app_settings.teamgogo_agent_count), so it's passed in.
export function buildCanonicalFacts(agentCount: string = '1660'): string {
  return `CANONICAL FACTS — these override anything in the knowledge base:
- My Director of Operations and first hire is named Kristy Waker. Auto-transcribed notes sometimes spell her name "Christie", "Christy", "Christiey", or just "Kristy". That is the same person. Her correct name is always Kristy Waker. Whenever you mention her, call her Kristy (or Kristy Waker). Never write "Christie" or "Christy".
- My team, #teamgogo, currently has ${agentCount} agents. That is the correct, current number. Older sources or transcripts may say a different figure — ignore those and use ${agentCount}. When the size of my team comes up, say ${agentCount} agents.`
}

// Backwards-compatible default (uses the fallback count). Prefer
// buildCanonicalFacts(await getTeamAgentCount()) so the live value is used.
export const CANONICAL_FACTS = buildCanonicalFacts()

// Normalize the misspellings of Kristy Waker's name that appear in the
// auto-transcribed source material before it ever reaches a prompt.
export function sanitizeBrainText(text: string): string {
  return text
    .replace(/\bChrist(?:iey|ie|ey|y)\b/g, 'Kristy')
    .replace(/\bchrist(?:iey|ie|ey|y)\b/g, 'kristy')
    .replace(/\bKristie\b/g, 'Kristy')
}
