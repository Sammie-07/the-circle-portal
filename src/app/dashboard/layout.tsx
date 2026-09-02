import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getViewAsCookie } from '@/lib/portalContext'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'
import ChatBubble from '@/components/dashboard/ChatBubble'
import SurveyGate from '@/components/dashboard/SurveyGate'
import PortalTopBar from '@/components/shared/PortalTopBar'
import { getOfficeHoursStatus } from '@/lib/office-hours'

const STAFF_ROLES = ['owner', 'admin', 'manager', 'support', 'tech']

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const isStaff = STAFF_ROLES.includes(profile?.role ?? '')
  const viewAs = await getViewAsCookie()

  // IMPERSONATION — staff only, only when the view_as_member cookie is set.
  // Renders the target member's portal with an admin banner. No chat bubble,
  // no paused gate (full portal for demos).
  if (isStaff && viewAs) {
    const admin = createAdminClient()
    const { data: target } = await admin
      .from('members')
      .select('name')
      .eq('id', viewAs)
      .single()

    if (target) {
      return (
        <div className="flex min-h-screen flex-col">
          <div className="flex items-center justify-between gap-4 px-5 py-2 bg-[#C9A227] text-[#090909] text-sm font-medium">
            <span>👁 Viewing {target.name}&apos;s portal — admin preview</span>
            <a
              href="/api/admin/impersonate?exit=1"
              className="underline underline-offset-2 hover:opacity-80 whitespace-nowrap"
            >
              Exit preview
            </a>
          </div>
          <div className="flex flex-col md:flex-row flex-1 min-h-0">
            <Sidebar role="member" memberName={target.name} />
            <main className="flex-1 overflow-auto pb-28">{children}</main>
            {/* Bubble shown for portal fidelity. In preview it runs an ephemeral
                chat under the viewer's own staff session: answers live from Gogo's
                Brain but persists nothing and never touches the member's history. */}
            <ChatBubble preview />
          </div>
        </div>
      )
    }
    // Stale cookie pointing at a missing member — fall through to normal logic.
  }

  // All team roles go to the admin portal (unchanged).
  if (isStaff) redirect('/admin')

  const { data: member } = await supabase
    .from('members')
    .select('name, status, cohort, join_date')
    .eq('email', user.email)
    .single()

  // Deactivation gate — block portal access when a member's status is paused.
  // Staff users (no member record) are unaffected since they redirect above.
  if (member && member.status !== 'active') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-[var(--bg)]">
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-lg max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#C9A227]/40 flex items-center justify-center mx-auto mb-5">
            <span className="text-[#C9A227] text-xl">⏸</span>
          </div>
          <h1 className="text-[var(--text)] font-serif text-2xl mb-3">Your access is paused</h1>
          <p className="text-[var(--text-2)] text-sm leading-relaxed">
            Please contact your coach to reactivate your account.
          </p>
        </div>
      </div>
    )
  }

  // Top-bar context line: week + quarter of their program.
  const weeksIn = member?.join_date
    ? Math.max(0, Math.floor((new Date().getTime() - new Date(member.join_date).getTime()) / (1000 * 60 * 60 * 24 * 7)))
    : 0
  const quarter = Math.min(Math.ceil((weeksIn + 1) / 13) || 1, 4)
  const topline = member?.join_date ? `Week ${weeksIn + 1} of 52 · Q${quarter} focus` : 'The Circle'
  const oh = await getOfficeHoursStatus()

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar role="member" memberName={member?.name ?? profile?.full_name ?? user.email} />
      <main className="flex-1 overflow-auto pb-28">
        <PortalTopBar topline={topline} zoomLink={oh.zoomLink} />
        {children}
      </main>
      <ChatBubble />
      {/* Blocking monthly progress survey — real, active members only (resolved
          by email inside its own API; renders nothing when not due). */}
      <SurveyGate />
    </div>
  )
}
