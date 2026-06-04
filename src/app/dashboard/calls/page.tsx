import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ClarityCallsList from '@/components/member/ClarityCallsList'

export const metadata = { title: 'My Clarity Calls · The Circle' }

export default async function MemberCallsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (!member) redirect('/dashboard')

  // RLS allows members to SELECT their own clarity calls.
  const { data: calls } = await supabase
    .from('clarity_calls')
    .select('id, title, video_url, call_date, notes, created_at')
    .eq('member_id', member.id)
    .order('call_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Your Recorded Sessions</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">Clarity Calls</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          Rewatch your coaching call recordings anytime.
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      <ClarityCallsList calls={calls ?? []} />

      <div className="mt-10">
        <Link href="/dashboard" className="text-xs text-[var(--text-3)] hover:text-[#C9A227] transition-colors">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}
