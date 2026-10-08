import type { SupabaseClient } from '@supabase/supabase-js'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { searchBrain, buildBrainContext, sanitizeBrainText } from '@/lib/brain-search'
import { CIRCLE_FACTS } from '@/lib/circle-facts'
import { PRIVATE_MEMBER_DETAIL, CONCEPT_TICS } from './circle-voice'

// ---------------------------------------------------------------------------
// The Circle content strategist. Instead of turning every member activity into
// a finished post, it judges what is actually worth posting and hands the team
// a CONCEPT BRIEF: the idea + the pain + Gogo's angle + why it sells The Circle
// + format + the kind of visual. Copy and design happen after, by a human.
//
// Sources: weekly call transcripts (Gogo Pearls), member transformations
// (anonymous by default), the testimonial library, and coaching topics from
// Gogo's Brain.
// ---------------------------------------------------------------------------

import { BUCKETS, VISUAL_TYPES, PILLARS, BUCKET_LABEL, BUCKET_SAYS, TOPICS, type Bucket, type VisualType } from './buckets'
export { BUCKETS, VISUAL_TYPES, BUCKET_LABEL, VISUAL_LABEL, TOPICS, type Bucket, type VisualType, type Topic } from './buckets'

export interface ConceptBrief {
  concept: string
  quote: string
  quote_source: 'call' | 'brain' | 'testimonial' | ''
  who: string
  pain: string
  gogo_angle: string
  why_circle: string
  story: { where: string; problem: string; changing: string; building: string } | null
  topic: string // what it's about (delegation, freedom...), separate from the pillar
  format: string
  visual_type: VisualType
  visual_note: string
  does: Array<'seen' | 'see_gogo' | 'want_room'>
  score: number
  named: boolean // true only when the member/person is approved to be named
}

export interface ConceptIdea {
  bucket: Bucket
  brief: ConceptBrief
}

export type ConceptSignalKind = 'transcript' | 'transformation' | 'testimonial' | 'topic' | 'experience'

export interface ConceptSignal {
  kind: ConceptSignalKind
  dedupeKey: string
  summary: string // admin-facing label
  memberId: string | null
  transcriptId?: string
  maxIdeas: number
  brainQuery: string
  bucketHint?: Bucket
  /** Names that must never appear in a brief (members not approved for naming). */
  privateNames: string[]
  /** A name the brief MAY use (approved for public use). */
  publicName?: string | null
  material: string // the raw material for the model
  /** Source text quotes must be found in, verbatim (transcript / testimonial). */
  quoteSource?: string
}

