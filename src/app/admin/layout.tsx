import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/shared/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!['owner', 'tech', 'admin', 'manager', 'support'].includes(profile?.role ?? '')) redirect('/dashboard')

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" memberName={profile?.full_name ?? user.email} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
