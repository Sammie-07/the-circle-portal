import { createAdminClient } from '@/lib/supabase/admin'
import { scanConceptSignals, generateConcepts, formatColumn, type ConceptSignal, type ConceptBrief } from './concepts'
import { writeCaption } from './caption'
import type { Bucket } from './buckets'

// Background content generation. Never call this in a request the user awaits
// unless that request is built for it (maxDuration 300) — otherwise run it in
// `after()` or a cron. The strategist looks at a small capped batch of signals
// per run and saves each signal's concept briefs as they finish (so partial
// progress survives a function timeout). Every signal it looks at is logged,
// including ones it judged not worth posting, so it never re-spends a model
// call on them.

const RATE_LIMIT_MS = 75_000 // untargeted runs (e.g. page loads) at most this often

async function recentFeedbackGuidance(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data } = await admin
    .from('content_posts')
    .select('feedback')
    .not('feedback', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(8)
  const notes = (data ?? []).map((r) => (r.feedback as string)?.trim()).filter(Boolean)
  return notes.length ? notes.map((n) => `- ${n}`).join('\n') : ''
}

export interface BatchOptions {
  cap?: number
  memberId?: string | null
  force?: boolean
  /** Include call transcripts (long input, ~1 min each). Only from routes with time to spare. */
  includeTranscripts?: boolean
  /** Stop starting new signals after this many ms (keeps inside the function limit). */
  budgetMs?: number
}

export async function generateBatch(opts: BatchOptions = {}): Promise<number> {
  const started = Date.now()
  const cap = opts.cap ?? 2
  const budget = opts.budgetMs ?? 40_000
  const admin = createAdminClient()

  // Rate-limit untargeted (page-load) runs so concurrent admin visits don't
  // thrash the model. Forced/targeted runs bypass it.
  if (!opts.force) {
    const { data: s } = await admin.from('app_settings').select('value').eq('key', 'content_gen_at').maybeSingle()
    const last = s?.value ? Date.parse(s.value as string) : 0
    if (Date.now() - last < RATE_LIMIT_MS) return 0
    await admin.from('app_settings').upsert({ key: 'content_gen_at', value: new Date().toISOString() }, { onConflict: 'key' })
  }

  let signals = await scanConceptSignals(admin, { memberId: opts.memberId })
  if (!opts.includeTranscripts) signals = signals.filter((s) => s.kind !== 'transcript')
  if (!signals.length) return 0

  const { data: logged } = await admin.from('content_signal_log').select('dedupe_key')
  const seen = new Set((logged ?? []).map((r) => r.dedupe_key as string))
  const fresh = signals.filter((s) => !seen.has(s.dedupeKey)).slice(0, cap)
  if (!fresh.length) return 0

  const guidance = await recentFeedbackGuidance(admin).catch(() => '')

  let made = 0
  for (const signal of fresh) {
    if (Date.now() - started > budget) break
    made += await runSignal(admin, signal, guidance)
  }
  return made
}

/** Generate + save the briefs for one signal. Returns how many were saved. */
export async function runSignal(admin: ReturnType<typeof createAdminClient>, signal: ConceptSignal, guidance = ''): Promise<number> {
  let made = 0
  let note = ''
  try {
    const { ideas, note: n } = await generateConcepts(signal, guidance)
    note = n
    // Every idea comes with a starting caption (in parallel; a failed caption
    // just leaves it blank for the "Write caption" button).
    const captions = await Promise.all(ideas.map((idea) => writeCaption(idea.bucket, idea.brief).catch(() => null)))
    for (let i = 0; i < ideas.length; i++) {
      const { bucket, brief } = ideas[i]
      const { error } = await admin.from('content_posts').upsert(
        {
          source_type: 'concept',
          bucket,
          brief,
          member_id: signal.memberId,
          signal: { kind: signal.kind, transcript_id: signal.transcriptId ?? null },
          trigger_summary: signal.summary,
          dedupe_key: `${signal.dedupeKey}#${i}`,
          format: formatColumn(brief.format),
          platform: 'both',
          caption: captions[i]?.caption ?? '',
          hashtags: captions[i]?.hashtags ?? '',
          slides: [],
          art_direction: '',
          status: 'draft',
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true }
      )
      if (!error) made++
    }
  } catch (err) {
    // A transient failure (model/network) is NOT logged, so it gets retried.
    console.error('[content] signal failed:', signal.dedupeKey, err instanceof Error ? err.message : err)
    return 0
  }
  await admin.from('content_signal_log').upsert({ dedupe_key: signal.dedupeKey, ideas: made, note: note.slice(0, 500) }, { onConflict: 'dedupe_key' })
  if (signal.transcriptId) {
    await admin.from('call_transcripts').update({ pearls_scanned_at: new Date().toISOString() }).eq('id', signal.transcriptId)
  }
  return made
}

/** Scan one saved call transcript for Gogo Pearls right away (after a call import). */
export async function scanTranscriptNow(transcriptId: string): Promise<number> {
  const admin = createAdminClient()
  const signals = await scanConceptSignals(admin)
  const signal = signals.find((s) => s.transcriptId === transcriptId)
  if (!signal) return 0
  const guidance = await recentFeedbackGuidance(admin).catch(() => '')
  return runSignal(admin, signal, guidance)
}

/**
 * Give captions to ideas that don't have one yet (ideas made before captions
 * existed, or whose caption failed). Newest first, a few at a time in parallel.
 */
export async function fillMissingCaptions(limit = 8): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('content_posts')
    .select('id, bucket, brief')
    .eq('source_type', 'concept')
    .eq('caption', '')
    .in('status', ['draft', 'approved'])
    .order('created_at', { ascending: false })
    .limit(limit)
  let done = 0
  const rows = (data ?? []).filter((r) => r.brief && r.bucket)
  for (let i = 0; i < rows.length; i += 4) {
    const chunk = rows.slice(i, i + 4)
    const results = await Promise.all(chunk.map((r) => writeCaption(r.bucket as Bucket, r.brief as ConceptBrief).catch(() => null)))
    for (let j = 0; j < chunk.length; j++) {
      const c = results[j]
      if (!c) continue
      const { error } = await admin.from('content_posts').update({ caption: c.caption, hashtags: c.hashtags, updated_at: new Date().toISOString() }).eq('id', chunk[j].id).eq('caption', '')
      if (!error) done++
    }
  }
  return done
}
