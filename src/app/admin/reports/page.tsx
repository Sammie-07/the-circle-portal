import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AdminReportsTable from '@/components/admin/AdminReportsTable'

export default async function AdminReportsPage() {
  const supabase = await createClient()

  const { data: reports } = await supabase
    .from('reports')
    .select(`
      id,
      period_type,
      period_label,
      generated_at,
      sent_at,
      content_html,
      members ( id, name, email )
    `)
    .order('generated_at', { ascending: false })

  const allReports = (reports ?? []).map(r => ({
    ...r,
    content_html: r.content_html ?? null,
    member: (Array.isArray(r.members) ? r.members[0] : r.members) as { id: string; name: string; email: string } | null,
  }))

  const totalGenerated = allReports.length
  const totalSent = allReports.filter(r => r.sent_at).length
  const totalDraft = totalGenerated - totalSent

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
          <h1 className="text-white font-serif text-3xl">Reports</h1>
          <p className="text-[#555] text-sm mt-1">All generated and sent Circle reports</p>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <Link
            href="/admin/bulk-reports"
            className="text-xs border border-[#C9A227]/30 text-[#C9A227] px-3 py-1.5 rounded hover:bg-[#C9A227]/10 transition-colors"
          >
            ✦ Bulk Reports
          </Link>
          <Link
            href="/admin"
            className="text-xs text-[#555] hover:text-[#C9A227] transition-colors"
          >
            ← Members
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Generated', value: totalGenerated },
          { label: 'Sent to Members', value: totalSent },
          { label: 'Drafts / Unsent', value: totalDraft },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-4">
            <p className="text-[#555] text-xs uppercase tracking-wider mb-2">{stat.label}</p>
            <p className="text-white font-serif text-2xl">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-6" />

      <AdminReportsTable reports={allReports} />
    </div>
  )
}
