import { redirect } from 'next/navigation'
import HomeworkSection from '@/components/dashboard/HomeworkSection'
import { resolvePortalContext } from '@/lib/portalContext'

export default async function MyHomeworkPage() {
  const ctx = await resolvePortalContext()
  if (!ctx.user) redirect('/login')
  const { db } = ctx

  if (!ctx.member) {
    return (
      <div className="p-4 sm:p-8 text-center">
        <p className="text-[var(--text-2)]">Your member profile is being set up. Check back soon.</p>
      </div>
    )
  }

  const { data: homeworkData } = await db
    .from('homework')
    .select('id, title, description, due_date, type, completed, completed_at, notes, auto_suggested, source_note_homework_id')
    .eq('member_id', ctx.member.id as string)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const items = homeworkData ?? []
  const done = items.filter((t) => t.completed).length

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Your assignments</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">My Homework</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          {items.length > 0
            ? `${done} of ${items.length} complete · unfinished tasks are shown first`
            : 'Nothing assigned yet. New homework from Gogo will appear here.'}
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {items.length > 0 ? (
        <HomeworkSection memberId={ctx.member.id as string} initialItems={items} />
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-8 text-center">
          <p className="text-[var(--text-3)] text-sm">You&apos;re all caught up — no homework right now.</p>
        </div>
      )}
    </div>
  )
}
