import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Financial data is sensitive — only owner/admin/manager may view or edit.
const EDITOR_ROLES = new Set(['owner', 'admin', 'manager'])
const SCHEDULES = new Set(['monthly', 'annual'])
const STATUSES = new Set(['active', 'paused', 'cancelled'])

const BILLING_FIELDS =
  'member_id, schedule, amount, currency, due_day, term_months, membership_start, membership_end, membership_status, notes, updated_at, updated_by'

// GET /api/member-billing?memberId=<uuid> — return the member's billing row (or null).
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('memberId')
  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('member_billing')
    .select(BILLING_FIELDS)
    .eq('member_id', memberId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ billing: data ?? null })
}

// PUT /api/member-billing — upsert the billing row for a member (onConflict member_id).
// Body: { member_id, schedule, amount, currency, due_day, membership_start, membership_end, membership_status, notes }
export async function PUT(request: Request) {
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

  const schedule = body.schedule ?? 'monthly'
  if (!SCHEDULES.has(schedule)) {
    return NextResponse.json({ error: 'Invalid schedule' }, { status: 400 })
  }

  const membership_status = body.membership_status ?? 'active'
  if (!STATUSES.has(membership_status)) {
    return NextResponse.json({ error: 'Invalid membership_status' }, { status: 400 })
  }

  // amount: numeric or null
  let amount: number | null = null
  if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
    const n = Number(body.amount)
    if (Number.isNaN(n)) return NextResponse.json({ error: 'amount must be numeric' }, { status: 400 })
    amount = n
  }

  // due_day: 1-31 or null
  let due_day: number | null = null
  if (body.due_day !== undefined && body.due_day !== null && body.due_day !== '') {
    const d = Number(body.due_day)
    if (!Number.isInteger(d) || d < 1 || d > 31) {
      return NextResponse.json({ error: 'due_day must be an integer 1-31' }, { status: 400 })
    }
    due_day = d
  }

  // term_months: 1-60 or null (plan length; drives how many monthly payments exist)
  let term_months: number | null = null
  if (body.term_months !== undefined && body.term_months !== null && body.term_months !== '') {
    const t = Number(body.term_months)
    if (!Number.isInteger(t) || t < 1 || t > 60) {
      return NextResponse.json({ error: 'term_months must be an integer 1-60' }, { status: 400 })
    }
    term_months = t
  }

  const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'USD'
  const membership_start = body.membership_start || null
  const membership_end = body.membership_end || null
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

  const db = createAdminClient()
  const { data, error } = await db
    .from('member_billing')
    .upsert(
      {
        member_id,
        schedule,
        amount,
        currency,
        due_day,
        term_months,
        membership_start,
        membership_end,
        membership_status,
        notes,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'member_id' }
    )
    .select(BILLING_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ billing: data })
}
