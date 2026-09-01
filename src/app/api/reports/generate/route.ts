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
    if (!['owner', 'admin', 'manager'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

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
    const questionsAsked = allLogs.reduce((sum: number, l: { questions_asked: number }) => sum + (l.questions_asked ?? 0), 0)
    const attendanceRate = totalWeeks > 0 ? Math.round((attended / totalWeeks) * 100) : 0

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

    // ── Homework accomplishments (the real work, from the homework table) ──
    // The report used to see only a per-week "homework_done" boolean and never the
    // actual tasks, so real milestones (hired a CPA, paid off debt, bought a
    // property, built a team) were invisible, and work assigned live on calls that
    // was never in the blueprint was silently ignored. Pull the tasks so the
    // narrative reflects what actually happened.
    const { data: homeworkRows } = await supabase
      .from('homework')
      .select('title, description, source, completed, completed_at, created_at')
      .eq('member_id', member_id)

    const hw = homeworkRows ?? []
    const inWindow = (ts: string | null) => Boolean(ts && new Date(ts) >= cutoff)

    // Blueprint items are the north star and the ONLY thing scored for blueprint %.
    const blueprintHw = hw.filter((h) => h.source === 'blueprint')
    const blueprintTotal = blueprintHw.length
    const blueprintDone = blueprintHw.filter((h) => h.completed).length
    const blueprintPct = blueprintTotal > 0 ? Math.round((blueprintDone / blueprintTotal) * 100) : 0

    // Task-based completion numbers (real, not the old per-week boolean).
    const completedThisPeriod = hw.filter((h) => h.completed && inWindow(h.completed_at))
    const hwCompletedCount = completedThisPeriod.length
    const totalActiveHw = hw.length
    const totalCompletedHw = hw.filter((h) => h.completed).length
    const overallHwPct = totalActiveHw > 0 ? Math.round((totalCompletedHw / totalActiveHw) * 100) : 0

    const fmtTask = (h: { title: string; description: string | null; source: string }) =>
      `- ${h.title}${h.description ? `: ${h.description.replace(/\s+/g, ' ').slice(0, 200)}` : ''} [${h.source === 'blueprint' ? 'BLUEPRINT' : 'LIVE, assigned on a call'}]`

    const completedThisPeriodList = completedThisPeriod.length
      ? completedThisPeriod.map(fmtTask).join('\n')
      : '(no homework marked complete in this specific period)'
    // Everything completed to date, so big milestones from earlier in the quarter
    // are not lost, especially in quarterly reports.
    const allCompletedList = hw.filter((h) => h.completed).map(fmtTask).join('\n') || '(none yet)'

    // Quarters are per-member (their own journey from join_date), so quarterly
    // reports are labelled by program quarter, not the calendar quarter.
    const periodLabel = period_type === 'quarterly' ? `Q${currentQuarter} Review` : getPeriodLabel(period_type)

    const brainQuery = `Circle coaching ${period_type} progress accountability ${currentQuarterData?.focus ?? 'results business growth'}`
    const brainContext = await fetchBrainContext(brainQuery)

    const prompt = `You are writing a ${period_type} progress report for ${member.name}, a member of Gogo Bethke's 12-month high-ticket coaching program, The Circle. Write it as Gogo would, speaking directly to the member ("you").

Two things anchor this report:
1. THE BLUEPRINT is the member's 12-month map, the plan Gogo built for them. It is the north star, and blueprint progress is measured against it.
2. REAL LIFE happens outside the plan. Members get work assigned live on coaching calls, and their goals genuinely evolve mid-program. That real work counts and must be honored, even though it is NOT scored against the blueprint.

---

MEMBER: ${member.name}
PERIOD: ${periodLabel}
COHORT: ${member.cohort ?? 'The Circle'}
WEEK ${weeksIn + 1} OF THEIR PROGRAM, CURRENT QUARTER Q${currentQuarter}${currentQuarterData?.title ? ` (${currentQuarterData.title})` : ''}
${currentQuarterData?.focus ? `Q${currentQuarter} FOCUS: ${currentQuarterData.focus}` : ''}

---

THE NUMBERS (use these EXACT figures, never invent or estimate others):
- Tuesday calls attended: ${attended} of ${totalWeeks} weeks (${attendanceRate}%)
- Homework completed this period: ${hwCompletedCount} task${hwCompletedCount === 1 ? '' : 's'}
- Blueprint progress overall: ${blueprintDone} of ${blueprintTotal} blueprint items done (${blueprintPct}%)
- Overall homework completion: ${totalCompletedHw} of ${totalActiveHw} (${overallHwPct}%)
- Questions asked on calls: ${questionsAsked}

HOMEWORK COMPLETED THIS PERIOD (each tagged BLUEPRINT or LIVE):
${completedThisPeriodList}

ALL COMPLETED WORK TO DATE (context, so big milestones from earlier this quarter are not missed):
${allCompletedList}

${weeklyNotes ? `NOTES FROM THE TEAM:\n${weeklyNotes}\n\n---\n` : ''}
${blueprintText ? `THEIR BLUEPRINT (the plan, the baseline to measure blueprint progress against):\n${blueprintText}\n\n---\n` : 'NOTE: No blueprint on file yet, so write from their real activity and general Circle coaching principles.\n\n---\n'}
${brainContext ? `GOGO'S COACHING PRINCIPLES (from The Brain, use for framing and voice):\n${brainContext}\n\n---\n` : ''}

WHAT COUNTS AS AN ACCOMPLISHMENT WORTH WRITING ABOUT (critical):
- Write about MEANINGFUL progress: hiring a CPA, sorting taxes, paying down debt, buying real estate, hiring an assistant, building a team or downline, opening new income streams, building systems, and real business or mindset milestones.
- Include big work whether it came from the BLUEPRINT or was assigned LIVE on a call. If the member has intentionally pivoted away from an original blueprint goal (for example, deciding not to build a big local team after all) and is doing meaningful work in a new direction, HONOR that real work. Do not scold them for drifting from the original plan when the drift is a deliberate, healthy choice.
- Do NOT put small tactical tasks in the narrative (for example "capitalize the headers on your website", "update your link in bio", minor admin). They can be reflected in the homework count, but they are never story-worthy and must never headline a section.
- Only BLUEPRINT items count toward the blueprint progress percentage. Live and call-assigned work is celebrated but never scored against the blueprint.

REPORT STRUCTURE:
1. WHERE YOU ARE: open warmly and place them in their journey (Q${currentQuarter}, week ${weeksIn + 1}), what this stage is about.
2. THE NUMBERS: present the figures above plainly and kindly, as a check-in, not a verdict. Include homework completed this period and the percentage, attendance, and blueprint progress.
3. WHAT'S WORKING: lead with genuine, specific wins. Pull the meaningful accomplishments (blueprint AND live) from the data above and name them.
4. WHERE THERE'S ROOM (include ONLY if the data shows a real gap, such as low attendance or stalled blueprint progress): name it honestly and with care. Acknowledge effort and life. Connect input to output gently. One honest, compassionate paragraph, never a lecture.
5. THE ONE MOVE: one clear, encouraging next step, tied to their Q${currentQuarter} focus or their real current direction.
6. CLOSING: warm, Gogo's voice, leaving them feeling seen, believed in, and motivated.

TONE (this matters, and it has been softened on purpose):
- Gogo Bethke's voice: warm, direct, real, and personal. Lean noticeably kinder and more human than a scorecard. This is a real person doing hard things, and life happens.
- Be encouraging and sensitive. Acknowledge effort and context. Celebrate progress generously.
- Still be honest: do NOT pamper, and do NOT paper over a real gap or pretend weak numbers are fine. Name what is true, kindly. Honest and warm at the same time.
- Never shame, never guilt-trip, never use fear or pressure as motivation.

PUNCTUATION AND VOICE (strict):
- NEVER use em dashes or en dashes. Use commas, periods, or rewrite the sentence.
- Write natural, flowing prose in complete sentences. Short sentences for emphasis only, never a string of clipped fragments.

OUTPUT: Return ONLY the raw HTML body content (no <html>/<head> tags, no markdown code fences, never start with \`\`\`). Begin directly with an HTML tag. Inline styles only. Brand: background #0D0D0D, text #F5F5F5, gold #C9A227, red #CC1F1F, card background #1A1A1A, borders #2A2A2A. Georgia serif headings, Helvetica body. Max width 700px.${feedback ? `\n\n---\n\nREGENERATION REQUEST FROM ADMIN:\n${feedback}\n\nAddress every point in the feedback above while keeping the same structure, brand, and voice.` : ''}`

    // ─── REVISION MODE ───────────────────────────────────────────────────────
    // When refining an existing unsent report, we must EDIT THE CURRENT DOCUMENT
    // rather than generate a fresh one. Regenerating from scratch re-rolls every
    // sentence, so each round of feedback silently undid the previous rounds
    // ("it fixes one thing and changes back another"). Passing the live HTML and
    // demanding a targeted edit is what makes earlier fixes stick: the document
    // itself carries the accumulated state.
    let existingReport: { id: string; sent_at: string | null; content_html: string | null } | null = null
    if (report_id) {
      const { data } = await supabase
        .from('reports')
        .select('id, sent_at, content_html')
        .eq('id', report_id)
        .single()
      existingReport = data ?? null
    }

    const isRevision = Boolean(
      feedback && existingReport && !existingReport.sent_at && existingReport.content_html?.trim()
    )

    const revisionPrompt = `You are revising an existing progress report for ${member.name}. The document below has already been reviewed and refined by an admin over previous rounds.

CURRENT REPORT (the live document):
${existingReport?.content_html ?? ''}

THE ADMIN'S REQUESTED CHANGES:
${feedback}

RULES FOR THIS REVISION (critical, this is an EDIT and not a rewrite):
- Apply ONLY the changes requested above.
- Return every other part of the document EXACTLY as it is: same sections, same order, same sentences, same numbers, same wording, same inline styles. Do not reword, reorder, re-summarize, shorten, or "improve" anything the request does not explicitly ask you to change.
- Earlier rounds of feedback are already baked into this document. Leaving untouched text byte-identical is how those earlier fixes survive. Rewriting an untouched section is a bug, not an improvement.
- If a request affects one sentence, change that one sentence and nothing else.
- Keep the same HTML structure, inline styles, and brand colors.
- NEVER use em dashes or en dashes. Use commas or rewrite the sentence.

REFERENCE DATA (use ONLY if the admin's request asks you to correct a fact or number):
Attendance ${attendanceRate}% (${attended} of ${totalWeeks}) · Homework completed this period ${hwCompletedCount} · Blueprint progress ${blueprintDone}/${blueprintTotal} (${blueprintPct}%) · Overall homework ${totalCompletedHw}/${totalActiveHw} (${overallHwPct}%) · Questions asked ${questionsAsked} · Week ${weeksIn} · Q${currentQuarter}

OUTPUT: Return the COMPLETE revised report as raw HTML body content. No markdown code fences, no commentary, no diff. Begin directly with an HTML tag.`

    console.log('[Report]', isRevision ? 'Revising' : 'Generating', 'for', member.name, '—', period_type)
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      // A revision must return the COMPLETE document, so the cap has to clear the
      // full report comfortably. (Capped output is billed by what's produced, so a
      // generous ceiling costs nothing extra and prevents a truncated overwrite.)
      max_tokens: 8000,
      messages: [{ role: 'user', content: isRevision ? revisionPrompt : prompt }],
    })
    console.log('[Report] Done, tokens:', message.usage?.output_tokens)

    const rawContent = message.content[0].type === 'text' ? message.content[0].text : ''
    const contentHtml = cleanReportHtml(rawContent)
    if (!contentHtml.trim()) {
      return NextResponse.json({ error: 'Claude returned an empty response. Please try again.' }, { status: 500 })
    }

    // Safety net: never let a truncated or collapsed revision destroy a report the
    // admin has already refined. If an edit comes back dramatically shorter than
    // the document it was editing, the model dropped content, so refuse the save.
    if (isRevision && existingReport?.content_html) {
      const before = existingReport.content_html.length
      if (contentHtml.length < before * 0.6) {
        return NextResponse.json(
          { error: 'The revision came back incomplete, so your current report was left untouched. Please try again, ideally asking for one change at a time.' },
          { status: 502 }
        )
      }
    }

    // If regenerating an unsent report, update it in place — keep the same ID and share_token
    if (report_id) {
      const existing = existingReport
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
        period_label: periodLabel,
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
