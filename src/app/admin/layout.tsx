import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'
import ChatBubble from '@/components/dashboard/ChatBubble'
import PortalTopBar from '@/components/shared/PortalTopBar'
import { getOfficeHoursStatus } from '@/lib/office-hours'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!['owner', 'admin', 'manager', 'support'].includes(profile?.role ?? '')) redirect('/dashboard')

  const oh = await getOfficeHoursStatus()

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar role="admin" memberName={profile?.full_name ?? user.email} />
      <main className="flex-1 overflow-auto pb-28">
        {/* Join button only on the actual meeting day — never a permanent link to the Zoom. */}
        <PortalTopBar topline="The Circle · Admin" zoomLink={oh.isMeetingDayET ? oh.zoomLink : null} showNotifications />
        {children}
      </main>
      {/* Staff get their own persisted Ask Gogo chat (staff-keyed sessions). */}
      <ChatBubble />
    </div>
  )
}
