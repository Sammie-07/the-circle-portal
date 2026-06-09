'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Billing {
  member_id: string
  schedule: 'monthly' | 'annual'
  amount: number | string | null
  currency: string | null
  due_day: number | null
  membership_start: string | null
  membership_end: string | null
  membership_status: 'active' | 'paused' | 'cancelled'
  notes: string | null
}

interface Payment {
  id: string
  member_id: string
  due_date: string | null
  period_label: string | null
  amount_due: number | string
  amount_paid: number | string
  status: 'unpaid' | 'partial' | 'paid'
  paid_date: string | null
  notes: string | null
  created_at: string
}

interface BillingForm {
  schedule: 'monthly' | 'annual'
  amount: string
  currency: string
  due_day: string
  membership_start: string
  membership_end: string
  membership_status: 'active' | 'paused' | 'cancelled'
  notes: string
}

interface PaymentForm {
  due_date: string
  period_label: string
  amount_due: string
  amount_paid: string
  status: 'unpaid' | 'partial' | 'paid'
  statusTouched: boolean
  paid_date: string
  notes: string
}

const EMPTY_BILLING: BillingForm = {
  schedule: 'monthly',
  amount: '',
  currency: 'USD',
  due_day: '',
  membership_start: '',
  membership_end: '',
  membership_status: 'active',
  notes: '',
}

const EMPTY_PAYMENT: PaymentForm = {
  due_date: '',
  period_label: '',
  amount_due: '',
  amount_paid: '',
  status: 'unpaid',
  statusTouched: false,
  paid_date: '',
  notes: '',
}

function deriveStatus(amountDue: number, amountPaid: number): 'unpaid' | 'partial' | 'paid' {
  if (amountPaid <= 0) return 'unpaid'
  if (amountPaid >= amountDue && amountPaid > 0) return 'paid'
  return 'partial'
}

