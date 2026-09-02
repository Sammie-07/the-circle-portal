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

function monthShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Every month from `start` to `end` inclusive (both 'YYYY-MM'), ascending
function monthRange(start: string, end: string): string[] {
  const out: string[] = []
  let [y, m] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  if (y > ey || (y === ey && m > em)) return [end]
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

const selectClass =
  'bg-[var(--surface)] border border-[var(--border-color)] rounded text-[var(--text-2)] text-[10px] px-1.5 py-1 focus:outline-none focus:border-[#C9A227] cursor-pointer'

export default function AttendanceCard({ logs, joinDate }: { logs: Log[]; joinDate?: string }) {
  // Continuous month list from the earliest relevant month through the current
  // month (ascending), so the current month and not-yet-logged months are
  // always selectable.
  const monthsAsc = useMemo(() => {
    const now = new Date()
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const logMonths = (logs ?? []).map((l) => monthKey(l.week_of)).filter((k) => k.length === 7)
    const joinMonth = (joinDate ?? '').slice(0, 7)
    const candidates = [joinMonth, ...logMonths].filter((k) => k.length === 7).sort()
    const start = candidates[0] && candidates[0] <= current ? candidates[0] : current
    return monthRange(start, current)
  }, [logs, joinDate])

  const earliest = monthsAsc[0]
  const latest = monthsAsc[monthsAsc.length - 1]
  const monthsDesc = useMemo(() => [...monthsAsc].reverse(), [monthsAsc])

  // Default to the full span (= all time)
  const [from, setFrom] = useState(earliest)
  const [to, setTo] = useState(latest)

  // Tolerate the user picking From after To
  const lo = from <= to ? from : to
  const hi = from <= to ? to : from

  const filtered = (logs ?? []).filter((l) => {
    const k = monthKey(l.week_of)
    return k >= lo && k <= hi
  })
  const total = filtered.length
  const attended = filtered.filter((l) => l.showed_up).length
  const rate = total > 0 ? Math.round((attended / total) * 100) : null

  const isAll = lo === earliest && hi === latest
  const isSingle = lo === hi
  const rangeLabel = isAll
    ? 'All time'
    : isSingle
    ? monthLabel(lo)
    : `${monthShort(lo)} – ${monthShort(hi)}`

  const suffix = isAll ? '' : isSingle ? ' this month' : ' in range'

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] p-6">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-[var(--text-3)] text-[10px] uppercase tracking-[0.18em]">Attendance</p>
        <span className="text-[var(--text-3)] text-[10px] truncate">{rangeLabel}</span>
      </div>

      <p className="text-[var(--text)] font-serif text-[30px] leading-none">{rate !== null ? `${rate}%` : '—'}</p>
      <p className="text-[var(--text-3)] text-xs mt-2">
        {attended} of {total} Tuesday call{total === 1 ? '' : 's'}
        {suffix}
      </p>

      <div className="mt-3 h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            rate && rate >= 75 ? 'bg-green-500' : rate && rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${rate ?? 0}%` }}
        />
      </div>

      {/* From / To range selectors */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-3)]">
        <span className="uppercase tracking-wider">From</span>
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={selectClass}
          aria-label="Attendance range start month"
        >
          {monthsDesc.map((m) => (
            <option key={m} value={m}>
              {monthShort(m)}
            </option>
          ))}
        </select>
        <span className="uppercase tracking-wider">to</span>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={selectClass}
          aria-label="Attendance range end month"
        >
          {monthsDesc.map((m) => (
            <option key={m} value={m}>
              {monthShort(m)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