const STRATEGIST_SYSTEM = `You are the content strategist for The Circle ⭕️, Gogo Bethke's 12-month private mastermind. You do NOT write finished posts. You find what is genuinely worth posting and hand the team a sharp CONCEPT BRIEF they can turn into a quote graphic, Reel or carousel.

THE NORTH STAR (ask this before every idea):
Does this make the RIGHT person want Gogo in their corner? Every idea must do at least one of:
- "seen": make the right entrepreneur feel seen ("that's me", "that's exactly my problem").
- "see_gogo": make them see Gogo differently as a coach (how she thinks, how direct she is, what being coached by her feels like).
- "want_room": make them want access to the room.
If an idea does none of these, do not suggest it.

WHO THE CIRCLE IS FOR (the only reader that matters):
Entrepreneurs in ANY industry already making consistent six figures, moving toward seven. They know how to work, sell and make money. Their problem is that they built success in a way that still depends on THEM:
- They vacation with the laptop. Physically somewhere beautiful, mentally still at the desk.
- They only make money when they work. No passive income. If they stop, it stops.
- The business can't run without them. No team that holds, no systems that stick, every decision comes back to them.
- Successful and exhausted. Still in grind mode. The business runs them.
- Their money isn't working for them. Earning, not yet building real wealth.
- They've hit a ceiling. What got them here won't get them there.
The Circle gives them four freedoms: location (systems that run whether they're in Tampa or Tuscany), time (a real team, VAs, the right structure), financial (passive income, investments, digital products) and CEO mindset (leading like an owner, not a producer).
THE TEST: would a successful six-figure owner read this and immediately recognize themselves? If not, it isn't Circle content.
- NOT Circle: "5 ways to stay motivated in business." Generic advice anyone could use. Beginner content.
- Circle: "You built a six-figure business. Why are you still approving every decision?"

CONTENT PILLARS (each pillar is a JOB the post does; pick the one whose job fits):
${BUCKETS.map((b) => `- ${b} (${BUCKET_LABEL[b]}), says ${BUCKET_SAYS[b]}\n  JOB: ${PILLARS[b].job}\n  BELONGS: ${PILLARS[b].belongs}\n  DOES NOT BELONG: ${PILLARS[b].not}`).join('\n')}

TOPIC IS NOT PILLAR. A topic is what the post is about; the pillar is the job it does. The same topic (say, delegation) can be Coaching ("'I can do it faster' might be the most expensive sentence in your business"), a Pearl (a real line Gogo said about letting go), a Member Transformation (someone went from approving everything to a team that owns it), Proof (a testimonial about finally taking a vacation), Gogo as the Coach (Gogo telling someone they are the bottleneck), or The Circle Experience (the member and their assistant both getting implementation support inside The Circle). Tag every idea with ONE topic from: ${TOPICS.join(', ')}.

JUDGMENT (this is the job):
- Never treat a routine activity as the idea. "Completed her homework", "didn't miss a call", "finished a task", "has a blueprint" are NOT posts. Ask what bigger transformation it represents, and if there isn't one, suggest nothing.
- Prefer one great idea over several average ones. It is fine, and often right, to return zero ideas.
- Be specific. Name the real pain in the owner's own words.
- THE FINAL TEST: could this exact idea be published by 500 other generic business coaches? If you can remove Gogo's name and it still sounds like every other coaching account on Instagram, it is not Circle content. Do not suggest it.
- Never use generic coaching language: "step into your highest self", "unlock your full potential", "your next level is waiting", "transform your business and your life", "you don't need X, you need Y", "success isn't about X, it's about Y", "your network is your net worth", "here's the truth".
- No profanity (the brand account never curses).
- Never start a concept with "She satisfies…" / "You satisfying…" or any "satisfies" phrasing. Write a plain, specific hook.

PRIVACY (NDA, non-negotiable):
- Member stories are ANONYMOUS by default: "One Circle member…", "One business owner inside The Circle…", "Someone Gogo coached this week…". Never use a member's name, their company, their city or any detail that identifies them, unless the material explicitly says the person is APPROVED TO BE NAMED.
- Even anonymous, NEVER include private or identifying details anywhere in a brief (story, concept, pain, anything): exact income, sales volume, revenue or hourly figures; debts, taxes, the IRS, levies, lawsuits or any legal/financial trouble; health; family members or childcare; follower counts; years in business; niche, market or city; awards or titles that point to one person. Generalize so the story stays true but unrecognizable: "a top producer in her market", "a seven-figure business", "a financial mess she'd been avoiding", "years into a successful career". The room's privacy is part of its value. Private details are never a reason to skip a real story: generalize them and still tell the transformation.
- Gogo, and her team (Kristy Waker), may always be named.

TRUTH:
- Gogo's perspective must come from the Brain excerpts or the transcript provided. Never invent her opinions, stories, numbers or results.
- A "quote" must be Gogo's (or the testimonial giver's) EXACT words copied from the material, verbatim. If there is no real quote, leave "quote" empty. Never paraphrase into quotation marks. Never invent a quote.
- Never invent member results, numbers or testimonials.

${CIRCLE_FACTS}

STYLE: plain, direct, no hype, no em dashes or en dashes (use commas or periods). The brand is written "The Circle ⭕️".

OUTPUT: return ONLY minified JSON, no markdown:
{"ideas":[{"bucket":"coaching|pearls|transformation|proof|coach|experience","topic":"one topic from the list","concept":"the idea as a scroll-stopping line (often the hook or headline)","quote":"verbatim quote or empty","quote_source":"call|brain|testimonial|","who":"who this is for, specifically","pain":"the pain in the owner's words","gogo_angle":"Gogo's perspective on it, from the material","why_circle":"why this sells The Circle (what it shows about the problems Gogo helps established owners solve)","story":{"where":"","problem":"","changing":"","building":""},"format":"one of: Quote graphic + caption | Carousel | Reel | Talking-head Reel | Single image + caption | Before/after story","visual_type":"power|relatable|coaching|speaking|listening|table|lifestyle|team|broll","visual_note":"what the visual should show and why it matches the emotion of the copy","does":["seen","see_gogo","want_room"],"score":1-10}],"skipped_reason":"if no ideas, why"}
- "story" is only for transformation; otherwise null. Proof uses the person's OWN words (quote), never a story we narrate.
- "score" = how strongly a six-figure owner would think "that's me" / "I need to be in that room". Be honest; below 7 means don't suggest it.
- visual_type must match the EMOTION of the idea: power posts (caliber of the room, big numbers, authority) get power / table / speaking, never a vacation laugh. Vulnerable or funny ideas may use relatable.`

