import type { SupabaseClient } from '@supabase/supabase-js'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { searchBrain, buildBrainContext } from '@/lib/brain-search'
import { BLUEPRINT_CSS, BLUEPRINT_CSS_CLASSES, cleanBlueprintPart } from '@/lib/blueprint-shell'
import { CIRCLE_FACTS } from '@/lib/circle-facts'
import { getSetting } from '@/lib/settings'
import { CEO_CALL_FIELDS } from '@/lib/problem-statement'

// The 12-Month CEO Roadmap: the deliverable for people who had a CEO Call with
// Gogo (a separate product from The Circle, same universe). Built from the
// call transcript, their CEO Call Form answers, the problem statement and
// Gogo's Brain. Month by month with week-by-week actions, a posting schedule
// when social media is part of the problem, and every fix pointing back to
// The Circle as the full solution. The team previews it, then sends it.

const ROADMAP_CSS = `<style>
  .month-card{border:1px solid var(--border);margin-bottom:36px;background:#0c0c0c;}
  .month-header{display:flex;gap:20px;align-items:center;padding:22px 30px;background:var(--card);border-bottom:1px solid var(--border);}
  .month-label{background:var(--gold);color:var(--bg);font-family:'Helvetica Neue',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;padding:7px 16px;text-transform:uppercase;white-space:nowrap;flex-shrink:0;}
  .month-title{font-size:22px;font-weight:700;color:#fff;line-height:1.2;margin-bottom:3px;}
  .month-focus{font-family:'Helvetica Neue',sans-serif;font-size:12px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;}
  .month-body{padding:28px 30px;}
  .month-goal{font-family:'Helvetica Neue',sans-serif;font-size:15px;color:#bbb;line-height:1.75;margin-bottom:22px;}
  .month-goal strong{color:var(--gold);}
  .week-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-bottom:22px;}
  .week-cell{background:var(--card);padding:18px 18px 14px;}
  .week-label{font-family:'Helvetica Neue',sans-serif;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border2);}
  .week-item{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#bbb;line-height:1.6;padding:5px 0;display:flex;gap:8px;}
  .week-item::before{content:'→';color:var(--gold);flex-shrink:0;}
  .month-metric{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:var(--muted);border-top:1px solid var(--border2);padding-top:14px;margin-bottom:16px;}
  .month-metric strong{color:var(--text);}
  .circle-tie{border-left:3px solid var(--red);background:rgba(204,31,31,0.05);padding:16px 22px;}
  .circle-tie .ct-label{font-family:'Helvetica Neue',sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--red);font-weight:700;margin-bottom:6px;}
  .circle-tie p{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:#ccc;line-height:1.7;margin:0;}
  .sched-wrap{overflow-x:auto;margin:28px 0;border:1px solid var(--border);}
  .sched-table{width:100%;border-collapse:collapse;font-family:'Helvetica Neue',sans-serif;font-size:13px;min-width:640px;}
  .sched-table th{background:var(--card);color:var(--gold);font-size:10px;letter-spacing:2px;text-transform:uppercase;text-align:left;padding:14px 16px;border-bottom:1px solid var(--border);}
  .sched-table td{color:#bbb;line-height:1.6;padding:14px 16px;border-bottom:1px solid var(--border2);vertical-align:top;}
  .sched-table td:first-child{color:#fff;font-weight:700;white-space:nowrap;}
  .cta-box{text-align:center;border:1px solid var(--border);background:var(--card);padding:44px 32px;margin-top:40px;}
  .cta-box p{font-family:'Helvetica Neue',sans-serif;font-size:15px;color:#bbb;line-height:1.7;max-width:620px;margin:0 auto 26px;}
  .cta-btn{display:inline-block;background:var(--gold);color:var(--bg);font-family:'Helvetica Neue',sans-serif;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;padding:16px 38px;}
  @media (max-width:760px){
    nav{padding:0 18px;}.nav-links{display:none;}
    .page-section{padding:56px 18px;}#cover{padding:80px 18px;}footer{padding:60px 18px;}
    .stat-row{grid-template-columns:1fr 1fr;}.stat-cell+.stat-cell{border-left:none;}
    .assess-grid,.rl-grid{grid-template-columns:1fr;}
    .week-grid{grid-template-columns:1fr 1fr;}
    .month-header{flex-direction:column;align-items:flex-start;gap:10px;padding:20px;}.month-body{padding:20px;}
  }
  @media (max-width:480px){.week-grid{grid-template-columns:1fr;}}
  @media print{.month-card{break-inside:avoid;}}
</style>`

