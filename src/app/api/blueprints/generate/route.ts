import { createClient } from '@/lib/supabase/server'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { NextResponse } from 'next/server'

// Extend timeout to 5 minutes — blueprint generation takes 60–90s
export const maxDuration = 300
export const runtime = 'nodejs'


// ─── Full CSS — injected by the API, never sent to Claude ───
const BLUEPRINT_CSS = `<style>
  :root{--gold:#C9A227;--red:#CC1F1F;--bg:#0D0D0D;--card:#161616;--card2:#1C1C1C;--border:rgba(201,162,39,0.18);--border2:rgba(255,255,255,0.06);--text:#EFEFEF;--muted:#777;--dim:#444;}
  *{margin:0;padding:0;box-sizing:border-box;}html{scroll-behavior:smooth;}
  body{background:var(--bg);color:var(--text);font-family:'Georgia','Times New Roman',serif;font-size:16px;line-height:1.8;}
  nav{position:sticky;top:0;z-index:200;background:rgba(13,13,13,0.98);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 56px;height:54px;}
  .nav-brand{display:flex;align-items:center;gap:10px;color:var(--gold);font-family:'Helvetica Neue',sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:600;}
  .nav-circle{width:18px;height:18px;border-radius:50%;border:2px solid var(--red);display:inline-block;flex-shrink:0;}
  .nav-links{display:flex;gap:32px;}.nav-links a{color:var(--muted);text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;transition:color 0.2s;}.nav-links a:hover{color:var(--gold);}
  .sans{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;}.gold{color:var(--gold);}.red{color:var(--red);}.muted{color:var(--muted);}
  .page-section{padding:96px 56px;border-bottom:1px solid var(--border2);}.page-section.alt{background:#0a0a0a;}.inner{max-width:980px;margin:0 auto;}
  .eyebrow{font-family:'Helvetica Neue',sans-serif;color:var(--gold);font-size:10px;letter-spacing:4px;text-transform:uppercase;margin-bottom:14px;display:block;}
  h2{font-size:clamp(30px,4vw,46px);font-weight:700;line-height:1.1;margin-bottom:12px;color:#fff;}
  h3{font-size:22px;font-weight:700;color:var(--gold);margin-bottom:10px;margin-top:44px;}h3:first-child{margin-top:0;}
  .section-intro{font-size:18px;color:#aaa;line-height:1.75;margin-bottom:52px;max-width:740px;font-family:'Helvetica Neue',sans-serif;}
  #cover{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:100px 56px;border-bottom:1px solid var(--border);background:radial-gradient(ellipse at 50% 70%,rgba(201,162,39,0.06) 0%,transparent 60%);}
  .circle-logo-lg{width:90px;height:90px;border-radius:50%;border:3px solid var(--red);display:flex;align-items:center;justify-content:center;margin:0 auto 28px;box-shadow:0 0 40px rgba(204,31,31,0.12);}
  .circle-logo-lg span{width:12px;height:12px;border-radius:50%;background:var(--red);}
  .brand-name{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:5px;text-transform:uppercase;color:var(--gold);margin-bottom:52px;}
  #cover h1{font-size:clamp(42px,6vw,72px);font-weight:700;line-height:1.05;letter-spacing:-1px;color:#fff;margin-bottom:18px;}
  #cover h1 em{color:var(--gold);font-style:normal;display:block;}
  .cover-sub{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:var(--muted);letter-spacing:3px;text-transform:uppercase;margin-bottom:52px;}
  .cover-tagline{font-size:22px;color:var(--gold);font-style:italic;border:1px solid var(--border);padding:16px 44px;display:inline-block;margin-bottom:56px;}
  .cover-meta{font-family:'Helvetica Neue',sans-serif;font-size:12px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;}
  .stat-row{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--border);margin-bottom:56px;}
  .stat-cell{padding:32px 24px;text-align:center;background:var(--card);}.stat-cell+.stat-cell{border-left:1px solid var(--border);}
  .stat-num{display:block;font-size:40px;font-weight:700;color:var(--gold);line-height:1;margin-bottom:8px;}
  .stat-label{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;display:block;}
  .callout{border-left:4px solid var(--gold);background:var(--card);padding:24px 28px;margin:32px 0;border-radius:0 2px 2px 0;}.callout.red{border-left-color:var(--red);}
  .callout p{font-family:'Helvetica Neue',sans-serif;font-size:15px;color:#bbb;line-height:1.75;margin:0;}.callout strong{color:var(--text);}
  blockquote{border-left:3px solid var(--red);padding:18px 24px;margin:32px 0;background:rgba(204,31,31,0.05);}
  blockquote p{font-size:17px;font-style:italic;color:#ccc;line-height:1.7;margin:0;}
  blockquote cite{display:block;margin-top:10px;font-family:'Helvetica Neue',sans-serif;font-size:12px;color:var(--muted);font-style:normal;letter-spacing:1px;}
  .body-text{font-family:'Helvetica Neue',sans-serif;font-size:15px;color:#bbb;line-height:1.85;margin-bottom:20px;}.body-text strong{color:var(--text);}
  .assess-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-bottom:16px;}.assess-col{background:var(--card);padding:30px;}
  .assess-col-head{font-family:'Helvetica Neue',sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-bottom:22px;padding-bottom:14px;border-bottom:1px solid var(--border2);}
  .assess-col-head.g{color:var(--gold);}.assess-col-head.r{color:var(--red);}
  .assess-item{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;}
  .assess-bullet{font-size:13px;flex-shrink:0;margin-top:3px;font-family:'Helvetica Neue',sans-serif;}
  .assess-item-text{font-family:'Helvetica Neue',sans-serif;font-size:14px;line-height:1.65;color:#bbb;}
  .rl-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:28px 0;}.rl-col{padding:28px;}
  .rl-col.red-side{background:rgba(204,31,31,0.06);border:1px solid rgba(204,31,31,0.2);}
  .rl-col.green-side{background:rgba(201,162,39,0.04);border:1px solid rgba(201,162,39,0.2);}
  .rl-head{font-family:'Helvetica Neue',sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-bottom:16px;}
  .rl-head.r{color:var(--red);}.rl-head.g{color:var(--gold);}
  .rl-item{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:#aaa;line-height:1.6;padding:6px 0;border-bottom:1px solid var(--border2);display:flex;gap:10px;align-items:center;}.rl-item:last-child{border-bottom:none;}
  .rl-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}.rl-dot.r{background:var(--red);}.rl-dot.g{background:var(--gold);}
  .hire-timeline{margin:36px 0;}.hire-item{display:grid;grid-template-columns:120px 1fr;gap:0;margin-bottom:2px;}
  .hire-time{background:var(--gold);color:var(--bg);font-family:'Helvetica Neue',sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;padding:20px 16px;display:flex;align-items:center;text-transform:uppercase;text-align:center;justify-content:center;}
  .hire-content{background:var(--card);padding:20px 28px;border:1px solid var(--border);border-left:none;}
  .hire-title{font-family:'Helvetica Neue',sans-serif;font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;}
  .hire-desc{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:#999;line-height:1.6;}
  .q-card{margin-bottom:48px;border:1px solid var(--border);}
  .q-header{background:var(--card);padding:24px 34px;border-bottom:1px solid var(--border);display:flex;gap:20px;align-items:center;}
  .q-label{background:var(--gold);color:var(--bg);font-family:'Helvetica Neue',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;padding:6px 16px;text-transform:uppercase;white-space:nowrap;flex-shrink:0;}
  .q-title{font-size:22px;font-weight:700;color:var(--gold);line-height:1.2;margin-bottom:2px;}
  .q-focus{font-family:'Helvetica Neue',sans-serif;font-size:12px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;}
  .q-body{padding:32px 34px;}.q-section{margin-bottom:32px;}
  .q-section-head{font-family:'Helvetica Neue',sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;color:var(--gold);text-transform:uppercase;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--border);}
  .q-section-head::before{content:'✦  ';}
  .q-point{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:#bbb;line-height:1.75;padding:8px 0;border-bottom:1px solid var(--border2);display:flex;gap:14px;align-items:flex-start;}.q-point:last-child{border-bottom:none;}
  .q-point-mark{color:var(--gold);flex-shrink:0;margin-top:2px;font-size:12px;}
  .q-quote-box{background:rgba(204,31,31,0.05);border-left:3px solid var(--red);padding:18px 24px;margin-top:28px;}
  .q-quote-box p{font-size:15px;font-style:italic;color:#ccc;line-height:1.7;margin:0;font-family:'Helvetica Neue',sans-serif;}
  .income-stream{background:var(--card);border:1px solid var(--border);margin-bottom:14px;}
  .income-top{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;padding:24px 30px;border-bottom:1px solid var(--border2);}
  .income-name{font-weight:700;font-size:17px;color:#fff;font-family:'Helvetica Neue',sans-serif;margin-bottom:4px;}
  .income-phase{font-family:'Helvetica Neue',sans-serif;font-size:10px;letter-spacing:2px;color:var(--gold);text-transform:uppercase;border:1px solid var(--border);padding:2px 10px;display:inline-block;}
  .income-now,.income-goal{font-family:'Helvetica Neue',sans-serif;padding:0 20px;border-left:1px solid var(--border2);}
  .income-lbl{font-size:10px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;}
  .income-val{font-size:14px;color:#bbb;line-height:1.5;}.income-val.tgt{color:var(--gold);}
  .income-bottom{padding:14px 30px;font-family:'Helvetica Neue',sans-serif;font-size:13px;color:var(--muted);line-height:1.6;}
  .income-bar{height:4px;background:#111;position:relative;margin-top:16px;}
  .income-bar-now{position:absolute;top:0;left:0;height:100%;background:var(--dim);}
  .income-bar-target{position:absolute;top:0;left:0;height:100%;opacity:0.6;}
  .rules-list{}.rule-item{display:flex;gap:24px;align-items:flex-start;padding:28px 0;border-bottom:1px solid var(--border2);}.rule-item:last-child{border-bottom:none;}
  .rule-n{font-size:36px;font-weight:700;color:var(--gold);line-height:1;flex-shrink:0;min-width:50px;font-family:'Helvetica Neue',sans-serif;}
  .rule-headline{font-family:'Helvetica Neue',sans-serif;font-size:14px;font-weight:700;letter-spacing:1px;color:var(--text);margin-bottom:6px;text-transform:uppercase;}
  .rule-explain{font-family:'Helvetica Neue',sans-serif;font-size:14px;color:#999;line-height:1.7;}
  .support-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-bottom:14px;}
  .support-card{background:var(--card);padding:24px;}.support-card.lead{border-top:2px solid var(--gold);}
  .support-person{font-family:'Helvetica Neue',sans-serif;font-weight:700;font-size:16px;color:#fff;margin-bottom:4px;}
  .support-title{font-family:'Helvetica Neue',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;}
  .support-desc{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#888;line-height:1.65;}
  .community-box{background:#0f0f0f;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;padding:28px 34px;margin-bottom:14px;}
  .community-box .left .lbl{font-family:'Helvetica Neue',sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;}
  .community-box .left .cname{font-family:'Helvetica Neue',sans-serif;font-size:20px;font-weight:700;color:#fff;margin-bottom:4px;}
  .community-box .left .csub{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:var(--muted);}
  .community-box .right{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:#bbb;line-height:1.8;text-align:right;}
  .program-detail{background:var(--card);border:1px solid var(--border);display:grid;grid-template-columns:1fr 1px 1fr 1px 1fr;align-items:center;}
  .pd-item{padding:28px 32px;}.pd-sep{background:var(--border);align-self:stretch;}
  .pd-label{font-family:'Helvetica Neue',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}
  .pd-val{font-size:22px;font-weight:700;color:var(--gold);margin-bottom:4px;}
  .pd-sub{font-family:'Helvetica Neue',sans-serif;font-size:13px;color:var(--muted);}
  .pd-item.white .pd-val{color:#fff;}.pd-item.italic{font-style:italic;color:var(--muted);font-size:15px;line-height:1.65;}
  footer{padding:90px 56px;text-align:center;background:radial-gradient(ellipse at 50% 50%,rgba(201,162,39,0.07) 0%,transparent 65%);border-top:1px solid var(--border);}
  .footer-quote{font-size:clamp(22px,3.5vw,38px);font-style:italic;color:var(--gold);max-width:660px;margin:0 auto 50px;line-height:1.45;}
  .footer-circle{width:52px;height:52px;border-radius:50%;border:2px solid var(--red);margin:0 auto 32px;display:flex;align-items:center;justify-content:center;}
  .footer-circle span{width:8px;height:8px;border-radius:50%;background:var(--red);}
  .footer-meta{font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:2.5px;color:var(--dim);text-transform:uppercase;}
  @media print{nav{display:none;}#cover{min-height:auto;padding:72px 56px;}.page-section{padding:40px 56px;}}
</style>`

