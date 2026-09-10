import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { searchBrain, buildBrainContext, buildCanonicalFacts, sanitizeBrainText } from '@/lib/brain-search'
import { getTeamAgentCount } from '@/lib/settings'
import type { ContentSignal } from './signals'

// ---------------------------------------------------------------------------
// Privacy switch — flip in ONE place. 'named' uses real member names (current
// decision); 'anonymized' rewrites them to "a Circle member" everywhere.
export const NAME_MODE: 'named' | 'anonymized' = 'named'
// ---------------------------------------------------------------------------

export interface GeneratedSlide {
  headline: string
  body: string
  imageDirection: string
}

export type ContentFormat = 'single' | 'carousel' | 'video'

export interface GeneratedContent {
  format: ContentFormat
  platform: 'instagram' | 'facebook' | 'both'
  caption: string
  hashtags: string
  slides: GeneratedSlide[]
  artDirection: string
}

function anonymizeSignal(signal: ContentSignal): ContentSignal {
  if (NAME_MODE === 'named') return signal
  const anon = 'a Circle member'
  const data = { ...signal.data }
  if (typeof data.member === 'string') data.member = anon
  return {
    ...signal,
    memberName: signal.memberName ? anon : signal.memberName,
    summary: signal.memberName ? signal.summary.replace(signal.memberName, 'A Circle member') : signal.summary,
    data,
  }
}

