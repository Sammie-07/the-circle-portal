'use client'

import { useEffect, useState } from 'react'

interface Props {
  isTuesday: boolean
  hasMeeting: boolean
  note: string | null
  zoomLink: string
  tuesdayISO: string
}

export default function OfficeHoursCard({ isTuesday, hasMeeting, note, zoomLink, tuesdayISO }: Props) {
  // No-meeting announcement popup — shown once per week (dismissal remembered).
  // Decided after mount to avoid an SSR hydration mismatch on the localStorage read.
  const [showPopup, setShowPopup] = useState(false)
  useEffect(() => {
    if (hasMeeting) return
    if (window.localStorage.getItem(`oh-nomeeting-dismissed-${tuesdayISO}`) !== '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowPopup(true)
    }
  }, [hasMeeting, tuesdayISO])

  function dismiss() {
    setShowPopup(false)
    try { window.localStorage.setItem(`oh-nomeeting-dismissed-${tuesdayISO}`, '1') } catch {}
  }

  // ── No meeting this week ───────────────────────────────────────────────
  if (!hasMeeting) {
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={dismiss} />
            <div className="relative bg-[var(--surface)] border border-[var(--border-color)] rounded-lg max-w-sm w-full p-6 text-center shadow-2xl">
              <div className="w-12 h-12 rounded-full border border-[#C9A227]/40 bg-[#C9A227]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-[#C9A227] text-xl">📣</span>
              </div>
              <h2 className="text-[var(--text)] font-serif text-xl mb-2">No Office Hours this week</h2>
              <p className="text-[var(--text-2)] text-sm leading-relaxed mb-5">
                {note?.trim() ? note : 'Heads up, there is no Tuesday Office Hours call this week. We will be back next Tuesday at 12 noon ET.'}
              </p>
              <button
                onClick={dismiss}
                className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-6 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── Meeting day (Tuesday) — show the Join button ──────────────────────
  if (isTuesday) {
    return (
      <div className="mt-6 border border-[#C9A227]/30 bg-[#C9A227]/5 rounded p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[#C9A227] text-sm font-medium">Office Hours are live today — 12 noon ET</p>
          <p className="text-[var(--text-2)] text-xs mt-0.5">Show up. Ask questions. Do the work.</p>
        </div>
        <a
          href={zoomLink}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#C9A227] text-[#0D0D0D] font-semibold text-sm px-5 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors flex-shrink-0"
        >
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
