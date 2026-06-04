import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ClarityCallsList from '@/components/member/ClarityCallsList'

export const metadata = { title: 'Call Replays · The Circle' }

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

  // Office hours are global — RLS allows any authenticated user to SELECT all rows.
  const { data: officeHours } = await supabase
    .from('office_hours')
    .select('id, title, video_url, call_date, notes, created_at')
    .order('call_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Your Recorded Sessions</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">Call Replays</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          Rewatch your coaching call and office hours recordings anytime.
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {/* Clarity Call Replay — the member's own clarity calls */}
      <section className="mb-12">
        <ClarityCallsList
          calls={calls ?? []}
          heading="Clarity Call Replay"
          subtitle="Rewatch your personal coaching call recordings."
          emptyText="Your clarity call recordings will appear here once your coach adds them."
        />
      </section>

      {/* Office Hours Replay — global weekly recordings shown to every member */}
      <section>
        <ClarityCallsList
          calls={officeHours ?? []}
          heading="Office Hours Replay"
          subtitle="Weekly recordings shared with everyone in The Circle."
          emptyText="Office hours recordings will appear here once they're posted."
        />
      </section>

      <div className="mt-10">
        <Link href="/dashboard" className="text-xs text-[var(--text-3)] hover:text-[#C9A227] transition-colors">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}
