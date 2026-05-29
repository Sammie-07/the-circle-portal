import { createClient } from '@/lib/supabase/server'
import BulkReportPanel from '@/components/admin/BulkReportPanel'

export default async function BulkReportsPage() {
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('members')
    .select('id, name, email, cohort, status')
    .eq('status', 'active')
    .order('name', { ascending: true })

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
        <h1 className="text-white font-serif text-3xl">Bulk Reports</h1>
        <p className="text-[#555] text-sm mt-1">
          Generate and send reports to all members — or just the ones you select.
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      <BulkReportPanel members={members ?? []} />
    </div>
  )
}
