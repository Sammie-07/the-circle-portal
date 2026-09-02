import { redirect } from 'next/navigation'
import ProfileForm from '@/components/dashboard/ProfileForm'
import MemberProfileCard from '@/components/shared/MemberProfileCard'
import ProfilePhotoUpload from '@/components/dashboard/ProfilePhotoUpload'
import { resolvePortalContext } from '@/lib/portalContext'

export default async function ProfilePage() {
  const ctx = await resolvePortalContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.member) redirect('/dashboard')
  const user = ctx.user

  const { data: member } = await ctx.db
    .from('members')
    .select('id, name, email, phone, city, instagram, website, bio, cohort, join_date')
    .eq('id', ctx.member.id as string)
    .maybeSingle()

  if (!member) redirect('/dashboard')

  const { data: headshot } = await ctx.db
    .from('member_documents')
    .select('id')
    .eq('member_id', member.id)
    .eq('doc_type', 'headshot')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const headshotUrl = headshot?.id ? `/api/member-documents/${headshot.id}/download` : null

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">Account</p>
        <h1 className="text-[var(--text)] font-serif text-[38px]">My Profile</h1>
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