// --------------------------------------------------------------------------
// Coaching topics: the recurring pains the team wants the engine hunting for.
// Each is revisited once a quarter for a fresh angle.
// --------------------------------------------------------------------------
const COACHING_TOPICS: Array<{ slug: string; bucket: Bucket; topic: string; query: string }> = [
  { slug: 'owner-bottleneck', bucket: 'coaching', topic: 'A business making good money that still needs the owner for every decision', query: 'business depends on the owner bottleneck every decision delegation systems team runs without you' },
  { slug: 'i-can-do-it-faster', bucket: 'coaching', topic: '"I can do it faster" as the reason an owner cannot delegate', query: 'delegation I can do it faster perfection letting go 80 percent done hiring VAs' },
  { slug: 'here-vs-there', bucket: 'coaching', topic: 'What got you here will not get you there', query: 'what got you here will not get you there next level growth change how you operate ceiling' },
  { slug: 'income-not-freedom', bucket: 'coaching', topic: 'Having income without freedom, vacationing with the laptop', query: 'freedom time money lifestyle vacation work life balance business runs without you' },
  { slug: 'only-paid-when-working', bucket: 'coaching', topic: 'Only making money when you work, no passive or residual income', query: 'passive income residual income multiple streams of income revenue share money while you sleep' },
  { slug: 'successful-exhausted', bucket: 'coaching', topic: 'Successful and exhausted, still operating in grind mode', query: 'burnout grind hustle exhausted rest balance sustainable business' },
  { slug: 'money-not-working', bucket: 'coaching', topic: 'Earning well but the money is not building wealth', query: 'investing wealth building money working for you real estate investing assets financial freedom' },
  { slug: 'producer-to-owner', bucket: 'coaching', topic: 'Moving from producer to business owner / CEO identity', query: 'CEO mindset business owner versus producer working on the business leadership identity' },
  { slug: 'stop-touching', bucket: 'coaching', topic: 'What the owner should still be doing versus what they should have stopped touching years ago', query: 'what to delegate owner tasks highest value activities time blocking stop doing list' },
  { slug: 'team-that-holds', bucket: 'coaching', topic: 'Building a team that holds: VAs, operations, the right structure', query: 'hiring VAs team structure operations manager hire slow fire fast building a team' },
  { slug: 'systems-run-without-you', bucket: 'coaching', topic: 'Systems and automation so the business runs without the owner', query: 'systems automation tools processes AI tech run the business without you' },
  { slug: 'multiple-streams', bucket: 'coaching', topic: 'Building multiple sources of income', query: 'multiple streams of income nine companies diversify income digital products investments' },
  { slug: 'caliber-of-room', bucket: 'coaching', topic: 'The caliber of the room you surround yourself with', query: 'caliber of the room surround yourself mastermind network who you spend time with level up' },
  { slug: 'learn-from-done-it', bucket: 'coaching', topic: 'Learning from someone who has already done it instead of trial and error', query: 'learning from someone who has done it mentor coach trial and error shortcut' },
  { slug: 'gogo-directness', bucket: 'coach', topic: "What it is like to be coached by Gogo: direct, no-BS, from experience", query: 'Gogo coaching style direct honest tough love accountability real talk' },
  { slug: 'gogo-story', bucket: 'pearls', topic: "Gogo's own path: from arriving with $200 to building multiple seven-figure companies, and what she would tell an owner stuck at six figures", query: 'Gogo story came to America with 200 dollars built companies seven figures journey' },
]

// What members actually get (from gogobethke.com/thecircle + the admin's
// approved "$1.6B" post). The only facts Circle Experience ideas may use.
const CIRCLE_PROGRAM_FACTS = `- A 12-month private mastermind, application-only, with an NDA (what's said in the room stays in the room).
- Personalized group coaching calls with Gogo: 2 guaranteed per month, most months 4. Every call goes deep into the members' businesses with a clear, actionable plan.
- Direct private WhatsApp chat with Gogo and her team for day-to-day questions and real-time feedback, so members aren't waiting for the next call to get unstuck.
- 1 hour monthly with Gogo's expert team (a team of 12 VAs: tech, systems, scaling). Implementation support, not just advice.
- Systems, automation and tech setup: software, apps, AI tools, trackers built so the business runs without the owner.
- Team building: finding and hiring the right VAs, structuring local and personal assistants.
- Passive income architecture: digital products, investment structures, wealth-building strategies.
- 12 months of CEO identity work: beliefs, habits and identity shifts.
- Every call is recorded and added to the member's portal.
- The caliber of the room: $1.6 BILLION+ in combined lifetime volume sitting at one table. Approved language: "At a certain point in business, you're not looking for somebody to explain how to work hard. You're asking different questions." / "$1.6 BILLION+ of combined experience creates a very different freaking conversation."
- Members are established entrepreneurs at consistent six figures and beyond, helping each other grow.`

