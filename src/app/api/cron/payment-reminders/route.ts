import { createClient } from '@supabase/supabase-js'
import { brandedEmail, sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// Daily ~9:30am ET — remind admins about member payments that are DUE TODAY (and any
// still-unpaid OVERDUE ones), so they remember to check Stripe for the charge and mark
// it paid in the portal. Sends ONE email per admin; sends nothing on a quiet day.

interface RawRow {
  id: string
  member_id: string
  due_date: string
  period_label: string | null
  amount_due: number
  amount_paid: number
  status: string
  member:
    | { name: string | null; is_internal: boolean | null }
    | { name: string | null; is_internal: boolean | null }[]
    | null
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount)
  } catch {
    return `${(currency || 'USD')} ${amount.toFixed(2)}`
  }
}

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // "Today" in ET (payments are date-only; the cron fires at 13:30 UTC = 9:30am ET,
  // which is the same calendar day in ET). en-CA gives YYYY-MM-DD.
  const todayET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())

  // Outstanding payments due today or earlier.
  const { data: rows, error } = await supabase
    .from('member_payments')
    .select('id, member_id, due_date, period_label, amount_due, amount_paid, status, member:members(name, is_internal)')
    .in('status', ['unpaid', 'partial'])
    .not('due_date', 'is', null)
    .lte('due_date', todayET)
    .order('due_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = ((rows ?? []) as RawRow[])
    .map((r) => {
      const m = Array.isArray(r.member) ? r.member[0] : r.member
      return {
        ...r,
        memberName: m?.name ?? 'Unknown member',
        internal: !!m?.is_internal,
        remaining: Number(r.amount_due) - Number(r.amount_paid),
      }
    })
    .filter((r) => !r.internal && r.remaining > 0)

  const dueToday = items.filter((r) => r.due_date === todayET)
  const overdue = items.filter((r) => r.due_date < todayET)

  if (dueToday.length === 0 && overdue.length === 0) {
    return NextResponse.json({ success: true, sent: 0, note: 'no payments due' })
  }

  // Currency per member (default USD).
  const memberIds = [...new Set(items.map((r) => r.member_id))]
  const { data: billings } = await supabase
    .from('member_billing')
    .select('member_id, currency')
    .in('member_id', memberIds)
  const currencyOf = new Map<string, string>((billings ?? []).map((b) => [b.member_id as string, (b.currency as string) || 'USD']))

  const line = (r: (typeof items)[number]) => {
    const cur = currencyOf.get(r.member_id) || 'USD'
    const partial = r.status === 'partial'
      ? ` <span style="color:#888;">(partial — ${money(Number(r.amount_paid), cur)} of ${money(Number(r.amount_due), cur)} paid)</span>`
      : ''
    const label = r.period_label ? ` <span style="color:#777;">· ${r.period_label}</span>` : ''
    return `<p style="margin:0 0 6px;font-size:14px;color:#CCCCCC;">
      <strong style="color:#FFFFFF;">${r.memberName}</strong> — ${money(r.remaining, cur)}${label}
      <span style="color:#777;">· due ${fmtDate(r.due_date)}</span>${partial}
    </p>`
  }

  const section = (title: string, color: string, list: typeof items) =>
    list.length
      ? `<div style="margin-bottom:16px;">
           <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:${color};">${title} (${list.length})</p>
           ${list.map(line).join('')}
         </div>`
      : ''

  const bodyHtml = `${section('Due today', '#C9A227', dueToday)}${section('Overdue and still unpaid', '#CC1F1F', overdue)}`

  const html = brandedEmail({
    eyebrow: 'Payment Reminder',
    heading: dueToday.length ? 'Member payments due today' : 'Outstanding member payments',
    body: [
      'These member payments are due. Check <strong style="color:#FFFFFF;">Stripe</strong> to confirm the charge went through, then mark each one paid in the portal so the ledger stays accurate.',
    ],
    bodyHtml,
    cta: { text: 'Open Payments in the portal', url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/payments` },
    note: 'You are receiving this because a member payment reached its due date. It repeats daily while anything stays unpaid.',
    footer: 'The Circle · Admin Billing',
  })

  const subject = `The Circle — ${dueToday.length} payment${dueToday.length === 1 ? '' : 's'} due today${overdue.length ? ` (+${overdue.length} overdue)` : ''}`

  const { data: admins } = await supabase
    .from('profiles')
    .select('email')
    .in('role', ['owner', 'admin', 'manager'])

  const recipients = (admins ?? []).map((a) => a.email).filter(Boolean) as string[]
  if (recipients.length === 0) {
    return NextResponse.json({ success: true, sent: 0, note: 'no admin recipients' })
  }

  await Promise.allSettled(
    recipients.map((email) =>
      sendEmail(email, subject, html).catch((err: unknown) => console.error(`Payment reminder send failed for ${email}:`, err))
    )
  )

  return NextResponse.json({
    success: true,
    sent: recipients.length,
    due_today: dueToday.length,
    overdue: overdue.length,
  })
}