function wrapWithShell(body: string, name: string, today: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${name} · 12-Month Blueprint · The Circle</title>
${BLUEPRINT_CSS}
</head>
<body>
${body}
</body>
</html>`
}

async function fetchBrainContext(query: string, count = 5): Promise<string> {
  const brainUrl = process.env.BRAIN_SUPABASE_URL
  const brainKey = process.env.BRAIN_SUPABASE_ANON_KEY
  if (!brainUrl || !brainKey) {
    console.warn('[Brain] BRAIN_SUPABASE_URL or BRAIN_SUPABASE_ANON_KEY not set — skipping Brain context')
    return ''
  }

  try {
    const res = await fetch(`${brainUrl}/rest/v1/rpc/match_brain_chunks`, {
      method: 'POST',
      headers: {
        apikey: brainKey,
        Authorization: `Bearer ${brainKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query_text: query, match_count: count }),
    })

    if (!res.ok) {
      console.warn(`[Brain] RPC returned ${res.status} for query: "${query.slice(0, 60)}"`)
      return ''
    }
    const chunks = await res.json()
    return chunks.map((c: { content: string }) => c.content).join('\n\n')
  } catch (err) {
    console.warn('[Brain] fetch error:', err instanceof Error ? err.message : String(err))
    return ''
  }
}

