import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NotesSection from '@/components/dashboard/NotesSection'

export default async function NotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members')
    .select('id, name')
    .eq('email', user.email)
    .maybeSingle()

  if (!member) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-2)]">Your member profile is being set up. Check back soon.</p>
      </div>
    )
  }

  const { data: notesData } = await supabase
    .from('member_notes')
    .select('content')
    .eq('member_id', member.id)
    .maybeSingle()

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Private workspace</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">My Notes</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">Just for you — ideas, wins, reminders, anything on your mind.</p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      <NotesSection
        memberId={member.id}
        initialContent={notesData?.content ?? ''}
        expanded
      />
    </div>
  )
}
