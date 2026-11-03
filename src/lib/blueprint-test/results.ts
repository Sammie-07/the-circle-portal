import type { SupabaseClient } from '@supabase/supabase-js'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { searchBrain, buildBrainContext } from '@/lib/brain-search'
import { CIRCLE_FACTS } from '@/lib/circle-facts'
import { ALL_QUESTIONS, FREEDOM_LABEL, answerLabel, type FreedomKey, type TestAnswers } from './questions'
import { getSetting } from '@/lib/settings'
import { DESTINATIONS, type Analysis, type Destination, type Route } from './score'

// Writes the "half the answers" results in Gogo's voice: an honest read of
// where they are on each freedom, their real bottleneck and three first moves.
// The full sequenced 12-month plan is what the blueprint (and the call) is for.

export interface TestResult {
  headline: string
  opening: string
  freedoms: Record<FreedomKey, string>
  bottleneck: string
  first_moves: string[]
  the_other_half: string
  closing: string
}

const SYSTEM = `You are Gogo Bethke writing someone's Blueprint Test results. Speak in first person ("I", "my"). They are NOT in any of my programs yet: they just took my free test about the four freedoms (time, location, financial freedom and CEO mindset).

THE JOB: give them half the answers. Show them, honestly and specifically, where they are and what is really holding them back, and give them three moves they can make this week. Do NOT hand over the full plan: the sequenced 12-month blueprint is what we build together. Make them feel seen, not sold to.

KNOWLEDGE RULE: my teachings, stories, numbers and program facts come ONLY from the Brain excerpts provided. Never invent a story, statistic, client result, price or quote. Never promise income or results. If the Brain has nothing on a point, coach from their answers.

USE THEIR ANSWERS: refer to what they actually told me (their hours, their team, their pain, their 12-month picture). Paraphrase, never paste their words back at length. Be kind about money trouble (taxes, credit, bankruptcy): name it as something to clean up, never shame.

VOICE: warm but straight, a blunt friend who wants them to win. Flowing conversational sentences, short paragraphs, one ALL-CAPS word at most. NEVER use em dashes (— or --). Never use: leverage, game-changing, unlock, journey, empower, transform, synergy, ecosystem, holistic, elevate, "next level". No sentence starts with "So". No exclamation points.

${CIRCLE_FACTS}
- The Circle is a 12-month commitment.

OUTPUT: ONLY minified JSON, no markdown:
{"headline":"one line naming their situation, max 12 words","opening":"2 short paragraphs (\\n\\n between) reading back where they are","freedoms":{"time":"1-2 sentences","location":"1-2 sentences","financial":"1-2 sentences","ceo":"1-2 sentences"},"bottleneck":"1 paragraph: the one thing holding everything else back and what it is costing them","first_moves":["move 1","move 2","move 3"],"the_other_half":"2-3 sentences: what the full blueprint maps out that this test cannot (the order, the hires, the numbers, the 12 months), without promising results","closing":"one line that leads naturally to: <ROUTE>"}`

function parseJson(text: string): TestResult | null {
  const a = text.indexOf('{')
  const b = text.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try {
    const r = JSON.parse(text.slice(a, b + 1)) as TestResult
    if (!r.headline || !r.opening || !r.freedoms || !Array.isArray(r.first_moves)) return null
    return r
  } catch {
    return null
  }
}

const noDashes = (s: string) => s.replace(/ *— */g, ', ').replace(/ *(?<!-)--(?!-) */g, ', ')

function scrub(r: TestResult): TestResult {
  return {
    headline: noDashes(r.headline),
    opening: noDashes(r.opening),
    freedoms: Object.fromEntries(Object.entries(r.freedoms).map(([k, v]) => [k, noDashes(String(v))])) as TestResult['freedoms'],
    bottleneck: noDashes(r.bottleneck ?? ''),
    first_moves: r.first_moves.slice(0, 3).map((m) => noDashes(String(m))),
    the_other_half: noDashes(r.the_other_half ?? ''),
    closing: noDashes(r.closing ?? ''),
  }
}

export async function writeResult(name: string, answers: TestAnswers, analysis: Analysis): Promise<TestResult> {
  const first = name.trim().split(/\s+/)[0] || 'friend'
  const dest = DESTINATIONS[analysis.route]
  const brainQuery = [FREEDOM_LABEL[analysis.bottleneck], String(answers.pain ?? ''), String(answers.vision ?? '')].join(' ').slice(0, 500)
  const chunks = await searchBrain(brainQuery, 6).catch(() => [])

  const lines = ALL_QUESTIONS.map((q) => `- ${q.label} → ${answerLabel(q.key, answers[q.key])}`).join('\n')
  const s = analysis.scores
  const user = `NAME: ${first}

THEIR ANSWERS:
${lines}

SCORES (0-100): Time ${s.time}, Location ${s.location}, Financial ${s.financial}, CEO Mindset ${s.ceo}. Overall ${s.overall}.
BIGGEST BOTTLENECK: ${FREEDOM_LABEL[analysis.bottleneck]}
WHERE I AM SENDING THEM NEXT: ${dest.label} (${dest.blurb})

GOGO'S BRAIN, RELEVANT EXCERPTS:
${chunks.length ? buildBrainContext(chunks) : '(nothing relevant found: coach from their answers)'}`

  const system = SYSTEM.replace('<ROUTE>', `${dest.label}`)
  let last = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2500,
      system,
      messages: [{ role: 'user', content: user }],
    })
    last = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    const parsed = parseJson(last)
    if (parsed) return scrub(parsed)
  }
  throw new Error(`Could not parse the results: ${last.slice(0, 200)}`)
}

/** Generates and stores the write-up for one test (runs after the response is sent). */
export async function generateAndStore(admin: SupabaseClient, id: string): Promise<void> {
  const { data: row } = await admin.from('blueprint_tests').select('name, answers, scores, bottleneck, route, second_route, flags').eq('id', id).maybeSingle()
  if (!row) return
  const analysis: Analysis = {
    scores: row.scores,
    bottleneck: row.bottleneck,
    route: row.route,
    secondRoute: row.second_route,
    reasons: [],
    flags: row.flags ?? [],
  }
  try {
    const result = await writeResult(row.name as string, row.answers as TestAnswers, analysis)
    await admin.from('blueprint_tests').update({ result, result_status: 'ready' }).eq('id', id)
  } catch (e) {
    console.error('Blueprint test result failed:', e)
    await admin.from('blueprint_tests').update({ result_status: 'error' }).eq('id', id)
  }
}

/** Destination for a route, with The Circle pointed at the clarity-call booking link once it is set. */
export async function destinationFor(route: Route | null): Promise<Destination | null> {
  if (!route) return null
  const d = DESTINATIONS[route]
  if (route !== 'circle') return d
  const url = await getSetting('blueprint_clarity_url')
  return url ? { ...d, url } : d
}
