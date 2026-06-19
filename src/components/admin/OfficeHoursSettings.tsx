'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

interface Props {
  initialZoomLink: string
  weekOf: string          // this week's Tuesday (YYYY-MM-DD)
  initialHasMeeting: boolean
  initialNote: string
  initialIsSet: boolean
}

export default function OfficeHoursSettings({ initialZoomLink, weekOf, initialHasMeeting, initialNote, initialIsSet }: Props) {
  const router = useRouter()
  const [zoomLink, setZoomLink] = useState(initialZoomLink)
  const [savingLink, setSavingLink] = useState(false)

  const [hasMeeting, setHasMeeting] = useState(initialHasMeeting)
  const [note, setNote] = useState(initialNote)
  const [isSet, setIsSet] = useState(initialIsSet)
  const [savingWeek, setSavingWeek] = useState(false)

  const tuesdayLabel = new Date(weekOf + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

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
        body: JSON.stringify({ has_meeting: hasMeeting, note }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error ?? 'Could not save', 'error'); return }
      setIsSet(true)
      toast(hasMeeting ? 'Marked: meeting this week' : 'Marked: no meeting this week')
      router.refresh()
    } catch {
      toast('Network error — please try again', 'error')
    } finally {
      setSavingWeek(false)
    }
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-5 max-w-md">
      <h2 className="text-[var(--text)] font-serif text-lg mb-1">Tuesday Office Hours</h2>
      <p className="text-[var(--text-3)] text-xs mb-5">The join link members use, and whether there&apos;s a call this week.</p>

      {/* This week toggle */}
      <div className="mb-6">
        <p className="text-xs text-[var(--text-2)] uppercase tracking-wider mb-2">This week ({tuesdayLabel})</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setHasMeeting(true)}
            className={`flex-1 text-sm rounded border px-3 py-2 transition-all ${hasMeeting ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-[var(--border-color)] text-[var(--text-3)] hover:border-[var(--border-hover)]'}`}
          >
            ✓ Meeting as usual
          </button>
          <button
            type="button"
            onClick={() => setHasMeeting(false)}
            className={`flex-1 text-sm rounded border px-3 py-2 transition-all ${!hasMeeting ? 'border-[#CC1F1F]/40 bg-[#CC1F1F]/10 text-[#CC1F1F]' : 'border-[var(--border-color)] text-[var(--text-3)] hover:border-[var(--border-hover)]'}`}
          >
            ✗ No meeting this week
          </button>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={hasMeeting ? 'Optional note (e.g. special guest)…' : 'Optional reason members will see…'}
          className="mt-2 w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={saveWeek}
            disabled={savingWeek}
            className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-5 py-2 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
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
        <p className="text-[var(--text-4)] text-xs mt-1.5">Shown to members as the &ldquo;Join the Zoom&rdquo; button on Tuesdays.</p>
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
