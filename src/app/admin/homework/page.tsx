import { createClient } from '@/lib/supabase/server'
import HomeworkOverview from '@/components/admin/HomeworkOverview'

interface RawTask {
  id: string
  title: string
  description: string | null
  type: 'homework' | 'task'
  completed: boolean
  due_date: string | null
  completed_at: string | null
}

export default async function AdminHomeworkPage() {
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('members')
    .select(`
      id, name, cohort, status,
      homework ( id, title, description, type, completed, due_date, completed_at, sort_order, created_at )
    `)
    .order('name', { ascending: true })

  const shaped = (members ?? []).map((m) => {
    const tasks = ((m.homework ?? []) as (RawTask & { sort_order: number | null; created_at: string })[])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at))
      .map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        type: t.type,
        completed: t.completed,
        due_date: t.due_date,
        completed_at: t.completed_at,
      }))
    return { id: m.id as string, name: m.name as string, cohort: (m.cohort as string | null) ?? null, status: m.status as string, tasks }
  })

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">Homework</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          Quick glance at every member&apos;s tasks. Pick a member to see what&apos;s done and what&apos;s outstanding, switch between them without leaving.
        </p>
      </div>

      <HomeworkOverview members={shaped} />
    </div>
  )
}