const ROADMAP_CLASSES = `${BLUEPRINT_CSS_CLASSES}
Roadmap-only classes:
month-card / month-header / month-label / month-title / month-focus / month-body / month-goal
week-grid (exactly 4 week-cell children) / week-cell / week-label / week-item
month-metric / circle-tie (with div.ct-label + p)
sched-wrap > table.sched-table (thead th, tbody td)
cta-box (p + a.cta-btn)`

const RULES = `${CIRCLE_FACTS}
- The Circle is a 12-month commitment.

ABOUT THIS DOCUMENT: This is a "12-Month CEO Roadmap" from a CEO Call with Gogo Bethke. It is NOT a Circle blueprint and the reader is NOT a Circle member. Never call it a blueprint. Never say "welcome to The Circle" or treat them as a member.

THE STRATEGY (never state this out loud): give them a real, specific plan, but only part of the solution. Every fix comes back to the same truth: to actually execute it they need what only The Circle gives, Gogo's coaching, accountability every week, and the systems Gogo helps members build. Do this naturally and specifically (tie it to the exact problem), never as a generic "join The Circle" line, never desperate, never pushy.

VOICE: Gogo Bethke, first person ("I", "my"), talking to them ("you"). Warm, direct, blunt friend who wants them to win. Use their real numbers and words from the call and form. Flowing sentences, not clipped fragments.

KNOWLEDGE: Gogo's teachings, stories, frameworks and numbers come ONLY from the Brain excerpts. Their situation comes ONLY from the transcript, form and problem statement. Never invent numbers, history, results, prices or testimonials. Never promise income or results. No investment or financial-product advice (no stocks, funds, crypto, specific accounts): money steps stay at habits and the business (know your numbers, CPA, separate accounts, income that does not depend on the next deal).

PUNCTUATION: Never use em dashes (—), not once. For ranges use a hyphen ("Months 1-3"). Never refer to anyone's gender from their name; use their first name or "you".`

interface Outline {
  motto: string
  core_problem: string
  needs_social: boolean
  months_intro: string
  months: { n: number; title: string; focus: string }[]
}

type Row = {
  id: string
  name: string | null
  answers: Record<string, string> | null
  statement: string | null
  roadmap_transcript: string | null
  roadmap_token: string | null
}

const firstName = (name: string | null) => (name ?? '').trim().split(/\s+/)[0] || 'there'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function brain(query: string, n = 5): Promise<string> {
  const chunks = await searchBrain(query, n).catch(() => [])
  return chunks.length ? buildBrainContext(chunks) : '(nothing found)'
}

async function ask(prompt: string, context: string, maxTokens: number): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const msg = await getAnthropic().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        // The shared context is identical across every call, so all but the
        // first read it from the prompt cache.
        messages: [{ role: 'user', content: [
          { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: prompt },
        ] }],
      })
      const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
      if (text) return text
    } catch (e) {
      if (attempt === 1) throw e
    }
  }
  throw new Error('The model returned an empty section')
}

function shell(body: string, name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(name)} · 12-Month CEO Roadmap · Gogo Bethke</title>
${BLUEPRINT_CSS}
${ROADMAP_CSS}
</head>
<body>
${body}
</body>
</html>`
}

export async function buildRoadmap(row: Row, feedback?: string): Promise<string> {
  const name = row.name?.trim() || 'Your'
  const first = firstName(row.name)
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
  const answers = row.answers ?? {}
  const form = CEO_CALL_FIELDS.filter((f) => f.key !== 'instagram_id')
    .map((f) => `- ${f.label} → ${answers[f.label] ?? '(left blank)'}`).join('\n')
  const transcript = row.roadmap_transcript?.trim() ?? ''

  const [bMindset, bTeam, bContent, bMoney, bCircle, bPlan] = await Promise.all([
    brain('CEO mindset vs agent mindset delegate stop doing everything yourself hourly rate red light green light'),
    brain('hire sequence assistant virtual assistant train team Loom checklist accountability let go'),
    brain('content strategy social media posting schedule reels agent attraction lead generation ManyChat'),
    brain('know your numbers profit taxes CPA income streams passive income revenue share assets'),
    brain('The Circle mastermind coaching accountability systems Gogo helps members'),
    brain(`12 month plan quarters foundation build scale ${transcript.slice(0, 400)} ${row.statement ?? ''}`.slice(0, 900)),
  ])

  const context = `PERSON: ${name} (first name: ${first})
ROADMAP DATE: ${today}

THEIR CEO CALL FORM:
${form}

PROBLEM STATEMENT (written for Gogo before the call):
${row.statement ?? '(none)'}

CEO CALL TRANSCRIPT WITH GOGO:
${transcript || '(no transcript)'}

GOGO'S BRAIN, MINDSET & CEO SHIFT:
${bMindset}

GOGO'S BRAIN, TEAM & HIRING:
${bTeam}

GOGO'S BRAIN, CONTENT & SOCIAL MEDIA:
${bContent}

