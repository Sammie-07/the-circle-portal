'use client'

import { useMemo, useState } from 'react'

type Log = { week_of: string; showed_up: boolean }

function monthKey(weekOf: string): string {
  // week_of is 'YYYY-MM-DD' — slice the year-month directly to avoid timezone shifts
  return (weekOf ?? '').slice(0, 7)
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function AttendanceCard({ logs }: { logs: Log[] }) {
  // Distinct months present in the logs, most recent first
  const months = useMemo(() => {
    const set = new Set(
      (logs ?? []).map((l) => monthKey(l.week_of)).filter((k) => k.length === 7)
    )
    return Array.from(set).sort().reverse()
  }, [logs])

  const [selected, setSelected] = useState<string>('all')

  const filtered =
    selected === 'all' ? logs ?? [] : (logs ?? []).filter((l) => monthKey(l.week_of) === selected)

  const total = filtered.length
  const attended = filtered.filter((l) => l.showed_up).length
  const rate = total > 0 ? Math.round((attended / total) * 100) : null

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-5">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-[var(--text-3)] text-xs uppercase tracking-wider">Attendance</p>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border-color)] rounded text-[var(--text-2)] text-[10px] px-1.5 py-1 max-w-[110px] focus:outline-none focus:border-[#C9A227] cursor-pointer"
          aria-label="Filter attendance by month"
        >
          <option value="all">All time</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <p className="text-[var(--text)] font-serif text-3xl">{rate !== null ? `${rate}%` : '—'}</p>
      <p className="text-[var(--text-3)] text-xs mt-2">
        {attended} of {total} Tuesday call{total === 1 ? '' : 's'}
        {selected === 'all' ? '' : ' this month'}
      </p>

      <div className="mt-3 h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            rate && rate >= 75 ? 'bg-green-500' : rate && rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${rate ?? 0}%` }}
        />
      </div>
    </div>
  )
}
