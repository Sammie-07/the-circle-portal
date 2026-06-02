import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'
import ChatBubble from '@/components/dashboard/ChatBubble'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: roleData } = await supabase.rpc('get_my_role')
  const role = roleData as string | null

  // All team roles go to the admin portal
  if (role && ['owner', 'tech', 'admin', 'manager', 'support'].includes(role)) redirect('/admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

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
