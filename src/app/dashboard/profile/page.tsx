import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from '@/components/dashboard/ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members')
    .select('id, name, email, phone, city, instagram, website, bio, cohort, join_date')
    .eq('email', user.email)
    .maybeSingle()

  if (!member) redirect('/dashboard')

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Account</p>
        <h1 className="text-white font-serif text-3xl">My Profile</h1>
        <p className="text-[#555] text-sm mt-1">
          {member.cohort ?? 'The Circle'} · Member since {new Date(member.join_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      <ProfileForm member={member} loginEmail={user.email ?? ''} />
    </div>
  )
}