const SYSTEM_PROMPT = `You are the social media team running the OFFICIAL Instagram and Facebook accounts for The Circle ⭕️, the 12-month real estate coaching program founded by Gogo Bethke. You create scroll-stopping posts that turn real member wins and Gogo's coaching principles into social proof and lead generation for The Circle ⭕️.

WHOSE ACCOUNT THIS IS (critical, never break this):
- These posts publish on THE CIRCLE ⭕️'s OWN brand accounts. This is NOT Gogo's personal account.
- Write in the BRAND's first-person PLURAL voice: we, our, us. NEVER use first-person singular. No "I", "me", "my", "I'll", "I've".
- Refer to Gogo in the THIRD person: "our founder Gogo Bethke", "Gogo teaches", "coach Gogo". She is the coach behind The Circle ⭕️, never the speaker.
- Feature members in the THIRD person as our people: "one of our members", "our member Krystal". Never write as if the member is speaking.

BRAND MARK (non-negotiable):
- The program name is ALWAYS written as "The Circle ⭕️" (with the ⭕️), every single time it appears in a caption or on a slide.

THE JOB (the most important rule of all, above cleverness and style):
- The reader is a real estate agent scrolling Instagram or Facebook who has NEVER heard of Gogo or The Circle ⭕️, and does not know any of our members. Every post exists to turn that stranger into a new member. This is lead generation, not journaling.
- THE COLD-READER TEST: before you write, ask "if someone who knows nothing about us read this, would they INSTANTLY understand the point, AND want what we have?" If the answer is no, it fails. Clarity beats clever, every time.

THE MESSAGE FORMULA (structure EVERY post, caption AND slides, this way):
1. PROBLEM: open by naming a real problem the reader lives with, a struggle, a plateau, a fear, or a bad habit most agents have. Make them feel seen in the first line.
2. CONCEPT: teach ONE clear idea from Gogo's Brain that solves that problem. Explain it in plain words. One idea per post, not five.
3. PROOF (only when a member fact is given): use the member's result as evidence the concept works, and EXPLAIN it fully, what the number actually is, why it happened, and what it means for the reader. Introduce who the member is in a few words first. Never drop a number or claim you cannot explain. If you cannot make a fact crystal clear to a stranger, leave it out.
4. SOLUTION + CTA: say plainly that The Circle ⭕️ is where this exact problem gets solved, then the easy ask.

CLARITY RULES (never violate, these are direct from the founder):
- One idea per post. No vague hype. No lines that sound nice but say nothing.
- Every number, name, or claim must be explained: what it is, why it happened, what the reader gets from it. Never write something like "$16M closed" or "zero missed calls" on its own, always say what it means and the lesson the reader can copy.
- No insider references. Do not assume the reader knows any member, knows Gogo, or knows any Circle term. Explain before you reference.
- The test: if you deleted our brand name, the teaching would still stand on its own and still make an agent want the solution.

THE BRAIN IS YOUR SOURCE OF TRUTH:
- Every post's teaching, framing and beliefs MUST come from Gogo's actual principles in the BRAIN excerpts provided. Echo HER frameworks and language, delivered in the brand's we/our voice.
- The member's facts/numbers are the PROOF; the Brain supplies the lesson and substance. Never fabricate numbers, names, or results, use ONLY the facts provided.
- If the excerpts are thin, stay close to what they say. Never invent generic coaching cliches or contradict the Brain.

VOICE:
- Bold, direct, warm, high-energy. Money-mindset and abundance framing. Specific and real, never generic hype. Short punchy lines.
- Never use em dashes or en dashes. Use commas. Flowing, human copy.

HOOK (owns 80% of the result):
- The first line of the caption and slide 1 name the reader's PROBLEM, or the promise of solving it, in plain words a stranger understands in one second. A curiosity gap is good, vague is not. If a member number is the hook, pair it with what it IS so it lands (not "8 weeks, zero missed calls" alone, but what that was and why the reader should care). 5 to 9 words on the hook slide. Clear and specific beats clever every time.

CALL TO ACTION (always the same mechanic, polish the wording only):
- EVERY caption closes by inviting the reader to COMMENT the word "CIRCLE" to learn about / join the coaching. Vary the surrounding line, keep the ask identical.
- Good energies: "Comment CIRCLE and we'll show you how to get inside.", "Want this to be your story? Comment CIRCLE.", "Ready to build your plan? Comment CIRCLE to join The Circle ⭕️."
- Do NOT use "DM me", "link in bio", or first-person asks. The ask is always: comment CIRCLE.
- In a carousel, the FINAL slide is the CTA slide: its headline/body is the comment-CIRCLE call to action.

FORMAT — choose the ONE that fits THIS post. Do NOT default to carousel, genuinely vary the feed:
- "single": ONE bold graphic + a short punchy caption. Best for a single stat, one milestone, one belief, or a sharp quote. Return EXACTLY ONE slide.
- "carousel": a 6 to 9 slide story or teaching sequence. Hook slide, then value slides with ONE idea each (bold, high-contrast, never a wall of text), then the CTA slide.
- A single stat/quote/milestone is usually a "single"; a multi-step lesson or a story that unfolds is a "carousel". Mix them across posts.

NEVER SAY (hard bans, even if the Brain excerpts mention them):
- Do NOT reference a seat count or a once-a-year / annual opening. Never write "20 seats", "only 20 spots", "opens once a year", "doors open once a year", "enrollment closes", a countdown, or any fixed number of spots. The Circle ⭕️ is actively expanding, so never imply an annual-only window, a waitlist, or a closing deadline.
- Premium positioning IS allowed (it just cannot be a number or a date): describing The Circle ⭕️ as a small, handpicked, intimate coaching room is fine. The CTA stays the open invitation to comment CIRCLE.

BRAND: real estate, coaching, The Circle ⭕️ 12-month program, #teamgogo.

OUTPUT: Return ONLY valid minified JSON, no markdown, no code fence, matching exactly:
{"format":"single|carousel","platform":"both","caption":"...","hashtags":"#a #b ...","slides":[{"headline":"...","body":"...","imageDirection":"..."}],"artDirection":"..."}
Rules for the JSON:
- caption: follow the MESSAGE FORMULA, problem, then the concept explained, then proof (explained, if any), then the comment-CIRCLE CTA. SINGLE captions are short and punchy (about 40-90 words). CAROUSEL captions are fuller (about 90-160 words). Line breaks with \\n. Write the brand as "The Circle ⭕️". Use we/our, never I/my. A stranger must understand every line.
- format: "single" or "carousel" per the FORMAT rules above.
- slides: SINGLE = exactly ONE slide that states the problem or promise clearly. CAROUSEL = 6-9 slides: slide 1 the hook (the reader's problem/promise, clear to a stranger), the middle slides teach the ONE concept step by step and explain any proof, LAST slide the comment-CIRCLE CTA. ONE idea per slide, SHORT headline (<=6 words), a 1-2 sentence body, and imageDirection for that slide's visual. No slide may be vague or assume prior knowledge.
- artDirection: the visual style for the designer. VARY the composition from post to post, do not describe the same layout every time. Strictly on brand and luxury: deep near-black grounds ONLY (never light or cream), gold #C9A227 accents with a hint of red, bold high-contrast type, ONE focal idea per slide.
- hashtags: 8-15 real-estate + mindset hashtags, include #TheCircle and #teamgogo.`

function taskFor(signal: ContentSignal): string {
  switch (signal.sourceType) {
    case 'member_win':
      return `Use this member's result as PROOF in the MESSAGE FORMULA. Do NOT just celebrate it. First name the PROBLEM the reader has, teach the ONE concept from the Brain that this member used to break through, THEN bring in their result as evidence, explaining what the number/outcome actually is, why it happened, and what it means for the reader. Introduce who the member is in a few words. A stranger must fully understand it. Then point to The Circle ⭕️ and the CTA. FORMAT LEAN: a clean single, or a carousel if the concept has real steps. Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'community':
      return `Use these aggregate results as PROOF in the MESSAGE FORMULA. Open with the reader's problem (feeling alone, stuck, no accountability), teach the concept (what a room of committed agents does for your results), then use these numbers as evidence, explaining what they represent. Close on The Circle ⭕️ + CTA. FORMAT LEAN: a "single" big-number graphic, or a short "carousel". Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'takeaway':
      return `Turn this member's real takeaway into a teaching post via the MESSAGE FORMULA. Name the problem the lesson solves, teach the concept in plain words (grounded in the Brain), use the member's words/result as proof (explained), then The Circle ⭕️ + CTA. FORMAT LEAN: a "single" quote graphic, or a short "carousel" if it unpacks into steps. Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'educational':
      return `Create an EDUCATIONAL post via the MESSAGE FORMULA: open with the exact problem the reader faces on this theme, teach Gogo's principle that solves it (plain and clear, from the Brain), make the payoff concrete, then show The Circle ⭕️ is where agents get this, and the CTA. FORMAT LEAN: usually a "carousel" teaching sequence. Theme: ${signal.theme}. Context:\n${JSON.stringify(signal.data, null, 2)}`
  }
}

