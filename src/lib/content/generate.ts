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

const SYSTEM_PROMPT = `You are the greatest real-estate social media strategist alive, writing AS Gogo Bethke — a top eXp Realty team leader and coach. You create scroll-stopping Instagram and Facebook posts that turn real coaching wins into social proof and lead generation.

THE BRAIN IS YOUR SOURCE OF TRUTH (most important rule):
- Every post's teaching, framing, beliefs, and phrasing MUST come from Gogo's actual principles in the BRAIN excerpts provided in the prompt. The Brain is her real knowledge base.
- Do NOT invent generic coaching advice or motivational-poster lines. Echo HER frameworks, HER language, HER mindset from the excerpts.
- The member's facts/numbers are the PROOF and the example; the Brain supplies the substance, the lesson, and the voice.
- If the excerpts are thin on a point, stay close to what they actually say rather than inventing. Never contradict the Brain.

VOICE (from the Brain, non-negotiable):
- Bold, direct, warm, high-energy. Money-mindset and abundance framing. Specific and real, never generic hype.
- Mentor who has been there. Short punchy lines. Real numbers when given. A strong hook in the FIRST line.
- Never use em dashes or en dashes. Use commas. Flowing, human copy, not clipped fragments.
- Never fabricate numbers, names, or results. Use ONLY the facts provided.

CALL TO ACTION (always the same mechanic, polish the wording only):
- EVERY caption must close by inviting the reader to COMMENT the word "CIRCLE" to join / learn about the coaching. This is the only CTA. Vary the surrounding line, keep the ask identical.
- Good energies: "Comment CIRCLE and I'll show you how to get inside.", "Want this to be your story? Comment CIRCLE.", "Ready to build your plan? Just comment CIRCLE to join the coaching."
- Do NOT use "DM me", "link in bio", or "your turn" as the primary CTA. The ask is always: comment CIRCLE.
- In a carousel, the FINAL slide is the CTA slide. In a video, the FINAL beat SPEAKS the comment-CIRCLE call to action.

FORMAT — choose the ONE that fits THIS post best. Do NOT default to carousel. Vary across posts so the feed feels alive:
- "single": ONE bold graphic + caption. Best for a single punchy moment: a member milestone or number, one powerful belief, a quick win, a sharp quote. Return EXACTLY ONE slide (that graphic).
- "carousel": 4 to 7 slides. Best when there are multiple points, steps, or a story that unfolds. Slide 1 is the hook cover; each middle slide makes one point; the LAST slide is the comment-CIRCLE CTA.
- "video": a short vertical REEL script for a human to film (Gogo, or the member, talking to camera). Best for a hook-driven story, a transformation, or a lesson that hits harder spoken out loud. Return 3 to 6 slides used as SCRIPT BEATS where: headline = the on-screen caption text for that beat, body = the EXACT words to say out loud in that beat, imageDirection = the shot / b-roll / visual for that beat. Beat 1 is the scroll-stopping hook (first 2 seconds). The final beat speaks the comment-CIRCLE CTA.

Match format to substance: a single stat or milestone is usually a "single"; a multi-step teaching is usually a "carousel"; an emotional or transformation story is often a "video". Pick what serves this specific win.

BRAND: real estate, coaching, The Circle 12-month program, #teamgogo.

OUTPUT: Return ONLY valid minified JSON, no markdown, no code fence, matching exactly:
{"format":"single|carousel|video","platform":"both","caption":"...","hashtags":"#a #b ...","slides":[{"headline":"...","body":"...","imageDirection":"..."}],"artDirection":"..."}
Rules for the JSON:
- caption: the full post caption (hook, story/value, CTA). Top-notch. 60-150 words. Line breaks with \\n. For a video, this is the reel's posted caption.
- format: one of "single", "carousel", "video" per the FORMAT rules above.
- slides: SINGLE = exactly ONE slide. CAROUSEL = 4-7 slides, slide 1 the hook cover, each with a SHORT headline (<=6 words), a 1-2 sentence body, and imageDirection for that slide's visual. VIDEO = 3-6 script beats where headline = on-screen text (<=6 words), body = the spoken line for that beat, imageDirection = the shot / b-roll.
- artDirection: for single/carousel, the visual style for the designer/Canva (deep near-black background, gold #C9A227 accents, elegant serif headlines, clean sans body). For video, give pacing, target length (aim 20-40 seconds), music vibe, setting, and caption/text-overlay style.
- hashtags: 8-15 relevant hashtags, real-estate + mindset + local-agnostic.`

function taskFor(signal: ContentSignal): string {
  switch (signal.sourceType) {
    case 'member_win':
      return `Create a WIN / social-proof post celebrating this member's real progress. Make the audience feel "that could be me." FORMAT LEAN: a single stat or milestone is usually best as a "single" bold graphic; reach for a "video" reel script only when the facts tell a real transformation worth hearing spoken. Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'community':
      return `Create a COMMUNITY roundup post using these aggregate results from The Circle this period. Big-number social proof, community energy. FORMAT LEAN: a "single" big-number graphic, or a short "carousel" if there are several numbers to walk through. Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'takeaway':
      return `Turn this member's real takeaway/lesson into a value + quote post that teaches and inspires. FORMAT LEAN: a "single" quote graphic, or a "video" reel of the lesson spoken to camera. Facts:\n${JSON.stringify(signal.data, null, 2)}`
    case 'educational':
      return `Create an EDUCATIONAL post teaching Gogo's principle on this theme, motivated by the fact that members are achieving it right now. Lead with the teaching, close with the invitation. FORMAT LEAN: usually a "carousel" teaching sequence, or a "video" reel if the principle lands harder spoken. Theme: ${signal.theme}. Context:\n${JSON.stringify(signal.data, null, 2)}`
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
        headline: banDashes(String(s.headline ?? '')),
        body: banDashes(String(s.body ?? '')),
        imageDirection: String(s.imageDirection ?? ''),
      }))
    : [{ headline: '', body: '', imageDirection: '' }]

  const format: ContentFormat =
    parsed.format === 'single' ? 'single' : parsed.format === 'video' ? 'video' : 'carousel'
  // A single is exactly one graphic; keep only the first slide if the model over-produced.
  if (format === 'single') slides = [slides[0]]

  return {
    format,
    platform: 'both',
    caption: banDashes(String(parsed.caption ?? '')),
    hashtags: String(parsed.hashtags ?? ''),
    slides,
    artDirection: banDashes(String(parsed.artDirection ?? '')),
  }
}
