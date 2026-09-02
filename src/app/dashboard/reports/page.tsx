import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolvePortalContext } from '@/lib/portalContext'

export default async function MemberReportsPage() {
  const ctx = await resolvePortalContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.member) redirect('/dashboard')
  const member = ctx.member as { id: string; name: string }

  const { data: reports } = await ctx.db
    .from('reports')
    .select('id, period_type, period_label, generated_at, sent_at, share_token, content_html')
    .eq('member_id', member.id)
    .not('sent_at', 'is', null)
    .order('generated_at', { ascending: false })

  const periodLabel: Record<string, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Annual',
  }
  const excerpt = (html: string | null) =>
    html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : ''

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto tc-rise">
      <div className="mb-8">
        <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">Written by Gogo&apos;s team</p>
        <h1 className="text-[var(--text)] font-serif text-[38px]">My Reports</h1>
        <p className="text-[var(--text-2)] text-[13.5px] mt-2.5">
          Reflecting your real attendance, homework, and progress, month over month.
        </p>
      </div>

      {!reports || reports.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] p-10 text-center">
          <div className="w-14 h-14 rounded-full border border-[var(--gold-line)] bg-[var(--gold-soft)] flex items-center justify-center mx-auto mb-4">
            <span className="text-[var(--gold)] text-2xl">◆</span>
          </div>
          <h2 className="text-[var(--text)] font-serif text-xl mb-2">No reports yet</h2>
          <p className="text-[var(--text-3)] text-sm leading-relaxed">
            Your first report will be delivered after your first month in the program.<br />
            Keep showing up and doing the work.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
          {reports.map((report, i) => {
            const isLatest = i === 0
            const ex = excerpt(report.content_html)
            return (
              <Link
                key={report.id}
                href={report.share_token ? `/r/${report.share_token}` : `/dashboard/reports/${report.id}`}
                className="block rounded-[18px] p-7 transition-transform hover:scale-[1.01]"
                style={{ border: `1px solid ${isLatest ? 'var(--gold-line)' : 'var(--border-color)'}`, background: 'var(--surface)' }}
              >
                <p className="text-[10px] tracking-[0.2em] uppercase mb-3" style={{ color: isLatest ? 'var(--gold-text)' : 'var(--text-3)' }}>
                  {isLatest ? 'Latest · ' : ''}{periodLabel[report.period_type] ?? report.period_type}
                </p>
                <p className="font-serif text-[22px] text-[var(--text)] mb-1.5">{report.period_label}</p>
                <p className="text-[12.5px] text-[var(--text-3)] mb-[18px]">
                  Sent {new Date(report.sent_at!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                {ex && <p className="text-[13px] text-[var(--text-2)] leading-[1.6]" style={{ textWrap: 'pretty' }}>{ex}…</p>}
              </Link>
            )
          })}
        </div>
      )}

      <div className="mt-8">
        <Link href="/dashboard" className="text-xs text-[var(--text-3)] hover:text-[var(--gold)] transition-colors">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}
