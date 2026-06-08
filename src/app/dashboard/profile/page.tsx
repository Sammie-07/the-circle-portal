import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from '@/components/dashboard/ProfileForm'
import MemberProfileCard from '@/components/shared/MemberProfileCard'
import ProfilePhotoUpload from '@/components/dashboard/ProfilePhotoUpload'

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

  const { data: headshot } = await supabase
    .from('member_documents')
    .select('id')
    .eq('member_id', member.id)
    .eq('doc_type', 'headshot')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const headshotUrl = headshot?.id ? `/api/member-documents/${headshot.id}/download` : null

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Account</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">My Profile</h1>
      </div>

      <MemberProfileCard
        name={member.name}
        cohort={member.cohort}
        joinDate={member.join_date}
        city={member.city}
        instagram={member.instagram}
        website={member.website}
        bio={member.bio}
        headshotUrl={headshotUrl}
      />

      <ProfilePhotoUpload memberId={member.id} hasPhoto={!!headshotUrl} />

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent my-8" />

      <h2 className="text-[var(--text)] font-serif text-lg mb-5">Edit your details</h2>

      <ProfileForm member={member} loginEmail={user.email ?? ''} />
    </div>
  )
}
