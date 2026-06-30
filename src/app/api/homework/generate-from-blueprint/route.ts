import { createClient } from '@/lib/supabase/server'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { NextResponse } from 'next/server'

export const maxDuration = 60
export const runtime = 'nodejs'

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000)
}

interface GeneratedTask {
  title: string
  description: string
  type: 'homework' | 'task'
  due_date: string | null
  sort_order: number
}

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const { member_id } = await request.json()
    if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

    const { data: member } = await supabase
      .from('members')
      .select('name, blueprint_html, join_date')
      .eq('id', member_id)
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (!member.blueprint_html) return NextResponse.json({ error: 'No blueprint generated yet' }, { status: 400 })

    const blueprintText = stripHtml(member.blueprint_html)

    // Determine current quarter from join date
    const joinDate = new Date(member.join_date)
    const weeksIn = Math.floor((new Date().getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
    const currentQuarter = Math.min(Math.ceil(weeksIn / 13) || 1, 4)

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // End of current quarter
    const qEndWeek = currentQuarter * 13
    const qEndDate = new Date(joinDate.getTime() + qEndWeek * 7 * 24 * 60 * 60 * 1000)
    const qEndStr = qEndDate.toISOString().split('T')[0]

    const anthropic = getAnthropic()

    const prompt = `You are reading ${member.name}'s 12-month Circle coaching blueprint prepared by Gogo Bethke.

Today is ${todayStr}. ${member.name} is currently in Q${currentQuarter} of their program.

Extract ALL concrete action items, homework assignments, and tasks from this blueprint that are relevant to their CURRENT quarter (Q${currentQuarter}) and the immediate weeks ahead.

For each item:
- "type": use "homework" for recurring actions (show up to calls, do weekly assignments, post content, etc.) and "task" for one-time concrete deliverables (hire someone, set up a system, create a document, complete a specific action)
- "title": short and actionable (under 60 chars), written as a command ("Set up Monday huddles", "Hire a VA", "Post 3x per week")
- "description": 1-2 sentences with context from the blueprint — why this matters, what specifically to do
- "due_date": ISO date string (YYYY-MM-DD) if there's a clear deadline or it maps to a Q${currentQuarter} milestone (end ${qEndStr}), otherwise null
- "sort_order": number starting at 0, ordered by priority/urgency

Return ONLY a valid JSON array. No markdown, no commentary, no code fences. Example format:
[{"title":"...","description":"...","type":"homework","due_date":null,"sort_order":0}]

Aim for 8–15 high-quality items. Avoid vague items like "work hard" or "stay focused". Every task should be specific enough that the member knows exactly what to do.

BLUEPRINT TEXT:
${blueprintText}`

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    if (!raw) return NextResponse.json({ error: 'No response from Claude' }, { status: 500 })

    let tasks: GeneratedTask[]
    try {
      // Strip any accidental markdown fences
      const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
      tasks = JSON.parse(cleaned)
      if (!Array.isArray(tasks)) throw new Error('Not an array')
    } catch {
      console.error('[GenerateTasks] Parse error, raw:', raw.slice(0, 500))
      return NextResponse.json({ error: 'Could not parse tasks from Claude response' }, { status: 500 })
    }

    // Validate + sanitise each task
    const safe = tasks
      .filter(t => t.title && typeof t.title === 'string')
      .map((t, i) => ({
        member_id,
        title: String(t.title).slice(0, 200),
        description: t.description ? String(t.description).slice(0, 1000) : null,
        type: t.type === 'task' ? 'task' : 'homework',
        source: 'blueprint',
        due_date: t.due_date ?? null,
        sort_order: typeof t.sort_order === 'number' ? t.sort_order : i,
        created_by: user.id,
      }))

    if (safe.length === 0) return NextResponse.json({ error: 'No valid tasks extracted' }, { status: 500 })

    const { data: inserted, error } = await supabase
      .from('homework')
      .insert(safe)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    console.log(`[GenerateTasks] Created ${inserted?.length} tasks for ${member.name}`)
    return NextResponse.json({ tasks: inserted, count: inserted?.length ?? 0 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GenerateTasks] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
