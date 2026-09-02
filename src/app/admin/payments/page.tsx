import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const metadata = { title: 'Payments · The Circle Admin' }

// Financial data is sensitive — owner/admin/manager only (not support).
const FINANCE_ROLES = ['owner', 'tech', 'admin', 'manager']

const MEMBERSHIP_BADGE: Record<string, string> = {
  active: 'text-green-400 border-green-400/30',
  paused: 'text-yellow-400 border-yellow-400/30',
  cancelled: 'text-[#CC1F1F] border-[#CC1F1F]/30',
}

const SCHEDULE_LABEL: Record<string, string> = { monthly: 'Monthly', annual: 'Annual' }

interface Billing {
  member_id: string
  schedule: string
  amount: number | string | null
  currency: string | null
  due_day: number | null
  membership_end: string | null
  membership_status: string
}
interface Payment {
  member_id: string
  due_date: string | null
  amount_due: number | string | null
  amount_paid: number | string | null
  status: string
}
interface MemberRow {
  id: string
  name: string
  cohort: string | null
}

export default async function AdminPaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!FINANCE_ROLES.includes(profile?.role ?? '')) redirect('/admin')

  // Service role: member_billing / member_payments RLS is is_admin()-only, so a
  // manager's cookie client can't read them — use the admin client here.
  const db = createAdminClient()
  const [membersRes, billingRes, paymentsRes] = await Promise.all([
    db.from('members').select('id, name, cohort').order('name', { ascending: true }),
    db.from('member_billing').select('member_id, schedule, amount, currency, due_day, membership_end, membership_status'),
    db.from('member_payments').select('member_id, due_date, amount_due, amount_paid, status'),
  ])

  const members = (membersRes.data ?? []) as MemberRow[]
  const billingBy = new Map<string, Billing>((billingRes.data ?? []).map((b) => [b.member_id, b as Billing]))
  const paysBy = new Map<string, Payment[]>()
  for (const p of (paymentsRes.data ?? []) as Payment[]) {
    const arr = paysBy.get(p.member_id) ?? []
    arr.push(p)
    paysBy.set(p.member_id, arr)
  }

  const today = new Date().toISOString().slice(0, 10)

  const rows = members.map((m) => {
    const b = billingBy.get(m.id) ?? null
    const ps = paysBy.get(m.id) ?? []
    let due = 0
    let paid = 0
    let overdue = false
    let nextDue: string | null = null
    for (const p of ps) {
      due += Number(p.amount_due) || 0
      paid += Number(p.amount_paid) || 0
      if (p.status !== 'paid' && p.due_date) {
        if (p.due_date < today) overdue = true
        if (p.due_date >= today && (!nextDue || p.due_date < nextDue)) nextDue = p.due_date
      }
    }
    const outstanding = due - paid
    const tracked = !!b || ps.length > 0
    return { m, b, ps, outstanding, overdue, nextDue, tracked }
  })

  // Sort: overdue first, then by outstanding desc, then name
  rows.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding
    return a.m.name.localeCompare(b.m.name)
  })

  const totalOutstanding = rows.reduce((s, r) => s + (r.outstanding > 0 ? r.outstanding : 0), 0)
  const overdueCount = rows.filter((r) => r.overdue).length
  const owingCount = rows.filter((r) => r.outstanding > 0).length

  const money = (n: number, cur = 'USD') => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n)
    } catch {
      return `$${n.toFixed(2)}`
    }
  }
  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="mb-8">
        <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">Admin</p>
        <h1 className="text-[var(--text)] font-serif text-[38px]">Payments</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          Every member&apos;s schedule, dues and status in one place.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-4">
          <p className="text-[var(--text-3)] text-xs uppercase tracking-wider mb-2">Outstanding</p>
          <p className="text-[var(--text)] font-serif text-2xl">{money(totalOutstanding)}</p>
          <p className="text-[var(--text-3)] text-xs mt-1">{owingCount} member{owingCount === 1 ? '' : 's'} owing</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-4">
          <p className="text-[var(--text-3)] text-xs uppercase tracking-wider mb-2">Overdue</p>
          <p className={`font-serif text-2xl ${overdueCount > 0 ? 'text-[#CC1F1F]' : 'text-[var(--text)]'}`}>{overdueCount}</p>
          <p className="text-[var(--text-3)] text-xs mt-1">past-due member{overdueCount === 1 ? '' : 's'}</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-4">
          <p className="text-[var(--text-3)] text-xs uppercase tracking-wider mb-2">Members</p>
          <p className="text-[var(--text)] font-serif text-2xl">{rows.length}</p>
          <p className="text-[var(--text-3)] text-xs mt-1">{rows.filter((r) => r.tracked).length} with billing set up</p>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-6" />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--text-3)] text-[10px] uppercase tracking-wider border-b border-[var(--border-color)]">
              <th className="text-left font-medium py-2 pr-4">Member</th>
              <th className="text-left font-medium py-2 pr-4">Membership</th>
              <th className="text-left font-medium py-2 pr-4">Schedule</th>
              <th className="text-left font-medium py-2 pr-4">Amount</th>
              <th className="text-left font-medium py-2 pr-4">Due day</th>
              <th className="text-left font-medium py-2 pr-4">Next due</th>
              <th className="text-right font-medium py-2 pr-4">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, b, outstanding, overdue, nextDue, tracked }) => {
              const cur = b?.currency ?? 'USD'
              return (
                <tr key={m.id} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--surface)] transition-colors">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/member/${m.id}`} className="text-[var(--text)] hover:text-[#C9A227] transition-colors">
                      {m.name}
                    </Link>
                    {m.cohort && <span className="block text-[var(--text-4)] text-[10px]">{m.cohort}</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {b ? (
                      <span className={`text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${MEMBERSHIP_BADGE[b.membership_status] ?? 'text-[var(--text-3)] border-[var(--border-color)]'}`}>
                        {b.membership_status}
                      </span>
                    ) : (
                      <span className="text-[var(--text-4)] text-xs">—</span>
                    )}
                    {b?.membership_end && (
                      <span className="block text-[var(--text-4)] text-[10px] mt-0.5">ends {fmtDate(b.membership_end)}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-[var(--text-2)]">{b ? SCHEDULE_LABEL[b.schedule] ?? b.schedule : '—'}</td>
                  <td className="py-3 pr-4 text-[var(--text-2)]">{b?.amount != null ? money(Number(b.amount), cur) : '—'}</td>
                  <td className="py-3 pr-4 text-[var(--text-2)]">{b?.due_day ?? '—'}</td>
                  <td className="py-3 pr-4 text-[var(--text-2)]">{nextDue ? fmtDate(nextDue) : '—'}</td>
                  <td className="py-3 pr-4 text-right">
                    {!tracked ? (
                      <span className="text-[var(--text-4)] text-xs">not tracked</span>
                    ) : outstanding > 0 ? (
                      <span className={overdue ? 'text-[#CC1F1F] font-medium' : 'text-yellow-400'}>
                        {money(outstanding, cur)}
                        {overdue && <span className="block text-[10px] uppercase tracking-wider">overdue</span>}
                      </span>
                    ) : (
                      <span className="text-green-400">Paid up</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[var(--text-3)] text-sm">No members yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[var(--text-4)] text-xs mt-6">
        Click a member to edit their billing and record payments. Totals assume USD.
      </p>
    </div>
  )
}
