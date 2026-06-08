import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import HomeworkSection from '@/components/dashboard/HomeworkSection'
import AttendanceCard from '@/components/dashboard/AttendanceCard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members')
    .select(`
      *,
      weekly_logs ( week_of, showed_up, homework_done, questions_asked ),
      reports ( id, period_type, period_label, generated_at, sent_at )
    `)
    .eq('email', user.email)
    .maybeSingle()

  if (!member) {
    return (
      <div className="p-8 text-center space-y-2">
        <p className="text-[var(--text-2)]">Your member profile is being set up. Check back soon.</p>
        <p className="text-[var(--text-3)] text-xs">Logged in as: {user.email}</p>
      </div>
    )
  }

  const { data: homeworkData } = await supabase
    .from('homework')
    .select('id, title, description, due_date, type, completed, completed_at, notes, auto_suggested')
    .eq('member_id', member.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const logs = member.weekly_logs ?? []
  const reports = (member.reports ?? []).filter((r: { sent_at: string | null }) => r.sent_at)

  const allTasks = homeworkData ?? []
  const taskTotal = allTasks.length
  const tasksDone = allTasks.filter(t => t.completed).length
  const homeworkRate = taskTotal > 0 ? Math.round((tasksDone / taskTotal) * 100) : null

  const latestReport = reports[0] ?? null

  // Determine current quarter from join date
  const joinDate = new Date(member.join_date)
  const now = new Date()
  const weeksIn = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
  const currentQuarter = Math.min(Math.ceil(weeksIn / 13) || 1, 4)

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Welcome back</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">{member.name}</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          {member.cohort ? `${member.cohort} cohort` : 'The Circle'} · Week {weeksIn + 1} of your program
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <AttendanceCard logs={logs} joinDate={member.join_date} />
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-5">
          <p className="text-[var(--text-3)] text-xs uppercase tracking-wider mb-2">Homework</p>
          <p className="text-[var(--text)] font-serif text-3xl">{homeworkRate !== null ? `${homeworkRate}%` : '—'}</p>
          <p className="text-[var(--text-3)] text-xs mt-2">{tasksDone} of {taskTotal} tasks complete</p>
          <div className="mt-3 h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${homeworkRate && homeworkRate >= 75 ? 'bg-green-500' : homeworkRate && homeworkRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${homeworkRate ?? 0}%` }}
            />
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-5">
          <p className="text-[var(--text-3)] text-xs uppercase tracking-wider mb-2">Current Quarter</p>
          <p className="text-[var(--text)] font-serif text-3xl">Q{currentQuarter}</p>
          <p className="text-[var(--text-3)] text-xs mt-2">of your 12-month blueprint</p>
        </div>
      </div>

      {/* Two columns: Blueprint + Latest Report */}
      <div className="grid grid-cols-2 gap-6">
        {/* Blueprint card */}
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[var(--text)] font-serif text-lg">Your Blueprint</h2>
            {member.blueprint_sent_to_member_at && member.blueprint_share_token && (
              <a
                href={`/b/${member.blueprint_share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#C9A227] text-xs hover:text-[#d4ac2d]"
              >
                View full ↗
              </a>
            )}
          </div>
          {member.blueprint_sent_to_member_at ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <p className="text-green-400 text-xs">Your blueprint is ready</p>
              </div>
              <div>
                <p className="text-[var(--text-3)] text-xs uppercase tracking-wider mb-1">Current Focus</p>
                <p className="text-[var(--text)] text-sm">Q{currentQuarter} · Months {((currentQuarter - 1) * 3) + 1}–{currentQuarter * 3}</p>
                <p className="text-[var(--text-3)] text-xs mt-1">Week {Math.floor((new Date().getTime() - new Date(member.join_date).getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1} of your program</p>
              </div>
              {member.blueprint_share_token && (
                <a
                  href={`/b/${member.blueprint_share_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] px-3 py-1.5 rounded hover:bg-[#C9A227]/15 transition-colors"
                >
                  Open blueprint →
                </a>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[var(--text-3)] text-sm mb-3">Your blueprint is being prepared by Gogo.</p>
              <p className="text-[var(--text-4)] text-xs leading-relaxed">
                It will appear here after your clarity call is reviewed.
              </p>
            </div>
          )}
        </div>

        {/* Latest report */}
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[var(--text)] font-serif text-lg">Latest Report</h2>
            <Link href="/dashboard/reports" className="text-[#C9A227] text-xs hover:text-[#d4ac2d]">
              All reports →
            </Link>
          </div>
          {latestReport ? (
            <div>
              <p className="text-[var(--text)] text-sm font-medium">{latestReport.period_label}</p>
              <p className="text-[var(--text-3)] text-xs mt-1">
                Sent {new Date(latestReport.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <Link
                href={`/dashboard/reports/${latestReport.id}`}
                className="inline-block mt-4 text-xs bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] px-3 py-1.5 rounded hover:bg-[#C9A227]/15 transition-colors"
              >
                Read report →
              </Link>
            </div>
          ) : (
            <p className="text-[var(--text-3)] text-sm">Your first report will appear here after your first month.</p>
          )}
        </div>
      </div>

      {/* Next Tuesday reminder */}
      <div className="mt-6 border border-[#C9A227]/20 bg-[#C9A227]/5 rounded p-4 flex items-center justify-between">
        <div>
          <p className="text-[#C9A227] text-sm font-medium">Tuesday Office Hours — 12 noon ET</p>
          <p className="text-[var(--text-2)] text-xs mt-0.5">Show up. Ask questions. Do the work.</p>
        </div>
        <span className="text-[#C9A227] text-2xl">◈</span>
      </div>

      {/* GoGet'Em Community */}
      <div className="mt-6 bg-[var(--surface)] border border-[var(--border-color)] rounded p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-[var(--text)] font-serif text-lg">GoGet&apos;Em Community</h2>
            <p className="text-[var(--text-3)] text-sm mt-0.5">
              Your community is part of The Circle. Jump in and see what&apos;s coming up.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap flex-shrink-0">
            <a
              href="http://members.gogetemcommunity.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#C9A227] text-[#0D0D0D] font-medium text-sm px-4 py-2 rounded hover:bg-[#d4ac2d] transition-colors"
            >
              Open Community ↗
            </a>
            <a
              href="https://gogetemwebinars.app.clientclub.net/communities/groups/gogetem-community/events"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[var(--border-color)] text-[var(--text-2)] text-sm px-4 py-2 rounded hover:border-[#C9A227] hover:text-[var(--text)] transition-colors"
            >
              Community Calendar ↗
            </a>
            <a
              href="https://calendar.google.com/calendar/embed?src=c_0aee2350885ffb2ab13aa6e23fd6c6394348bda90c1f29615cd5e34de956186c%40group.calendar.google.com&ctz=Africa%2FLagos"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[var(--border-color)] text-[var(--text-2)] text-sm px-4 py-2 rounded hover:border-[#C9A227] hover:text-[var(--text)] transition-colors"
            >
              GGTC Social Calendar ↗
            </a>
          </div>
        </div>
      </div>

      {/* Homework & Blueprint Tasks */}
      <HomeworkSection
        memberId={member.id}
        initialItems={homeworkData ?? []}
      />

    </div>
  )
}