const EXPERIENCE_ANGLES: Array<{ slug: string; angle: string; query: string }> = [
  { slug: 'caliber', angle: 'The caliber of the room: $1.6B+ in combined experience at one table', query: 'caliber of the room mastermind surround yourself successful people different questions' },
  { slug: 'direct-access', angle: 'Direct access to Gogo between calls (private WhatsApp)', query: 'access to a mentor between calls getting unstuck fast direct feedback' },
  { slug: 'team-support', angle: "Implementation support from Gogo's team, not just advice", query: 'implementation support team VAs tech systems built for you not just advice' },
  { slug: 'confidential', angle: 'A confidential room: the NDA and the conversations it makes possible', query: 'private room honest conversations trust confidentiality mastermind' },
  { slug: 'peer-learning', angle: 'Peer learning: established owners helping each other at the same table', query: 'peers mastermind members help each other learn from each other' },
  { slug: 'calls', angle: 'What happens on the coaching calls: deep dives into your business with a clear plan', query: 'coaching call deep dive action plan accountability' },
  { slug: 'seat-at-table', angle: 'A seat at the table: what changes when you are in this room for 12 months', query: 'seat at the table twelve months commitment identity transformation room' },
]

function quarterKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`
}

function monthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7)
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameVariants(name: string | null | undefined): string[] {
  if (!name) return []
  const full = name.trim()
  const parts = full.split(/\s+/).filter((p) => p.length >= 3)
  return [...new Set([full, ...parts])]
}

/** Hide the private figures in a member's own words (anonymous stories only). */
function maskPrivate(t: string): string {
  return t
    .replace(/\$\s?[\d,.]+\s?(k|m|mm|million|thousand|b|billion)?\b/gi, '[an amount]')
    .replace(/\b[\d,.]+\s?(k|m|mm|million|thousand)\b/gi, '[an amount]')
    .replace(/\b[\d,.]+\s?(followers|subscribers)\b/gi, '[an audience]')
    .replace(/\bicon( agent| status| award)?\b/gi, '[a top award]')
}

interface StoryMember {
  id: string
  name: string
  is_internal: boolean
  public_story_ok: boolean | null
  blueprint_html: string | null
  survey_responses: Array<{ period_month: string; answers: Record<string, unknown>; status: string }> | null
}

const STAFF_NAMES = ['Gogo', 'Bethke', 'Kristy', 'Waker']

interface CallRow { id: string; call_date: string | null; title: string | null; transcript: string }

/** A weekly call transcript → Gogo Pearls / Gogo as the Coach. */
export function transcriptSignal(c: CallRow, privateNames: string[]): ConceptSignal {
  // Every speaker on the call except Gogo and her team is private, by
  // whatever name the transcript used (nicknames, mis-transcriptions).
  const labelCounts = new Map<string, number>()
  for (const m of String(c.transcript).matchAll(/^(?:\[[\d:]+\]\s*)?([A-Z][A-Za-z.'-]+(?: [A-Z][A-Za-z.'-]+){0,2}):/gm)) {
    labelCounts.set(m[1], (labelCounts.get(m[1]) ?? 0) + 1)
  }
  const speakers = [...labelCounts]
    .filter(([n, k]) => k >= 2 && !STAFF_NAMES.some((st) => n.toLowerCase().includes(st.toLowerCase())))
    .map(([n]) => n)
  const callPrivate = [...new Set([...privateNames, ...speakers.flatMap((n) => nameVariants(n))])]
  return {
    kind: 'transcript',
    dedupeKey: `call:${c.id}`,
    summary: `Circle call${c.call_date ? ` · ${c.call_date}` : ''}${c.title ? ` · ${c.title}` : ''}`,
    memberId: null,
    transcriptId: c.id,
    maxIdeas: 6,
    brainQuery: 'Gogo coaching principles delegation team freedom money mindset CEO',
    privateNames: callPrivate,
    material: `A WEEKLY CIRCLE COACHING CALL TRANSCRIPT. Find the strongest Gogo moments: lines worth quoting, perspective shifts, times she told someone they were solving the wrong problem, or explained why their structure keeps them trapped, or challenged how they think about money, delegation, hiring, investing, freedom or leadership. NOT a summary of the call. Each idea is bucket "pearls" (a line, question, analogy or mindset shift she said: how Gogo thinks) or "coach" (a real coaching INTERACTION: her questioning, challenging, looking at the numbers or telling a member what has to change, so the viewer feels what being coached by her is like). Quotes must be Gogo's exact words from this transcript. The members on the call are anonymous: describe them only as "a Circle member" or "a business owner".\n\nTRANSCRIPT:\n${String(c.transcript).slice(0, 110_000)}`,
    quoteSource: String(c.transcript),
  }
}

