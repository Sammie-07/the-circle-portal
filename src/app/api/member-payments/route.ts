import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Financial data is sensitive — only owner/admin/manager may view or edit.
const EDITOR_ROLES = new Set(['owner', 'admin', 'manager'])
const STATUSES = new Set(['unpaid', 'partial', 'paid'])

const PAYMENT_FIELDS =
  'id, member_id, due_date, period_label, amount_due, amount_paid, status, paid_date, notes, created_at, created_by'

// Derive a payment status from the amounts.
function deriveStatus(amountDue: number, amountPaid: number): 'unpaid' | 'partial' | 'paid' {
  if (amountPaid <= 0) return 'unpaid'
  if (amountPaid >= amountDue && amountPaid > 0) return 'paid'
  return 'partial'
}

// GET /api/member-payments?memberId=<uuid> — list a member's payments (due_date asc, nulls last).
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
    .from('member_payments')
    .select(PAYMENT_FIELDS)
    .eq('member_id', memberId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ payments: data ?? [] })
}

// POST /api/member-payments — create a payment.
// Body: { member_id, due_date?, period_label?, amount_due, amount_paid?, status?, paid_date?, notes? }
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

  const amount_due = Number(body.amount_due ?? 0)
  if (Number.isNaN(amount_due)) {
    return NextResponse.json({ error: 'amount_due must be numeric' }, { status: 400 })
  }
  const amount_paid = Number(body.amount_paid ?? 0)
  if (Number.isNaN(amount_paid)) {
    return NextResponse.json({ error: 'amount_paid must be numeric' }, { status: 400 })
  }

  let status: string
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    status = body.status
  } else {
    status = deriveStatus(amount_due, amount_paid)
  }

  const due_date = body.due_date || null
  const period_label = typeof body.period_label === 'string' && body.period_label.trim() ? body.period_label.trim() : null
  const paid_date = body.paid_date || null
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

  const db = createAdminClient()
  const { data, error } = await db
    .from('member_payments')
    .insert({
      member_id,
      due_date,
      period_label,
      amount_due,
      amount_paid,
      status,
      paid_date,
      notes,
      created_by: user.id,
    })
    .select(PAYMENT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ payment: data }, { status: 201 })
}
