import type { SupabaseClient } from '@supabase/supabase-js'
import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai'
import { searchBrain, buildBrainContext } from '@/lib/brain-search'

// The CEO Call Form (GHL survey ChfGby8l8lRNGPiQZkcp): each submission is run
// through Gogo's Brain into a one-paragraph problem statement she reads before
// the call. Labels/keys mirror the GHL form so the webhook can send either.

export const CEO_CALL_FIELDS: { key: string; label: string }[] = [
  { key: 'instagram_id', label: 'Instagram ID' },
  { key: 'how_long_have_you_been_in_business', label: 'How long have you been in business?' },
  { key: 'how_many_sources_of_income_do_you_have', label: 'How many sources of income do you have?' },
  { key: 'how_much_do_you_make_from_each', label: 'How much do you make from each?' },
  { key: 'whats_your_revenue_in_the_last_12_months', label: "What's your revenue in the last 12 months?" },
  { key: 'how_much_did_you_pay_in_taxes_in_the_last_12_months_or_last_year', label: 'How much did you pay in taxes in the last 12 months or last year?' },
  { key: 'what_is_your_investment_property_portfolio_type_and_value', label: 'What is your investment property portfolio type and value?' },
  { key: 'what_are_your_other_investment_types_and_their_total_value', label: 'What are your other investment types and their total value (e.g. stocks, cryptocurrencies, etc.)?' },
  { key: 'how_many_hours_do_you_currently_work', label: 'How many hours do you currently work?' },
  { key: 'how_is_your_support_team_currently_structured_please_list_your_total_number_of_employees_and_their_specific_positions', label: 'How is your support team currently structured? Please list your total number of employees and their specific positions.' },
  { key: 'what_does_your_support_team_cost_you', label: 'What does your support team cost you?' },
  { key: 'do_you_have_any_help_at_home_and_if_so_what_kind_eg_house_assistant_or_personal_assistant', label: 'Do you have any help at home, and if so, what kind (e.g. house assistant or personal assistant)?' },
  { key: 'whats_your_credit_score', label: 'What is your credit score?' },
  { key: 'what_does_success_mean_to_you', label: 'What does success mean to you?' },
  { key: 'what_are_the_biggest_pain_points_in_your_business_currently', label: 'What are the biggest pain points in your business?' },
  { key: 'single_dropdown_250my', label: 'Are you behind with your taxes?' },
  { key: 'hsingle_dropdown_23hhv', label: 'Have you filed for bankruptcy?' },
  { key: 'what_is_your_gross_annual_household_income', label: 'What is your gross annual household income?' },
]

type Body = Record<string, unknown>

const asText = (v: unknown): string | null => {
  if (v === null || v === undefined) return null
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(', ') || null
  if (typeof v === 'object') return null
  const s = String(v).trim()
  return s ? s.slice(0, 3000) : null
}

/** Normalizes a label or key for loose matching ("What's your revenue…?" ~ whats_your_revenue…). */
const norm = (s: string) => s.toLowerCase().replace(/^contact\./, '').replace(/[^a-z0-9]+/g, '')

/**
 * Pulls the form answers out of a GHL webhook body. GHL can send custom fields
 * keyed by label, by field key (with or without "contact."), nested under
 * customData/contact, or (custom webhook action) as whatever keys the workflow
 * defines, so every place is checked.
 */
export function extractAnswers(body: Body): Record<string, string> {
  const flat = new Map<string, unknown>()
  const add = (o: unknown) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return
    for (const [k, v] of Object.entries(o as Body)) if (!flat.has(norm(k))) flat.set(norm(k), v)
  }
  add(body)
  add(body.customData)
  add(body.contact)
  add((body.contact as Body | undefined)?.customFields)

  const out: Record<string, string> = {}
  for (const f of CEO_CALL_FIELDS) {
    const v = asText(flat.get(norm(f.label)) ?? flat.get(norm(f.key)))
    if (v) out[f.label] = v
  }
  return out
}

export function extractContact(body: Body) {
  const c = (body.contact as Body | undefined) ?? {}
  const first = asText(body.first_name ?? c.first_name ?? c.firstName)
  const last = asText(body.last_name ?? c.last_name ?? c.lastName)
  return {
    contactId: asText(body.contact_id ?? c.id ?? body.contactId),
    name: asText(body.full_name ?? body.name ?? c.name ?? c.full_name) ?? ([first, last].filter(Boolean).join(' ') || null),
    email: asText(body.email ?? c.email)?.toLowerCase() ?? null,
    phone: asText(body.phone ?? c.phone),
  }
}

const SYSTEM = `You are Gogo Bethke's chief of staff. Gogo is about to get on a CEO call with the person below, and you write her a one-paragraph problem statement from the form they filled out with their real numbers.

THE JOB: name the real problem underneath their symptoms, the way Gogo would see it. Use Gogo's lens from the Brain excerpts (time, location and financial freedom, CEO mindset, team, systems, money habits). Back it with their specific numbers and words (revenue, income sources, hours, team and its cost, taxes, investments, credit, what success means to them, pain points). Say plainly what is costing them the most and why. If something is a red flag (behind on taxes, bankruptcy, heavy hours, all income from one source, team costs vs revenue), state it as a fact for Gogo, without drama.

RULES:
- ONE paragraph, 110-170 words. Third person, using their first name. Written for Gogo's eyes only, not to the person. Do not mention Gogo by name (she is the reader); state the diagnosis directly.
- Never guess gender from a name: refer to them by first name or they/them.
- Use only what the form says and what the Brain excerpts say. Never invent numbers, history or results. If an answer is missing or vague, do not guess; you may note that it was left blank if it matters.
- No headings, no bullet points, no em dashes (— or --), no exclamation points, no flattery, no advice list. This is a diagnosis, not a plan.
- Output the paragraph only.`

export async function writeStatement(name: string | null, answers: Record<string, string>): Promise<string> {
  const first = (name ?? '').trim().split(/\s+/)[0] || 'This person'
  const lines = CEO_CALL_FIELDS
    .filter((f) => f.key !== 'instagram_id')
    .map((f) => `- ${f.label} → ${answers[f.label] ?? '(left blank)'}`)
    .join('\n')
  const pain = answers['What are the biggest pain points in your business?'] ?? ''
  const success = answers['What does success mean to you?'] ?? ''
  const chunks = await searchBrain(`${pain} ${success}`.trim().slice(0, 500) || 'CEO mindset time freedom financial freedom', 6).catch(() => [])

  const msg = await getAnthropic().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 800,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `FIRST NAME: ${first}\n\nTHEIR FORM:\n${lines}\n\nGOGO'S BRAIN, RELEVANT EXCERPTS:\n${chunks.length ? buildBrainContext(chunks) : '(nothing relevant found)'}`,
    }],
  })
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
  if (!text) throw new Error('Empty statement')
  return text.replace(/ *— */g, ', ').replace(/ *(?<!-)--(?!-) */g, ', ').replace(/\n+/g, ' ')
}

/** Writes and stores the statement for one submission (runs after the webhook replies). */
export async function generateStatement(admin: SupabaseClient, id: string): Promise<void> {
  const { data: row } = await admin.from('problem_statements').select('name, answers').eq('id', id).maybeSingle()
  if (!row) return
  try {
    const statement = await writeStatement(row.name as string | null, row.answers as Record<string, string>)
    await admin.from('problem_statements').update({ statement, status: 'ready', error: null }).eq('id', id)
  } catch (e) {
    console.error('Problem statement failed:', e)
    await admin.from('problem_statements').update({ status: 'error', error: String(e).slice(0, 500) }).eq('id', id)
  }
}
