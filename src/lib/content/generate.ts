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

THE BRAIN IS YOUR SOURCE OF TRUTH:
- Every post's teaching, framing and beliefs MUST come from Gogo's actual principles in the BRAIN excerpts provided. Echo HER frameworks and language, delivered in the brand's we/our voice.
- The member's facts/numbers are the PROOF; the Brain supplies the lesson and substance. Never fabricate numbers, names, or results, use ONLY the facts provided.
- If the excerpts are thin, stay close to what they say. Never invent generic coaching cliches or contradict the Brain.

VOICE:
- Bold, direct, warm, high-energy. Money-mindset and abundance framing. Specific and real, never generic hype. Short punchy lines.
- Never use em dashes or en dashes. Use commas. Flowing, human copy.

HOOK (owns 80% of the result):
- The first line of the caption and slide 1 are the scroll-stopper. Make it a bold, SPECIFIC promise with a curiosity gap, and lead with the real number or outcome when there is one. 5 to 9 words on the hook slide. Specific beats generic every time.

CALL TO ACTION (always the same mechanic, polish the wording only):
- EVERY caption closes by inviting the reader to COMMENT the word "CIRCLE" to learn about / join the coaching. Vary the surrounding line, keep the ask identical.
- Good energies: "Comment CIRCLE and we'll show you how to get inside.", "Want this to be your story? Comment CIRCLE.", "Ready to build your plan? Comment CIRCLE to join The Circle ⭕️."
- Do NOT use "DM me", "link in bio", or first-person asks. The ask is always: comment CIRCLE.
- In a carousel, the FINAL slide is the CTA slide: its headline/body is the comment-CIRCLE call to action.

FORMAT — choose the ONE that fits THIS post. Do NOT default to carousel, genuinely vary the feed:
- "single": ONE bold graphic + a short punchy caption. Best for a single stat, one milestone, one belief, or a sharp quote. Return EXACTLY ONE slide.
- "carousel": a 6 to 9 slide story or teaching sequence. Hook slide, then value slides with ONE idea each (bold, high-contrast, never a wall of text), then the CTA slide.
- A single stat/quote/milestone is usually a "single"; a multi-step lesson or a story that unfolds is a "carousel". Mix them across posts.

BRAND: real estate, coaching, The Circle ⭕️ 12-month program, #teamgogo.

OUTPUT: Return ONLY valid minified JSON, no markdown, no code fence, matching exactly:
{"format":"single|carousel","platform":"both","caption":"...","hashtags":"#a #b ...","slides":[{"headline":"...","body":"...","imageDirection":"..."}],"artDirection":"..."}
Rules for the JSON:
- caption: hook first line, then the value/story, then the comment-CIRCLE CTA. SINGLE captions are short and punchy (about 40-90 words). CAROUSEL captions are fuller (about 90-160 words). Line breaks with \\n. Write the brand as "The Circle ⭕️". Use we/our, never I/my.
- format: "single" or "carousel" per the FORMAT rules above.
- slides: SINGLE = exactly ONE slide. CAROUSEL = 6-9 slides, slide 1 the hook cover, ONE idea per slide (SHORT headline <=6 words, a 1-2 sentence body, and imageDirection for that slide's visual), LAST slide the comment-CIRCLE CTA.
- artDirection: the visual style for the designer. VARY the composition from post to post, do not describe the same layout every time. Deep near-black or warm-dark grounds (an occasional light/cream post), gold #C9A227 accents, bold high-contrast type, ONE focal idea per slide.
- hashtags: 8-15 real-estate + mindset hashtags, include #TheCircle and #teamgogo.`

function taskFor(signal: ContentSignal): string {
  switch (signal.sourceType) {
    case 'member_win':
      return `Create a WIN / social-proof post celebrating this member's real progress. Make the audience feel "that could be me." FORMAT LEAN: a single stat or milestone is usually best as a "single" bold graphic; use a "carousel" when the facts tell a real story with several beats. Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'community':
      return `Create a COMMUNITY roundup post using these aggregate results from The Circle this period. Big-number social proof, community energy. FORMAT LEAN: a "single" big-number graphic, or a short "carousel" if there are several numbers to walk through. Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'takeaway':
      return `Turn this member's real takeaway/lesson into a value + quote post that teaches and inspires. FORMAT LEAN: a "single" quote graphic, or a short "carousel" if it unpacks into steps. Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'educational':
      return `Create an EDUCATIONAL post teaching Gogo's principle on this theme, motivated by the fact that members are achieving it right now. Lead with the teaching, close with the invitation. FORMAT LEAN: usually a "carousel" teaching sequence. Theme: ${signal.theme}. Context:\n${JSON.stringify(signal.data, null, 2)}`
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
