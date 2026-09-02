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

const heroClass = 'relative overflow-hidden rounded-[18px] border border-[var(--border-2)] px-[34px] py-8'
const heroGlow = { background: 'radial-gradient(120% 140% at 100% 0%, var(--gold-soft) 0%, rgba(0,0,0,0) 62%), var(--surface)' } as React.CSSProperties
const joinBtn = 'inline-flex items-center rounded-full bg-[var(--gold)] text-[#0B0B0B] text-[13px] font-medium px-[22px] py-[11px] hover:brightness-110 transition-all'

function LiveTag({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-[18px]">
      <span className="w-1.5 h-1.5 rounded-full tc-pulse" style={{ background: 'var(--red)' }} />
      <span className="text-[10px] tracking-[0.24em] uppercase" style={{ color: 'var(--red-text)' }}>{text}</span>
    </div>
  )
}
function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-[32px] leading-[1.15] text-[var(--text)] mb-2.5" style={{ letterSpacing: '-0.01em' }}>{children}</h2>
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
        <section className="rounded-[18px] border border-[var(--border-color)] bg-[var(--surface)] px-[34px] py-8">
          <p className="text-[10px] tracking-[0.24em] uppercase text-[var(--text-3)] mb-[18px]">Office Hours</p>
          <Heading>No call this week</Heading>
          <p className="text-sm text-[var(--text-2)] max-w-[44ch]" style={{ textWrap: 'pretty' }}>
            {note?.trim() ? note : 'There is no Tuesday Office Hours this week. See you next Tuesday at 12 noon ET.'}
          </p>
        </section>
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
          <section className={heroClass} style={heroGlow}>
            <LiveTag text="Live today" />
            <Heading>Office Hours (rescheduled)</Heading>
            <p className="text-sm text-[var(--text-2)] max-w-[44ch] mb-[26px]" style={{ textWrap: 'pretty' }}>
              The call moved to today, {fmt12h(rescheduledTime)} ET. {note?.trim() ? note : 'Show up. Ask questions. Do the work.'}
            </p>
            <a href={zoomLink} target="_blank" rel="noopener noreferrer" className={joinBtn}>Join the Zoom →</a>
          </section>
        ) : (
          <section className={heroClass} style={heroGlow}>
            <p className="text-[10px] tracking-[0.24em] uppercase text-[var(--gold-text)] mb-[18px]">Rescheduled this week</p>
            <Heading>Office Hours moved this week</Heading>
            <p className="text-sm text-[var(--text-2)] max-w-[48ch]" style={{ textWrap: 'pretty' }}>
              This week&apos;s call is on <strong className="text-[var(--text)] font-medium">{movedWhen}</strong>{note?.trim() ? ` — ${note}` : '.'} The join button appears here that day.
            </p>
          </section>
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
      <section className={heroClass} style={heroGlow}>
        <LiveTag text="Live now" />
        <Heading>Tuesday Office Hours</Heading>
        <p className="text-sm text-[var(--text-2)] max-w-[44ch] mb-[26px]" style={{ textWrap: 'pretty' }}>
          It&apos;s live today at 12 noon ET with Gogo. Show up. Ask questions. Do the work.
        </p>
        <a href={zoomLink} target="_blank" rel="noopener noreferrer" className={joinBtn}>Join the Zoom →</a>
      </section>
    )
  }

  // ── Normal week, not Tuesday yet ──────────────────────────────────────
  return (
    <section className={heroClass} style={heroGlow}>
      <p className="text-[10px] tracking-[0.24em] uppercase text-[var(--gold-text)] mb-[18px]">This Tuesday · 12 noon ET</p>
      <Heading>Tuesday Office Hours</Heading>
      <p className="text-sm text-[var(--text-2)] max-w-[44ch]" style={{ textWrap: 'pretty' }}>
        12 noon ET with Gogo. Show up, ask questions, do the work. The join button appears here on Tuesday.
      </p>
    </section>
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
        <button onClick={onDismiss} className="bg-[#C9A227] text-[#090909] text-sm font-medium px-6 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors">
          Got it
        </button>
      </div>
    </div>
  )
}