/** One member's bigger-picture story for this month (anonymous unless approved). */
export function storySignal(
  m: Pick<StoryMember, 'id' | 'name' | 'public_story_ok' | 'blueprint_html'>,
  responses: Array<{ period_month: string; answers: Record<string, unknown> }>,
  notes: string[],
  privateNames: string[],
): ConceptSignal {
  const named = !!m.public_story_ok
  // Anonymous stories never see the private figures: dollar amounts, award
  // titles and follower counts are masked, and numeric survey answers are
  // given only as trends (up / down). The model can't leak what it never saw.
  const mask = named ? (t: string) => t : maskPrivate
  const blueprint = m.blueprint_html ? mask(htmlToText(m.blueprint_html).slice(0, 3500)) : ''
  const textKeys = ['biggest_achievement', 'biggest_disappointment', 'personal_wins', 'takeaway', 'catch_all', 'has_investments']
  const numKeys = ['total_income', 'income_sources', 'hours_per_week', 'team_size', 'vas', 'personal_assistant', 'house_assistant', 'credit_score', 'total_debt', 'investments_value', 'real_estate_properties', 'real_estate_value', 'active_llcs', 'closings']
  const surveys = responses
    .map((r) => {
      const a = r.answers ?? {}
      const keys = named ? [...numKeys, ...textKeys] : textKeys
      const kept = Object.fromEntries(keys.filter((k) => a[k] !== undefined && a[k] !== null && a[k] !== '').map((k) => [k, typeof a[k] === 'string' ? mask(a[k] as string) : a[k]]))
      return `${r.period_month}: ${JSON.stringify(kept)}`
    })
    .join('\n')
  const trends = named || responses.length < 2 ? '' : numKeys
    .map((k) => {
      const first = Number(responses[0].answers?.[k])
      const last = Number(responses[responses.length - 1].answers?.[k])
      if (!Number.isFinite(first) || !Number.isFinite(last) || first === last) return ''
      return `${k.replace(/_/g, ' ')}: ${last > first ? 'up' : 'down'}`
    })
    .filter(Boolean)
    .join(', ')
  return {
    kind: 'transformation',
    dedupeKey: `story:${m.id}:${monthKey()}`,
    summary: `${m.name} · bigger-picture story (${monthKey()})${named ? ' · approved to name' : ' · anonymous'}`,
    memberId: m.id,
    maxIdeas: 1,
    brainQuery: `Gogo principle for ${String(responses[responses.length - 1]?.answers?.biggest_disappointment ?? '').slice(0, 200) || 'scaling a business that depends on the owner'}`,
    bucketHint: 'transformation',
    privateNames: named ? privateNames.filter((n) => !nameVariants(m.name).includes(n)) : privateNames,
    publicName: named ? m.name.split(/\s+/)[0] : null,
    material: `ONE MEMBER'S ACTIVITY (${named ? `APPROVED TO BE NAMED: you may call them "${m.name.split(/\s+/)[0]}"` : 'ANONYMOUS: never name or identify them'}). Find the BIGGER TRANSFORMATION, not the activity: where were they, what was the actual problem, what are they changing, what are they building now, and why would another successful entrepreneur identify with it? Return ONE transformation idea, or none if there is no real story yet.\n\nTheir 12-month blueprint (their starting point and goals):\n${blueprint || '(none)'}\n\nMonthly progress surveys (oldest to newest):\n${surveys || '(none)'}${trends ? `\nTrends since their first survey: ${trends}` : ''}\n\nWhat they raised on recent coaching calls:\n${notes.slice(-10).map(mask).join('\n') || '(none)'}`,
  }
}

/** The Circle Experience angles (what you get access to by joining). */
export function experienceSignals(privateNames: string[]): ConceptSignal[] {
  return EXPERIENCE_ANGLES.map((e) => ({
    kind: 'experience' as const,
    dedupeKey: `experience:${e.slug}:${quarterKey()}`,
    summary: `Circle Experience · ${e.angle}`,
    memberId: null,
    maxIdeas: 1,
    brainQuery: e.query,
    bucketHint: 'experience' as const,
    privateNames,
    material: `A Circle Experience ("experience" pillar) idea about: "${e.angle}". The job: sell the actual environment and access someone gets by joining. Use ONLY these approved program facts (and the Brain excerpts for Gogo's view of why it matters). Never invent features, numbers or member details.\n\nAPPROVED PROGRAM FACTS:\n${CIRCLE_PROGRAM_FACTS}`,
  }))
}

