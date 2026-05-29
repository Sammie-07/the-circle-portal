import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import HomeworkSection from '@/components/dashboard/HomeworkSection'
import NotesSection from '@/components/dashboard/NotesSection'

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
        <p className="text-[#888]">Your member profile is being set up. Check back soon.</p>
        <p className="text-[#555] text-xs">Logged in as: {user.email}</p>
      </div>
    )
  }

  // Fetch homework + notes in parallel
  const [{ data: homeworkData }, { data: notesData }] = await Promise.all([
    supabase
      .from('homework')
      .select('id, title, description, due_date, type, completed, completed_at')
      .eq('member_id', member.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('member_notes')
      .select('content')
      .eq('member_id', member.id)
      .maybeSingle(),
  ])

  const logs = member.weekly_logs ?? []
  const reports = (member.reports ?? []).filter((r: { sent_at: string | null }) => r.sent_at)
  const total = logs.length
  const attended = logs.filter((l: { showed_up: boolean }) => l.showed_up).length
  const homeworkDone = logs.filter((l: { homework_done: boolean }) => l.homework_done).length
  const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : null
  const homeworkRate = total > 0 ? Math.round((homeworkDone / total) * 100) : null

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
        <h1 className="text-white font-serif text-3xl">{member.name}</h1>
        <p className="text-[#555] text-sm mt-1">
          {member.cohort ? `${member.cohort} cohort` : 'The Circle'} · Week {weeksIn + 1} of your program
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-5">
          <p className="text-[#555] text-xs uppercase tracking-wider mb-2">Attendance</p>
          <p className="text-white font-serif text-3xl">{attendanceRate !== null ? `${attendanceRate}%` : '—'}</p>
          <p className="text-[#555] text-xs mt-2">{attended} of {total} Tuesday calls</p>
          <div className="mt-3 h-1 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${attendanceRate && attendanceRate >= 75 ? 'bg-green-500' : attendanceRate && attendanceRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${attendanceRate ?? 0}%` }}
            />
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-5">
          <p className="text-[#555] text-xs uppercase tracking-wider mb-2">Homework</p>
          <p className="text-white font-serif text-3xl">{homeworkRate !== null ? `${homeworkRate}%` : '—'}</p>
          <p className="text-[#555] text-xs mt-2">{homeworkDone} of {total} weeks complete</p>
          <div className="mt-3 h-1 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${homeworkRate && homeworkRate >= 75 ? 'bg-green-500' : homeworkRate && homeworkRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${homeworkRate ?? 0}%` }}
            />
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-5">
          <p className="text-[#555] text-xs uppercase tracking-wider mb-2">Current Quarter</p>
          <p className="text-white font-serif text-3xl">Q{currentQuarter}</p>
          <p className="text-[#555] text-xs mt-2">of your 12-month blueprint</p>
        </div>
      </div>

      {/* Two columns: Blueprint + Latest Report */}
      <div className="grid grid-cols-2 gap-6">
        {/* Blueprint card */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-serif text-lg">Your Blueprint</h2>
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
                <p className="text-[#555] text-xs uppercase tracking-wider mb-1">Current Focus</p>
                <p className="text-white text-sm">Q{currentQuarter} · Months {((currentQuarter - 1) * 3) + 1}–{currentQuarter * 3}</p>
                <p className="text-[#555] text-xs mt-1">Week {Math.floor((new Date().getTime() - new Date(member.join_date).getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1} of your program</p>
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
              <p className="text-[#555] text-sm mb-3">Your blueprint is being prepared by Gogo.</p>
              <p className="text-[#444] text-xs leading-relaxed">
                It will appear here after your clarity call is reviewed.
              </p>
            </div>
          )}
        </div>

        {/* Latest report */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-serif text-lg">Latest Report</h2>
            <Link href="/dashboard/reports" className="text-[#C9A227] text-xs hover:text-[#d4ac2d]">
              All reports →
            </Link>
          </div>
          {latestReport ? (
            <div>
              <p className="text-white text-sm font-medium">{latestReport.period_label}</p>
              <p className="text-[#555] text-xs mt-1">
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
            <p className="text-[#555] text-sm">Your first report will appear here after your first month.</p>
          )}
        </div>
      </div>

      {/* Next Tuesday reminder */}
      <div className="mt-6 border border-[#C9A227]/20 bg-[#C9A227]/5 rounded p-4 flex items-center justify-between">
        <div>
          <p className="text-[#C9A227] text-sm font-medium">Tuesday Office Hours — 11am ET</p>
          <p className="text-[#888] text-xs mt-0.5">Show up. Ask questions. Do the work.</p>
        </div>
        <span className="text-[#C9A227] text-2xl">◈</span>
      </div>

      {/* Homework & Blueprint Tasks */}
      <HomeworkSection
        memberId={member.id}
        initialItems={homeworkData ?? []}
      />

      {/* Personal Notes */}
      <NotesSection
        memberId={member.id}
        initialContent={notesData?.content ?? ''}
      />
    </div>
  )
}
