import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { scanRecentSignals } from '@/lib/content/signals'
import { generatePost } from '@/lib/content/generate'

export const runtime = 'nodejs'
export const maxDuration = 60

const STAFF = ['owner', 'admin', 'manager']
const MAX_PER_RUN = 6 // keep within the function time budget; click again for more
const CONCURRENCY = 2

// POST /api/content/generate — scan recent member activity and generate new
// draft posts for any signal we haven't already turned into content.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const signals = await scanRecentSignals(admin)
  if (signals.length === 0) {
    return NextResponse.json({ ok: true, generated: 0, remaining: 0, reason: 'no activity to post about yet' })
  }

  // Skip signals we've already generated (dedupe_key).
  const { data: existing } = await admin.from('content_posts').select('dedupe_key')
  const seen = new Set((existing ?? []).map((r) => r.dedupe_key).filter(Boolean))
  const fresh = signals.filter((s) => !seen.has(s.dedupeKey))
  const batch = fresh.slice(0, MAX_PER_RUN)

  // Generate with light concurrency.
  const results: Array<{ signal: (typeof batch)[number]; content: Awaited<ReturnType<typeof generatePost>> } | null> = []
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const slice = batch.slice(i, i + CONCURRENCY)
    const settled = await Promise.all(
      slice.map(async (signal) => {
        try {
          const content = await generatePost(signal)
          return { signal, content }
        } catch {
          return null
        }
      })
    )
    results.push(...settled)
  }

  const rows = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map(({ signal, content }) => ({
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
      status: 'draft' as const,
    }))

  let generated = 0
  if (rows.length) {
    const { error } = await admin.from('content_posts').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    generated = rows.length
  }

  return NextResponse.json({
    ok: true,
    generated,
    remaining: Math.max(0, fresh.length - batch.length),
    candidates: fresh.length,
  })
}
