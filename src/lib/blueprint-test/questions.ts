// The public Blueprint Test: who they are, their numbers, the four freedoms
// (time, location, financial, CEO mindset), and readiness. Questions marked
// "intake" come from The Circle's GHL application form so a lead who goes on to
// apply has already answered them.
//
// `key` is stored in blueprint_tests.answers: never rename one, add new ones.

export type FreedomKey = 'time' | 'location' | 'financial' | 'ceo'

export const FREEDOM_LABEL: Record<FreedomKey, string> = {
  time: 'Time Freedom',
  location: 'Location Freedom',
  financial: 'Financial Freedom',
  ceo: 'CEO Mindset',
}

interface Option { value: string; label: string }

interface Base {
  key: string
  label: string
  hint?: string
  optional?: boolean
}

export type TestQuestion =
  | (Base & { type: 'single'; options: Option[] })
  | (Base & { type: 'multi'; options: Option[] })
  // 1 = not me at all, 5 = that's exactly me. `reverse` flips it for scoring.
  | (Base & { type: 'scale'; freedom: FreedomKey; reverse?: boolean })
  | (Base & { type: 'text'; long?: boolean })

export interface TestStep { id: string; title: string; intro: string; questions: TestQuestion[] }

const YES_NO: Option[] = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]

export const TEST_STEPS: TestStep[] = [
  {
    id: 'you',
    title: 'Where you are',
    intro: 'A few quick ones so I know who I am talking to.',
    questions: [
      {
        key: 'role', type: 'single', label: 'What best describes you?',
        options: [
          { value: 'agent', label: 'Real estate agent' },
          { value: 'team_leader', label: 'Real estate team leader or owner' },
          { value: 'broker', label: 'Broker or brokerage owner' },
          { value: 'business_owner', label: 'Business owner (another industry)' },
          { value: 'investor', label: 'Investor' },
          { value: 'starting', label: 'Not in business yet' },
        ],
      },
      { key: 'teamgogo', type: 'single', label: 'Are you a #teamgogo agent?', options: YES_NO }, // intake
      { key: 'ggtc_member', type: 'single', label: 'Are you a GoGet’Em Community member?', options: YES_NO }, // intake
      { key: 'bbm', type: 'single', label: 'Have you been to Beach, Business & Millions?', options: YES_NO }, // intake
    ],
  },
  {
    id: 'numbers',
    title: 'Your numbers',
    intro: 'Ranges are fine. Nobody sees this but my team.',
    questions: [
      {
        key: 'revenue', type: 'single', label: 'What was your business revenue in the last 12 months?', // intake
        options: [
          { value: 'under_100k', label: 'Under $100k' },
          { value: '100k_249k', label: '$100k – $249k' },
          { value: '250k_499k', label: '$250k – $499k' },
          { value: '500k_999k', label: '$500k – $999k' },
          { value: '1m_plus', label: '$1M+' },
        ],
      },
      {
        key: 'household_income', type: 'single', label: 'What is your gross annual household income?', // intake
        options: [
          { value: '0_99k', label: '$0 – $99k' },
          { value: '100k_199k', label: '$100k – $199k' },
          { value: '200k_499k', label: '$200k – $499k' },
          { value: '500k_749k', label: '$500k – $749k' },
          { value: '750k_1m', label: '$750k – $1M' },
          { value: '1m_plus', label: '$1M+' },
        ],
      },
      {
        key: 'hours', type: 'single', label: 'How many hours do you work in a typical week?', // intake
        options: [
          { value: 'under_30', label: 'Under 30' },
          { value: '30_45', label: '30 – 45' },
          { value: '46_60', label: '46 – 60' },
          { value: '61_80', label: '61 – 80' },
          { value: '80_plus', label: 'More than 80' },
        ],
      },
      {
        key: 'team', type: 'single', label: 'What does your team look like today?', // intake (team size & structure)
        options: [
          { value: 'solo', label: 'Just me' },
          { value: 'me_plus_support', label: 'Me plus an assistant or VA' },
          { value: 'small', label: 'A small team (2 – 5 people)' },
          { value: 'mid', label: 'A team of 6 – 15' },
          { value: 'large', label: 'More than 15' },
        ],
      },
      {
        key: 'support', type: 'multi', label: 'Who supports you right now? Pick all that apply.', // intake (support team + help at home)
        options: [
          { value: 'va', label: 'Virtual assistant (VA)' },
          { value: 'in_house', label: 'In-house assistant' },
          { value: 'ops', label: 'Operations or transaction coordinator' },
          { value: 'exec', label: 'Personal or executive assistant' },
          { value: 'home', label: 'Help at home (house assistant, cleaner, nanny)' },
          { value: 'none', label: 'Nobody yet' },
        ],
      },
    ],
  },
  {
    id: 'time',
    title: 'Time & location',
    intro: '1 means “not me at all”, 5 means “that’s exactly me”. Be honest, it only helps you.',
    questions: [
      { key: 'time_away', type: 'scale', freedom: 'time', label: 'If I stepped away for two weeks, my business would keep running without me.' },
      { key: 'time_calendar', type: 'scale', freedom: 'time', label: 'I decide my calendar. My business does not decide it for me.' },
      { key: 'time_family', type: 'scale', freedom: 'time', label: 'I am present for the people and moments that matter, without my phone pulling me away.' },
      { key: 'loc_anywhere', type: 'scale', freedom: 'location', label: 'I can run my business from anywhere with a laptop and a phone.' },
      { key: 'loc_tied', type: 'scale', freedom: 'location', reverse: true, label: 'My income depends on me being physically in my local market.' },
      { key: 'loc_systems', type: 'scale', freedom: 'location', label: 'My systems (CRM, follow-up, marketing) run online, not in my head.' },
    ],
  },
  {
    id: 'money',
    title: 'Money & mindset',
    intro: 'Same scale. This is where most people find their real bottleneck.',
    questions: [
      { key: 'fin_passive', type: 'scale', freedom: 'financial', label: 'I have income that comes in whether I close a deal this month or not.' },
      { key: 'fin_invest', type: 'scale', freedom: 'financial', label: 'I own investments (property, stocks, other) that grow without my time.' },
      { key: 'fin_numbers', type: 'scale', freedom: 'financial', label: 'I know my numbers every month: income, expenses, profit, debt.' },
      { key: 'ceo_work', type: 'scale', freedom: 'ceo', label: 'Most of my week goes to work only I can do (vision, leadership, big deals), not tasks.' },
      { key: 'ceo_people', type: 'scale', freedom: 'ceo', label: 'I have hired, trained, and when needed let go of people.' },
      { key: 'ceo_rooms', type: 'scale', freedom: 'ceo', label: 'I invest in coaching and rooms that stretch me, and I implement what I learn.' },
      {
        key: 'portfolio', type: 'single', label: 'Do you own investment property?', // intake (portfolio type & value)
        options: [
          { value: 'none', label: 'Not yet' },
          { value: '1_2', label: '1 – 2 properties' },
          { value: '3_9', label: '3 – 9 properties' },
          { value: '10_plus', label: '10 or more' },
        ],
      },
      {
        key: 'credit', type: 'single', label: 'What is your credit score?', // intake
        options: [
          { value: 'under_620', label: 'Under 620' },
          { value: '620_679', label: '620 – 679' },
          { value: '680_739', label: '680 – 739' },
          { value: '740_plus', label: '740+' },
          { value: 'unsure', label: 'Not sure' },
        ],
      },
      { key: 'taxes_behind', type: 'single', label: 'Are you behind on your taxes?', options: YES_NO }, // intake
      { key: 'bankruptcy', type: 'single', label: 'Have you recently filed for bankruptcy, or are you planning to?', options: YES_NO }, // intake
    ],
  },
  {
    id: 'vision',
    title: 'Where you want to go',
    intro: 'Two real answers. This is what I read most closely.',
    questions: [
      { key: 'pain', type: 'text', long: true, label: 'What are the biggest pain points in your business right now?' }, // intake
      { key: 'vision', type: 'text', long: true, label: 'Picture 12 months from now. What has to be true for you to call it your best year?' },
      {
        key: 'invest_ready', type: 'single', // intake
        label: 'Quality masterminds are a business investment. If you were chosen for a room like The Circle, are you mentally and financially able to make that investment?',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'questions', label: 'Yes, but I have questions' },
          { value: 'no', label: 'No' },
        ],
      },
      {
        key: 'decision_makers', type: 'single', // intake
        label: 'Are the decision makers in your life and business (spouse, partner) on board with you investing in yourself?',
        options: [
          { value: 'yes', label: 'Yes, they are on board' },
          { value: 'not_yet', label: 'Not yet, I still need to have that conversation' },
        ],
      },
    ],
  },
]

