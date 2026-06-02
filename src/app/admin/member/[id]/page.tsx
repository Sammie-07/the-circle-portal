import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import WeeklyLogForm from '@/components/admin/WeeklyLogForm'
import MemberReportPanel from '@/components/admin/MemberReportPanel'
import BlueprintPanel from '@/components/admin/BlueprintPanel'
import HomeworkPanel from '@/components/admin/HomeworkPanel'
import SendInviteButton from '@/components/admin/SendInviteButton'
import CheckinLinkButton from '@/components/admin/CheckinLinkButton'
import SigninLinkButton from '@/components/admin/SigninLinkButton'
import Link from 'next/link'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (!member) notFound()

  const { data: logs } = await supabase
    .from('weekly_logs')
    .select('*')
    .eq('member_id', id)
    .order('week_of', { ascending: false })
    .limit(20)

  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .eq('member_id', id)
    .order('generated_at', { ascending: false })

  const { data: homeworkItems } = await supabase
    .from('homework')
    .select('id, completed')
    .eq('member_id', id)

  const allLogs = logs ?? []
  const total = allLogs.length
  const attended = allLogs.filter(l => l.showed_up).length
  const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : null

  const allTasks = homeworkItems ?? []
  const taskTotal = allTasks.length
  const tasksDone = allTasks.filter(t => t.completed).length
  const taskRate = taskTotal > 0 ? Math.round((tasksDone / taskTotal) * 100) : null

  function getHealthLabel(rate: number | null) {
    if (rate === null) return { label: 'No data', color: 'text-[var(--text-3)]' }
    if (rate >= 75) return { label: 'On track', color: 'text-green-400' }
    if (rate >= 50) return { label: 'Needs attention', color: 'text-yellow-400' }
    return { label: 'At risk', color: 'text-red-400' }
  }

  const health = getHealthLabel(attendanceRate)

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <Link href="/admin" className="text-[var(--text-3)] text-xs hover:text-[#C9A227] transition-colors">
        ← All Members
      </Link>

      {/* Member header */}
      <div className="mt-4 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-1">{member.cohort ?? 'Circle Member'}</p>
            <h1 className="text-[var(--text)] font-serif text-3xl mb-1">{member.name}</h1>
            <p className="text-[var(--text-3)] text-sm">{member.email}</p>
          </div>
          <div className="text-right space-y-2">
            <p className={`text-sm font-medium ${health.color}`}>{health.label}</p>
            <p className="text-[var(--text-3)] text-xs">Member since {new Date(member.join_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            {member.email && (
              <SendInviteButton email={member.email} memberName={member.name} />
            )}
            <CheckinLinkButton memberId={id} />
            {member.email && <SigninLinkButton email={member.email} />}
          </div>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-4">
          <p className="text-[var(--text-3)] text-xs uppercase tracking-wider mb-2">Attendance</p>
          <p className="text-[var(--text)] font-serif text-2xl">{attendanceRate !== null ? `${attendanceRate}%` : '—'}</p>
          <p className="text-[var(--text-3)] text-xs mt-1">{attended} of {total} calls</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-4">
          <p className="text-[var(--text-3)] text-xs uppercase tracking-wider mb-2">Tasks Done</p>
          <p className="text-[var(--text)] font-serif text-2xl">{taskRate !== null ? `${taskRate}%` : '—'}</p>
          <p className="text-[var(--text-3)] text-xs mt-1">{tasksDone} of {taskTotal} tasks</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-4">
          <p className="text-[var(--text-3)] text-xs uppercase tracking-wider mb-2">Reports Sent</p>
          <p className="text-[var(--text)] font-serif text-2xl">{(reports ?? []).filter(r => r.sent_at).length}</p>
          <p className="text-[var(--text-3)] text-xs mt-1">{(reports ?? []).length} total generated</p>
        </div>
      </div>

      {/* Blueprint — full width, above the 2-col grid */}
      <div className="mb-6">
        <BlueprintPanel
          memberId={id}
          memberName={member.name}
          memberEmail={member.email ?? null}
          blueprintHtml={member.blueprint_html ?? null}
          blueprintGeneratedAt={member.blueprint_generated_at ?? null}
          blueprintSentToGogoAt={member.blueprint_sent_to_gogo_at ?? null}
          blueprintSentToMemberAt={member.blueprint_sent_to_member_at ?? null}
          blueprintShareToken={member.blueprint_share_token ?? null}
          blueprintTranscript={member.blueprint_transcript ?? null}
        />
      </div>

      {/* Homework & Tasks — full width above the 2-col grid */}
      <div className="mb-6">
        <HomeworkPanel memberId={id} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Weekly Log Form */}
        <div>
          <h2 className="text-[var(--text)] font-serif text-lg mb-4">Log This Week</h2>
          <WeeklyLogForm memberId={id} />

          {/* Past logs */}
          {allLogs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[var(--text-2)] text-xs uppercase tracking-wider mb-3">Recent Weeks</h3>
              <div className="space-y-2">
                {allLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border-color)] rounded px-4 py-2.5">
                    <span className="text-[var(--text-2)] text-xs">{new Date(log.week_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${log.showed_up ? 'text-green-400' : 'text-red-400'}`}>
                        {log.showed_up ? '✓ Showed up' : '✗ Missed'}
                      </span>
                      <span className={`text-xs ${log.homework_done ? 'text-green-400' : 'text-[var(--text-3)]'}`}>
                        {log.homework_done ? '✓ HW done' : '— No HW'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Report Panel */}
        <div>
          <h2 className="text-[var(--text)] font-serif text-lg mb-4">Reports</h2>
          <MemberReportPanel memberId={id} memberName={member.name} memberEmail={member.email ?? null} reports={reports ?? []} />
        </div>
      </div>
    </div>
  )
}
