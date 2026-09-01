import { createClient } from '@supabase/supabase-js'
import { brandedEmail, sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'

// Daily. Quarters are per-member: each member's journey runs in four 13-week
// quarters from their own program start (members.join_date). When a member
// crosses into a new quarter (i.e. just finished one), email the admins so they
// can generate and send that member's quarterly report. Fires once per member
// per quarter, tracked in quarter_report_notifications.
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: members } = await supabase
    .from('members')
    .select('id, name, join_date, is_internal, status, invited_at')
    .eq('status', 'active')
    .not('invited_at', 'is', null)

  const nowMs = Date.now()
  const WEEK = 1000 * 60 * 60 * 24 * 7

  const crossed: Array<{ id: string; name: string; completedQuarter: number }> = []
  for (const m of members ?? []) {
    if (m.is_internal || !m.join_date) continue
    const weeksIn = Math.floor((nowMs - new Date(m.join_date).getTime()) / WEEK)
    // Q1 = weeks 0-12, Q2 = 13-25, Q3 = 26-38, Q4 = 39-51, "done" = 52+.
    const currentQuarter = Math.min(Math.floor(weeksIn / 13) + 1, 5)
    const completedQuarter = currentQuarter - 1
    if (completedQuarter < 1 || completedQuarter > 4) continue

    const { data: already } = await supabase
      .from('quarter_report_notifications')
      .select('id')
      .eq('member_id', m.id)
      .eq('completed_quarter', completedQuarter)
      .maybeSingle()
    if (already) continue

    crossed.push({ id: m.id as string, name: m.name as string, completedQuarter })
  }

  if (crossed.length === 0) return NextResponse.json({ ok: true, notified: 0 })

  // Record first so a mid-send failure can't cause a duplicate notification.
  await supabase
    .from('quarter_report_notifications')
    .insert(crossed.map((c) => ({ member_id: c.id, completed_quarter: c.completedQuarter })))

  const { data: admins } = await supabase
    .from('profiles')
    .select('email')
    .in('role', ['owner', 'admin', 'manager'])
  const adminEmails = (admins ?? []).map((a) => a.email as string).filter(Boolean)

  const rows = crossed
    .map(
      (c) =>
        `<tr>
          <td style="padding:10px 14px;border-bottom:1px solid #2A2A2A;color:#F5F5F5;">${c.name}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #2A2A2A;color:#C9A227;">Completed Quarter ${c.completedQuarter}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #2A2A2A;"><a href="${APP_URL}/admin/member/${c.id}" style="color:#C9A227;">Open member →</a></td>
        </tr>`
    )
    .join('')

  const html = brandedEmail({
    eyebrow: 'Quarterly Reports',
    heading:
      crossed.length === 1
        ? `${crossed[0].name} just wrapped a quarter`
        : `${crossed.length} members just wrapped a quarter`,
    body: [
      crossed.length === 1
        ? `${crossed[0].name} has crossed into a new quarter of their Circle journey. It is time to generate and send their quarterly report.`
        : `These members have crossed into a new quarter of their Circle journey. It is time to generate and send each of their quarterly reports.`,
      'Open each member, generate their quarterly report, review it, and send.',
    ],
    bodyHtml: `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;">${rows}</table>`,
    cta: { text: 'Go to the portal', url: `${APP_URL}/admin` },
  })

  let sent = 0
  for (const email of adminEmails) {
    try {
      await sendEmail(email, `Quarterly report${crossed.length > 1 ? 's' : ''} due`, html)
      sent++
    } catch {
      /* one bad admin address must not stop the rest */
    }
  }

  return NextResponse.json({ ok: true, notified: crossed.length, admins_emailed: sent })
}
