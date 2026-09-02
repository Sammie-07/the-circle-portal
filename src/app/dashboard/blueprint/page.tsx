import { redirect } from 'next/navigation'
import Link from 'next/link'
import BlueprintOpener from '@/components/dashboard/BlueprintOpener'
import { resolvePortalContext } from '@/lib/portalContext'


export default async function BlueprintPage() {
  const ctx = await resolvePortalContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.member) redirect('/dashboard')

  const { data: member } = await ctx.db
    .from('members')
    .select('name, join_date, cohort, blueprint_html, blueprint_sent_to_member_at, blueprint_share_token')
    .eq('id', ctx.member.id as string)
    .single()

  if (!member) redirect('/dashboard')

  const joinDate = new Date(member.join_date)
  const isPublished = !!member.blueprint_sent_to_member_at && !!member.blueprint_html
  const blueprintUrl = isPublished && member.blueprint_share_token
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/b/${member.blueprint_share_token}`
    : null

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto tc-rise">
      <div className="flex items-end justify-between gap-8 mb-8">
        <div>
          <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">12-month plan</p>
          <h1 className="text-[var(--text)] font-serif text-[38px]">My Blueprint</h1>
          <p className="text-[var(--text-2)] text-[13.5px] mt-2.5">
            Prepared by Gogo Bethke · {member.cohort ?? 'The Circle'} · Joined {joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        {blueprintUrl && (
          <a
            href={blueprintUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-none rounded-full text-[12.5px] px-5 py-2.5"
            style={{ border: '1px solid var(--gold-line)', background: 'var(--gold-soft)', color: 'var(--gold-text)' }}
          >
            Open shareable version ↗
          </a>
        )}
      </div>

      {blueprintUrl ? (
        /* Auto-opens blueprint in new tab on mount, shows button as fallback */
        <BlueprintOpener blueprintUrl={blueprintUrl} />
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] p-10 text-center">
          <div className="w-14 h-14 rounded-full border border-[var(--gold-line)] bg-[var(--gold-soft)] flex items-center justify-center mx-auto mb-5">
            <span className="text-[var(--gold)] text-2xl">◈</span>
          </div>
          <h2 className="text-[var(--text)] font-serif text-xl mb-3">Your blueprint is being prepared</h2>
          <p className="text-[var(--text-3)] text-sm leading-relaxed max-w-sm mx-auto">
            Gogo is reviewing your clarity call and writing your personalized 12-month business plan.
            It will appear here once it&apos;s ready.
          </p>
        </div>
      )}

      <div className="mt-10 text-center">
        <div className="h-px bg-[var(--border-color)] mb-6" />
        <p className="text-[var(--gold-text)] font-serif italic text-sm">
          &ldquo;The quickest way to reach your goals isn&apos;t through trial and error,<br />
          it&apos;s by learning directly from someone who&apos;s already done it.&rdquo;
        </p>
        <p className="text-[var(--text-3)] text-xs mt-2">— Gogo Bethke</p>
      </div>

      <div className="mt-6">
        <Link href="/dashboard" className="text-xs text-[var(--text-3)] hover:text-[var(--gold)] transition-colors">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}
