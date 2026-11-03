import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import LeadsTable, { type Lead } from '@/components/admin/LeadsTable'

export const dynamic = 'force-dynamic'

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

export default async function AdminLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) redirect('/dashboard')

  const { data: leads } = await createAdminClient()
    .from('blueprint_tests')
    .select('id, token, created_at, name, email, phone, answers, scores, bottleneck, route, second_route, flags, result, result_status, source, status, notes')
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div className="p-4 sm:p-8 max-w-7xl">
      <div className="mb-8">
        <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">Admin</p>
        <h1 className="text-[var(--text)] font-serif text-[38px]">Leads</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          Everyone who took the Blueprint Test: their four-freedom scores, their bottleneck, and where the test sent them.
          Public test link: <a href="/blueprint-test" target="_blank" className="text-[var(--gold-text)] hover:underline">/blueprint-test</a>
        </p>
      </div>
      <LeadsTable leads={(leads ?? []) as Lead[]} />
    </div>
  )
}