GOGO'S BRAIN, MONEY & INCOME:
${bMoney}

GOGO'S BRAIN, THE CIRCLE:
${bCircle}

GOGO'S BRAIN, PLANNING:
${bPlan}

${RULES}
${feedback ? `\nREVISION REQUEST FROM GOGO'S TEAM (apply it everywhere it is relevant):\n${feedback}\n` : ''}`

  // 1. A shared outline keeps the parallel sections consistent with each other.
  const outlineRaw = await ask(`Plan ${first}'s 12-Month CEO Roadmap. Decide the core problem, the order of the 12 months (what must come first so the rest works), and whether social media / content / marketing / lead generation is part of their problem (from the call or form).
OUTPUT ONLY minified JSON: {"motto":"one short line Gogo would say to them, from the call","core_problem":"1-2 sentences","needs_social":true|false,"months_intro":"2 sentences introducing the month-by-month plan","months":[{"n":1,"title":"evocative month title","focus":"what this month is for, one line"}, ...12 items]}`, context, 3000)
  const a = outlineRaw.indexOf('{'), b = outlineRaw.lastIndexOf('}')
  let outline: Outline
  try {
    outline = JSON.parse(outlineRaw.slice(a, b + 1)) as Outline
    if (!Array.isArray(outline.months) || outline.months.length < 12) throw new Error('short')
  } catch {
    throw new Error('Could not plan the roadmap (the outline came back malformed). Try again.')
  }

  const plan = `THE AGREED PLAN (follow it exactly, it keeps all parts consistent):
Core problem: ${outline.core_problem}
${outline.months.map((m) => `Month ${m.n}: ${m.title}, ${m.focus}`).join('\n')}
Social media posting schedule included: ${outline.needs_social ? 'YES' : 'NO'}

${ROADMAP_CLASSES}

OUTPUT: ONLY raw HTML for the part asked, no markdown fences, no <html>/<head>/<body>/<style>/<nav>. Write everything in full, no placeholders.`

  const monthPrompt = (from: number, to: number) => `${plan}

Write the month cards for Months ${from}-${to} ONLY (${to - from + 1} cards, no section wrapper). Each card:
<div class="month-card" id="m${from}">
  <div class="month-header"><div class="month-label">Month N</div><div><div class="month-title">title from the plan</div><div class="month-focus">focus</div></div></div>
  <div class="month-body">
    <p class="month-goal"><strong>This month:</strong> what we are fixing and why it comes now, tied to their real situation.</p>
    <div class="week-grid"> four week-cell: <div class="week-cell"><div class="week-label">Week 1</div><div class="week-item">specific action</div>... 3-4 week-items</div> for Weeks 1-4</div>
    <p class="month-metric"><strong>Done means:</strong> the measurable sign this month worked.</p>
    <div class="circle-tie"><div class="ct-label">Where The Circle comes in</div><p>why doing this month alone stalls, and exactly what coaching, accountability or system inside The Circle makes it stick, specific to this month's work.</p></div>
  </div>