export const ALL_QUESTIONS: TestQuestion[] = TEST_STEPS.flatMap((s) => s.questions)
export const QUESTION_BY_KEY: Record<string, TestQuestion> = Object.fromEntries(ALL_QUESTIONS.map((q) => [q.key, q]))

export type TestAnswers = Record<string, string | string[] | number>

export function isAnswered(q: TestQuestion, v: unknown): boolean {
  if (q.optional) return true
  if (q.type === 'scale') return typeof v === 'number' && v >= 1 && v <= 5
  if (q.type === 'multi') return Array.isArray(v) && v.length > 0
  if (q.type === 'text') return typeof v === 'string' && v.trim().length >= 3
  return typeof v === 'string' && q.options.some((o) => o.value === v)
}

/** Human-readable answer, for the admin view and the AI prompt. */
export function answerLabel(key: string, v: unknown): string {
  const q = QUESTION_BY_KEY[key]
  if (v === undefined || v === null || v === '') return 'not answered'
  if (!q) return String(v)
  if (q.type === 'scale') return `${v} / 5`
  if (q.type === 'text') return String(v)
  const label = (x: unknown) => q.options.find((o) => o.value === x)?.label ?? String(x)
  return Array.isArray(v) ? v.map(label).join(', ') : label(v)
}

/** Keeps only known keys with well-formed values (the public form is untrusted). */
export function cleanAnswers(raw: unknown): TestAnswers {
  const out: TestAnswers = {}
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  for (const q of ALL_QUESTIONS) {
    const v = r[q.key]
    if (q.type === 'scale' && typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5) out[q.key] = v
    else if (q.type === 'text' && typeof v === 'string') out[q.key] = v.trim().slice(0, 2000)
    else if (q.type === 'single' && typeof v === 'string' && q.options.some((o) => o.value === v)) out[q.key] = v
    else if (q.type === 'multi' && Array.isArray(v)) {
      const vals = v.filter((x): x is string => typeof x === 'string' && q.options.some((o) => o.value === x))
      if (vals.length) out[q.key] = [...new Set(vals)]
    }
  }
  return out
}
