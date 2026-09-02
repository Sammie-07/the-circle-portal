import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { resolvePortalContext } from '@/lib/portalContext'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await resolvePortalContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.member) redirect('/dashboard')
  const member = ctx.member as { id: string; name: string }

  // Fetch the report — scoped to the resolved member; RLS applies on the normal path.
  const { data: report } = await ctx.db
    .from('reports')
    .select('*')
    .eq('id', id)
    .eq('member_id', member.id)
    .not('sent_at', 'is', null)
    .single()

  if (!report) notFound()

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/reports" className="text-xs text-[#555] hover:text-[#C9A227] transition-colors">
          ← All reports
        </Link>
        <div className="mt-4">
          <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">
            {report.period_type === 'monthly' ? 'Monthly Report' : report.period_type === 'quarterly' ? 'Quarterly Report' : 'Annual Review'}
          </p>
          <h1 className="text-white font-serif text-[38px]">{report.period_label}</h1>
          <p className="text-[#555] text-sm mt-1">
            Delivered {new Date(report.sent_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {/* Report content rendered from stored HTML */}
      <div
        className="report-body"
        dangerouslySetInnerHTML={{ __html: report.content_html }}
      />
    </div>
  )
}
