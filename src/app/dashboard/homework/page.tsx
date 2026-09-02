import { redirect } from 'next/navigation'
import HomeworkSection from '@/components/dashboard/HomeworkSection'
import { resolvePortalContext } from '@/lib/portalContext'
import UnrecognizedAccount from '@/components/shared/UnrecognizedAccount'

export default async function MyHomeworkPage() {
  const ctx = await resolvePortalContext()
  if (!ctx.user) redirect('/login')
  const { db } = ctx

  if (!ctx.member) {
    return (
      <UnrecognizedAccount email={ctx.user.email} />
    )
  }

  const { data: homeworkData } = await db
    .from('homework')
    .select('id, title, description, due_date, type, completed, completed_at, created_at, notes, auto_suggested, source_note_homework_id')
    .eq('member_id', ctx.member.id as string)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const items = homeworkData ?? []
  const total = items.length
  const done = items.filter((t) => t.completed).length
  const open = total - done
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const overdue = items.filter((t) => !t.completed && t.due_date && new Date(t.due_date + 'T00:00:00') < startOfToday).length

  const chip = 'text-xs px-4 py-[7px] rounded-full border'

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto tc-rise">
      <div className="mb-[22px]">
        <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">Your assignments</p>
        <h1 className="text-[var(--text)] font-serif text-[38px]">My Homework</h1>
        <p className="text-[var(--text-2)] text-[13.5px] mt-2.5">
          {total > 0
            ? `${done} of ${total} complete · Gogo reviews these before every office hours.`
            : 'Nothing assigned yet. New homework from Gogo will appear here.'}
        </p>
      </div>

      {total > 0 && (
        <div className="flex gap-2.5 flex-wrap mb-[22px]">
          <span className={chip} style={{ background: 'var(--gold-soft)', borderColor: 'var(--gold-line)', color: 'var(--gold-text)' }}>All {total}</span>
          <span className={chip} style={{ borderColor: 'var(--border-color)', color: 'var(--text-2)' }}>Open {open}</span>
          {overdue > 0 && <span className={chip} style={{ borderColor: 'var(--red-soft)', color: 'var(--red-text)' }}>Overdue {overdue}</span>}
          <span className={chip} style={{ borderColor: 'var(--border-color)', color: 'var(--text-2)' }}>Done {done}</span>
        </div>
      )}

      {items.length > 0 ? (
        <HomeworkSection memberId={ctx.member.id as string} initialItems={items} />
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] p-8 text-center">
          <p className="text-[var(--text-3)] text-sm">You&apos;re all caught up — no homework right now.</p>
        </div>
      )}
    </div>
  )
}
