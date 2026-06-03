import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'
import ChatBubble from '@/components/dashboard/ChatBubble'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  // All team roles go to the admin portal
  if (['owner', 'admin', 'manager', 'support'].includes(profile?.role ?? '')) redirect('/admin')

  const { data: member } = await supabase
    .from('members')
    .select('name, status')
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

  return (
    <div className="flex min-h-screen">
      <Sidebar role="member" memberName={member?.name ?? profile?.full_name ?? user.email} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <ChatBubble />
    </div>
  )
}
