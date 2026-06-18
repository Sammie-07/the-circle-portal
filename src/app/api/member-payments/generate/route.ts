import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const EDITOR_ROLES = new Set(['owner', 'admin', 'manager'])

// Safety cap so a bad/open-ended plan can't create a runaway number of rows.
const MAX_ROWS = 60
// Default horizon when no membership_end is set: The Circle is a 12-month program.
const DEFAULT_MONTHLY_COUNT = 12
const DEFAULT_ANNUAL_COUNT = 1

function pad(n: number) { return String(n).padStart(2, '0') }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

interface PlanRow { due_date: string; period_label: string }

function buildSchedule(b: {
  schedule: string
  due_day: number | null
  membership_start: string | null
  membership_end: string | null
}): PlanRow[] {
  const start = b.membership_start ? new Date(b.membership_start + 'T00:00:00') : new Date()
  start.setHours(0, 0, 0, 0)
  const end = b.membership_end ? new Date(b.membership_end + 'T00:00:00') : null

  const rows: PlanRow[] = []

  if (b.schedule === 'annual') {
    const limit = end ? MAX_ROWS : DEFAULT_ANNUAL_COUNT
    const d = new Date(start)
    for (let i = 0; i < limit && rows.length < MAX_ROWS; i++) {
      if (end && d > end) break
      rows.push({ due_date: isoDate(d), period_label: String(d.getFullYear()) })
      d.setFullYear(d.getFullYear() + 1)
    }
  } else {
    // monthly — pay on due_day each month
    const wantedDay = b.due_day ? Math.min(Math.max(Number(b.due_day), 1), 31) : start.getDate()
    const limit = end ? MAX_ROWS : DEFAULT_MONTHLY_COUNT
    let y = start.getFullYear()
    let m = start.getMonth()
    for (let i = 0; i < limit && rows.length < MAX_ROWS; i++) {
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const d = new Date(y, m, Math.min(wantedDay, daysInMonth))
      if (end && d > end) break
      rows.push({
        due_date: isoDate(d),
        period_label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      })
      m += 1
      if (m > 11) { m = 0; y += 1 }
    }
  }

  return rows
}

// POST /api/member-payments/generate — create the payment due rows from the
// member's billing plan. Idempotent: skips any due_date that already has a row.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const member_id = body.member_id
  if (!member_id || typeof member_id !== 'string') {
    return NextResponse.json({ error: 'member_id is required' }, { status: 400 })
  }

  const db = createAdminClient()

  const { data: billing } = await db
    .from('member_billing')
    .select('schedule, amount, due_day, membership_start, membership_end')
    .eq('member_id', member_id)
    .maybeSingle()

  if (!billing) {
    return NextResponse.json({ error: 'Set up and save the billing plan first.' }, { status: 400 })
  }
  const amount = billing.amount === null || billing.amount === undefined || billing.amount === '' ? null : Number(billing.amount)
  if (amount === null || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Set a billing amount greater than 0 first.' }, { status: 400 })
  }

  const planned = buildSchedule(billing)
  if (planned.length === 0) {
    return NextResponse.json({ error: 'Could not project any due dates from the plan (check the membership dates).' }, { status: 400 })
  }

  // Skip dates that already have a payment row, so re-running is safe.
  const { data: existing } = await db
    .from('member_payments')
    .select('due_date')
    .eq('member_id', member_id)
  const existingDates = new Set((existing ?? []).map((p) => p.due_date))

  const toInsert = planned
    .filter((r) => !existingDates.has(r.due_date))
    .map((r) => ({
      member_id,
      due_date: r.due_date,
      period_label: r.period_label,
      amount_due: amount,
      amount_paid: 0,
      status: 'unpaid',
      created_by: user.id,
    }))

  if (toInsert.length === 0) {
    return NextResponse.json({ added: 0, message: 'Schedule already up to date.' })
  }

  const { error } = await db.from('member_payments').insert(toInsert)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ added: toInsert.length })
}
