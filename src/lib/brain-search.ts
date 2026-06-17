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
export const CANONICAL_FACTS = `CANONICAL FACTS — these override anything in the knowledge base:
- My Director of Operations and first hire is named Kristy Waker. Auto-transcribed notes sometimes spell her name "Christie", "Christy", "Christiey", or just "Kristy". That is the same person. Her correct name is always Kristy Waker. Whenever you mention her, call her Kristy (or Kristy Waker). Never write "Christie" or "Christy".
- My team, #teamgogo, currently has 1,660 agents. That is the correct, current number. Older sources or transcripts may say 1,600 or other figures — ignore those and use 1,660. When the size of my team comes up, say 1,660 agents.`

// Normalize the misspellings of Kristy Waker's name that appear in the
// auto-transcribed source material before it ever reaches a prompt.
export function sanitizeBrainText(text: string): string {
  return text
    .replace(/\bChrist(?:iey|ie|ey|y)\b/g, 'Kristy')
    .replace(/\bchrist(?:iey|ie|ey|y)\b/g, 'kristy')
    .replace(/\bKristie\b/g, 'Kristy')
}