/** Collect everything the strategist should look at this run. */
export async function scanConceptSignals(admin: SupabaseClient, opts: { memberId?: string | null } = {}): Promise<ConceptSignal[]> {
  const transcripts: ConceptSignal[] = []
  const stories: ConceptSignal[] = []
  const proofs: ConceptSignal[] = []
  const topics: ConceptSignal[] = []

  // Everyone whose name must stay out of public copy (anonymous by default).
  const { data: roster } = await admin.from('members').select('id, name, public_story_ok, is_internal')
  const privateNames = (roster ?? [])
    .filter((m) => !m.public_story_ok)
    .flatMap((m) => nameVariants(m.name as string))
    .filter((n) => !STAFF_NAMES.some((s) => s.toLowerCase() === n.toLowerCase()))

  // --- Weekly call transcripts → Gogo Pearls (heavy: long input) ---
  if (!opts.memberId) {
    const { data: calls } = await admin
      .from('call_transcripts')
      .select('id, call_date, title, transcript')
      .is('pearls_scanned_at', null)
      .order('created_at', { ascending: false })
      .limit(2)
    for (const c of calls ?? []) transcripts.push(transcriptSignal(c as CallRow, privateNames))
  }

  // --- Member transformations: one bigger-picture story per member per month ---
  {
    let q = admin
      .from('members')
      .select('id, name, is_internal, public_story_ok, blueprint_html, survey_responses ( period_month, answers, status )')
      .eq('status', 'active')
    if (opts.memberId) q = q.eq('id', opts.memberId)
    const { data: members } = await q
    const since = new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: logs } = await admin
      .from('weekly_logs')
      .select('member_id, week_of, notes')
      .gte('week_of', since)
      .not('notes', 'is', null)
      .order('week_of', { ascending: true })
    const notesBy = new Map<string, string[]>()
    for (const l of logs ?? []) {
      const n = String(l.notes ?? '').trim()
      if (n.length < 15) continue
      const arr = notesBy.get(l.member_id as string) ?? []
      arr.push(`${l.week_of}: ${n}`)
      notesBy.set(l.member_id as string, arr)
    }

    for (const m of (members ?? []) as StoryMember[]) {
      if (m.is_internal) continue
      const responses = (m.survey_responses ?? [])
        .filter((r) => r.status === 'complete')
        .sort((a, b) => a.period_month.localeCompare(b.period_month))
        .slice(-3)
      const notes = notesBy.get(m.id) ?? []
      // Not enough substance for a real story yet: skip quietly (no log entry,
      // so it's reconsidered once more happens).
      if (responses.length < 2 && notes.length < 2) continue

      stories.push(storySignal(m, responses, notes, privateNames))
    }
  }

  // --- Testimonials → proof ---
  if (!opts.memberId) {
    const { data: tms } = await admin
      .from('testimonials')
      .select('id, person_name, person_title, kind, headline, quote, name_ok')
      .order('created_at', { ascending: true })
    for (const t of tms ?? []) {
      const named = !!t.name_ok
      const text = `${t.headline ? `${t.headline}\n` : ''}${t.quote}`
      proofs.push({
        kind: 'testimonial',
        dedupeKey: `proof:${t.id}`,
        summary: `${t.person_name} · ${t.kind === 'endorsement' ? 'endorsement' : 'testimonial'}${named ? ' · approved to name' : ' · anonymous'}`,
        memberId: null,
        maxIdeas: 1,
        brainQuery: t.kind === 'endorsement' ? 'Gogo reputation coaching style credibility' : 'Circle results team freedom transformation',
        bucketHint: 'proof',
        privateNames: named ? [] : nameVariants(t.person_name as string),
        publicName: named ? (t.person_name as string) : null,
        material: `A ${t.kind === 'endorsement' ? 'PUBLIC ENDORSEMENT OF GOGO from an industry leader' : 'TESTIMONIAL from a Circle member'} (${named ? `APPROVED TO BE NAMED: ${t.person_name}${t.person_title ? `, ${t.person_title}` : ''}` : 'ANONYMOUS: never name or identify them'}). This is a "proof" idea: evidence in THEIR OWN WORDS, not a story we narrate. Pull the strongest sentence (quote it verbatim), then use the brief to say what doubt it removes, the problem they came in with, what changed and the result, and the larger lesson another entrepreneur would identify with.\n\n${text}`,
        quoteSource: text,
      })
    }
  }

  // --- Coaching topics from Gogo's Brain (fresh angle each quarter) ---
  if (!opts.memberId) {
    for (const t of COACHING_TOPICS) {
      topics.push({
        kind: 'topic',
        dedupeKey: `topic:${t.slug}:${quarterKey()}`,
        summary: `Topic · ${t.topic}`,
        memberId: null,
        maxIdeas: 2,
        brainQuery: t.query,
        bucketHint: t.bucket,
        privateNames,
        material: t.bucket === 'coach'
          ? `A TOPIC for "Gogo as the Coach": "${t.topic}". This pillar needs a REAL coaching interaction (Gogo questioning, challenging or redirecting someone). Only suggest an idea if the Brain excerpts describe an actual coaching moment; otherwise return zero. Plain Gogo quotes with no interaction belong in "pearls" instead.`
          : `A TOPIC to find content in: "${t.topic}". Using ONLY Gogo's perspective from the Brain excerpts, give up to 2 ideas doing DIFFERENT jobs: a "${t.bucket}" idea, and (only if the excerpts contain one) a "pearls" idea built on a line Gogo actually said, quoted verbatim from the excerpts.`,
      })
    }
  }

  // --- The Circle Experience: what you get access to by joining ---
  const experiences: ConceptSignal[] = []
  if (!opts.memberId) {
    experiences.push(...experienceSignals(privateNames))
  }

  // Interleave so a run mixes pillars instead of draining one source.
  const out: ConceptSignal[] = [...transcripts]
  const lanes = [stories, proofs, topics, experiences]
  for (let i = 0; lanes.some((l) => i < l.length); i++) {
    for (const lane of lanes) if (i < lane.length) out.push(lane[i])
  }
  return out
}

