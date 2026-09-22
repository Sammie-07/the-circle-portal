// Shared helper for wrapping an uploaded PDF blueprint in the same branded
// "The Circle" shell used by generated blueprints. The structure deliberately
// mirrors the generated shell (dark bg, gold/red accents, sticky <nav> with
// .nav-brand + .nav-links) so that src/app/b/[token]/route.ts can inject its
// download toolbar via its existing `html.replace('</nav>', ...)` call.

import { getAnthropic } from '@/lib/ai'

// The revision edit echoes back the whole blueprint HTML with surgical changes,
// a read-and-restructure task, not deep reasoning. A faster model does long
// structured output much quicker (same choice as the Fathom transcript route),
// which keeps a large blueprint's edit inside Vercel's function time limit.
const EDIT_MODEL = 'claude-sonnet-5'

// ─── Full blueprint CSS — injected around the body, never sent to Claude ───
export const BLUEPRINT_CSS = `<style>
  :root{--gold:#C9A227;--red:#CC1F1F;--bg:#090909;--card:#161616;--card2:#1C1C1C;--border:rgba(201,162,39,0.18);--border2:rgba(255,255,255,0.06);--text:#EFEFEF;--muted:#777;--dim:#444;}
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

// The CSS class vocabulary the model may use (matches BLUEPRINT_CSS above).
export const BLUEPRINT_CSS_CLASSES = `CSS classes available (all pre-defined in stylesheet — use exactly as listed):
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

