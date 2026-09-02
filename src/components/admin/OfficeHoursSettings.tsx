'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

type Status = 'meeting' | 'no_meeting' | 'rescheduled'

interface Props {
  initialZoomLink: string
  weekOf: string          // this week's Tuesday (YYYY-MM-DD)
  initialStatus: Status
  initialNote: string
  initialRescheduledDate: string  // YYYY-MM-DD or ''
  initialRescheduledTime: string  // HH:MM or ''
  initialIsSet: boolean
}

const WEEKDAYS = [
  { label: 'Monday', off: 0 },
  { label: 'Tuesday', off: 1 },
  { label: 'Wednesday', off: 2 },
  { label: 'Thursday', off: 3 },
  { label: 'Friday', off: 4 },
  { label: 'Saturday', off: 5 },
  { label: 'Sunday', off: 6 },
]

function pad(n: number) { return String(n).padStart(2, '0') }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

// This week's Monday is the day before its Tuesday.
function mondayOf(weekOfTuesday: string) {
  const d = new Date(weekOfTuesday + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  return d
}
function dateForOffset(off: number, weekOfTuesday: string) {
  const d = mondayOf(weekOfTuesday)
  d.setDate(d.getDate() + off)
  return isoDate(d)
}
function offsetOfDate(dateISO: string, weekOfTuesday: string) {
  const monday = mondayOf(weekOfTuesday)
  const d = new Date(dateISO + 'T00:00:00')
  return Math.round((d.getTime() - monday.getTime()) / 86400000)
}
function fmt12h(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return hhmm
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m || 0)} ${ampm}`
}

export default function OfficeHoursSettings({ initialZoomLink, weekOf, initialStatus, initialNote, initialRescheduledDate, initialRescheduledTime, initialIsSet }: Props) {
  const router = useRouter()
  const [zoomLink, setZoomLink] = useState(initialZoomLink)
  const [savingLink, setSavingLink] = useState(false)

  const [status, setStatus] = useState<Status>(initialStatus)
  const [note, setNote] = useState(initialNote)
  const [weekday, setWeekday] = useState<number>(
    initialRescheduledDate ? offsetOfDate(initialRescheduledDate, weekOf) : 3 // default Thursday
  )
  const [time, setTime] = useState(initialRescheduledTime || '12:00')
  const [isSet, setIsSet] = useState(initialIsSet)
  const [savingWeek, setSavingWeek] = useState(false)

  const tuesdayLabel = new Date(weekOf + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const movedDateLabel = new Date(dateForOffset(weekday, weekOf) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  async function saveLink(e: React.FormEvent) {
    e.preventDefault()
    setSavingLink(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office_hours_zoom_link: zoomLink }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error ?? 'Could not save', 'error'); return }
      toast('Zoom link saved')
      router.refresh()
    } catch {
      toast('Network error — please try again', 'error')
    } finally {
      setSavingLink(false)
    }
  }

  async function saveWeek() {
    setSavingWeek(true)
    try {
      const res = await fetch('/api/office-hours-week', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          note,
          rescheduled_date: status === 'rescheduled' ? dateForOffset(weekday, weekOf) : null,
          rescheduled_time: status === 'rescheduled' ? time : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error ?? 'Could not save', 'error'); return }
      setIsSet(true)
      toast(
        status === 'meeting' ? 'Marked: meeting this week'
          : status === 'no_meeting' ? 'Marked: no meeting this week'
          : `Rescheduled to ${movedDateLabel}, ${fmt12h(time)}`
      )
      router.refresh()
    } catch {
      toast('Network error — please try again', 'error')
    } finally {
      setSavingWeek(false)
    }
  }

  const optBtn = (active: boolean, activeCls: string) =>
    `flex-1 text-sm rounded border px-3 py-2 transition-all ${active ? activeCls : 'border-[var(--border-color)] text-[var(--text-3)] hover:border-[var(--border-hover)]'}`

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] p-5 max-w-md">
      <h2 className="text-[var(--text)] font-serif text-lg mb-1">Tuesday Office Hours</h2>
      <p className="text-[var(--text-3)] text-xs mb-5">The join link members use, and whether there&apos;s a call this week.</p>

      {/* This week */}
      <div className="mb-6">
        <p className="text-xs text-[var(--text-2)] uppercase tracking-wider mb-2">This week ({tuesdayLabel})</p>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={() => setStatus('meeting')} className={optBtn(status === 'meeting', 'border-green-500/40 bg-green-500/10 text-green-400')}>
              ✓ Meeting as usual
            </button>
            <button type="button" onClick={() => setStatus('no_meeting')} className={optBtn(status === 'no_meeting', 'border-[#CC1F1F]/40 bg-[#CC1F1F]/10 text-[#CC1F1F]')}>
              ✗ No meeting
            </button>
          </div>
          <button type="button" onClick={() => setStatus('rescheduled')} className={optBtn(status === 'rescheduled', 'border-[#C9A227]/50 bg-[#C9A227]/10 text-[#C9A227]')}>
            ↻ Rescheduled this week
          </button>
        </div>

        {/* Rescheduled day + time */}
        {status === 'rescheduled' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">New day</label>
              <select
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
              >
                {WEEKDAYS.map((w) => <option key={w.off} value={w.off}>{w.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-1">New time (ET)</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
              />
            </div>
            <p className="col-span-2 text-[var(--text-4)] text-[10px]">
              Members will see the call moved to <span className="text-[#C9A227]">{movedDateLabel} at {fmt12h(time)} ET</span>.
            </p>
          </div>
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            status === 'no_meeting' ? 'Optional reason members will see…'
              : status === 'rescheduled' ? 'Optional note (e.g. why it moved)…'
              : 'Optional note (e.g. special guest)…'
          }
          className="mt-2 w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={saveWeek}
            disabled={savingWeek}
            className="bg-[#C9A227] text-[#090909] text-sm font-medium px-5 py-2 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
          >
            {savingWeek ? 'Saving…' : 'Save this week'}
          </button>
          {!isSet && <span className="text-[var(--text-4)] text-xs">Not set yet — defaults to a meeting.</span>}
        </div>
      </div>

      <div className="h-px bg-[var(--border-color)] mb-5" />

      {/* Zoom link */}
      <form onSubmit={saveLink}>
        <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5">Zoom join link</label>
        <input
          value={zoomLink}
          onChange={(e) => setZoomLink(e.target.value)}
          placeholder="https://us02web.zoom.us/j/…"
          className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
        />
        <p className="text-[var(--text-4)] text-xs mt-1.5">Shown to members as the &ldquo;Join the Zoom&rdquo; button on the call day.</p>
        <button
          type="submit"
          disabled={savingLink}
          className="mt-3 border border-[var(--border-color)] text-[var(--text-2)] text-sm px-5 py-2 rounded hover:border-[#C9A227] hover:text-[var(--text)] transition-colors disabled:opacity-40"
        >
          {savingLink ? 'Saving…' : 'Save link'}
        </button>
      </form>
    </div>
  )
}
