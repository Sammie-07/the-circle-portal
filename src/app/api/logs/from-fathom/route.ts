import { createClient } from '@/lib/supabase/server'
import { getAnthropic } from '@/lib/ai'
import { fetchFathomTranscript } from '@/lib/fathom'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

// Faster model for extraction/attribution (this is a read-and-structure task,
// not deep reasoning), so a 50+ minute transcript processes inside the limit.
const EXTRACT_MODEL = 'claude-sonnet-5'

interface MemberLite { id: string; name: string }
interface ExtractedRow {
  member_id: string
  attended: boolean
  questions_count: number
  notes: string
  homeworks?: { title?: string; description?: string }[]
}

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set on the server' }, { status: 500 })
    }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!['owner', 'admin', 'manager'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
    const userId = user.id

    let body: { url?: string } = {}
    try { body = await request.json() } catch { /* handled below */ }
    if (!body.url) return NextResponse.json({ error: 'Paste a Fathom share link first.' }, { status: 400 })

    const transcript = await fetchFathomTranscript(body.url)

    // Real, active members only. Internal/staff accounts (Gogo, Kristy, Ferny,
    // Adriana, test profiles) also appear as speakers on the call but must never
    // be attributed as members.
    const { data: members } = await supabase
      .from('members')
      .select('id, name')
      .eq('status', 'active')
      .neq('is_internal', true)
    const roster = (members ?? []) as MemberLite[]
    if (roster.length === 0) return NextResponse.json({ error: 'No active members to match.' }, { status: 400 })

    const rosterList = roster.map((m) => `- ${m.name} (id: ${m.id})`).join('\n')

    const prompt = `You are processing the transcript of a group coaching call for Gogo Bethke's program, The Circle. Speakers are labeled by their real names. Attribute what happened to the right member.

ROSTER (match transcript speakers to these members by name; "Krystal" matches "Krystal Thomas", first names or nicknames are fine):
${rosterList}

For EACH member in the roster, produce:
- "attended": true if that member spoke or clearly participated in the call, false if they are not present in the transcript at all.
- "questions_count": the number of DISTINCT problems, questions, or requests for help this member raised on the call, even if not phrased as a literal question (a struggle they described, something they asked for help with, a decision they were stuck on, etc.). 0 if none.
- "notes": do NOT transcribe everything they said. Use judgment and capture ONLY what is worth noting for coaching and their monthly report: their key questions and problems, what they need help with, and any notable updates, decisions, or wins. Skip small talk and filler. 1 to 4 tight sentences, specific and factual. Empty string if they did not participate or nothing was worth noting.
- "homeworks": action items THIS member needs to do, based ONLY on what was assigned or agreed on the call, things Gogo (the coach) told them to do, or that they clearly committed to as a next step. Do NOT invent tasks, do NOT add generic best-practice advice, and do NOT include things that were merely discussed but not assigned. Each item is {"title": a short imperative task, "description": one line of context if helpful}. Empty array if nothing was assigned to them on this call.

Rules:
- Speakers who are NOT in the roster (for example the coach, Gogo, or a guest) are ignored, do not invent a member for them.
- A member not found in the transcript: attended false, questions_count 0, notes "", homeworks [].
- Never invent content. Only use what is in the transcript.
- Never use em dashes or en dashes.

Return ONLY a JSON object: {"members":[{"member_id":"<id>","attended":<bool>,"questions_count":<int>,"notes":"<text>","homeworks":[{"title":"<task>","description":"<context or empty>"}]}]}. Include every roster member exactly once.

TRANSCRIPT (${transcript.title}):
${transcript.text}`

    const message = await getAnthropic().messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
    // Read ALL text blocks (the model may emit a thinking block first, so
    // content[0] can be non-text and empty).
    const raw = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    const jsonText = raw.replace(/^\s*```[a-zA-Z]*\s*/, '').replace(/\s*```\s*$/, '').trim()

    let parsed: { members?: ExtractedRow[] }
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return NextResponse.json({ error: 'Could not read the call results. Please try processing again.' }, { status: 502 })
    }

    // Only return rows for real roster ids; clamp shapes.
    const validIds = new Set(roster.map((m) => m.id))
    const rows = (parsed.members ?? [])
      .filter((r) => validIds.has(r.member_id))
      .map((r) => ({
        member_id: r.member_id,
        showed_up: r.attended === true,
        questions_asked: Math.max(0, Math.round(Number(r.questions_count) || 0)),
        notes: typeof r.notes === 'string' ? r.notes.replace(/\s*[—–]\s*/g, ', ').trim() : '',
      }))

    // Auto-suggest homework from the call: action items Gogo assigned or the
    // member committed to. Created as source 'call' + auto_suggested so they show
    // in each member's backend for the admin to accept, edit, or delete.
    const noDash = (s: string) => s.replace(/\s*[—–]\s*/g, ', ').trim()
    const suggestions: { member_id: string; title: string; description: string | null }[] = []
    for (const r of parsed.members ?? []) {
      if (!validIds.has(r.member_id) || !Array.isArray(r.homeworks)) continue
      for (const h of r.homeworks) {
        const title = noDash(String(h?.title ?? '')).slice(0, 200)
        if (!title) continue
        const description = h?.description ? noDash(String(h.description)).slice(0, 500) : null
        suggestions.push({ member_id: r.member_id, title, description })
      }
    }

    let suggestedHomework = 0
    if (userId && suggestions.length) {
      // Dedupe against call-sourced tasks already suggested for these members
      // (so re-processing the same call does not pile up duplicates).
      const memberIds = [...new Set(suggestions.map((s) => s.member_id))]
      const { data: existing } = await supabase
        .from('homework')
        .select('member_id, title')
        .eq('source', 'call')
        .in('member_id', memberIds)
      const seen = new Set((existing ?? []).map((e) => `${e.member_id}::${(e.title ?? '').trim().toLowerCase()}`))
      const toInsert = suggestions
        .filter((s) => !seen.has(`${s.member_id}::${s.title.trim().toLowerCase()}`))
        .map((s) => ({
          member_id: s.member_id,
          title: s.title,
          description: s.description,
          type: 'task' as const,
          source: 'call' as const,
          auto_suggested: true,
          completed: false,
          created_by: userId,
        }))
      if (toInsert.length) {
        const { error } = await supabase.from('homework').insert(toInsert)
        if (!error) suggestedHomework = toInsert.length
      }
    }

    const attended = rows.filter((r) => r.showed_up).length
    return NextResponse.json({ title: transcript.title, speakers: transcript.speakers, attended, rows, suggestedHomework })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Something went wrong processing the call.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
