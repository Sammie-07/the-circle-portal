import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBatch } from '@/lib/content/generate-batch'

export const runtime = 'nodejs'
export const maxDuration = 60

// One-off backfill trigger for seeding the content bank from existing member
// activity. Inert (403) unless an admin has set app_settings.content_backfill_token
// out of band and it matches ?token=. Delete that setting to disable. Each call
// generates a small batch (deduped), so call it a few times to fill the bank.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const admin = createAdminClient()
  const { data } = await admin.from('app_settings').select('value').eq('key', 'content_backfill_token').maybeSingle()
  const expected = ((data?.value as string) ?? '').trim()
  if (!expected || token !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const generated = await generateBatch({ cap: 3, force: true })
  return NextResponse.json({ ok: true, generated })
}
