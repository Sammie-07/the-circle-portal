'use client'

import { useEffect, useRef, useState } from 'react'

interface DateFieldProps {
  value: string // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  required?: boolean
  /** Allow clearing back to empty (for optional dates). Default true. */
  clearable?: boolean
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function toIso(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}
// Parse 'YYYY-MM-DD' as a local date (no timezone shift).
function parseIso(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) }
}
function formatLabel(value: string): string {
  const p = parseIso(value)
  if (!p) return ''
  return new Date(p.y, p.m, p.d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DateField({ value, onChange, className, placeholder = 'Select a date', required, clearable = true }: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const selected = parseIso(value)
  const now = new Date()
  // Month currently shown in the calendar grid.
  const [view, setView] = useState(() => ({
    y: selected?.y ?? now.getFullYear(),
    m: selected?.m ?? now.getMonth(),
  }))

  // Re-sync the visible month to the selected value each time the popover opens.
  useEffect(() => {
    if (!open) return
    const p = parseIso(value)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (p) setView({ y: p.y, m: p.m })
  }, [open, value])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const firstWeekday = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const todayIso = toIso(now.getFullYear(), now.getMonth(), now.getDate())

  function prevMonth() {
    setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  }
  function nextMonth() {
    setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))
  }
  function pick(d: number) {
    onChange(toIso(view.y, view.m, d))
    setOpen(false)
  }

  const triggerClass =
    className ??
    'w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]'

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${triggerClass} flex items-center justify-between gap-2 text-left`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? '' : 'text-[var(--text-4)]'}>{value ? formatLabel(value) : placeholder}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--text-3)]">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
      {/* Hidden input keeps native required validation working inside forms */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          className="sr-only absolute bottom-0 left-1/2 h-0 w-0 opacity-0"
        />
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-lg border border-[var(--border-color)] bg-[var(--surface)] p-3 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="w-7 h-7 rounded flex items-center justify-center text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors" aria-label="Previous month">‹</button>
            <span className="text-[var(--text)] text-sm font-medium">{MONTHS[view.m]} {view.y}</span>
            <button type="button" onClick={nextMonth} className="w-7 h-7 rounded flex items-center justify-center text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors" aria-label="Next month">›</button>
          </div>
          {/* Weekday row */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="text-center text-[10px] text-[var(--text-4)] uppercase py-1">{w}</div>
            ))}
          </div>
          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const iso = toIso(view.y, view.m, day)
              const isSelected = iso === value
              const isToday = iso === todayIso
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  className={`h-8 rounded text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#C9A227] text-[#0D0D0D] font-semibold'
                      : isToday
                        ? 'text-[#C9A227] border border-[#C9A227]/40 hover:bg-[#C9A227]/10'
                        : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-color)]">
            <button type="button" onClick={() => { onChange(todayIso); setOpen(false) }} className="text-[#C9A227] text-xs hover:underline">Today</button>
            {clearable && value && (
              <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="text-[var(--text-3)] text-xs hover:text-[#CC1F1F]">Clear</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
