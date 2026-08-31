import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scanRecentSignals } from '@/lib/content/signals'
import { generatePost } from '@/lib/content/generate'

export const runtime = 'nodejs'
export const maxDuration = 60

// One-off backfill trigger for seeding the content bank from existing member
// activity. Inert (403) unless app_settings.content_backfill_token matches
// ?token=. Returns diagnostics so we can see exactly what's happening.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const admin = createAdminClient()
  const { data: setting } = await admin.from('app_settings').select('value').eq('key', 'content_backfill_token').maybeSingle()
  const expected = ((setting?.value as string) ?? '').trim()
  if (!expected || token !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const signals = await scanRecentSignals(admin)
  const { data: existing } = await admin.from('content_posts').select('dedupe_key')
  const seen = new Set((existing ?? []).map((r) => r.dedupe_key).filter(Boolean))
  const fresh = signals.filter((s) => !seen.has(s.dedupeKey)).slice(0, 2) // 2/run stays under the 60s function limit

  let made = 0
  let firstError: string | null = null
  for (const signal of fresh) {
    try {
      const content = await generatePost(signal)
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
      if (error) { if (!firstError) firstError = `db: ${error.message}` } else made++
    } catch (e) {
      if (!firstError) firstError = `gen: ${(e as Error)?.message ?? String(e)}`
    }
  }

  return NextResponse.json({
    ok: true,
    signals: signals.length,
    sample: signals.slice(0, 6).map((s) => s.summary),
    fresh: fresh.length,
    made,
    firstError,
  })
}
