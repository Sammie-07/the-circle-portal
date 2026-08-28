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
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    key: 'total_income',
    label: 'What was your total income last month?',
    type: 'currency',
    direction: 'up_good',
  },
  {
    key: 'income_sources',
    label: 'How many sources of income do you currently have?',
    type: 'integer',
    direction: 'up_good',
  },
  {
    key: 'closings',
    label: 'How many home sales (closings) did you complete last month?',
    type: 'integer',
    direction: 'up_good',
  },
  {
    key: 'avg_price_range',
    label: 'What was the average price range of the homes you sold last month?',
    type: 'text',
    direction: 'neutral',
    hint: 'e.g. $300k–$500k',
  },
  {
    key: 'total_debt',
    label:
      'How much total debt do you currently have (including credit cards, loans, etc.)?',
    type: 'currency',
    direction: 'down_good',
  },
  {
    key: 'credit_score',
    label: 'What is your current credit score?',
    type: 'integer',
    direction: 'up_good',
    baselineKey: 'credit_score',
  },
  {
    key: 'has_investments',
    label:
      'Do you currently have any investments (e.g., stocks, crypto, real estate)?',
    type: 'boolean',
    direction: 'up_good',
    baselineKey: 'has_investments',
  },
  {
    key: 'investments_value',
    label: 'What is the total dollar value of your investments?',
    type: 'currency',
    direction: 'up_good',
  },
  {
    key: 'real_estate_properties',
    label: 'If you invest in real estate, how many properties do you currently own?',
    type: 'integer',
    direction: 'up_good',
  },
  {
    key: 'active_llcs',
    label: 'How many active LLCs do you currently own or operate?',
    type: 'integer',
    direction: 'up_good',
  },
  {
    key: 'vas',
    label: 'How many Virtual Assistants (VAs) do you currently employ or work with?',
    type: 'integer',
    direction: 'up_good',
  },
  {
    key: 'hours_per_week',
    label: 'How many hours did you work per week on average last month?',
    type: 'number',
    direction: 'neutral',
  },
  {
    key: 'takeaway',
    label: 'What is your biggest takeaway or key lesson from this past month?',
    type: 'longtext',
    direction: 'neutral',
  },
]

export const SURVEY_QUESTION_BY_KEY: Record<string, SurveyQuestion> =
  Object.fromEntries(SURVEY_QUESTIONS.map((q) => [q.key, q]))

/** Answers are stored keyed by question key; values are the raw entered types. */
export type SurveyAnswers = Record<string, string | number | boolean | null>

/** True when every non-optional question has a usable answer. */
export function isSurveyComplete(answers: SurveyAnswers | null | undefined): boolean {
  if (!answers) return false
  return SURVEY_QUESTIONS.every((q) => {
    const v = answers[q.key]
    if (q.type === 'boolean') return v === true || v === false
    if (typeof v === 'string') return v.trim().length > 0
    return v !== null && v !== undefined
  })
}