export async function POST(request: Request) {
  try {
  const apiKey = process.env.ANTHROPIC_API_KEY
  console.log('[Blueprint] Env check — ANTHROPIC_API_KEY:', apiKey ? `set (${apiKey.slice(0, 15)}...)` : 'MISSING')
  console.log('[Blueprint] Env check — BRAIN_SUPABASE_URL:', process.env.BRAIN_SUPABASE_URL ? 'set' : 'MISSING')
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set on the server' }, { status: 500 })
  const anthropic = getAnthropic()

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  let body: { member_id?: string; transcript?: string; call_date?: string; fathom_link?: string; feedback?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { member_id, transcript, call_date, fathom_link, feedback } = body

  if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  const { data: member } = await supabase.from('members').select('*').eq('id', member_id).single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Use provided transcript OR fall back to the one saved from a previous generation
  const finalTranscript = transcript?.trim() || member.blueprint_transcript || ''
  if (!finalTranscript) return NextResponse.json({ error: 'transcript is required' }, { status: 400 })

  const joinDate = new Date(member.join_date)
  const weeksIn = Math.floor((new Date().getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
  const today = call_date
    ? new Date(call_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Save transcript before generation (only if a new one was provided)
  if (transcript?.trim()) {
    await supabase.from('members').update({
      blueprint_transcript: transcript,
    }).eq('id', member_id)
  }

  // Fetch Brain context across targeted queries — each section pulls what it needs
  const transcriptSnippet = finalTranscript.slice(0, 500)
  const [
    brainMindset,
    brainHiring,
    brainContent,
    brainIncome,
    brainRules,
    brainSupport,
    brainQuarters,
  ] = await Promise.all([
    fetchBrainContext('CEO mindset vs agent mindset stop doing everything yourself delegate red light green light exercise hourly rate', 4),
    fetchBrainContext('hire sequence licensed assistant virtual assistant buyer agent when to hire how to train Loom checklist', 4),
    fetchBrainContext('content strategy avatar shift agent attraction Friday reels ManyChat social media coaching digital products', 4),
    fetchBrainContext('income streams revenue share team splits eXp mentorship coaching digital products passive income', 4),
    fetchBrainContext("Gogo rules commitments non-negotiables show up Tuesday phone quiet delegate hourly rate Friday content", 4),
    fetchBrainContext('Circle support system GoGetEm community WhatsApp Kristy Tuesday calls one-on-one tech session', 3),
    fetchBrainContext(`quarterly plan 12 month blueprint Q1 Q2 Q3 Q4 foundation build machine scale launch ${transcriptSnippet}`, 4),
  ])

  // Shared context block reused in both prompts
  const memberCtx = `MEMBER: ${member.name}
COHORT: ${member.cohort ?? 'The Circle'}
BLUEPRINT DATE: ${today}
WEEK ${weeksIn + 1} IN PROGRAM
${fathom_link ? `FATHOM: ${fathom_link}` : ''}

CLARITY CALL TRANSCRIPT:
${finalTranscript}`

  const cssClasses = `CSS classes available (all pre-defined in stylesheet — use exactly as listed):
nav / nav-brand / nav-circle / nav-links
#cover / circle-logo-lg / brand-name / cover-sub / cover-tagline / cover-meta
page-section / page-section.alt / inner / eyebrow / section-intro
stat-row / stat-cell / stat-num / stat-label
callout / body-text / blockquote with cite
assess-grid / assess-col / assess-col-head.g or .r / assess-item / assess-bullet / assess-item-text
rl-grid / rl-col.red-side or .green-side / rl-head.r or .g / rl-item / rl-dot.r or .g
hire-timeline / hire-item / hire-time / hire-content / hire-title / hire-desc
q-card / q-header / q-label / q-title / q-focus / q-body / q-section / q-section-head / q-point / q-point-mark / q-quote-box
income-stream / income-top / income-name / income-phase / income-now / income-goal / income-lbl / income-val.tgt / income-bottom / income-bar / income-bar-now / income-bar-target
rules-list / rule-item / rule-n / rule-headline / rule-explain
support-grid / support-card.lead / support-person / support-title / support-desc
community-box / program-detail / pd-item / pd-sep / pd-label / pd-val / pd-sub
footer / footer-quote / footer-circle / footer-meta`

  // ── CALL 1 of 3: nav + cover + sections 1–3 ──────────────────────────────
  const prompt1 = `You are writing PART 1 of 3 of a personalized 12-month business blueprint for ${member.name} in Gogo Bethke's coaching program "The Circle."

${memberCtx}

---
GOGO'S BRAIN — MINDSET & CEO SHIFT:
${brainMindset}

GOGO'S BRAIN — HIRING SEQUENCE & TRAINING:
${brainHiring}

---
${cssClasses}

OUTPUT: Return ONLY raw HTML — no prose, no explanation, no markdown fences. Start with <nav> and end after the closing </section> of Section 03. Do NOT include <!DOCTYPE>, <html>, <head>, <style>, or <body> tags.

WRITE THESE 5 ELEMENTS IN FULL — no placeholders, no truncation:

1. <nav> — sticky nav: The Circle brand (nav-circle dot + "The Circle") + 7 links: Today, The Shift, Your Hires, Blueprint, Income, Rules, Your Team

2. <section id="cover"> — circle-logo-lg, "The Circle · Coaching Program" brand-name, h1 "Your 12-Month" + em "Business Blueprint", cover-sub "A Clarity Call Report · Prepared by Gogo Bethke", cover-tagline with ONE powerful motto Gogo would say to THIS person from the transcript, cover-meta with name · market · ${today}

3. <section id="s1" class="page-section"> — eyebrow "Section 01", h2 "Where You Are Today", section-intro, stat-row with 4 stat-cells (real numbers from transcript), callout with sharp insight in Gogo's voice, assess-grid: left col (5-6 strengths with ✓ bullets) + right col (5-6 challenges with → bullets) — ALL from transcript

4. <section id="s2" class="page-section alt"> — eyebrow "Section 02", h2 "The Shift That Changes Everything", section-intro, blockquote from Brain, h3 "Agent Mindset vs. CEO Mindset", body-text setup paragraph, rl-grid (agent mindset red-side 6-7 items / CEO mindset green-side 6-7 items), h3 "The Red Light / Green Light Exercise", body-text explanation, rl-grid (red light stop-doing / green light keep-doing from transcript), callout with hourly rate insight, second blockquote from Brain

5. <section id="s3" class="page-section"> — eyebrow "Section 03", h2 "Your Hire Sequence", section-intro, blockquote from Brain (Kristy hire story), hire-timeline with 3-4 hire-items (month label + title + description tailored to their situation), h3 "How to Find Your First Hire", body-text, callout with 71.1% stat, h3 "How to Train Them So They Actually Stick", q-section with q-section-head + 5 q-points (Loom, type it out, checklists, 90-day check-ins, accountability)

${feedback ? `---\nREFINEMENT REQUEST: The admin has reviewed the previous blueprint and asked for these specific changes:\n${feedback}\nApply these changes where relevant to the sections you are writing. Keep everything else as specified.\n---` : ''}
RULES: Every word from transcript or Brain. Gogo's voice — direct, warm, personal. No invented facts. Dense content.`

  // ── CALL 2 of 3: section 4 only — 12-month quarterly blueprint ───────────
  const prompt2 = `You are writing PART 2 of 3 of a personalized 12-month business blueprint for ${member.name} in Gogo Bethke's coaching program "The Circle." This call is dedicated entirely to Section 04 — the 12-Month Blueprint.

${memberCtx}

---
GOGO'S BRAIN — QUARTERLY FRAMEWORK & PLANNING:
${brainQuarters}

---
${cssClasses}

OUTPUT: Return ONLY raw HTML — no prose, no explanation, no markdown fences. Write exactly ONE element: <section id="s4" class="page-section alt">...</section>. Do NOT include <!DOCTYPE>, <html>, <head>, <style>, or <body> tags.

WRITE THIS ELEMENT IN FULL — no placeholders, no truncation:

<section id="s4" class="page-section alt"> — eyebrow "Section 04", h2 "The 12-Month Blueprint", section-intro that sets up the quarterly plan, then FOUR complete q-cards:

Q1 (Months 1-3): q-header with q-label "Q1 · Months 1–3" + q-title (evocative title from transcript themes) + q-focus subtitle, q-body with 3-4 q-sections each having q-section-head + 3-4 q-points (→ mark), end with q-quote-box featuring a Gogo-voice quote
Q2 (Months 4-6): same complete structure
Q3 (Months 7-9): same complete structure
Q4 (Months 10-12): same complete structure

Each q-point should be a concrete action item or milestone pulled directly from the transcript. Each q-section-head should name a specific focus area (e.g., "BUILD YOUR SUPPORT TEAM", "SYSTEMIZE LEAD GEN", "LAUNCH PASSIVE STREAMS"). Each q-quote-box should end with a motivating Gogo-voice line specific to that quarter's theme.

${feedback ? `---\nREFINEMENT REQUEST: The admin has reviewed the previous blueprint and asked for these specific changes:\n${feedback}\nApply these changes where relevant to Section 04. Keep everything else as specified.\n---` : ''}
RULES: All action items must come directly from the transcript. Gogo's voice — direct, warm, personal. No invented facts. All 4 quarters must be fully written out.`

  // ── CALL 3 of 3: sections 5–7 + footer ───────────────────────────────────
  const prompt3 = `You are writing PART 3 of 3 of a personalized 12-month business blueprint for ${member.name} in Gogo Bethke's coaching program "The Circle."

${memberCtx}

---
GOGO'S BRAIN — INCOME STREAMS & PASSIVE INCOME:
${brainIncome}

GOGO'S BRAIN — GOGO'S RULES & NON-NEGOTIABLES:
${brainRules}

GOGO'S BRAIN — CIRCLE SUPPORT SYSTEM:
${brainSupport}

GOGO'S BRAIN — CONTENT STRATEGY:
${brainContent}

---
${cssClasses}

OUTPUT: Return ONLY raw HTML — no prose, no explanation, no markdown fences. Start with <section id="s5"> and end with </footer>. Do NOT include <!DOCTYPE>, <html>, <head>, <style>, or <body> tags.

WRITE THESE 4 ELEMENTS IN FULL — no placeholders, no truncation:

1. <section id="s5" class="page-section"> — eyebrow "Section 05", h2 "Your Income Architecture", section-intro (summarize their current income situation from transcript), then 4-5 income-stream blocks. Each block:
   <div class="income-stream">
     <div class="income-top"> — col1: income-name + income-phase tag | col2: income-now (NOW label + current state) | col3: income-goal (BY MONTH 12 label + gold target text)
     <div class="income-bar"><div class="income-bar-now" style="width:X%"></div><div class="income-bar-target" style="width:Y%;background:var(--gold)"></div></div>
     <div class="income-bottom"> — one sentence on the vehicle/mechanism
   </div>
   End with a blockquote from Brain on passive income / what if you can't work.

2. <section id="s6" class="page-section alt"> — eyebrow "Section 06", h2 "Gogo's Rules for Your Year", section-intro, then rules-list with 8-10 rule-items:
   <div class="rule-item"><div class="rule-n">01</div><div><div class="rule-headline">RULE IN ALL CAPS.</div><div class="rule-explain">Why this rule matters specifically for THIS person based on transcript.</div></div></div>
   Pull rules from Brain but write the rule-explain to match their exact situation.

3. <section id="s7" class="page-section"> — eyebrow "Section 07", h2 "Your Circle Support System", section-intro, support-grid with 6 support-cards (first gets class="support-card lead"):
   Weekly Office Hours (Every Tuesday 12-1pm EST), Private WhatsApp Community (between-session access), Monthly 1:1 Tech Session (60 min, one per month), GoGet'Em Community (required, tech calls Tue+Wed 3pm EST), Session Recordings (posted in WhatsApp same week), The Circle Members (up to 20, NDA-protected)
   Then community-box (non-subscription commitment text + right side: all payments non-refundable / early termination / year begins moment you sign)
   Then program-detail (3 pd-items separated by pd-sep: monthly $3,000/month · 12 payments total $36,000 | annual $30,000 · paid in full · 2 months complimentary · save $6,000 | italic "Your year starts the moment you sign.")

4. <footer> — footer-circle (div with span inside), footer-quote with Gogo's warm personal closing line TO this specific person based on their call, footer-meta "The Circle · 12-Month Coaching Program · gogobethke.com", second footer-meta "Confidential · Prepared for ${member.name} · ${today}"

${feedback ? `---\nREFINEMENT REQUEST: The admin has reviewed the previous blueprint and asked for these specific changes:\n${feedback}\nApply these changes where relevant to the sections you are writing. Keep everything else as specified.\n---` : ''}
RULES: Every word from transcript or Brain. Gogo's voice — direct, warm, personal. No invented facts. Dense, complete content.`

  let part1 = ''
  let part2 = ''
  let part3 = ''

  try {
    console.log('[Blueprint] Starting Call 1 of 3 (nav + cover + sections 1–3)...')
    const msg1 = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt1 }],
    })
    part1 = msg1.content[0].type === 'text' ? msg1.content[0].text : ''
    console.log('[Blueprint] Call 1 done, tokens:', msg1.usage?.output_tokens)

    console.log('[Blueprint] Starting Call 2 of 3 (section 4 — 12-month blueprint)...')
    const msg2 = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt2 }],
    })
    part2 = msg2.content[0].type === 'text' ? msg2.content[0].text : ''
    console.log('[Blueprint] Call 2 done, tokens:', msg2.usage?.output_tokens)

    console.log('[Blueprint] Starting Call 3 of 3 (sections 5–7 + footer)...')
    const msg3 = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt3 }],
    })
    part3 = msg3.content[0].type === 'text' ? msg3.content[0].text : ''
    console.log('[Blueprint] Call 3 done, tokens:', msg3.usage?.output_tokens)

    if (!part1.trim() || !part2.trim() || !part3.trim()) {
      return NextResponse.json({ error: 'Claude returned an incomplete response. Please try again.' }, { status: 500 })
    }
  } catch (aiErr: unknown) {
    const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr)
    const cause = aiErr instanceof Error && (aiErr as NodeJS.ErrnoException).cause
    console.error('[Blueprint] Anthropic error:', errMsg, cause ? `| cause: ${String(cause)}` : '')
    return NextResponse.json({ error: `AI generation failed: ${errMsg}` }, { status: 500 })
  }

  const blueprintBody = part1.trim() + '\n' + part2.trim() + '\n' + part3.trim()

  // Inject CSS shell — keeps CSS out of the prompt entirely
  const blueprintHtml = wrapWithShell(blueprintBody, member.name, today)

  // Get or generate share token
  const shareToken = member.blueprint_share_token ?? crypto.randomUUID()

  const { error: dbError } = await supabase
    .from('members')
    .update({
      blueprint_html: blueprintHtml,
      blueprint_generated_at: new Date().toISOString(),
      blueprint_share_token: shareToken,
      blueprint_sent_to_gogo_at: null,
      blueprint_sent_to_member_at: null,
    })
    .eq('id', member_id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ success: true, blueprint_html: blueprintHtml, share_token: shareToken })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const cause = err instanceof Error ? (err as NodeJS.ErrnoException).cause : undefined
    console.error('[Blueprint] Unhandled error:', msg, cause ? `| cause: ${String(cause)}` : '')
    return NextResponse.json({ error: `Unexpected error: ${msg}` }, { status: 500 })
  }
}
