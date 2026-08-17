'use client'

import { useEffect, useState } from 'react'

type Status = 'meeting' | 'no_meeting' | 'rescheduled'

interface Props {
  status: Status
  isMeetingDay: boolean          // is today the day the call actually happens this week
  note: string | null
  zoomLink: string
  tuesdayISO: string
  rescheduledDate: string | null // YYYY-MM-DD
  rescheduledTime: string | null // HH:MM (ET)
}

function fmt12h(hhmm: string | null) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return hhmm
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`
}
function fmtDay(dateISO: string | null) {
  if (!dateISO) return ''
  return new Date(dateISO + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function OfficeHoursCard({ status, isMeetingDay, note, zoomLink, tuesdayISO, rescheduledDate, rescheduledTime }: Props) {
  // Announcement popup for a changed week (no meeting OR rescheduled) — shown once
  // per week. Decided after mount to avoid an SSR hydration mismatch.
  const changed = status === 'no_meeting' || status === 'rescheduled'
  const [showPopup, setShowPopup] = useState(false)
  useEffect(() => {
    if (!changed) return
    if (window.localStorage.getItem(`oh-${status}-dismissed-${tuesdayISO}`) !== '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowPopup(true)
    }
  }, [changed, status, tuesdayISO])

  function dismiss() {
    setShowPopup(false)
    try { window.localStorage.setItem(`oh-${status}-dismissed-${tuesdayISO}`, '1') } catch {}
  }

  const movedWhen = `${fmtDay(rescheduledDate)} at ${fmt12h(rescheduledTime)} ET`

  // ── No meeting this week ───────────────────────────────────────────────
  if (status === 'no_meeting') {
    return (
      <>
        <div className="mt-6 border border-[var(--border-color)] bg-[var(--surface)] rounded p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[var(--text-2)] text-sm font-medium">No Office Hours this week</p>
            <p className="text-[var(--text-3)] text-xs mt-0.5">
              {note?.trim() ? note : 'There is no Tuesday call this week. See you next Tuesday at 12 noon ET.'}
            </p>
          </div>
          <span className="text-[var(--text-3)] text-2xl flex-shrink-0">⊘</span>
        </div>
        {showPopup && (
          <Popup icon="📣" title="No Office Hours this week" onDismiss={dismiss}>
            {note?.trim() ? note : 'Heads up, there is no Tuesday Office Hours call this week. We will be back next Tuesday at 12 noon ET.'}
          </Popup>
        )}
      </>
    )
  }

  // ── Rescheduled this week ─────────────────────────────────────────────
  if (status === 'rescheduled') {
    return (
      <>
        {isMeetingDay ? (
          <div className="mt-6 border border-[#C9A227]/30 bg-[#C9A227]/5 rounded p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[#C9A227] text-sm font-medium">Office Hours are live today — {fmt12h(rescheduledTime)} ET (rescheduled)</p>
              <p className="text-[var(--text-2)] text-xs mt-0.5">{note?.trim() ? note : 'The call moved to today this week. Show up. Ask questions.'}</p>
            </div>
            <a href={zoomLink} target="_blank" rel="noopener noreferrer" className="bg-[#C9A227] text-[#0D0D0D] font-semibold text-sm px-5 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors flex-shrink-0">
              Join the Zoom →
            </a>
          </div>
        ) : (
          <div className="mt-6 border border-[#C9A227]/30 bg-[#C9A227]/5 rounded p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[#C9A227] text-sm font-medium">Office Hours moved this week</p>
              <p className="text-[var(--text-2)] text-xs mt-0.5">
                This week&apos;s call is on <strong className="text-[var(--text)]">{movedWhen}</strong>{note?.trim() ? ` — ${note}` : '.'} The join button appears here that day.
              </p>
            </div>
            <span className="text-[#C9A227] text-2xl flex-shrink-0">↻</span>
          </div>
        )}
        {showPopup && (
          <Popup icon="↻" title="Office Hours moved this week" onDismiss={dismiss}>
            {`This week's Office Hours are rescheduled to ${movedWhen}.${note?.trim() ? ` ${note}` : ''}`}
          </Popup>
        )}
      </>
    )
  }

  // ── Meeting as usual — Tuesday shows the Join button ──────────────────
  if (isMeetingDay) {
    return (
      <div className="mt-6 border border-[#C9A227]/30 bg-[#C9A227]/5 rounded p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[#C9A227] text-sm font-medium">Office Hours are live today — 12 noon ET</p>
          <p className="text-[var(--text-2)] text-xs mt-0.5">Show up. Ask questions. Do the work.</p>
        </div>
        <a href={zoomLink} target="_blank" rel="noopener noreferrer" className="bg-[#C9A227] text-[#0D0D0D] font-semibold text-sm px-5 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors flex-shrink-0">
          Join the Zoom →
        </a>
      </div>
    )
  }

  // ── Normal week, not Tuesday yet ──────────────────────────────────────
  return (
    <div className="mt-6 border border-[#C9A227]/20 bg-[#C9A227]/5 rounded p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-[#C9A227] text-sm font-medium">Tuesday Office Hours — 12 noon ET</p>
        <p className="text-[var(--text-2)] text-xs mt-0.5">Show up. Ask questions. Do the work. The join button appears here Tuesday.</p>
      </div>
      <span className="text-[#C9A227] text-2xl flex-shrink-0">◈</span>
    </div>
  )
}

function Popup({ icon, title, children, onDismiss }: { icon: string; title: string; children: React.ReactNode; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onDismiss} />
      <div className="relative bg-[var(--surface)] border border-[var(--border-color)] rounded-lg max-w-sm w-full p-6 text-center shadow-2xl">
        <div className="w-12 h-12 rounded-full border border-[#C9A227]/40 bg-[#C9A227]/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-[#C9A227] text-xl">{icon}</span>
        </div>
        <h2 className="text-[var(--text)] font-serif text-xl mb-2">{title}</h2>
        <p className="text-[var(--text-2)] text-sm leading-relaxed mb-5">{children}</p>
        <button onClick={onDismiss} className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-6 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors">
          Got it
        </button>
      </div>
    </div>
  )
}
