import { createClient } from '@/lib/supabase/server'
import MembersTable from '@/components/admin/MembersTable'
import InviteMemberButton from '@/components/admin/InviteMemberButton'

export default async function AdminMembersPage() {
  const supabase = await createClient()

  // Fetch all members with logs + homework tasks
  const { data: members } = await supabase
    .from('members')
    .select(`
      *,
      weekly_logs ( week_of, showed_up, homework_done, questions_asked ),
      homework ( id, completed )
    `)
    .order('join_date', { ascending: false })

  const membersWithStats = (members ?? []).map((m) => {
    const logs = m.weekly_logs ?? []
    const total = logs.length
    const attended = logs.filter((l: { showed_up: boolean }) => l.showed_up).length

    const tasks = m.homework ?? []
    const taskTotal = tasks.length
    const tasksDone = tasks.filter((t: { completed: boolean }) => t.completed).length

    return {
      ...m,
      calls_total: total,
      calls_attended: attended,
      attendance_rate: total > 0 ? Math.round((attended / total) * 100) : null,
      homework_rate: taskTotal > 0 ? Math.round((tasksDone / taskTotal) * 100) : null,
      last_active: logs[0]?.week_of ?? null,
    }
  })

  const active = membersWithStats.filter(m => m.status === 'active').length
  const total = membersWithStats.length

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
          <h1 className="text-[var(--text)] font-serif text-3xl">Circle Members</h1>
        </div>
        <InviteMemberButton />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Members', value: active },
          { label: 'Total Enrolled', value: total },
          { label: 'Avg Attendance', value: membersWithStats.length > 0
            ? `${Math.round(membersWithStats.filter(m => m.attendance_rate !== null).reduce((a, m) => a + (m.attendance_rate ?? 0), 0) / Math.max(membersWithStats.filter(m => m.attendance_rate !== null).length, 1))}%`
            : '—'
          },
          { label: 'Reports Sent', value: '—' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-4">
            <p className="text-[var(--text-3)] text-xs uppercase tracking-wider mb-2">{stat.label}</p>
            <p className="text-[var(--text)] font-serif text-2xl">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      <MembersTable members={membersWithStats} />
    </div>
  )
}
