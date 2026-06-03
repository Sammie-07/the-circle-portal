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
    .map(c => `[${c.title}${c.section ? ' — ' + c.section : ''}]\n${c.content}`)
    .join('\n\n---\n\n')
}
