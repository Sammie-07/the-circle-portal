import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BlueprintOpener from '@/components/dashboard/BlueprintOpener'


export default async function BlueprintPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members')
    .select('name, join_date, cohort, blueprint_html, blueprint_sent_to_member_at, blueprint_share_token')
    .eq('email', user.email)
    .single()

  if (!member) redirect('/dashboard')

  const joinDate = new Date(member.join_date)
  const isPublished = !!member.blueprint_sent_to_member_at && !!member.blueprint_html
  const blueprintUrl = isPublished && member.blueprint_share_token
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/b/${member.blueprint_share_token}`
    : null

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Your 12-Month Plan</p>
        <h1 className="text-white font-serif text-3xl">Business Blueprint</h1>
        <p className="text-[#555] text-sm mt-1">
          Prepared by Gogo Bethke · {member.cohort ?? 'The Circle'} · Joined {joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {blueprintUrl ? (
        /* Auto-opens blueprint in new tab on mount, shows button as fallback */
        <BlueprintOpener blueprintUrl={blueprintUrl} />
      ) : (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-10 text-center">
          <div className="w-14 h-14 rounded-full border border-[#C9A227]/30 bg-[#C9A227]/5 flex items-center justify-center mx-auto mb-5">
            <span className="text-[#C9A227] text-2xl">◈</span>
          </div>
          <h2 className="text-white font-serif text-xl mb-3">Your Blueprint Is Being Prepared</h2>
          <p className="text-[#555] text-sm leading-relaxed max-w-sm mx-auto">
            Gogo is reviewing your clarity call and writing your personalized 12-month business plan.
            It will appear here once it&apos;s ready.
          </p>
        </div>
      )}

      <div className="mt-10 text-center">
        <div className="h-px bg-gradient-to-r from-transparent via-[#2A2A2A] to-transparent mb-6" />
        <p className="text-[#C9A227] font-serif italic text-sm">
          &ldquo;The quickest way to reach your goals isn&apos;t through trial and error —<br />
          it&apos;s by learning directly from someone who&apos;s already done it.&rdquo;
        </p>
        <p className="text-[#555] text-xs mt-2">— Gogo Bethke</p>
      </div>

      <div className="mt-6">
        <Link href="/dashboard" className="text-xs text-[#555] hover:text-[#C9A227] transition-colors">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}
