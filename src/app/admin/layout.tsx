import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: roleData } = await supabase.rpc('get_my_role')
  const role = roleData as string | null

  if (!role || !['owner', 'tech', 'admin', 'manager', 'support'].includes(role)) redirect('/dashboard')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" memberName={profile?.full_name ?? user.email} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
