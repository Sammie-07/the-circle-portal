import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchFathomTranscript } from '@/lib/fathom'
import { getAnthropic } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 120

// TEMP diagnostic: runs the FULL extraction (fetch + attribution) so we can see
// end-to-end timing and whether it completes within the function limit.
export async function GET(request: Request) {
  const u = new URL(request.url)
  const token = u.searchParams.get('token')
  const url = u.searchParams.get('url')
  const admin = createAdminClient()
  const { data: tok } = await admin.from('app_settings').select('value').eq('key', 'fathom_test_token').maybeSingle()
  if (!tok?.value || token !== tok.value) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!url) return NextResponse.json({ error: 'pass ?url=' }, { status: 400 })

  const dbg: Record<string, unknown> = {}
  const start = Date.now()
  try {
    const tr = await fetchFathomTranscript(url)
    dbg.fetchMs = Date.now() - start
    dbg.chars = tr.text.length

    const { data: members } = await admin.from('members').select('id, name').eq('status', 'active').neq('is_internal', true)
    const roster = members ?? []
    dbg.roster = roster.length
    const rosterList = roster.map((m) => `- ${m.name} (id: ${m.id})`).join('\n')

    const prompt = `Process this coaching call transcript. Speakers use real names. For each roster member return attended (bool), questions_count (int: distinct problems/questions/help raised), notes (1-4 sentences, only what's worth noting), homeworks (array of {title,description} of tasks assigned to them on the call, else []). Match names/nicknames to roster. Ignore non-roster speakers. Return ONLY {"members":[{"member_id","attended","questions_count","notes","homeworks"}]}.

ROSTER:
${rosterList}

TRANSCRIPT:
${tr.text}`

    const t1 = Date.now()
    const msg = await getAnthropic().messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
    dbg.aiMs = Date.now() - t1
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonText = raw.replace(/^\s*```[a-zA-Z]*\s*/, '').replace(/\s*```\s*$/, '').trim()
    try {
      const parsed = JSON.parse(jsonText)
      dbg.parseOk = true
      dbg.memberCount = Array.isArray(parsed.members) ? parsed.members.length : 0
      dbg.attended = (parsed.members ?? []).filter((m: { attended?: boolean }) => m.attended).length
      dbg.sample = (parsed.members ?? []).slice(0, 3)
    } catch {
      dbg.parseOk = false
      dbg.rawSnippet = raw.slice(0, 300)
    }
    dbg.totalMs = Date.now() - start
    return NextResponse.json({ ok: true, ...dbg })
  } catch (e) {
    dbg.error = (e as Error).message
    dbg.totalMs = Date.now() - start
    return NextResponse.json({ ok: false, ...dbg }, { status: 200 })
  }
}
