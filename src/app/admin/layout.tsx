import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Regular client is fine for own profile — auth.uid() = id policy always allows it
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.role || !['owner', 'tech', 'admin', 'manager', 'support'].includes(profile.role)) {
    redirect('/login')  // Never redirect to /dashboard — that would create a loop
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" memberName={profile?.full_name ?? user.email} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
