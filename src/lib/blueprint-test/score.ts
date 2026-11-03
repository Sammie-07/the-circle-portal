import { ALL_QUESTIONS, type FreedomKey, type TestAnswers } from './questions'

// Scores the four freedoms (0-100) and decides where in Gogo's business the
// person belongs. Rules, not AI: the same answers always route the same way,
// and the admin can see exactly why.

export type Route = 'circle' | 'partner' | 'community' | 'not_ready'

export interface Destination { label: string; url: string; cta: string; blurb: string }

// The Circle's URL is replaced by the clarity-call booking link once it is set
// in app_settings.blueprint_clarity_url (see getDestinations).
export const DESTINATIONS: Record<Route, Destination> = {
  circle: {
    label: 'The Circle',
    url: 'https://gogobethke.com/thecircle',
    cta: 'Apply for your clarity call',
    blurb: 'My small, handpicked, application-only mastermind for six-figure entrepreneurs building time, location and financial freedom.',
  },
  partner: {
    label: 'Partner with Gogo (#teamgogo)',
    url: 'https://gogobethke.com/partner',
    cta: 'See what partnering looks like',
    blurb: 'Join my team at eXp: the systems, support and revenue share that let me build a business that runs without me.',
  },
  community: {
    label: 'GoGet’Em Community',
    url: 'https://gogetemcommunity.com',
    cta: 'Join the GoGet’Em Community',
    blurb: 'The training, tech support and community to build your foundation: marketing, branding, systems and lead generation.',
  },
  not_ready: {
    label: 'Start here',
    url: 'https://gogobethke.com',
    cta: 'Start learning with me',
    blurb: 'Free content to build your foundation before you invest in a program.',
  },
}

export interface Scores { time: number; location: number; financial: number; ceo: number; overall: number }

export interface Analysis {
  scores: Scores
  bottleneck: FreedomKey
  route: Route
  secondRoute: Route | null
  /** Why it routed this way, in plain English (shown to the admin). */
  reasons: string[]
  /** Things staff should know before a call. */
  flags: string[]
}

const HOURS: Record<string, number> = { under_30: 100, '30_45': 75, '46_60': 50, '61_80': 25, '80_plus': 0 }
const PORTFOLIO: Record<string, number> = { none: 0, '1_2': 50, '3_9': 80, '10_plus': 100 }
const TEAM: Record<string, number> = { solo: 0, me_plus_support: 40, small: 65, mid: 85, large: 100 }

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

function likert(answers: TestAnswers, freedom: FreedomKey): number {
  const vals: number[] = []
  for (const q of ALL_QUESTIONS) {
    if (q.type !== 'scale' || q.freedom !== freedom) continue
    const v = answers[q.key]
    if (typeof v === 'number') vals.push(q.reverse ? 6 - v : v)
  }
  if (!vals.length) return 50
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  return ((avg - 1) / 4) * 100
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

export function analyze(answers: TestAnswers): Analysis {
  const time = clamp(0.8 * likert(answers, 'time') + 0.2 * (HOURS[str(answers.hours)] ?? 50))
  const location = clamp(likert(answers, 'location'))
  let financial = 0.75 * likert(answers, 'financial') + 0.25 * (PORTFOLIO[str(answers.portfolio)] ?? 0)
  if (answers.taxes_behind === 'yes') financial -= 10
  if (answers.bankruptcy === 'yes') financial -= 10
  financial = clamp(financial)
  const ceo = clamp(0.75 * likert(answers, 'ceo') + 0.25 * (TEAM[str(answers.team)] ?? 0))
  const scores: Scores = { time, location, financial, ceo, overall: clamp((time + location + financial + ceo) / 4) }

  // Lowest freedom is the bottleneck; ties go to the one that unlocks the others.
  const order: FreedomKey[] = ['ceo', 'time', 'financial', 'location']
  const bottleneck = order.reduce((lo, k) => (scores[k] < scores[lo] ? k : lo), order[0])

  const role = str(answers.role)
  const isAgent = ['agent', 'team_leader', 'broker'].includes(role)
  const onTeam = answers.teamgogo === 'yes'
  const sixFigure = (answers.revenue && answers.revenue !== 'under_100k') || (answers.household_income && answers.household_income !== '0_99k')
  const investNo = answers.invest_ready === 'no'

  const reasons: string[] = []
  let route: Route
  if (role === 'starting') {
    route = 'not_ready'
    reasons.push('Not in business yet.')
  } else if (sixFigure && !investNo) {
    route = 'circle'
    reasons.push('Six-figure business or household income, and open to investing in a mastermind.')
  } else if (sixFigure && isAgent && !onTeam) {
    route = 'partner'
    reasons.push('Six-figure agent, not ready to invest in a mastermind, not on #teamgogo yet.')
  } else {
    route = 'community'
    reasons.push(sixFigure ? 'Six figures but not ready to invest in a mastermind.' : 'Under six figures: building the foundation first.')
  }

  let secondRoute: Route | null = null
  if (route !== 'partner' && isAgent && !onTeam) {
    secondRoute = 'partner'
    reasons.push('Licensed agent not on #teamgogo, so partnering is also a fit.')
  } else if (route === 'not_ready') {
    secondRoute = 'community'
  }

  const flags: string[] = []
  if (answers.taxes_behind === 'yes') flags.push('Behind on taxes')
  if (answers.bankruptcy === 'yes') flags.push('Bankruptcy filed or planned')
  if (answers.credit === 'under_620') flags.push('Credit score under 620')
  if (answers.decision_makers === 'not_yet') flags.push('Decision makers not on board yet')
  if (answers.invest_ready === 'questions') flags.push('Has questions about the investment')
  if (answers.hours === '80_plus') flags.push('Working 80+ hours a week')
  if (onTeam) flags.push('Already #teamgogo')
  if (answers.ggtc_member === 'yes') flags.push('Already a GGTC member')

  return { scores, bottleneck, route, secondRoute, reasons, flags }
}
