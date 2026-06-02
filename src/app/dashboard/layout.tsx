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
    .select('name')
    .eq('email', user.email)
    .single()

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
