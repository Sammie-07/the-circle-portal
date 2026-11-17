import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import CeoCallList, { type CeoCall } from '@/components/admin/CeoCallList'

export const dynamic = 'force-dynamic'

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

export default async function AdminCeoCallsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) redirect('/dashboard')

  const { data: rows } = await createAdminClient()
    .from('problem_statements')
    .select('id, created_at, name, email, phone, answers, statement, status, error, ghl_sent_at, ghl_error')
    .order('created_at', { ascending: false })
    .limit(300)

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">Admin</p>
        <h1 className="text-[var(--text)] font-serif text-[38px]">CEO Calls</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          Every CEO Call Form, run through Gogo&apos;s Brain into a one-paragraph problem statement to read before the call.
        </p>
      </div>
      <CeoCallList calls={(rows ?? []) as CeoCall[]} />
    </div>
  )
}
