import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import MemberProfileCard from '@/components/shared/MemberProfileCard'
import WeeklyLogForm from '@/components/admin/WeeklyLogForm'
import WeeklyLogsEditor from '@/components/admin/WeeklyLogsEditor'
import MemberReportPanel from '@/components/admin/MemberReportPanel'
import BlueprintPanel from '@/components/admin/BlueprintPanel'
import ClarityCallsPanel from '@/components/admin/ClarityCallsPanel'
import MemberDocumentsPanel from '@/components/admin/MemberDocumentsPanel'
import MemberPaymentsPanel from '@/components/admin/MemberPaymentsPanel'
import HomeworkPanel from '@/components/admin/HomeworkPanel'
import SendInviteButton from '@/components/admin/SendInviteButton'
import CheckinLinkButton from '@/components/admin/CheckinLinkButton'
import SigninLinkButton from '@/components/admin/SigninLinkButton'
import EditMemberButton from '@/components/admin/EditMemberButton'
import MemberStatusButton from '@/components/admin/MemberStatusButton'
import DeleteMemberButton from '@/components/admin/DeleteMemberButton'
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

  const admin = createAdminClient()
  const { data: headshot } = await admin
    .from('member_documents')
    .select('id')
    .eq('member_id', id)
    .eq('doc_type', 'headshot')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const headshotUrl = headshot?.id ? `/api/member-documents/${headshot.id}/download` : null

  // NOTE: GHL application answers are intentionally NOT shown anywhere in the
  // portal (member or admin). They live only in the `applications` table and are
  // consumed server-side to auto-inject financial tasks when a member's blueprint
  // is generated. See src/lib/apply-financial-rules.ts.

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
    <div className="p-4 sm:p-8 max-w-7xl">
      {/* Breadcrumb */}
      <Link href="/admin" className="text-[var(--text-3)] text-xs hover:text-[#C9A227] transition-colors">
        ← All Members
      </Link>

      {/* Member header */}
      <div className="mt-4 mb-8">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-start gap-6">
          <div className="flex-1 min-w-0">
            <MemberProfileCard
              name={member.name}
              email={member.email}
              cohort={member.cohort}
              joinDate={member.join_date}
              city={member.city}
              instagram={member.instagram}
              website={member.website}
              bio={member.bio}
              headshotUrl={headshotUrl}
              membershipStatus={member.status ?? null}
            />
          </div>
          <div className="text-right space-y-2 lg:w-64 shrink-0">
            <p className={`text-sm font-medium ${health.color}`}>{health.label}</p>
            <p className="text-[var(--text-3)] text-xs">Member since {new Date(member.join_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            <div className="flex flex-wrap justify-end items-center gap-2 pt-1">
              <a
                href={`/api/admin/impersonate?member=${id}`}
                className="text-xs border border-[var(--border-color)] text-[var(--text-2)] px-3 py-1.5 rounded hover:border-[#C9A227] hover:text-[#C9A227] transition-colors"
              >
                Access Member&apos;s View
              </a>
              {member.email && (
                <SendInviteButton email={member.email} memberName={member.name} />
              )}
              <CheckinLinkButton memberId={id} />
              {member.email && <SigninLinkButton email={member.email} />}
              <EditMemberButton
                member={{
                  id: member.id,
                  name: member.name,
                  email: member.email,
                  cohort: member.cohort ?? null,
                  status: member.status ?? null,
                  phone: member.phone ?? null,
                  city: member.city ?? null,
                  instagram: member.instagram ?? null,
                  website: member.website ?? null,
                  bio: member.bio ?? null,
                }}
              />
              <MemberStatusButton memberId={id} memberName={member.name} status={member.status ?? null} />
            </div>
            <div className="pt-3 border-t border-[var(--border-color)]/50 mt-3 flex justify-end">
              <DeleteMemberButton memberId={id} memberName={member.name} />
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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

      {/* Homework & Tasks — FIRST so progress is front-and-center */}
      <div className="mb-6">
        <HomeworkPanel memberId={id} />
      </div>

      {/* Log This Week + Reports — the small panels, side by side near the top */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly Log Form */}
        <div>
          <h2 className="text-[var(--text)] font-serif text-lg mb-4">Log This Week</h2>
          <WeeklyLogForm memberId={id} />

          {/* Past logs — editable inline */}
          {allLogs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[var(--text-2)] text-xs uppercase tracking-wider mb-3">Recent Weeks <span className="text-[var(--text-4)] normal-case tracking-normal">· tap to edit</span></h3>
              <WeeklyLogsEditor memberId={id} logs={allLogs} />
            </div>
          )}
        </div>

        {/* Report Panel */}
        <div>
          <h2 className="text-[var(--text)] font-serif text-lg mb-4">Reports</h2>
          <MemberReportPanel memberId={id} memberName={member.name} memberEmail={member.email ?? null} reports={reports ?? []} />
        </div>
      </div>

      {/* Blueprint */}
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

      {/* Clarity Calls */}
      <div className="mb-6">
        <ClarityCallsPanel memberId={member.id} />
      </div>

      {/* Documents */}
      <div className="mb-6">
        <MemberDocumentsPanel memberId={member.id} />
      </div>

      {/* Payments — LAST (admin only) */}
      <div className="mb-6">
        <MemberPaymentsPanel memberId={member.id} programStart={member.join_date ?? null} />
      </div>
    </div>
  )
}
