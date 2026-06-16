'use client'

import Link from 'next/link'

interface MemberRow {
  id: string
  name: string
  email: string
  status: string
  invited_at: string | null
  cohort: string | null
  join_date: string
  calls_attended: number
  calls_total: number
  attendance_rate: number | null
  homework_rate: number | null
  last_active: string | null
}

// Health = a single readable signal combining attendance and homework, so the
// admin can scan the roster for who needs attention without reading both numbers.
function healthInfo(attendance: number | null, homework: number | null) {
  const vals = [attendance, homework].filter((v): v is number => v !== null)
  if (vals.length === 0) return { label: 'No data', text: 'text-[var(--text-3)]', dot: 'bg-[var(--border-color)]' }
  const score = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  if (score >= 75) return { label: 'On track', text: 'text-green-400', dot: 'bg-green-500' }
  if (score >= 50) return { label: 'Watch', text: 'text-yellow-400', dot: 'bg-yellow-500' }
  return { label: 'At risk', text: 'text-red-400', dot: 'bg-red-500' }
}

// Status reflects TWO things: membership state (active/paused/graduated) and,
// for active members, whether they've actually been sent their login invite.
// A member created but not yet invited shows "Not invited", not "Active".
function statusInfo(status: string, invitedAt: string | null) {
  if (status === 'graduated') return { label: 'Graduated', cls: 'bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/25' }
  if (status === 'inactive') return { label: 'Paused', cls: 'bg-red-500/10 text-red-400 border border-red-500/25' }
  if (invitedAt) return { label: 'Active', cls: 'bg-green-500/10 text-green-400 border border-green-500/25' }
  return { label: 'Not invited', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/30' }
}

export default function MembersTable({ members }: { members: MemberRow[] }) {
  if (members.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-[var(--border-color)] rounded">
        <p className="text-[var(--text-3)] text-sm">No members yet.</p>
        <p className="text-[var(--text-4)] text-xs mt-1">Use the Invite Member button to add your first Circle member.</p>
      </div>
    )
  }

  return (
    <div className="border border-[var(--border-color)] rounded overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-[var(--border-color)] bg-[var(--surface-2)]">
            <th className="text-left px-5 py-3 text-[var(--text-3)] text-xs uppercase tracking-wider font-normal">Member</th>
            <th className="text-left px-4 py-3 text-[var(--text-3)] text-xs uppercase tracking-wider font-normal">Status</th>
            <th className="text-left px-4 py-3 text-[var(--text-3)] text-xs uppercase tracking-wider font-normal">Cohort</th>
            <th className="text-left px-4 py-3 text-[var(--text-3)] text-xs uppercase tracking-wider font-normal">Attendance</th>
            <th className="text-left px-4 py-3 text-[var(--text-3)] text-xs uppercase tracking-wider font-normal">Homework</th>
            <th className="text-left px-4 py-3 text-[var(--text-3)] text-xs uppercase tracking-wider font-normal">Health</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {members.map((member, i) => (
            <tr
              key={member.id}
              className={`border-b border-[var(--border-color)] hover:bg-[var(--surface)]/50 transition-colors ${i === members.length - 1 ? 'border-b-0' : ''}`}
            >
              <td className="px-5 py-4">
                <p className="text-[var(--text)] font-medium">{member.name}</p>
                <p className="text-[var(--text-3)] text-xs mt-0.5">{member.email}</p>
              </td>
              <td className="px-4 py-4">
                {(() => {
                  const s = statusInfo(member.status, member.invited_at)
                  return <span className={`text-xs px-2 py-0.5 rounded-sm whitespace-nowrap ${s.cls}`}>{s.label}</span>
                })()}
              </td>
              <td className="px-4 py-4 text-[var(--text-2)] text-xs">
                {member.cohort ?? '—'}
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text)] text-sm">
                    {member.calls_total > 0 ? `${member.calls_attended}/${member.calls_total}` : '—'}
                  </span>
                  {member.attendance_rate !== null && (
                    <span className="text-[var(--text-3)] text-xs">({member.attendance_rate}%)</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-4">
                <span className="text-[var(--text)] text-sm">
                  {member.homework_rate !== null ? `${member.homework_rate}%` : '—'}
                </span>
              </td>
              <td className="px-4 py-4">
                {(() => {
                  const h = healthInfo(member.attendance_rate, member.homework_rate)
                  return (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className={`w-2 h-2 rounded-full ${h.dot}`} />
                      <span className={`text-xs ${h.text}`}>{h.label}</span>
                    </span>
                  )
                })()}
              </td>
              <td className="px-4 py-4 text-right">
                <div className="flex items-center justify-end gap-3">
                  <a
                    href={`/api/admin/impersonate?member=${member.id}`}
                    className="text-xs text-[var(--text-3)] hover:text-[#C9A227] transition-colors"
                  >
                    Access Member&apos;s View
                  </a>
                  <Link
                    href={`/admin/member/${member.id}`}
                    className="text-xs text-[#C9A227] hover:text-[#d4ac2d] transition-colors"
                  >
                    View →
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
