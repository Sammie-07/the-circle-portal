// Financial-health rule engine. Reads a member's normalized application
// answers and produces a flat list of tasks to inject into their blueprint.

export type ApplicationAnswers = {
  credit_score?: number | null
  owes_back_taxes?: boolean | null
  has_investments?: boolean | null
  [k: string]: unknown
}

export type FinancialRule = {
  id: string
  label: string
  when: (a: ApplicationAnswers) => boolean
  tasks: { title: string; description?: string }[]
}

// ─── Defensive coercion helpers ─────────────────────────────────────────────
// Answers can arrive from GHL as strings ("680"), booleans, or yes/no strings.

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const digits = v.replace(/[^\d.]/g, '')
    if (!digits) return null
    const n = Number(digits)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function coerceBoolean(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (['yes', 'y', 'true', '1'].includes(s)) return true
    if (['no', 'n', 'false', '0'].includes(s)) return false
  }
  return null
}

export const FINANCIAL_RULES: FinancialRule[] = [
  {
    id: 'credit-under-750',
    label: 'Credit score under 750',
    when: (a) => {
      const score = coerceNumber(a.credit_score)
      return score != null && score < 750
    },
    tasks: [
      { title: 'Pay down your credit card balances', description: 'Knock the balances down — high utilization drags your score and your cash flow.' },
      { title: 'Open a dedicated tax savings account', description: 'A separate account so tax money is never spent twice.' },
      { title: 'Set up a money tracker (know every dollar in and out)', description: 'You cannot scale what you do not track. Know every dollar.' },
      { title: 'Build a one-month expense buffer', description: 'One month of expenses sitting in the bank so a slow month never owns you.' },
    ],
  },
  {
    id: 'owes-back-taxes',
    label: 'Owes back taxes',
    when: (a) => coerceBoolean(a.owes_back_taxes) === true,
    tasks: [
      { title: 'Resolve your back taxes (call a tax pro or set up an IRS payment plan)', description: 'Stop avoiding it. Call a tax pro or set up an IRS payment plan this week.' },
      { title: 'Open a separate tax savings account and fund it every deal', description: 'Every closing, money goes here first — before you touch a dime.' },
    ],
  },
  {
    id: 'no-investments',
    label: 'No investments',
    when: (a) => coerceBoolean(a.has_investments) === false,
    tasks: [
      { title: 'Open an investment account', description: 'Money sitting still loses. Open the account and get in the game.' },
      { title: 'Automate a monthly investment contribution', description: 'Pay your future self automatically so it happens whether you remember or not.' },
    ],
  },
]

export type EvaluatedTask = {
  rule_key: string
  title: string
  description?: string
}

export function evaluateRules(answers: ApplicationAnswers | null | undefined): EvaluatedTask[] {
  const a = answers ?? {}
  const out: EvaluatedTask[] = []
  for (const rule of FINANCIAL_RULES) {
    let matched = false
    try {
      matched = rule.when(a)
    } catch {
      matched = false
    }
    if (!matched) continue
    rule.tasks.forEach((task, index) => {
      out.push({
        rule_key: `${rule.id}:${index}`,
        title: task.title,
        description: task.description,
      })
    })
  }
  return out
}