export default function MemberPaymentsPanel({ memberId }: { memberId: string }) {
  const router = useRouter()
  const [billing, setBilling] = useState<Billing | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  // Billing form
  const [billingForm, setBillingForm] = useState<BillingForm>(EMPTY_BILLING)
  const [savingBilling, setSavingBilling] = useState(false)
  const [billingError, setBillingError] = useState('')

  // Payment modal
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Payment | null>(null)
  const [payForm, setPayForm] = useState<PaymentForm>(EMPTY_PAYMENT)
  const [savingPay, setSavingPay] = useState(false)
  const [payError, setPayError] = useState('')

  const loadBilling = useCallback(async () => {
    try {
      const res = await fetch(`/api/member-billing?memberId=${memberId}`)
      const data = await res.json()
      if (res.ok) {
        const b: Billing | null = data.billing ?? null
        setBilling(b)
        if (b) {
          setBillingForm({
            schedule: b.schedule ?? 'monthly',
            amount: b.amount === null || b.amount === undefined ? '' : String(b.amount),
            currency: b.currency ?? 'USD',
            due_day: b.due_day === null || b.due_day === undefined ? '' : String(b.due_day),
            membership_start: b.membership_start ?? '',
            membership_end: b.membership_end ?? '',
            membership_status: b.membership_status ?? 'active',
            notes: b.notes ?? '',
          })
        }
      }
    } catch {
      // leave as-is
    }
  }, [memberId])

  const loadPayments = useCallback(async () => {
    try {
      const res = await fetch(`/api/member-payments?memberId=${memberId}`)
      const data = await res.json()
      if (res.ok) setPayments(data.payments ?? [])
    } catch {
      // leave as-is
    }
  }, [memberId])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadBilling(), loadPayments()])
    setLoading(false)
  }, [loadBilling, loadPayments])

  // Fetch billing + payments on mount (loaders toggle their own loading state).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll() }, [loadAll])

  const currency = billing?.currency || billingForm.currency || 'USD'

  const fmtMoney = useCallback(
    (v: number) => {
      try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(v)
      } catch {
        return `${currency} ${v.toFixed(2)}`
      }
    },
    [currency]
  )

  const fmtDate = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  // Summary
  const totalDue = payments.reduce((s, p) => s + Number(p.amount_due), 0)
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_paid), 0)
  const outstanding = totalDue - totalPaid
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = payments
    .filter((p) => p.due_date && p.due_date >= today && p.status !== 'paid')
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0]

  async function saveBilling(e: React.FormEvent) {
    e.preventDefault()
    setSavingBilling(true)
    setBillingError('')
    try {
      const res = await fetch('/api/member-billing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          schedule: billingForm.schedule,
          amount: billingForm.amount === '' ? null : billingForm.amount,
          currency: billingForm.currency.trim() || 'USD',
          due_day: billingForm.due_day === '' ? null : billingForm.due_day,
          membership_start: billingForm.membership_start || null,
          membership_end: billingForm.membership_end || null,
          membership_status: billingForm.membership_status,
          notes: billingForm.notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setBillingError(data.error ?? 'Something went wrong'); return }
      await loadBilling()
      router.refresh()
    } catch {
      setBillingError('Network error — please try again')
    } finally {
      setSavingBilling(false)
    }
  }

  function openAdd() {
    setEditing(null)
    setPayForm(EMPTY_PAYMENT)
    setPayError('')
    setOpen(true)
  }

  function openEdit(p: Payment) {
    setEditing(p)
    setPayForm({
      due_date: p.due_date ?? '',
      period_label: p.period_label ?? '',
      amount_due: String(Number(p.amount_due)),
      amount_paid: String(Number(p.amount_paid)),
      status: p.status,
      statusTouched: true,
      paid_date: p.paid_date ?? '',
      notes: p.notes ?? '',
    })
    setPayError('')
    setOpen(true)
  }

  // Auto-suggest status from amounts unless the user has overridden it.
  function updateAmount(field: 'amount_due' | 'amount_paid', value: string) {
    setPayForm((f) => {
      const next = { ...f, [field]: value }
      if (!f.statusTouched) {
        next.status = deriveStatus(Number(next.amount_due || 0), Number(next.amount_paid || 0))
      }
      return next
    })
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault()
    setSavingPay(true)
    setPayError('')
    try {
      const payload = {
        member_id: memberId,
        due_date: payForm.due_date || null,
        period_label: payForm.period_label,
        amount_due: payForm.amount_due === '' ? 0 : Number(payForm.amount_due),
        amount_paid: payForm.amount_paid === '' ? 0 : Number(payForm.amount_paid),
        status: payForm.status,
        paid_date: payForm.paid_date || null,
        notes: payForm.notes,
      }
      const isEdit = !!editing
      const res = await fetch(
        isEdit ? `/api/member-payments/${editing!.id}` : '/api/member-payments',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) { setPayError(data.error ?? 'Something went wrong'); return }
      setOpen(false)
      await Promise.all([loadPayments(), loadBilling()])
      router.refresh()
    } catch {
      setPayError('Network error — please try again')
    } finally {
      setSavingPay(false)
    }
  }

  async function deletePayment(p: Payment) {
    const label = p.period_label || fmtDate(p.due_date)
    if (!confirm(`Delete payment "${label}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/member-payments/${p.id}`, { method: 'DELETE' })
      if (res.ok) { await Promise.all([loadPayments(), loadBilling()]); router.refresh() }
    } catch {
      // ignore
    }
  }

  const inputClass = "w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
  const labelClass = "block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5"

  const membershipBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'text-green-400 border-green-400/40',
      paused: 'text-yellow-400 border-yellow-400/40',
      cancelled: 'text-[#CC1F1F] border-[#CC1F1F]/40',
    }
    return map[status] ?? 'text-[var(--text-3)] border-[var(--border-color)]'
  }

  const payStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: 'text-green-400 border-green-400/40',
      partial: 'text-yellow-400 border-yellow-400/40',
      unpaid: 'text-[var(--text-3)] border-[var(--border-color)]',
    }
    return map[status] ?? 'text-[var(--text-3)] border-[var(--border-color)]'
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[#C9A227] text-xs tracking-[0.2em] uppercase mb-1">Member Finances</p>
          <h2 className="text-[var(--text)] font-serif text-xl">Payments</h2>
          <p className="text-[var(--text-3)] text-xs mt-1">Schedule, dues, status — replaces the spreadsheet.</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-[#C9A227] text-[#0D0D0D] font-medium text-sm px-4 py-2 rounded hover:bg-[#d4ac2d] transition-colors"
        >
          + Add Payment
        </button>
      </div>

      {loading ? (
        <p className="text-[var(--text-3)] text-sm">Loading…</p>
      ) : (
        <>
          {/* Billing settings */}
          <form onSubmit={saveBilling} className="bg-[var(--bg)] border border-[var(--border-color)] rounded p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[var(--text-2)] text-xs uppercase tracking-wider">Billing Settings</h3>
              <span className={`text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 ${membershipBadge(billingForm.membership_status)}`}>
                {billingForm.membership_status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Schedule</label>
                <select
                  value={billingForm.schedule}
                  onChange={(e) => setBillingForm((f) => ({ ...f, schedule: e.target.value as 'monthly' | 'annual' }))}
                  className={inputClass}
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Membership Status</label>
                <select
                  value={billingForm.membership_status}
                  onChange={(e) => setBillingForm((f) => ({ ...f, membership_status: e.target.value as 'active' | 'paused' | 'cancelled' }))}
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={billingForm.amount}
                  onChange={(e) => setBillingForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 1200"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <input
                  value={billingForm.currency}
                  onChange={(e) => setBillingForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                  placeholder="USD"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Pays on day-of-month</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={billingForm.due_day}
                  onChange={(e) => setBillingForm((f) => ({ ...f, due_day: e.target.value }))}
                  placeholder="1–31"
                  className={inputClass}
                />
              </div>
              <div></div>
              <div>
                <label className={labelClass}>Membership Start</label>
                <input
                  type="date"
                  value={billingForm.membership_start}
                  onChange={(e) => setBillingForm((f) => ({ ...f, membership_start: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Membership End</label>
                <input
                  type="date"
                  value={billingForm.membership_end}
                  onChange={(e) => setBillingForm((f) => ({ ...f, membership_end: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Notes</label>
                <textarea
                  value={billingForm.notes}
                  onChange={(e) => setBillingForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Billing notes…"
                  className={inputClass + ' resize-none'}
                />
              </div>
            </div>

            {billingError && <p className="text-[#CC1F1F] text-xs mt-3">{billingError}</p>}

            <div className="flex justify-end mt-4">
              <button
                type="submit"
                disabled={savingBilling}
                className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-5 py-2 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
              >
                {savingBilling ? 'Saving…' : 'Save Billing'}
              </button>
            </div>
          </form>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-[var(--bg)] border border-[var(--border-color)] rounded p-3">
              <p className="text-[var(--text-3)] text-[10px] uppercase tracking-wider mb-1">Total Due</p>
              <p className="text-[var(--text)] font-serif text-lg">{fmtMoney(totalDue)}</p>
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border-color)] rounded p-3">
              <p className="text-[var(--text-3)] text-[10px] uppercase tracking-wider mb-1">Total Paid</p>
              <p className="text-green-400 font-serif text-lg">{fmtMoney(totalPaid)}</p>
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border-color)] rounded p-3">
              <p className="text-[var(--text-3)] text-[10px] uppercase tracking-wider mb-1">Outstanding</p>
              <p className={`font-serif text-lg ${outstanding > 0 ? 'text-[#CC1F1F]' : 'text-[var(--text)]'}`}>{fmtMoney(outstanding)}</p>
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border-color)] rounded p-3">
              <p className="text-[var(--text-3)] text-[10px] uppercase tracking-wider mb-1">Next Due</p>
              <p className="text-[var(--text)] font-serif text-lg">{upcoming ? fmtDate(upcoming.due_date) : '—'}</p>
            </div>
          </div>

          {/* Ledger */}
          {payments.length === 0 ? (
            <p className="text-[var(--text-3)] text-sm">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--text-3)] text-[10px] uppercase tracking-wider border-b border-[var(--border-color)]">
                    <th className="text-left font-normal py-2 pr-3">Due</th>
                    <th className="text-left font-normal py-2 pr-3">Period</th>
                    <th className="text-right font-normal py-2 pr-3">Due</th>
                    <th className="text-right font-normal py-2 pr-3">Paid</th>
                    <th className="text-left font-normal py-2 pr-3">Status</th>
                    <th className="text-left font-normal py-2 pr-3">Paid Date</th>
                    <th className="text-left font-normal py-2 pr-3">Notes</th>
                    <th className="text-right font-normal py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--border-color)]/50">
                      <td className="py-2.5 pr-3 text-[var(--text-2)] whitespace-nowrap">{fmtDate(p.due_date)}</td>
                      <td className="py-2.5 pr-3 text-[var(--text)] whitespace-nowrap">{p.period_label || '—'}</td>
                      <td className="py-2.5 pr-3 text-right text-[var(--text-2)] whitespace-nowrap">{fmtMoney(Number(p.amount_due))}</td>
                      <td className="py-2.5 pr-3 text-right text-[var(--text-2)] whitespace-nowrap">{fmtMoney(Number(p.amount_paid))}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 ${payStatusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--text-3)] whitespace-nowrap">{fmtDate(p.paid_date)}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-3)] max-w-[180px] truncate">{p.notes || '—'}</td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openEdit(p)}
                            className="border border-[var(--border-color)] text-[var(--text-2)] text-xs px-3 py-1.5 rounded hover:border-[#C9A227] hover:text-[var(--text)] transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deletePayment(p)}
                            className="border border-[#CC1F1F]/30 text-[#CC1F1F] text-xs px-3 py-1.5 rounded hover:border-[#CC1F1F]/60 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add / Edit payment modal */}
      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[var(--text)] font-serif text-xl">{editing ? 'Edit Payment' : 'Add Payment'}</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--text-3)] hover:text-[var(--text)] text-lg">✕</button>
            </div>

            <form onSubmit={savePayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Due Date</label>
                  <input
                    type="date"
                    value={payForm.due_date}
                    onChange={(e) => setPayForm((f) => ({ ...f, due_date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Period Label</label>
                  <input
                    value={payForm.period_label}
                    onChange={(e) => setPayForm((f) => ({ ...f, period_label: e.target.value }))}
                    placeholder="e.g. March 2026"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Amount Due</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payForm.amount_due}
                    onChange={(e) => updateAmount('amount_due', e.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Amount Paid</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payForm.amount_paid}
                    onChange={(e) => updateAmount('amount_paid', e.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={payForm.status}
                    onChange={(e) => setPayForm((f) => ({ ...f, status: e.target.value as 'unpaid' | 'partial' | 'paid', statusTouched: true }))}
                    className={inputClass}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Paid Date</label>
                  <input
                    type="date"
                    value={payForm.paid_date}
                    onChange={(e) => setPayForm((f) => ({ ...f, paid_date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  value={payForm.notes}
                  onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Payment notes…"
                  className={inputClass + ' resize-none'}
                />
              </div>

              {payError && <p className="text-[#CC1F1F] text-xs">{payError}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 border border-[var(--border-color)] text-[var(--text-2)] text-sm py-2.5 rounded hover:border-[var(--border-hover)] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={savingPay}
                  className="flex-1 bg-[#C9A227] text-[#0D0D0D] text-sm font-medium py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40">
                  {savingPay ? 'Saving…' : editing ? 'Save Changes' : 'Add Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
