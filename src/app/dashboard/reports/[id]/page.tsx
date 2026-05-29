import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get the member record for this user
  const { data: member } = await supabase
    .from('members')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (!member) redirect('/dashboard')

  // Fetch the report — RLS ensures it belongs to this member and is sent
  const { data: report } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .eq('member_id', member.id)
    .not('sent_at', 'is', null)
    .single()

  if (!report) notFound()

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/reports" className="text-xs text-[#555] hover:text-[#C9A227] transition-colors">
          ← All reports
        </Link>
        <div className="mt-4">
          <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">
            {report.period_type === 'monthly' ? 'Monthly Report' : report.period_type === 'quarterly' ? 'Quarterly Report' : 'Annual Review'}
          </p>
          <h1 className="text-white font-serif text-3xl">{report.period_label}</h1>
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
