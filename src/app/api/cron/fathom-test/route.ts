import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchFathomTranscript } from '@/lib/fathom'
import { getAnthropic } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 120

// TEMP diagnostic: token-gated (app_settings.fathom_test_token). Tests each stage
// of the Fathom import on the SERVER so we can see whether the transcript fetch
// works from Vercel's IP and how long each step takes. Remove after debugging.
export async function GET(request: Request) {
  const u = new URL(request.url)
  const token = u.searchParams.get('token')
  const url = u.searchParams.get('url')
  const admin = createAdminClient()
  const { data: tok } = await admin.from('app_settings').select('value').eq('key', 'fathom_test_token').maybeSingle()
  if (!tok?.value || token !== tok.value) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!url) return NextResponse.json({ error: 'pass ?url=' }, { status: 400 })

  const dbg: Record<string, unknown> = { hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY }
  try {
    const t0 = Date.now()
    const tr = await fetchFathomTranscript(url)
    dbg.fetchMs = Date.now() - t0
    dbg.title = tr.title
    dbg.chars = tr.text.length
    dbg.speakers = tr.speakers
  } catch (e) {
    dbg.fetchError = (e as Error).message
    return NextResponse.json({ stage: 'fetch', ok: false, ...dbg }, { status: 200 })
  }

  try {
    const t1 = Date.now()
    const msg = await getAnthropic().messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
    })
    dbg.aiMs = Date.now() - t1
    dbg.aiReply = msg.content[0].type === 'text' ? msg.content[0].text.slice(0, 40) : ''
  } catch (e) {
    dbg.aiError = (e as Error).message
    return NextResponse.json({ stage: 'ai', ok: false, ...dbg }, { status: 200 })
  }

  return NextResponse.json({ stage: 'done', ok: true, ...dbg })
}
