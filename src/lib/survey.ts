// Monthly progress survey — shared date logic + the indicator/highlight engine.
// Date math is done in ET (America/New_York) so "first Monday" lines up with the
// team's clock, matching the office-hours logic.

import {
  SURVEY_QUESTIONS,
  SURVEY_QUESTION_BY_KEY,
  type SurveyAnswers,
} from './survey-questions'

const TZ = 'America/New_York'

/** Y/M/D of a Date as seen in ET. */
export function etParts(d: Date): { y: number; m: number; day: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]))
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    day: Number(parts.day),
    weekday: weekdayMap[parts.weekday as string] ?? 0,
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** ISO date (YYYY-MM-DD) for a Y/M/D triple. */
export function isoDate(y: number, m: number, day: number): string {
  return `${y}-${pad(m)}-${pad(day)}`
}

/** The 1st-of-month ISO string for the month `d` falls in (ET). */
export function periodMonthOf(d: Date): string {
  const { y, m } = etParts(d)
  return isoDate(y, m, 1)
}

/** Day-of-week (0=Sun) for the 1st of the given ET month, via a stable UTC-noon anchor. */
function weekdayOfFirst(y: number, m: number): number {
  return new Date(Date.UTC(y, m - 1, 1, 12)).getUTCDay()
}

/** Date (day-of-month) of the first Monday of the given month. */
export function firstMondayDay(y: number, m: number): number {
  const wd = weekdayOfFirst(y, m) // 0=Sun..6=Sat
  // days to add to the 1st to reach Monday (1)
  const offset = (1 - wd + 7) % 7
  return 1 + offset
}

export interface SurveyWindow {
  periodMonth: string // 1st of month, ISO
  openedOn: string // first Monday, ISO
  weekEnd: string // Sunday ending the send week, ISO
}

/** The survey window for the month `d` falls in (ET). */
export function windowForMonth(d: Date): SurveyWindow {
  const { y, m } = etParts(d)
  const fm = firstMondayDay(y, m)
  const weekEndDay = fm + 6 // Monday + 6 = Sunday
  return {
    periodMonth: isoDate(y, m, 1),
    openedOn: isoDate(y, m, fm),
    weekEnd: isoDate(y, m, weekEndDay),
  }
}

/** Has the current month's survey opened yet (today is on/after the first Monday, ET)? */
export function isWindowOpen(d: Date): boolean {
  const { day } = etParts(d)
  const { y, m } = etParts(d)
  return day >= firstMondayDay(y, m)
}

/** Is `d` inside the send-week reminder window (first Monday .. that Sunday)? */
export function isInReminderWeek(d: Date): boolean {
  const { y, m, day } = etParts(d)
  const fm = firstMondayDay(y, m)
  return day >= fm && day <= fm + 6
}

// ---------------------------------------------------------------------------
// Indicator / highlight engine
// ---------------------------------------------------------------------------

export type Trend = 'up' | 'down' | 'flat' | 'none'

export interface CellIndicator {
  trend: Trend
  /** true = this move is progress, false = regression, null = neutral metric. */
  good: boolean | null
  /** e.g. "+25%" or "+1". */
  deltaLabel?: string
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(n) && v.trim() !== '' ? n : null
  }
  return null
}

/** Compare a question's current value to its previous value → an indicator. */
export function indicatorFor(
  key: string,
  current: unknown,
  previous: unknown
): CellIndicator {
  const q = SURVEY_QUESTION_BY_KEY[key]
  if (!q || q.direction === 'neutral' || q.type === 'text' || q.type === 'longtext') {
    return { trend: 'none', good: null }
  }
  const cur = toNum(current)
  const prev = toNum(previous)
  if (cur === null || prev === null) return { trend: 'none', good: null }

  const diff = cur - prev
  if (diff === 0) return { trend: 'flat', good: null }

  const trend: Trend = diff > 0 ? 'up' : 'down'
  const good = q.direction === 'up_good' ? diff > 0 : diff < 0

  let deltaLabel: string
  if (q.type === 'currency') {
    const pct = prev !== 0 ? Math.round((diff / Math.abs(prev)) * 100) : null
    deltaLabel = pct !== null ? `${pct > 0 ? '+' : ''}${pct}%` : `${diff > 0 ? '+' : ''}${diff}`
  } else {
    deltaLabel = `${diff > 0 ? '+' : ''}${diff}`
  }
  return { trend, good, deltaLabel }
}

export interface Highlight {
  key: string
  label: string // question label
  message: string // human sentence, content-worthy
  tone: 'win' | 'watch'
}

