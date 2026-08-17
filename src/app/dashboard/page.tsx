import { redirect } from 'next/navigation'
import Link from 'next/link'
import AttendanceCard from '@/components/dashboard/AttendanceCard'
import OfficeHoursCard from '@/components/dashboard/OfficeHoursCard'
import { resolvePortalContext } from '@/lib/portalContext'
import { getOfficeHoursStatus } from '@/lib/office-hours'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ oh?: string }> }) {
  const sp = await searchParams
  const ctx = await resolvePortalContext()
  if (!ctx.user) redirect('/login')
  const { db } = ctx

  const { data: member } = ctx.member
    ? await db
        .from('members')
        .select(`
          *,
          weekly_logs ( week_of, showed_up, homework_done, questions_asked ),
          reports ( id, period_type, period_label, generated_at, sent_at )
        `)
        .eq('id', ctx.member.id as string)
        .maybeSingle()
    : { data: null }

  if (!member) {
    return (
      <div className="p-4 sm:p-8 text-center space-y-2">
        <p className="text-[var(--text-2)]">Your member profile is being set up. Check back soon.</p>
        <p className="text-[var(--text-3)] text-xs">Logged in as: {ctx.user.email}</p>
      </div>
    )
  }

  const { data: homeworkData } = await db
    .from('homework')
    .select('id, title, description, due_date, type, completed, completed_at, notes, auto_suggested, source_note_homework_id')
    .eq('member_id', member.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const logs = member.weekly_logs ?? []
  const reports = (member.reports ?? []).filter((r: { sent_at: string | null }) => r.sent_at)

  const allTasks = homeworkData ?? []
  const taskTotal = allTasks.length
  const tasksDone = allTasks.filter(t => t.completed).length
  const homeworkRate = taskTotal > 0 ? Math.round((tasksDone / taskTotal) * 100) : null

  // Tasks coming due (within 3 days, including overdue) — drives the reminder banner.
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const daysUntilDue = (due: string) =>
    Math.round((new Date(due + 'T00:00:00').getTime() - startOfToday.getTime()) / 86400000)
  const dueSoonTasks = allTasks.filter(t => !t.completed && t.due_date && daysUntilDue(t.due_date) <= 3)
  const overdueCount = dueSoonTasks.filter(t => t.due_date && daysUntilDue(t.due_date) < 0).length
  const upcomingCount = dueSoonTasks.length - overdueCount

  const latestReport = reports[0] ?? null

  // Determine current quarter from join date
  const joinDate = new Date(member.join_date)
  const now = new Date()
  const weeksIn = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
  const currentQuarter = Math.min(Math.ceil(weeksIn / 13) || 1, 4)

  let officeHours = await getOfficeHoursStatus()
  // Opt-in preview overrides for testing (not the real day/state):
  //   ?oh=tuesday → the Tuesday "Join the Zoom" state
  //   ?oh=off     → the "No Office Hours this week" + popup state
  //   ?oh=moved   → the "rescheduled, not today" notice + popup
  //   ?oh=movedtoday → the rescheduled Join button (moved day is today)
  if (sp?.oh === 'tuesday') officeHours = { ...officeHours, status: 'meeting', isMeetingDayET: true }
  else if (sp?.oh === 'off') officeHours = { ...officeHours, status: 'no_meeting', hasMeeting: false, isMeetingDayET: false }
  else if (sp?.oh === 'moved' || sp?.oh === 'movedtoday') officeHours = {
    ...officeHours,
    status: 'rescheduled',
    isMeetingDayET: sp.oh === 'movedtoday',
    rescheduledDate: officeHours.rescheduledDate ?? officeHours.tuesdayISO,
    rescheduledTime: officeHours.rescheduledTime ?? '14:00',
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Welcome back</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">{member.name}</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          {member.cohort ? `${member.cohort} cohort` : 'The Circle'} · Week {weeksIn + 1} of your program
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {/* Deadline reminder bubble */}
      {dueSoonTasks.length > 0 && (
        <Link
          href="/dashboard/homework"
          className={`flex items-center gap-3 mb-8 rounded-lg border px-4 py-3 transition-colors ${
            overdueCount > 0
              ? 'bg-[#CC1F1F]/10 border-[#CC1F1F]/30 hover:border-[#CC1F1F]/50'
              : 'bg-[#C9A227]/10 border-[#C9A227]/30 hover:border-[#C9A227]/50'
          }`}
        >
          <span className="text-xl flex-shrink-0">⏰</span>
          <div className="min-w-0">
            <p className="text-[var(--text)] text-sm font-medium">
              {dueSoonTasks.length === 1 ? 'You have a task coming due' : `You have ${dueSoonTasks.length} tasks coming due`}
            </p>
            <p className="text-[var(--text-2)] text-xs mt-0.5">
              {overdueCount > 0 && <span className="text-[#ff8080]">{overdueCount} overdue</span>}
              {overdueCount > 0 && upcomingCount > 0 && ' · '}
              {upcomingCount > 0 && `${upcomingCount} due within 3 days`}
              {' · tap to view →'}
            </p>
          </div>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <AttendanceCard logs={logs} joinDate={member.join_date} />
        <Link href="/dashboard/homework" className="block bg-[var(--surface)] border border-[var(--border-color)] rounded p-5 hover:border-[#C9A227]/40 transition-colors group">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[var(--text-3)] text-xs uppercase tracking-wider">Homework</p>
            <span className="text-[#C9A227] text-xs opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
          </div>
          <p className="text-[var(--text)] font-serif text-3xl">{homeworkRate !== null ? `${homeworkRate}%` : '—'}</p>
          <p className="text-[var(--text-3)] text-xs mt-2">{tasksDone} of {taskTotal} tasks complete</p>
          <div className="mt-3 h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${homeworkRate && homeworkRate >= 75 ? 'bg-green-500' : homeworkRate && homeworkRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${homeworkRate ?? 0}%` }}
            />
          </div>
        </Link>
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-5">
          <p className="text-[var(--text-3)] text-xs uppercase tracking-wider mb-2">Current Quarter</p>
          <p className="text-[var(--text)] font-serif text-3xl">Q{currentQuarter}</p>
          <p className="text-[var(--text-3)] text-xs mt-2">of your 12-month blueprint</p>
        </div>
      </div>

      {/* Two columns: Blueprint + Latest Report */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Tuesday Office Hours — Join button on Tuesdays, popup when off */}
      <OfficeHoursCard
        status={officeHours.status}
        isMeetingDay={officeHours.isMeetingDayET}
        note={officeHours.note}
        zoomLink={officeHours.zoomLink}
        tuesdayISO={officeHours.tuesdayISO}
        rescheduledDate={officeHours.rescheduledDate}
        rescheduledTime={officeHours.rescheduledTime}
      />

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

    </div>
  )
}