// Clean one model-generated HTML part before it's stored:
//  1. Strip any markdown code fence the model wraps the part in (```html … ```).
//  2. Remove em dashes (—) entirely — replace with a comma so it reads naturally.
//  3. Convert en dashes (–) to plain hyphens (keeps numeric ranges correct).
export function cleanBlueprintPart(raw: string): string {
  let html = raw.trim()
  html = html
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?\s*```\s*$/, '')
    .trim()
  html = html
    .replace(/\s*—\s*/g, ', ')
    .replace(/,\s*,/g, ', ')
    .replace(/\s+,/g, ',')
    .replace(/–/g, '-')
  return html
}

export function wrapWithShell(body: string, name: string): string {
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

// Extract the <body> inner HTML from a full stored blueprint document. Falls back
// to the whole string if no <body> is present.
export function extractBlueprintBody(fullHtml: string): string {
  const m = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return m ? m[1].trim() : fullHtml
}

// Edit an EXISTING blueprint to accommodate a member's revision request. This is
// a surgical edit — the model changes only what the new direction requires and
// keeps everything else byte-for-byte, rather than regenerating from scratch.
// Returns a full wrapped HTML document ready to store as blueprint_html.
export async function editBlueprintForRevision({
  existingHtml,
  memberName,
  answers,
}: {
  existingHtml: string
  memberName: string
  answers: { question: string; answer: string }[]
}): Promise<string> {
  const anthropic = getAnthropic()
  const existingBody = extractBlueprintBody(existingHtml)

  const answersBlock = answers
    .filter(a => a?.answer?.trim())
    .map(a => `Q: ${a.question}\nA: ${a.answer.trim()}`)
    .join('\n\n')

  // Ask for a MINIMAL SET OF FIND/REPLACE EDITS, not the whole document. Echoing
  // the full ~15-16k-token blueprint back was slow enough to hit the serverless
  // time limit; returning only the changed snippets keeps the output tiny (a few
  // hundred tokens), so it is fast, never truncates, and needs no streaming.
  const prompt = `You are EDITING an existing personalized 12-month business blueprint (HTML) for ${memberName} in Gogo Bethke's coaching program "The Circle." ${memberName} submitted a revision request describing a new idea or change of direction. Return the minimal set of edits that make the blueprint reflect their request.

RULES:
- Surgical edit, NOT a rewrite. Change ONLY the parts that must change (e.g. the relevant quarters, the income architecture, the rules, focus areas, and the cover tagline if it no longer fits). Leave everything else untouched.
- Each edit is a {"find","replace"} pair. "find" MUST be an exact, verbatim snippet copied character-for-character from the blueprint below (including the HTML tags and existing CSS classes), long enough to appear EXACTLY ONCE. Do NOT reformat, re-indent, or change quotes or whitespace in "find". If unsure it is unique, include more surrounding text.
- "replace" is the new HTML that takes its place, using ONLY the CSS classes already present in the document.
- Keep Gogo's voice: direct, warm, personal. No invented facts beyond what the member told you. Never use em dashes (the — character); use commas. Numeric ranges like "Months 1-3".

MEMBER'S REVISION REQUEST:
${answersBlock}

BLUEPRINT (copy every "find" snippet verbatim from here):
${existingBody}

OUTPUT: Return ONLY minified JSON, no markdown, no prose: {"edits":[{"find":"<verbatim snippet>","replace":"<new html>"}]}. Include only the edits that must change. If nothing needs to change, return {"edits":[]}.`

  const msg = await anthropic.messages.create({
    model: EDIT_MODEL,
    max_tokens: 8000, // only the edits come back, so this is plenty and stays non-streaming
    messages: [{ role: 'user', content: prompt }],
  })

  // Read ALL text blocks (the model may lead with a non-text block).
  const raw = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  let parsed: { edits?: { find?: string; replace?: string }[] }
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('Could not read the edit instructions. Please try again.')
  }

  const edits = (parsed.edits ?? []).filter(
    (e) => typeof e?.find === 'string' && e.find.trim() !== '' && typeof e?.replace === 'string'
  )
  if (edits.length === 0) {
    throw new Error('The edit produced no changes. Add more detail to the revision request and try again.')
  }

  const noDash = (s: string) => s.replace(/—/g, ', ').replace(/–/g, '-')
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Apply each edit: exact match first, then a whitespace-tolerant fallback so a
  // minor reformatting in "find" still lands. First occurrence only.
  let body = existingBody
  let applied = 0
  for (const e of edits) {
    const find = e.find as string
    const replace = noDash(e.replace as string)
    if (body.includes(find)) {
      body = body.replace(find, () => replace)
      applied++
      continue
    }
    const re = new RegExp(escapeRe(find).replace(/\s+/g, '\\s+'))
    if (re.test(body)) {
      body = body.replace(re, () => replace)
      applied++
    }
  }
  if (applied === 0) {
    throw new Error('Could not locate the sections to edit in the current blueprint. Please try again.')
  }

  return wrapWithShell(cleanBlueprintPart(body), memberName)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function wrapPdfBlueprint({
  memberName,
  pdfUrl,
  extractedText,
}: {
  memberName: string
  pdfUrl: string
  extractedText: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(memberName)} · Blueprint · The Circle</title>
<style>
  :root{--gold:#C9A227;--red:#CC1F1F;--bg:#090909;--border:rgba(201,162,39,0.18);--muted:#777;}
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{background:var(--bg);height:100%;color:#EFEFEF;font-family:'Georgia','Times New Roman',serif;}
  nav{position:sticky;top:0;z-index:200;background:rgba(13,13,13,0.98);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 56px;height:54px;}
  .nav-brand{display:flex;align-items:center;gap:10px;color:var(--gold);font-family:'Helvetica Neue',sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:600;}
  .nav-circle{width:18px;height:18px;border-radius:50%;border:2px solid var(--red);display:inline-block;flex-shrink:0;}
  .nav-links{display:flex;gap:32px;}
  .nav-links a{color:var(--muted);text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;}
  .pdf-wrap{max-width:1100px;margin:0 auto;}
  iframe{display:block;}
  @media (max-width:640px){nav{padding:0 20px;}.nav-links{display:none;}}
</style>
</head>
<body>
<nav>
  <div class="nav-brand"><span class="nav-circle"></span> The Circle</div>
  <div class="nav-links"><a>12-Month Blueprint</a></div>
</nav>
<div class="pdf-wrap">
  <iframe src="${pdfUrl}#toolbar=0&navpanes=0&view=FitH" style="width:100%;height:calc(100vh - 54px);border:0;background:#0a0a0a"></iframe>
</div>
<div style="display:none" aria-hidden="true">${escapeHtml(extractedText)}</div>
</body>
</html>`
}
