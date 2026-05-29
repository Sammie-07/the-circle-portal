'use client'

import Link from 'next/link'

interface MemberRow {
  id: string
  name: string
  email: string
  status: string
  cohort: string | null
  join_date: string
  calls_attended: number
  calls_total: number
  attendance_rate: number | null
  homework_rate: number | null
  last_active: string | null
}

function HealthDot({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="w-2 h-2 rounded-full bg-[#2A2A2A] inline-block" />
  if (rate >= 75) return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
  if (rate >= 50) return <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
  return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400 border border-green-500/20',
    inactive: 'bg-red-500/10 text-red-400 border border-red-500/20',
    graduated: 'bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/20',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-sm ${styles[status] ?? styles.inactive}`}>
      {status}
    </span>
  )
}

export default function MembersTable({ members }: { members: MemberRow[] }) {
  if (members.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-[#2A2A2A] rounded">
        <p className="text-[#555] text-sm">No members yet.</p>
        <p className="text-[#444] text-xs mt-1">Use the Invite Member button to add your first Circle member.</p>
      </div>
    )
  }

  return (
    <div className="border border-[#2A2A2A] rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2A2A2A] bg-[#111]">
            <th className="text-left px-5 py-3 text-[#555] text-xs uppercase tracking-wider font-normal">Member</th>
            <th className="text-left px-4 py-3 text-[#555] text-xs uppercase tracking-wider font-normal">Status</th>
            <th className="text-left px-4 py-3 text-[#555] text-xs uppercase tracking-wider font-normal">Cohort</th>
            <th className="text-left px-4 py-3 text-[#555] text-xs uppercase tracking-wider font-normal">Attendance</th>
            <th className="text-left px-4 py-3 text-[#555] text-xs uppercase tracking-wider font-normal">Homework</th>
            <th className="text-left px-4 py-3 text-[#555] text-xs uppercase tracking-wider font-normal">Health</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {members.map((member, i) => (
            <tr
              key={member.id}
              className={`border-b border-[#2A2A2A] hover:bg-[#1A1A1A]/50 transition-colors ${i === members.length - 1 ? 'border-b-0' : ''}`}
            >
              <td className="px-5 py-4">
                <p className="text-white font-medium">{member.name}</p>
                <p className="text-[#555] text-xs mt-0.5">{member.email}</p>
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={member.status} />
              </td>
              <td className="px-4 py-4 text-[#888] text-xs">
                {member.cohort ?? '—'}
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm">
                    {member.calls_total > 0 ? `${member.calls_attended}/${member.calls_total}` : '—'}
                  </span>
                  {member.attendance_rate !== null && (
                    <span className="text-[#555] text-xs">({member.attendance_rate}%)</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-4">
                <span className="text-white text-sm">
                  {member.homework_rate !== null ? `${member.homework_rate}%` : '—'}
                </span>
              </td>
              <td className="px-4 py-4">
                <HealthDot rate={member.attendance_rate} />
              </td>
              <td className="px-4 py-4 text-right">
                <Link
                  href={`/admin/member/${member.id}`}
                  className="text-xs text-[#C9A227] hover:text-[#d4ac2d] transition-colors"
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
