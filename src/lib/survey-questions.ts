// The monthly "Circle Progress Check" — 13 fixed questions asked on the first
// Monday of every month. Definitions live in code (identical for every member,
// like CANONICAL_FACTS) so there's no per-question admin table to maintain.
//
// `key` is the stable slug stored in survey_responses.answers — never rename one
// (it would orphan historical answers); add new questions at the end instead.
//
// `direction` drives the admin progress indicators:
//   up_good   — a rise is progress (income, closings, credit, ...)
//   down_good — a fall is progress (debt)
//   neutral   — context only, no good/bad arrow (hours, price range, takeaway)
//
// `baselineKey` maps to a field on the intake application (applications.data) so
// month one can compare against where the member started. Only credit score and
// "has investments" were captured at intake — everything else baselines from the
// first survey.

export type SurveyInputType =
  | 'currency' // dollar amount, whole
  | 'integer' // whole count
  | 'number' // decimal allowed (e.g. hours)
  | 'boolean' // yes / no
  | 'text' // short free text (e.g. price range)
  | 'longtext' // paragraph

export type SurveyDirection = 'up_good' | 'down_good' | 'neutral'

export interface SurveyQuestion {
  key: string
  label: string
  type: SurveyInputType
  direction: SurveyDirection
  /** Field on applications.data to use as the month-1 baseline, if any. */
  baselineKey?: string
  /** Optional helper shown under the field. */
  hint?: string
  /** Visual grouping header shown above the first question of each section. */
  section?: string
  /** Optional questions never block submission or count toward the progress bar. */
  optional?: boolean
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  // ── Income & Production ──
  { key: 'total_income', section: 'Income & Production', label: 'What was your total income last month?', type: 'currency', direction: 'up_good' },
  { key: 'income_sources', label: 'How many sources of income do you currently have?', type: 'integer', direction: 'up_good' },
  { key: 'closings', label: 'How many home sales (closings) did you complete last month?', type: 'integer', direction: 'up_good' },
  { key: 'avg_price_range', label: 'What was the average price range of the homes you sold last month?', type: 'text', direction: 'neutral', hint: 'e.g. $300k-$500k' },

  // ── Real Estate Portfolio ──
  { key: 'real_estate_properties', section: 'Real Estate Portfolio', label: 'If you invest in real estate, how many properties do you currently own?', type: 'integer', direction: 'up_good' },
  { key: 'real_estate_value', label: 'What is the total value of your real estate assets?', type: 'currency', direction: 'up_good' },

  // ── Debt & Credit ──
  { key: 'total_debt', section: 'Debt & Credit', label: 'How much total debt do you currently have (including credit cards, loans, etc.)?', type: 'currency', direction: 'down_good' },
  { key: 'credit_score', label: 'What is your current credit score?', type: 'integer', direction: 'up_good', baselineKey: 'credit_score' },

  // ── Investments ──
  { key: 'has_investments', section: 'Investments', label: 'Do you currently have any investments (e.g., stocks, crypto, real estate)?', type: 'boolean', direction: 'up_good', baselineKey: 'has_investments' },
  { key: 'investments_value', label: 'What is the total dollar value of your investments?', type: 'currency', direction: 'up_good' },

  // ── Business & Team ──
  { key: 'active_llcs', section: 'Business & Team', label: 'How many active LLCs do you currently own or operate?', type: 'integer', direction: 'up_good' },
  { key: 'team_size', label: 'Do you have agents besides yourself? If so, how many?', type: 'integer', direction: 'up_good', hint: 'Enter 0 if it is just you for now.' },
  { key: 'agents_attracted', label: 'How many agents did you attract last month?', type: 'integer', direction: 'up_good' },

  // ── Your Support Team (VA / in-house / personal / house) ──
  { key: 'vas', section: 'Your Support Team', label: 'How many Virtual Assistants (VAs) do you currently employ or work with?', type: 'integer', direction: 'up_good', hint: 'Online / remote support.' },
  { key: 'in_house_assistant', label: 'Do you have an in-house assistant (in-person support inside your business)?', type: 'boolean', direction: 'up_good' },
  { key: 'personal_assistant', label: 'Do you have a personal or executive assistant?', type: 'boolean', direction: 'up_good' },
  { key: 'house_assistant', label: 'Do you have a house assistant (in-person help at home, e.g. errands, laundry)?', type: 'boolean', direction: 'up_good' },

  // ── Time ──
  { key: 'hours_per_week', section: 'Time', label: 'How many hours did you work per week on average last month?', type: 'number', direction: 'neutral' },

  // ── Reflection ──
  { key: 'personal_wins', section: 'Reflection', label: 'What personal goal(s) did you check off last month that you are proud of?', type: 'longtext', direction: 'neutral', hint: 'e.g. hired a CPA, paid taxes on time, became debt-free.' },
  { key: 'biggest_achievement', label: 'What was your biggest achievement this past month?', type: 'longtext', direction: 'neutral' },
  { key: 'biggest_disappointment', label: 'What was your biggest disappointment or failure this past month?', type: 'longtext', direction: 'neutral', hint: 'Be honest, this is where the real coaching happens.' },
  { key: 'takeaway', label: 'What is your biggest takeaway or key lesson from this past month?', type: 'longtext', direction: 'neutral' },
  { key: 'catch_all', label: 'What else are you working on that we are not asking about?', type: 'longtext', direction: 'neutral', optional: true, hint: 'Optional.' },
]

export const SURVEY_QUESTION_BY_KEY: Record<string, SurveyQuestion> =
  Object.fromEntries(SURVEY_QUESTIONS.map((q) => [q.key, q]))

/** Answers are stored keyed by question key; values are the raw entered types. */
export type SurveyAnswers = Record<string, string | number | boolean | null>

/** True when every non-optional question has a usable answer. */
export function isSurveyComplete(answers: SurveyAnswers | null | undefined): boolean {
  if (!answers) return false
  return SURVEY_QUESTIONS.every((q) => {
    if (q.optional) return true
    const v = answers[q.key]
    if (q.type === 'boolean') return v === true || v === false
    if (typeof v === 'string') return v.trim().length > 0
    return v !== null && v !== undefined
  })
}