/**
 * Surface content-worthy movements between two months of answers. Generous by
 * design — the admin page shows these as "suggestions" to turn into proof/content.
 * `prev` may be a partial baseline (intake) for month one.
 */
export function highlightsBetween(
  current: SurveyAnswers,
  previous: SurveyAnswers | null
): Highlight[] {
  const out: Highlight[] = []
  const label = (k: string) => SURVEY_QUESTION_BY_KEY[k]?.label ?? k
  const money = (n: number) =>
    `$${Math.round(n).toLocaleString('en-US')}`

  const cur = (k: string) => toNum(current[k])
  const pre = (k: string) => (previous ? toNum(previous[k]) : null)

  // Income jump
  {
    const c = cur('total_income')
    const p = pre('total_income')
    if (c !== null && p !== null && p > 0) {
      const pct = Math.round(((c - p) / p) * 100)
      if (pct >= 25) out.push({ key: 'total_income', label: label('total_income'), message: `Income up ${pct}% month over month (${money(p)} → ${money(c)}).`, tone: 'win' })
      else if (pct <= -25) out.push({ key: 'total_income', label: label('total_income'), message: `Income down ${Math.abs(pct)}% vs last month (${money(p)} → ${money(c)}).`, tone: 'watch' })
    }
  }
  // Credit score milestones / rises
  {
    const c = cur('credit_score')
    const p = pre('credit_score')
    if (c !== null) {
      for (const t of [850, 800, 750, 700, 650]) {
        if (c >= t && (p === null || p < t)) {
          out.push({ key: 'credit_score', label: label('credit_score'), message: `Credit score crossed ${t} (now ${c}).`, tone: 'win' })
          break
        }
      }
      if (p !== null && c - p >= 20) out.push({ key: 'credit_score', label: label('credit_score'), message: `Credit score up ${c - p} points (${p} → ${c}).`, tone: 'win' })
    }
  }
  // Debt paydown
  {
    const c = cur('total_debt')
    const p = pre('total_debt')
    if (c !== null && p !== null && p > 0) {
      const pct = Math.round(((p - c) / p) * 100)
      if (c === 0) out.push({ key: 'total_debt', label: label('total_debt'), message: `Debt fully cleared (was ${money(p)}).`, tone: 'win' })
      else if (pct >= 10) out.push({ key: 'total_debt', label: label('total_debt'), message: `Debt down ${pct}% (${money(p)} → ${money(c)}).`, tone: 'win' })
      else if (pct <= -20) out.push({ key: 'total_debt', label: label('total_debt'), message: `Debt rose ${Math.abs(pct)}% (${money(p)} → ${money(c)}).`, tone: 'watch' })
    }
  }
  // Business-growth counts
  const growth: Array<[string, string]> = [
    ['active_llcs', 'LLC'],
    ['vas', 'VA'],
    ['income_sources', 'income source'],
    ['real_estate_properties', 'property'],
  ]
  for (const [k, noun] of growth) {
    const c = cur(k)
    const p = pre(k)
    if (c !== null && p !== null && c > p) {
      const d = c - p
      out.push({ key: k, label: label(k), message: `Added ${d} ${noun}${d === 1 ? '' : 's'} (${p} → ${c}).`, tone: 'win' })
    }
  }
  // Investments value growth
  {
    const c = cur('investments_value')
    const p = pre('investments_value')
    if (c !== null && p !== null && p > 0 && c - p > 0) {
      const pct = Math.round(((c - p) / p) * 100)
      if (pct >= 25) out.push({ key: 'investments_value', label: label('investments_value'), message: `Investment value up ${pct}% (${money(p)} → ${money(c)}).`, tone: 'win' })
    }
  }
  // Started investing (vs intake or last month)
  {
    const c = current['has_investments']
    const p = previous ? previous['has_investments'] : null
    if (c === true && (p === false || p === null) && previous) {
      out.push({ key: 'has_investments', label: label('has_investments'), message: `Started investing since last checkpoint.`, tone: 'win' })
    }
  }
  return out
}

/** Pull the month-1 baseline for a member from their intake application data. */
export function baselineFromApplication(
  appData: Record<string, unknown> | null | undefined
): SurveyAnswers | null {
  if (!appData) return null
  const base: SurveyAnswers = {}
  let any = false
  for (const q of SURVEY_QUESTIONS) {
    if (!q.baselineKey) continue
    const v = appData[q.baselineKey]
    if (v === undefined || v === null) continue
    if (q.type === 'boolean') {
      base[q.key] = v === true || v === 'yes' || v === 'y' || v === 'true'
    } else {
      base[q.key] = typeof v === 'number' ? v : String(v)
    }
    any = true
  }
  return any ? base : null
}