</div>
Use id="mN" on each card with its own month number. Week items must be concrete actions they can do that week (who, what, how many), from their call and Gogo's Brain, not vague advice.${outline.needs_social ? ' Where a month involves content, point to the posting schedule in Section 04 instead of repeating it.' : ''}`

  const partOpen = `${plan}

Write exactly these elements:
1. <section id="cover"> — exactly <div class="circle-logo-lg"><span></span></div> (no text inside it), brand-name "Gogo Bethke · CEO Call", h1 "Your 12-Month" + <em>CEO Roadmap</em>, cover-sub "Prepared by Gogo Bethke after our CEO Call", cover-tagline with this motto: "${outline.motto}", cover-meta "${esc(name)} · ${today}"
2. <section id="s1" class="page-section"><div class="inner"> — eyebrow "Section 01", h2 "Where You Are Today", section-intro, stat-row with 4 stat-cells (their real numbers), callout with my sharp read, assess-grid (left .g "What You Have Going For You" 4-6 items with ✓, right .r "What Is Costing You" 4-6 items with →)
3. <section id="s2" class="page-section alt"><div class="inner"> — eyebrow "Section 02", h2 "The Real Problem", section-intro naming the core problem plainly, body-text paragraphs on why it keeps happening and what it is costing them, blockquote from Gogo's Brain with cite, rl-grid (red-side "What Got You Here" 5-6 items / green-side "What Gets You There" 5-6 items), callout red: why fixing this alone has not worked, and what changes when you have a coach and a room holding you to it (The Circle).
Close every div and section.`

  const partSocial = `${plan}

Write exactly ONE element: <section id="s4" class="page-section"><div class="inner"> — eyebrow "Section 04", h2 "Your Posting Schedule", section-intro (why content matters for THEIR goal, from the call), then:
- h3 "Your Weekly Rhythm" + sched-wrap with table.sched-table: columns Day | Platform | What to post | Goal; one row per day Monday-Sunday (rest days allowed), specific to their business and audience.
- h3 "Your First Four Weeks of Content" + sched-wrap with table.sched-table: columns Week | Theme | Posts (3-5 concrete post ideas with hooks) | Call to action.
- h3 "How to Batch It" + body-text: a simple weekly batching routine (when, how long, who helps).
- circle-tie block: why a posting schedule alone fails without feedback and accountability, and how The Circle keeps them consistent and turns content into leads.
Close every div and section.`

  const partClose = `${plan}

Write exactly these elements:
1. <section id="s5" class="page-section alt"><div class="inner"> — eyebrow "Section ${outline.needs_social ? '05' : '04'}", h2 "Why You Can't Do This Alone", section-intro: this roadmap is the what; the how, the accountability and the systems are what we build together. Then rules-list with 5-6 rule-items (rule-n 01.., rule-headline in caps, rule-explain) naming the exact places people like them stall on a plan like this, each answered by what The Circle gives (my coaching, weekly accountability, the systems I help members build, a small handpicked room of people building the same freedom). Then blockquote from Gogo's Brain with cite. Then cta-box: p "If you are ready to stop doing this alone, apply for The Circle and let's build the other half together." + <a class="cta-btn" href="__CIRCLE_URL__">Apply for The Circle</a>
2. <footer> — footer-circle (div with span), footer-quote with my warm closing line to ${first} from our call, footer-meta "12-Month CEO Roadmap · Gogo Bethke · gogobethke.com", second footer-meta "Confidential · Prepared for ${esc(name)} · ${today}"
Close every div and section.`

  const tasks: Promise<string>[] = [
    ask(partOpen, context, 8000),
    ask(monthPrompt(1, 3), context, 9000),
    ask(monthPrompt(4, 6), context, 9000),
    ask(monthPrompt(7, 9), context, 9000),
    ask(monthPrompt(10, 12), context, 9000),
    ask(partClose, context, 6000),
    outline.needs_social ? ask(partSocial, context, 7000) : Promise.resolve(''),
  ]
  const [open, m1, m2, m3, m4, close, social] = (await Promise.all(tasks)).map(cleanBlueprintPart)

  const circleUrl = (await getSetting('blueprint_clarity_url')) || 'https://gogobethke.com/thecircle'
  const sections = [
    { id: 's1', label: 'Today' },
    { id: 's2', label: 'The Problem' },
    { id: 's3', label: '12 Months' },
    ...(outline.needs_social ? [{ id: 's4', label: 'Posting' }] : []),
    { id: 's5', label: 'Next Step' },
  ]
  const nav = `<nav><div class="nav-brand"><span class="nav-circle"></span>CEO Roadmap</div><div class="nav-links">${sections.map((s) => `<a href="#${s.id}">${s.label}</a>`).join('')}</div></nav>`
  const months = `<section id="s3" class="page-section alt"><div class="inner">
<span class="eyebrow">Section 03</span>
<h2>Your 12 Months, Step by Step</h2>
<p class="section-intro">${esc(outline.months_intro.replace(/\s*—\s*/g, ', '))}</p>
${m1}
${m2}
${m3}
${m4}
</div></section>`

  // The round mark is a plain red ring (this is not The Circle's branding).
  const cover = open.replace(/<div class="circle-logo-lg">[\s\S]*?<\/div>/, '<div class="circle-logo-lg"><span></span></div>')
  const body = [nav, cover, months, social, close.replace(/__CIRCLE_URL__/g, esc(circleUrl))].filter(Boolean).join('\n')
  return shell(body, name)
}

/** Generates (or regenerates) one roadmap in the background and stores it. */
export async function generateRoadmap(admin: SupabaseClient, id: string, feedback?: string): Promise<void> {
  const { data: row } = await admin
    .from('problem_statements')
    .select('id, name, answers, statement, roadmap_transcript, roadmap_token')
    .eq('id', id)
    .maybeSingle()
  if (!row) return
  try {
    const html = await buildRoadmap(row as Row, feedback)
    await admin.from('problem_statements').update({
      roadmap_html: html,
      roadmap_status: 'ready',
      roadmap_error: null,
      roadmap_generated_at: new Date().toISOString(),
      roadmap_token: (row.roadmap_token as string | null) ?? crypto.randomUUID(),
      roadmap_sent_at: null,
    }).eq('id', id)
  } catch (e) {
    console.error('CEO roadmap failed:', e)
    await admin.from('problem_statements')
      .update({ roadmap_status: 'error', roadmap_error: String(e instanceof Error ? e.message : e).slice(0, 500) })
      .eq('id', id)
  }
}
