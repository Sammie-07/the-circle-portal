import { createClient } from '@/lib/supabase/server'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { sanitizeBrainText } from '@/lib/brain-search'
import { NextResponse } from 'next/server'

export const maxDuration = 120
export const runtime = 'nodejs'

async function fetchBrainContext(query: string): Promise<string> {
  const brainUrl = process.env.BRAIN_SUPABASE_URL
  const brainKey = process.env.BRAIN_SUPABASE_ANON_KEY
  if (!brainUrl || !brainKey) return ''

  try {
    const res = await fetch(`${brainUrl}/rest/v1/rpc/match_brain_chunks`, {
      method: 'POST',
      headers: {
        apikey: brainKey,
        Authorization: `Bearer ${brainKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query_text: query, match_count: 5 }),
    })
    if (!res.ok) return ''
    const chunks = await res.json()
    return sanitizeBrainText(chunks.map((c: { content: string }) => c.content).join('\n\n'))
  } catch (err) {
    console.warn('[Report] Brain fetch error:', err instanceof Error ? err.message : String(err))
    return ''
  }
}

function getPeriodLabel(periodType: string): string {
  const now = new Date()
  if (periodType === 'monthly') {
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  if (periodType === 'quarterly') {
    const q = Math.ceil((now.getMonth() + 1) / 3)
    return `Q${q} ${now.getFullYear()}`
  }
  return `${now.getFullYear()} Annual Review`
}

function getWeeksForPeriod(periodType: string): number {
  if (periodType === 'monthly') return 4
  if (periodType === 'quarterly') return 13
  return 52
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)
}

// Clean the model's raw output before it's saved/rendered:
//  1. Strip any markdown code fence the model wraps the HTML in (```html … ```),
//     which otherwise renders as a literal "```html" banner at the top.
//  2. Remove em/en dashes entirely — reports must never contain them. Replace
//     them with a comma so clauses read as one natural, flowing sentence
//     instead of a hard break.
function cleanReportHtml(raw: string): string {
  let html = raw.trim()

  // Strip a leading ```html / ``` fence and a trailing ``` fence (any casing).
  html = html
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?\s*```\s*$/, '')
    .trim()

  // No em or en dashes, ever. Collapse surrounding spaces into a single comma.
  html = html
    .replace(/\s*[—–]\s*/g, ', ')
    // Tidy up any artefacts the substitution can create.
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/,(?=\S)/g, ', ')

  return html
}

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set on the server' }, { status: 500 })
    const anthropic = getAnthropic()

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    let body: { member_id?: string; period_type?: string; feedback?: string; report_id?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { member_id, period_type, feedback, report_id } = body
    if (!member_id || !period_type) {
      return NextResponse.json({ error: 'member_id and period_type required' }, { status: 400 })
    }

    const weeks = getWeeksForPeriod(period_type)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - weeks * 7)

    const { data: member } = await supabase.from('members').select('*').eq('id', member_id).single()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const { data: logs } = await supabase
      .from('weekly_logs')
      .select('*')
      .eq('member_id', member_id)
      .gte('week_of', cutoff.toISOString().split('T')[0])
      .order('week_of', { ascending: false })

    const allLogs = logs ?? []
    const totalWeeks = allLogs.length
    const attended = allLogs.filter(l => l.showed_up).length
    const homeworkDone = allLogs.filter(l => l.homework_done).length
    const questionsAsked = allLogs.reduce((sum: number, l: { questions_asked: number }) => sum + (l.questions_asked ?? 0), 0)
    const attendanceRate = totalWeeks > 0 ? Math.round((attended / totalWeeks) * 100) : 0
    const homeworkRate = totalWeeks > 0 ? Math.round((homeworkDone / totalWeeks) * 100) : 0

    const joinDate = new Date(member.join_date)
    const weeksIn = Math.floor((new Date().getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
    const currentQuarter = Math.min(Math.ceil(weeksIn / 13) || 1, 4)

    const blueprintText = member.blueprint_html ? stripHtml(member.blueprint_html) : null
    const blueprintData = member.blueprint_data
    const currentQuarterData = blueprintData?.quarters?.[currentQuarter - 1]

    const weeklyNotes = allLogs
      .filter((l: { notes: string | null }) => l.notes)
      .map((l: { week_of: string; notes: string }) => `Week of ${l.week_of}: ${l.notes}`)
      .join('\n')

    const brainQuery = `Circle coaching ${period_type} progress accountability ${currentQuarterData?.focus ?? 'results business growth'}`
    const brainContext = await fetchBrainContext(brainQuery)

    const prompt = `You are generating a ${period_type} progress report for a Circle member in Gogo Bethke's 12-month high-ticket coaching program.

The BLUEPRINT is the member's 12-month map — the plan Gogo made for them. This report measures their ACTUAL RESULTS against that plan. The blueprint is not a bonus reference — it IS the standard. The report exists to close the gap between the plan and reality, or celebrate when they're nailing it.

---

MEMBER: ${member.name}
PERIOD: ${getPeriodLabel(period_type)}
COHORT: ${member.cohort ?? 'The Circle'}
WEEK ${weeksIn + 1} OF THEIR PROGRAM
CURRENT QUARTER: Q${currentQuarter}${currentQuarterData?.title ? ` — ${currentQuarterData.title}` : ''}
${currentQuarterData?.focus ? `Q${currentQuarter} FOCUS: ${currentQuarterData.focus}` : ''}

---

ACTIVITY DATA THIS PERIOD:
- Weeks tracked: ${totalWeeks}
- Tuesday calls attended: ${attended} of ${totalWeeks} (${attendanceRate}%)
- Homework completed: ${homeworkDone} of ${totalWeeks} (${homeworkRate}%)
- Questions asked on calls: ${questionsAsked}
${weeklyNotes ? `\nWEEKLY NOTES FROM ADRIANA:\n${weeklyNotes}` : ''}

---

${blueprintText ? `THEIR BLUEPRINT (what Gogo mapped out for them, this is the baseline):\n${blueprintText}\n\n---\n` : 'NOTE: No blueprint generated yet for this member, so generate the report based on general Circle coaching principles.\n\n---\n'}

${brainContext ? `GOGO'S COACHING PRINCIPLES (from The Brain):\n${brainContext}\n\n---\n` : ''}

REPORT STRUCTURE:
1. Open with WHERE THEY ARE in their blueprint right now: Q${currentQuarter}, what the plan called for, framed as "the map said X."
2. THE NUMBERS: attendance % and homework % shown plainly, compared to the blueprint standard (75%+ attendance, 100% homework is the expectation).
3. WHAT'S WORKING: specific wins, even small ones. Lead with what's good.
4. THE GAP (if any): if attendance is under 75% or homework under 50%, be direct. Name what the blueprint called for, what the data actually shows, and the cost of that gap, written as flowing sentences rather than clipped fragments. Tie lack of input to lack of output. Never shame, but never soften the truth.
5. THE ONE MOVE: one specific action for next month, tied directly to their Q${currentQuarter} blueprint focus.
6. CLOSING LINE: Gogo's voice, direct, warm, and demanding, landing on a confident note that tells them they have the map and it's time to move.

TONE: Gogo Bethke, direct, warm, no-BS. The report feels like Gogo wrote it personally after looking at their data and their blueprint side by side. It is not a form letter. It knows this specific person's plan.

PUNCTUATION AND VOICE (strict):
- NEVER use em dashes (—) or en dashes (–). Not once. Use commas, periods, or rewrite the sentence instead.
- Write in natural, flowing prose. Connect related ideas into complete sentences. Do NOT chop thoughts into a string of two or three word fragments. Short sentences are fine for emphasis, but they should be the exception, not the rhythm of the whole report.
- Read it back in your head: it should sound like a person talking warmly and plainly, not a list of punches.

OUTPUT: Return ONLY the raw HTML body content (no <html>/<head> tags). Do NOT wrap the output in markdown code fences. Never start the response with \`\`\`html or \`\`\` and never end it with \`\`\`. Output must begin directly with an HTML tag. Inline styles only. The Circle brand: background #0D0D0D, text #F5F5F5, gold #C9A227, red #CC1F1F, card background #1A1A1A, borders #2A2A2A. Georgia serif headings, Helvetica body. Max width 700px.${feedback ? `\n\n---\n\nREGENERATION REQUEST FROM ADMIN:\n${feedback}\n\nThis is a regeneration of a previous report. Address every point in the feedback above while keeping the same structure, brand, and voice.` : ''}`

    console.log('[Report] Generating for', member.name, '—', period_type)
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    })
    console.log('[Report] Done, tokens:', message.usage?.output_tokens)

    const rawContent = message.content[0].type === 'text' ? message.content[0].text : ''
    const contentHtml = cleanReportHtml(rawContent)
    if (!contentHtml.trim()) {
      return NextResponse.json({ error: 'Claude returned an empty response. Please try again.' }, { status: 500 })
    }

    // If regenerating an unsent report, update it in place — keep the same ID and share_token
    if (report_id) {
      const { data: existing } = await supabase
        .from('reports')
        .select('id, sent_at')
        .eq('id', report_id)
        .single()

      if (existing && !existing.sent_at) {
        const { data: report, error } = await supabase
          .from('reports')
          .update({ content_html: contentHtml, generated_at: new Date().toISOString() })
          .eq('id', report_id)
          .select()
          .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ report })
      }
    }

    // Otherwise insert a new report
    const { data: report, error } = await supabase
      .from('reports')
      .insert({
        member_id,
        period_type,
        period_label: getPeriodLabel(period_type),
        content_html: contentHtml,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ report })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Report] Unhandled error:', msg)
    return NextResponse.json({ error: `Unexpected error: ${msg}` }, { status: 500 })
  }
}
