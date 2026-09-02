import { redirect } from 'next/navigation'
import Link from 'next/link'
import OfficeHoursCard from '@/components/dashboard/OfficeHoursCard'
import RecentReplays, { type Replay } from '@/components/dashboard/RecentReplays'
import { resolvePortalContext } from '@/lib/portalContext'
import { getOfficeHoursStatus } from '@/lib/office-hours'
import UnrecognizedAccount from '@/components/shared/UnrecognizedAccount'

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
      <UnrecognizedAccount email={ctx.user.email} />
    )
  }

  const { data: homeworkData } = await db
    .from('homework')
    .select('id, title, description, due_date, type, completed, completed_at, created_at, notes, auto_suggested, source_note_homework_id')
    .eq('member_id', member.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  // Recent replays — the member's clarity calls + the global office-hours
  // recordings, merged, newest first (a dashboard shortcut to the Calls page).
  const { data: clarityCalls } = await db
    .from('clarity_calls')
    .select('id, title, call_date, created_at, video_url')
    .eq('member_id', member.id as string)
    .order('call_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(5)
  const { data: ohCalls } = await db
    .from('office_hours')
    .select('id, title, call_date, created_at, video_url')
    .order('call_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(5)
  type Row = { id: string; title: string; call_date: string | null; created_at: string; video_url: string }
  const recentReplays: Replay[] = [
    ...((clarityCalls ?? []) as Row[]).map((c) => ({ id: c.id, title: c.title, call_date: c.call_date, video_url: c.video_url, kind: 'clarity' as const })),
    ...((ohCalls ?? []) as Row[]).map((c) => ({ id: c.id, title: c.title, call_date: c.call_date, video_url: c.video_url, kind: 'office' as const })),
  ]
    .filter((r) => r.video_url)
    .sort((a, b) => (b.call_date ?? '').localeCompare(a.call_date ?? ''))
    .slice(0, 3)

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
  const initials = (member.name ?? 'The Circle').split(/\s+/).filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || 'TC'

  // All-time attendance for the welcome hero stat.
  const attTotal = logs.length
  const attended = logs.filter((l: { showed_up: boolean }) => l.showed_up).length
  const attendanceRate = attTotal > 0 ? Math.round((attended / attTotal) * 100) : null

  // Determine current quarter from join date
  const joinDate = new Date(member.join_date)
  const now = new Date()
  const weeksIn = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
  const currentQuarter = Math.min(Math.ceil(weeksIn / 13) || 1, 4)
  // Blueprint quarter segments (Q1–Q4) for the progress bar.
  const quarterSegments = [1, 2, 3, 4].map((q) => (q < currentQuarter ? 'done' : q === currentQuarter ? 'current' : 'todo'))

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
    <div className="p-4 sm:p-8 max-w-5xl mx-auto flex flex-col gap-[22px] tc-rise">

      {/* Welcome hero — attendance + homework + avatar folded in */}
      <section className="flex flex-wrap items-center justify-between gap-x-12 gap-y-6 rounded-[18px] border border-[var(--border-color)] bg-[var(--surface)] px-[34px] py-[30px]">
        <div className="flex-1 min-w-[260px]">
          <p className="text-[10px] tracking-[0.24em] uppercase text-[var(--text-3)] mb-1">Welcome back</p>
          <p className="font-serif text-[38px] leading-[1.1] text-[var(--text)]">{member.name}</p>
          <p className="text-[13px] text-[var(--text-2)] mt-3">
            {member.cohort ? `${member.cohort} cohort · ` : ''}Week {weeksIn + 1} of 52 · Q{currentQuarter} focus
          </p>
        </div>
        <div className="flex items-center gap-9 flex-none">
          <div className="w-[140px]">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--text-3)] mb-2">Attendance</p>
            <p className="font-serif text-[30px] leading-none text-[var(--text)]">{attendanceRate !== null ? `${attendanceRate}%` : '—'}</p>
            <div className="mt-[9px] h-[3px] rounded-[2px] bg-[var(--surface-2)] overflow-hidden">
              <div className="h-full" style={{ width: `${attendanceRate ?? 0}%`, background: '#22C55E' }} />
            </div>
          </div>
          <div className="w-[140px]">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--text-3)] mb-2">Homework</p>
            <p className="font-serif text-[30px] leading-none text-[var(--text)]">{homeworkRate !== null ? `${homeworkRate}%` : '—'}</p>
            <div className="mt-[9px] h-[3px] rounded-[2px] bg-[var(--surface-2)] overflow-hidden">
              <div className="h-full" style={{ width: `${homeworkRate ?? 0}%`, background: 'var(--gold)' }} />
            </div>
          </div>
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-[17px] font-bold flex-none" style={{ background: '#F4A7B9', color: '#5A2233' }}>
            {initials}
          </div>
        </div>
      </section>

      {/* Tuesday Office Hours (hero) */}
      <OfficeHoursCard
        status={officeHours.status}
        isMeetingDay={officeHours.isMeetingDayET}
        note={officeHours.note}
        zoomLink={officeHours.zoomLink}
        tuesdayISO={officeHours.tuesdayISO}
        rescheduledDate={officeHours.rescheduledDate}
        rescheduledTime={officeHours.rescheduledTime}
      />

      {/* Deadline reminder */}
      {dueSoonTasks.length > 0 && (
        <Link
          href="/dashboard/homework"
          className="block rounded-2xl border px-[26px] py-[22px] transition-colors"
          style={{ background: overdueCount > 0 ? 'var(--red-soft)' : 'var(--gold-soft)', borderColor: 'var(--border-2)' }}
        >
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="text-[var(--text)] text-sm font-medium">
                {dueSoonTasks.length === 1 ? 'You have a task coming due' : `${dueSoonTasks.length} tasks need you this week`}
              </p>
              <p className="text-[var(--text-2)] text-xs mt-1">
                {overdueCount > 0 && <span style={{ color: 'var(--red-text)' }}>{overdueCount} overdue</span>}
                {overdueCount > 0 && upcomingCount > 0 && ' · '}
                {upcomingCount > 0 && `${upcomingCount} due within 3 days`}
              </p>
            </div>
            <span
              className="flex-none text-xs px-[18px] py-[9px] rounded-full border"
              style={{ borderColor: overdueCount > 0 ? 'var(--red-text)' : 'var(--gold-line)', color: overdueCount > 0 ? 'var(--red-text)' : 'var(--gold-text)' }}
            >
              Open homework →
            </span>
          </div>
        </Link>
      )}

      {/* Two columns: Blueprint + Latest Report */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[22px]">
        {/* Blueprint card */}
        <section className="rounded-[18px] border border-[var(--border-color)] bg-[var(--surface)] p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[var(--text)] font-serif text-[19px]">Your Blueprint</h2>
            {member.blueprint_sent_to_member_at && member.blueprint_share_token && (
              <a href={`/b/${member.blueprint_share_token}`} target="_blank" rel="noopener noreferrer" className="text-[var(--gold-text)] text-[11.5px] hover:text-[var(--gold)]">
                View full ↗
              </a>
            )}
          </div>
          {member.blueprint_sent_to_member_at ? (
            <div className="space-y-4">
              {/* Q1–Q4 progress */}
              <div className="flex gap-1.5">
                {quarterSegments.map((s, i) => (
                  <div
                    key={i}
                    className="flex-1 h-1 rounded-[2px]"
                    style={{ background: s === 'done' ? 'var(--gold)' : s === 'current' ? 'linear-gradient(90deg, var(--gold) 62%, var(--surface-2) 62%)' : 'var(--surface-2)' }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] flex-shrink-0" />
                <p className="text-[#22C55E] text-xs">Your blueprint is ready</p>
              </div>
              <div>
                <p className="text-[var(--text-3)] text-[10px] uppercase tracking-[0.2em] mb-1">Current Focus</p>
                <p className="text-[var(--text)] text-sm">Q{currentQuarter} · Months {((currentQuarter - 1) * 3) + 1}–{currentQuarter * 3}</p>
                <p className="text-[var(--text-3)] text-xs mt-1">Week {weeksIn + 1} of your program</p>
              </div>
              {member.blueprint_share_token && (
                <a href={`/b/${member.blueprint_share_token}`} target="_blank" rel="noopener noreferrer" className="inline-block text-xs rounded-full bg-[var(--gold)] text-[#0B0B0B] font-medium px-4 py-2 hover:brightness-110 transition-all">
                  Open blueprint →
                </a>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[var(--text-3)] text-sm mb-3">Your blueprint is being prepared by Gogo.</p>
              <p className="text-[var(--text-4)] text-xs leading-relaxed">It will appear here after your clarity call is reviewed.</p>
            </div>
          )}
        </section>

        {/* Latest report */}
        <section className="rounded-[18px] border border-[var(--border-color)] bg-[var(--surface)] p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[var(--text)] font-serif text-[19px]">Latest Report</h2>
            <Link href="/dashboard/reports" className="text-[var(--gold-text)] text-[11.5px] hover:text-[var(--gold)]">All reports →</Link>
          </div>
          {latestReport ? (
            <div>
              <p className="text-[var(--text)] text-sm font-medium">{latestReport.period_label}</p>
              <p className="text-[var(--text-3)] text-xs mt-1">
                Sent {new Date(latestReport.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              <Link href={`/dashboard/reports/${latestReport.id}`} className="inline-block mt-4 text-xs rounded-full bg-[var(--gold)] text-[#0B0B0B] font-medium px-4 py-2 hover:brightness-110 transition-all">
                Read report →
              </Link>
            </div>
          ) : (
            <p className="text-[var(--text-3)] text-sm">Your first report will appear here after your first month.</p>
          )}
        </section>
      </div>

      {/* Recent replays — play inline */}
      <RecentReplays replays={recentReplays} />

      {/* GoGet'Em Community */}
      <section className="rounded-[18px] border border-[var(--border-color)] p-7" style={{ background: 'linear-gradient(100deg, rgba(232,112,154,0.09), rgba(123,95,196,0.09))' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-[var(--text)] font-serif text-[19px]">GoGet&apos;Em Community</h2>
            <p className="text-[var(--text-2)] text-sm mt-0.5">Your community is part of The Circle. Jump in and see what&apos;s coming up.</p>
          </div>
          <div className="flex gap-2 flex-wrap flex-shrink-0">
            <a href="http://members.gogetemcommunity.com/" target="_blank" rel="noopener noreferrer" className="rounded-full text-white font-medium text-sm px-5 py-2 hover:brightness-110 transition-all" style={{ background: 'linear-gradient(135deg, #E8709A, #7B5FC4)' }}>
              Open Community ↗
            </a>
            <a href="https://gogetemwebinars.app.clientclub.net/communities/groups/gogetem-community/events" target="_blank" rel="noopener noreferrer" className="rounded-full border border-[var(--border-2)] text-[var(--text-2)] text-sm px-5 py-2 hover:border-[var(--gold)] hover:text-[var(--text)] transition-colors">
              Community Calendar ↗
            </a>
            <a href="https://calendar.google.com/calendar/embed?src=c_0aee2350885ffb2ab13aa6e23fd6c6394348bda90c1f29615cd5e34de956186c%40group.calendar.google.com&ctz=Africa%2FLagos" target="_blank" rel="noopener noreferrer" className="rounded-full border border-[var(--border-2)] text-[var(--text-2)] text-sm px-5 py-2 hover:border-[var(--gold)] hover:text-[var(--text)] transition-colors">
              GGTC Social Calendar ↗
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
