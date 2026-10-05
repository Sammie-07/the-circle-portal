import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { CIRCLE_FACTS } from '@/lib/circle-facts'
import { CIRCLE_VOICE, BANNED_PHRASES, PROFANITY, PRIVATE_MEMBER_DETAIL } from './circle-voice'
import type { Bucket } from './buckets'
import type { ConceptBrief } from './concepts'

// Writes the Instagram/Facebook caption for a concept brief, in the Circle
// voice (circle-voice.ts). A starting point the team edits, not a final post.

const CAPTION_SYSTEM = `You write Instagram and Facebook captions for The Circle ⭕️ brand account (Gogo Bethke's 12-month private mastermind). Follow this guide exactly. It is the voice.

${CIRCLE_VOICE}

${CIRCLE_FACTS}

HARD RULES FOR EVERY CAPTION:
- Brand account. Not Gogo speaking in first person. No "I"/"my" as Gogo. Gogo appears in the third person, as the coach the reader wants in their corner.
- The reader ("you") is the subject, except for member stories, testimonials, behind-the-scenes and posts about Gogo's coaching style.
- Use ONLY what the brief gives you. Never invent numbers, results, stories, quotes or facts. If the brief has a Gogo quote, you may use it word for word; never create a new quote and attribute it to Gogo.
- Members are anonymous unless the brief says they are approved to be named. Even if the brief contains them, NEVER include identifying or private details about a member: names, company, city, niche, awards or status titles, exact income or sales figures (no dollar amounts about a member at all), debts, taxes, the IRS, levies, legal or financial trouble, health, children, spouses or other family details, follower counts, years in business. Generalize so the story stays true but unrecognizable ("a top producer in her market", "a seven-figure business", "a financial mess she'd been avoiding", "years into a successful career"). This is the NDA; breaking it is the worst possible mistake.
- When you use a Gogo quote, introduce it inside a sentence (e.g. Gogo said it on a call: "...") instead of a dash-style attribution line.
- No profanity. No em dashes or en dashes. Never a period right before an emoji. Emojis rarely, only if natural.
- Normal paragraphs, mostly 2 to 4 sentences each. Do NOT put every sentence on its own line. About 90 to 200 words (member stories may run a little longer).
- Write "The Circle ⭕" with the ⭕.
- End with a CTA that flows from the pain in the post and asks them to comment "circle" to apply (vary the wording; position Gogo as the person they want beside them, never uncertain).
- Do not teach the full solution. Enough to show Gogo knows what comes next.

OUTPUT: ONLY minified JSON, no markdown: {"caption":"... (use \\n\\n between paragraphs)","hashtags":"#TheCircle plus up to 4 specific, relevant hashtags"}`

export interface CaptionResult {
  caption: string
  hashtags: string
}

function stripFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

/** House-style cleanup the model sometimes misses. */
function polish(s: string): string {
  return s
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+–\s+/g, ', ')
    .replace(/\.(\s*)(\p{Extended_Pictographic})/gu, '$1$2') // no period right before an emoji
    .replace(/The Circle(?!\s*⭕)/g, 'The Circle ⭕')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Private details that must never appear in an anonymous member story.
const PRIVATE_DETAIL = PRIVATE_MEMBER_DETAIL

function problems(caption: string, privateStory = false): string[] {
  const lower = caption.toLowerCase()
  const out = BANNED_PHRASES.filter((p) => lower.includes(p)).map((p) => `uses the banned phrase "${p}"`)
  if (PROFANITY.test(caption)) out.push('contains profanity')
  const leak = privateStory ? caption.match(PRIVATE_DETAIL) : null
  if (leak) out.push(`includes a private member detail ("${leak[0]}"); remove every dollar amount, tax/debt/legal detail and family detail about the member and keep the story general`)
  const lines = caption.split('\n').filter((l) => l.trim())
  const paragraphs = caption.split(/\n\s*\n/).filter((p) => p.trim())
  if (paragraphs.length >= 8 && lines.length / Math.max(1, paragraphs.length) < 1.3) out.push('puts nearly every sentence on its own line; use normal paragraphs')
  return out
}

/** Write a caption for one brief. Retries once if it breaks the guide's hard rules. */
export async function writeCaption(bucket: Bucket, brief: ConceptBrief, opts: { note?: string; previous?: string } = {}): Promise<CaptionResult> {
  const briefText = [
    `BUCKET: ${bucket}`,
    `CONCEPT: ${brief.concept}`,
    brief.quote ? `QUOTE (verbatim, ${brief.quote_source === 'testimonial' ? 'the member\'s own words from their testimonial, NOT Gogo' : brief.quote_source === 'call' ? 'Gogo said this on a Circle coaching call' : 'Gogo\'s own words from her teachings; do not say it was on a call'}): "${brief.quote}"` : '',
    `WHO THIS IS FOR: ${brief.who}`,
    `PAIN: ${brief.pain}`,
    `GOGO ANGLE: ${brief.gogo_angle}`,
    brief.story ? `MEMBER STORY (${brief.named ? 'approved to name' : 'ANONYMOUS, keep it general'}): where they were: ${brief.story.where} / the real problem: ${brief.story.problem} / what they're changing: ${brief.story.changing} / what they're building: ${brief.story.building}` : '',
    `WHY THIS SELLS THE CIRCLE: ${brief.why_circle}`,
    `FORMAT: ${brief.format}`,
  ].filter(Boolean).join('\n')

  // Anonymous member stories get the strict privacy check.
  const privateStory = !brief.named && (bucket === 'transformation' || !!brief.story)
  let feedback = ''
  let last: CaptionResult = { caption: '', hashtags: '' }
  for (let attempt = 0; attempt < 3; attempt++) {
    const user = `Write the caption for this concept.\n\n${briefText}${opts.note ? `\n\nTHE TEAM'S NOTE FOR THIS CAPTION: ${opts.note}` : ''}${opts.previous ? `\n\nTHE PREVIOUS CAPTION (write a clearly different take):\n${opts.previous}` : ''}${feedback ? `\n\nYOUR LAST DRAFT BROKE THE GUIDE: ${feedback}. Fix that.` : ''}\n\nJSON only.`
    const res = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system: CAPTION_SYSTEM,
      messages: [{ role: 'user', content: user }],
    })
    const raw = stripFence(res.content.map((b) => (b.type === 'text' ? b.text : '')).join(''))
    let parsed: { caption?: string; hashtags?: string }
    try {
      parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    } catch {
      feedback = 'the output was not valid JSON'
      continue
    }
    last = { caption: polish(String(parsed.caption ?? '')), hashtags: String(parsed.hashtags ?? '').trim() || '#TheCircle' }
    const issues = problems(last.caption, privateStory)
    if (last.caption && !issues.length) return last
    feedback = issues.join('; ') || 'the caption was empty'
  }
  if (!last.caption) throw new Error('Could not write a caption')
  // Never hand back a story caption that still leaks private details.
  if (privateStory && PRIVATE_DETAIL.test(last.caption)) throw new Error('Could not write a caption without private member details. Try Rewrite caption.')
  return last
}
