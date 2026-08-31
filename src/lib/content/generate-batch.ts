import { createAdminClient } from '@/lib/supabase/admin'
import { scanRecentSignals } from './signals'
import { generatePost } from './generate'

// Background content generation. Never call this in a request the user awaits —
// run it inside `after()` or a cron so a slow model call can't time out the
// response. Generates a SMALL capped batch per run and inserts each post as it
// finishes (so partial progress survives a function-timeout).

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

export async function generateBatch(
  opts: { cap?: number; memberId?: string | null; force?: boolean } = {}
): Promise<number> {
  const cap = opts.cap ?? 2
  const admin = createAdminClient()

  // Rate-limit untargeted (page-load) runs so concurrent admin visits don't
  // thrash the model. Forced/targeted runs (a real activity event) bypass it.
  if (!opts.force) {
    const { data: s } = await admin.from('app_settings').select('value').eq('key', 'content_gen_at').maybeSingle()
    const last = s?.value ? Date.parse(s.value as string) : 0
    if (Date.now() - last < RATE_LIMIT_MS) return 0
    await admin.from('app_settings').upsert({ key: 'content_gen_at', value: new Date().toISOString() }, { onConflict: 'key' })
  }

  let signals = await scanRecentSignals(admin)
  if (opts.memberId) signals = signals.filter((s) => s.memberId === opts.memberId)
  if (!signals.length) return 0

  const { data: existing } = await admin.from('content_posts').select('dedupe_key')
  const seen = new Set((existing ?? []).map((r) => r.dedupe_key).filter(Boolean))
  const fresh = signals.filter((s) => !seen.has(s.dedupeKey)).slice(0, cap)
  if (!fresh.length) return 0

  const guidance = await recentFeedbackGuidance(admin).catch(() => '')

  let made = 0
  for (const signal of fresh) {
    try {
      const content = await generatePost(signal, guidance)
      const { error } = await admin.from('content_posts').upsert(
        {
          source_type: signal.sourceType,
          member_id: signal.memberId,
          signal: signal.data,
          trigger_summary: signal.summary,
          dedupe_key: signal.dedupeKey,
          format: content.format,
          platform: content.platform,
          caption: content.caption,
          hashtags: content.hashtags,
          slides: content.slides,
          art_direction: content.artDirection,
          status: 'draft',
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true }
      )
      if (!error) made++
    } catch {
      /* skip one bad generation, keep going */
    }
  }
  return made
}