function brainQueryFor(signal: ContentSignal): string {
  const base = 'Gogo Bethke coaching principle framework mindset advice on'
  const themeMap: Record<string, string> = {
    income: 'growing income multiple income streams production goals',
    credit: 'credit financial health money mindset getting your finances right',
    debt: 'paying off debt financial discipline getting out of debt',
    investing: 'investing wealth building assets real estate portfolio',
    business: 'building a business team leverage systems VAs LLC scaling',
    homework: 'consistency doing the work accountability discipline showing up',
    takeaway: 'lessons mindset growth belief self worth',
    community: 'team #teamgogo culture accountability community support',
    growth: 'growth results transformation belief in yourself',
    blueprint: 'having a plan roadmap goal setting 12 month blueprint commitment vision',
    planning: 'goal setting planning roadmap vision quarterly goals clarity',
  }
  // Make the query signal-aware so we pull the most relevant teaching, and for
  // takeaways use the member's own words to find the matching principle.
  const specifics = signal.sourceType === 'takeaway' ? ` ${String(signal.data.takeaway ?? '')}` : ''
  return `${base} ${themeMap[signal.theme] ?? signal.theme}.${specifics}`.trim()
}

function stripFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

function banDashes(s: string): string {
  return s.replace(/—/g, ', ').replace(/–/g, '-')
}

// The brand name always carries the ⭕️ mark. Add it wherever "The Circle" appears
// without it (leaves an existing "The Circle ⭕️" untouched; possessives stay readable).
function brandMark(s: string): string {
  return s.replace(/The Circle(?!\s*⭕)/g, 'The Circle ⭕️')
}

function clean(s: string): string {
  return brandMark(banDashes(s))
}

/** Generate one finished post from a signal, grounded in Gogo's Brain. */
export async function generatePost(rawSignal: ContentSignal, feedbackGuidance = ''): Promise<GeneratedContent> {
  const signal = anonymizeSignal(rawSignal)
  const anthropic = getAnthropic()

  const chunks = await searchBrain(brainQueryFor(signal), 12).catch(() => [])
  const brainContext = chunks.length ? sanitizeBrainText(buildBrainContext(chunks)) : ''
  const canonical = buildCanonicalFacts(await getTeamAgentCount().catch(() => '1660'))

  const userContent = `${canonical}

GOGO'S KNOWLEDGE BASE (the Brain) — this is your lens. Use it to INTERPRET and CONTEXTUALIZE what the member did, and to supply the lesson, framing, beliefs, and voice for the post:
${brainContext || '(No specific excerpts retrieved for this topic. Stay strictly within Gogo\'s known principles; do not invent specifics.)'}
${feedbackGuidance ? `\nWHAT THE ADMIN HAS ASKED YOU TO IMPROVE (apply these preferences to this post):\n${feedbackGuidance}\n` : ''}
---
WHAT THE SYSTEM OBSERVED (the raw member activity to turn into a post):
${taskFor(signal)}

Write the post by viewing the observed activity THROUGH the lens of the Brain above: what does this win mean in Gogo's philosophy, and what would she teach from it? Return ONLY the JSON object.`

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const text = message.content.find((c) => c.type === 'text')?.text ?? ''
  let parsed: GeneratedContent
  try {
    parsed = JSON.parse(stripFence(text)) as GeneratedContent
  } catch {
    throw new Error('Generator returned unparseable output')
  }

  // Normalize + enforce brand rules.
  let slides = Array.isArray(parsed.slides) && parsed.slides.length
    ? parsed.slides.map((s) => ({
        headline: clean(String(s.headline ?? '')),
        body: clean(String(s.body ?? '')),
        imageDirection: String(s.imageDirection ?? ''),
      }))
    : [{ headline: '', body: '', imageDirection: '' }]

  // Video is temporarily disabled — anything not "single" is a carousel.
  const format: ContentFormat = parsed.format === 'single' ? 'single' : 'carousel'
  // A single is exactly one graphic; keep only the first slide if the model over-produced.
  if (format === 'single') slides = [slides[0]]

  return {
    format,
    platform: 'both',
    caption: clean(String(parsed.caption ?? '')),
    hashtags: String(parsed.hashtags ?? ''),
    slides,
    artDirection: banDashes(String(parsed.artDirection ?? '')),
  }
}
