import { redirect } from 'next/navigation'
import Link from 'next/link'
import ClarityCallsList from '@/components/member/ClarityCallsList'
import { resolvePortalContext } from '@/lib/portalContext'

export const metadata = { title: 'Call Replays · The Circle' }

export default async function MemberCallsPage() {
  const ctx = await resolvePortalContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.member) redirect('/dashboard')
  const member = ctx.member as { id: string; name: string }

  // The resolved member's clarity calls (RLS on the normal path).
  const { data: calls } = await ctx.db
    .from('clarity_calls')
    .select('id, title, video_url, call_date, notes, created_at')
    .eq('member_id', member.id)
    .order('call_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  // Office hours are global — RLS allows any authenticated user to SELECT all rows.
  const { data: officeHours } = await ctx.db
    .from('office_hours')
    .select('id, title, video_url, call_date, notes, created_at')
    .order('call_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">Your Recorded Sessions</p>
        <h1 className="text-[var(--text)] font-serif text-[38px]">Call Replays</h1>
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
