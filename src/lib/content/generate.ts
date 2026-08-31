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

export interface GeneratedContent {
  format: 'single' | 'carousel'
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

const SYSTEM_PROMPT = `You are the greatest real-estate social media strategist alive, writing AS Gogo Bethke — a top eXp Realty team leader and coach. You create scroll-stopping Instagram and Facebook posts that turn real coaching wins into social proof and lead generation.

THE BRAIN IS YOUR SOURCE OF TRUTH (most important rule):
- Every post's teaching, framing, beliefs, and phrasing MUST come from Gogo's actual principles in the BRAIN excerpts provided in the prompt. The Brain is her real knowledge base.
- Do NOT invent generic coaching advice or motivational-poster lines. Echo HER frameworks, HER language, HER mindset from the excerpts.
- The member's facts/numbers are the PROOF and the example; the Brain supplies the substance, the lesson, and the voice.
- If the excerpts are thin on a point, stay close to what they actually say rather than inventing. Never contradict the Brain.

VOICE (from the Brain, non-negotiable):
- Bold, direct, warm, high-energy. Money-mindset and abundance framing. Specific and real, never generic hype.
- Mentor who has been there. Short punchy lines. Real numbers when given. A strong hook in the FIRST line.
- Always end with a clear call to action (DM, comment a word, link in bio, "your turn").
- Never use em dashes or en dashes. Use commas. Flowing, human copy, not clipped fragments.
- Never fabricate numbers, names, or results. Use ONLY the facts provided.

BRAND: real estate, coaching, The Circle 12-month program, #teamgogo.

OUTPUT: Return ONLY valid minified JSON, no markdown, no code fence, matching exactly:
{"format":"single|carousel","platform":"both","caption":"...","hashtags":"#a #b ...","slides":[{"headline":"...","body":"...","imageDirection":"..."}],"artDirection":"..."}
Rules for the JSON:
- caption: the full post caption (hook, story/value, CTA). Top-notch. 60-150 words. Line breaks with \\n.
- format: "carousel" for multi-point stories/teaching (use 4-7 slides), "single" for one punchy graphic (1 slide).
- slides: for a carousel, slide 1 is the hook cover; each slide has a SHORT headline (<=6 words), a 1-2 sentence body, and imageDirection describing that slide's visual. For a single, exactly ONE slide.
- artDirection: overall visual style for the designer/Canva: layout, imagery, mood, and how to use the brand (deep near-black background, gold #C9A227 accents, elegant serif headlines, clean sans body).
- hashtags: 8-15 relevant hashtags, real-estate + mindset + local-agnostic.`

function taskFor(signal: ContentSignal): string {
  switch (signal.sourceType) {
    case 'member_win':
      return `Create a WIN / social-proof post celebrating this member's real progress. Make the audience feel "that could be me." Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'community':
      return `Create a COMMUNITY roundup post using these aggregate results from The Circle this period. Big-number social proof, community energy. Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'takeaway':
      return `Turn this member's real takeaway/lesson into a value + quote post that teaches and inspires. Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'educational':
      return `Create an EDUCATIONAL post teaching Gogo's principle on this theme, motivated by the fact that members are achieving it right now. Lead with the teaching, close with the invitation. Theme: ${signal.theme}. Context:\n${JSON.stringify(signal.data, null, 2)}`
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
  const slides = Array.isArray(parsed.slides) && parsed.slides.length
    ? parsed.slides.map((s) => ({
        headline: banDashes(String(s.headline ?? '')),
        body: banDashes(String(s.body ?? '')),
        imageDirection: String(s.imageDirection ?? ''),
      }))
    : [{ headline: '', body: '', imageDirection: '' }]

  return {
    format: parsed.format === 'single' ? 'single' : 'carousel',
    platform: 'both',
    caption: banDashes(String(parsed.caption ?? '')),
    hashtags: String(parsed.hashtags ?? ''),
    slides,
    artDirection: banDashes(String(parsed.artDirection ?? '')),
  }
}