// ---------------------------------------------------------------------------

function stripFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

function noDashes(s: string): string {
  return s.replace(/\s*—\s*/g, ', ').replace(/\s+–\s+/g, ', ')
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Replace any private name with a neutral reference. */
function scrubNames(s: string, names: string[]): string {
  let out = s
  for (const n of [...names].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`\\b${escapeRe(n)}('s)?\\b`, 'g'), (_m, poss) => (poss ? "a Circle member's" : 'a Circle member'))
  }
  return out
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** True if the quote appears (near-)verbatim in the source. */
function quoteIsReal(quote: string, source: string): boolean {
  const q = normalizeForMatch(quote)
  if (q.length < 8) return false
  return normalizeForMatch(source).includes(q)
}

const MIN_SCORE = 7

/** Ask the strategist for concept briefs from one signal. Returns 0+ ideas. */
export async function generateConcepts(signal: ConceptSignal, guidance = ''): Promise<{ ideas: ConceptIdea[]; note: string }> {
  const chunks = await searchBrain(signal.brainQuery, 10).catch(() => [])
  const brainText = chunks.length ? sanitizeBrainText(buildBrainContext(chunks)) : ''

  const baseUser = `GOGO'S BRAIN (her real teachings; the only source for her perspective outside a transcript):
${brainText || '(no excerpts retrieved; stay strictly within what the material shows)'}
${guidance ? `\nWHAT THE TEAM HAS ASKED FOR (apply these preferences):\n${guidance}\n` : ''}
---
${signal.material}

Return up to ${signal.maxIdeas} idea${signal.maxIdeas === 1 ? '' : 's'}${signal.bucketHint ? ` (usually bucket "${signal.bucketHint}")` : ''}. Zero is fine if nothing passes the test. JSON only.`

  // Quotes must be real: from the transcript/testimonial, or Gogo's Brain.
  const quoteHaystack = `${signal.quoteSource ?? ''}\n${brainText}`
  // Anonymous member stories must not carry private/identifying details in ANY
  // field (the brief is what the team designs from). Gogo's own angle is exempt (her
  // own numbers are public). Other ideas are checked on the member story only.
  const strictPrivacy = (signal.kind === 'transformation' || signal.kind === 'transcript') && !signal.publicName

  function issuesFor(b: ConceptBrief): string[] {
    const out: string[] = []
    if (CONCEPT_TICS.test(b.concept)) out.push(`the concept "${b.concept}" starts with a "She satisfies..." style phrase; write a plain, specific hook`)
    const fields = strictPrivacy
      ? [b.concept, b.who, b.pain, b.why_circle, b.visual_note, ...(signal.kind === 'transcript' ? [b.quote] : []), ...(b.story ? Object.values(b.story) : [])]
      : !signal.publicName && b.story ? Object.values(b.story) : []
    for (const f of fields) {
      const m = f.match(PRIVATE_MEMBER_DETAIL)
      if (m) out.push(`"${m[0]}" is a private/identifying member detail (in: "${f.slice(0, 120)}"); generalize it`)
    }
    return out
  }

  let parsed: { ideas?: unknown[]; skipped_reason?: string } = {}
  let ideas: ConceptIdea[] = []
  let dropped: string[] = []
  let fixNote = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: STRATEGIST_SYSTEM,
      messages: [{ role: 'user', content: fixNote ? `${baseUser}\n\nYOUR LAST ANSWER BROKE THE RULES. Fix every one of these and return the full JSON again:\n- ${fixNote}` : baseUser }],
    })
    const raw = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    try {
      const t = stripFence(raw)
      parsed = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1))
    } catch {
      if (attempt === 0) { fixNote = 'the output was not valid JSON'; continue }
      throw new Error('Strategist returned unreadable output')
    }

    ideas = []
    dropped = []
    const problems: string[] = []
    for (const rawIdea of (parsed.ideas ?? []).slice(0, signal.maxIdeas)) {
      const i = rawIdea as Record<string, unknown>
      const bucket = (BUCKETS as readonly string[]).includes(String(i.bucket)) ? (i.bucket as Bucket) : signal.bucketHint ?? 'coaching'
      const score = Number(i.score) || 0
      const does = (Array.isArray(i.does) ? i.does : []).filter((d): d is ConceptBrief['does'][number] => ['seen', 'see_gogo', 'want_room'].includes(String(d)))
      if (score < MIN_SCORE || does.length === 0) { dropped.push(`score ${score}`); continue }

      const clean = (v: unknown) => scrubNames(noDashes(String(v ?? '').trim()), signal.privateNames)
      let quote = String(i.quote ?? '').trim().replace(/^["“]|["”]$/g, '')
      if (quote && !quoteIsReal(quote, quoteHaystack)) quote = ''
      // A pearl IS its quote; without a verifiable line it isn't a pearl.
      if (bucket === 'pearls' && !quote) { dropped.push('unverified quote'); continue }

      const st = i.story as Record<string, unknown> | null | undefined
      const story = st && typeof st === 'object' && Object.values(st).some((v) => String(v ?? '').trim())
        ? { where: clean(st.where), problem: clean(st.problem), changing: clean(st.changing), building: clean(st.building) }
        : null
      const vt = String(i.visual_type)
      const brief: ConceptBrief = {
        concept: clean(i.concept),
        quote: scrubNames(noDashes(quote), signal.privateNames),
        quote_source: quote ? ((['call', 'brain', 'testimonial'].includes(String(i.quote_source)) ? i.quote_source : signal.kind === 'transcript' ? 'call' : signal.kind === 'testimonial' ? 'testimonial' : 'brain') as ConceptBrief['quote_source']) : '',
        who: clean(i.who),
        pain: clean(i.pain),
        gogo_angle: clean(i.gogo_angle),
        why_circle: clean(i.why_circle),
        story: bucket === 'transformation' ? story : null,
        topic: (TOPICS as readonly string[]).includes(String(i.topic ?? '').toLowerCase().trim()) ? String(i.topic).toLowerCase().trim() : '',
        format: noDashes(String(i.format ?? '').trim()) || 'Single image + caption',
        visual_type: (VISUAL_TYPES as readonly string[]).includes(vt) ? (vt as VisualType) : 'power',
        visual_note: clean(i.visual_note),
        does,
        score,
        named: !!signal.publicName,
      }
      const issues = issuesFor(brief)
      if (issues.length) { problems.push(...issues); dropped.push(issues[0].slice(0, 160)); continue }
      ideas.push({ bucket, brief })
    }

    if (!problems.length || attempt === 2) break
    fixNote = problems.join('\n- ')
  }

  const note = ideas.length
    ? `${ideas.length} idea${ideas.length === 1 ? '' : 's'}${dropped.length ? `, dropped ${dropped.join(', ')}` : ''}`
    : `no ideas: ${String(parsed.skipped_reason ?? '').slice(0, 300) || dropped.join(', ') || 'nothing passed'}`
  return { ideas, note }
}

/** Map a brief's free-text format onto the content_posts format column. */
export function formatColumn(format: string): 'single' | 'carousel' | 'video' {
  const f = format.toLowerCase()
  if (f.includes('carousel') || f.includes('before/after')) return 'carousel'
  if (f.includes('reel')) return 'video'
  return 'single'
}
