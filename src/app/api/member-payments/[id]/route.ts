import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const EDITOR_ROLES = new Set(['owner', 'admin', 'manager'])
const STATUSES = new Set(['unpaid', 'partial', 'paid'])

const PAYMENT_FIELDS =
  'id, member_id, due_date, period_label, amount_due, amount_paid, status, paid_date, notes, created_at, created_by'

function deriveStatus(amountDue: number, amountPaid: number): 'unpaid' | 'partial' | 'paid' {
  if (amountPaid <= 0) return 'unpaid'
  if (amountPaid >= amountDue && amountPaid > 0) return 'paid'
  return 'partial'
}

// PATCH /api/member-payments/[id] — partial update.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, string | number | null> = {}

  if (body.due_date !== undefined) updates.due_date = body.due_date || null
  if (body.period_label !== undefined) {
    updates.period_label =
      typeof body.period_label === 'string' && body.period_label.trim() ? body.period_label.trim() : null
  }
  if (body.paid_date !== undefined) updates.paid_date = body.paid_date || null
  if (body.notes !== undefined) {
    updates.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
  }

  let amountChanged = false
  if (body.amount_due !== undefined) {
    const n = Number(body.amount_due)
    if (Number.isNaN(n)) return NextResponse.json({ error: 'amount_due must be numeric' }, { status: 400 })
    updates.amount_due = n
    amountChanged = true
  }
  if (body.amount_paid !== undefined) {
    const n = Number(body.amount_paid)
    if (Number.isNaN(n)) return NextResponse.json({ error: 'amount_paid must be numeric' }, { status: 400 })
    updates.amount_paid = n
    amountChanged = true
  }

  const statusProvided = body.status !== undefined && body.status !== null && body.status !== ''
  if (statusProvided) {
    if (!STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const db = createAdminClient()

  // If amounts changed but status was not explicitly sent, re-derive it from the
  // resulting amounts (merging the updates over the existing row).
  if (amountChanged && !statusProvided) {
    const { data: existing } = await db
      .from('member_payments')
      .select('amount_due, amount_paid')
      .eq('id', id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const amountDue = updates.amount_due !== undefined ? Number(updates.amount_due) : Number(existing.amount_due)
    const amountPaid = updates.amount_paid !== undefined ? Number(updates.amount_paid) : Number(existing.amount_paid)
    updates.status = deriveStatus(amountDue, amountPaid)
  }

  const { data, error } = await db
    .from('member_payments')
    .update(updates)
    .eq('id', id)
    .select(PAYMENT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ payment: data })
}

// DELETE /api/member-payments/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createAdminClient()
  const { error } = await db.from('member_payments').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
