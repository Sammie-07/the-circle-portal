'use client'

import { useEffect, useState } from 'react'
import Confetti from './Confetti'

interface Achievement {
  id: string
  key: string
  title: string
  body: string
  emoji: string
  tier: 'small' | 'milestone'
  badgeKey?: string | null
}

// Pops a confetti celebration for any achievements the member has earned but not
// yet seen. Fetched on portal load; cycles one card at a time; marks everything
// seen when the member closes it so it never re-fires. Positive reinforcement,
// not a blocker — dismissible by button or backdrop.
//
// Test accounts get a demo experience: the API returns ALL their achievements
// (so they can run the whole set) plus a tester-only Replay button, and closing
// does NOT mark them seen — so it can be replayed. Real members never see the
// Replay button and their cards are marked seen on close.
export default function AchievementGate() {
  const [items, setItems] = useState<Achievement[] | null>(null)
  const [isTester, setIsTester] = useState(false)
  const [idx, setIdx] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/achievements/me')
      .then((r) => r.json())
      .then((d: { achievements?: Achievement[]; isTester?: boolean }) => {
        if (cancelled) return
        setIsTester(!!d.isTester)
        if (d.achievements && d.achievements.length > 0) {
          setItems(d.achievements)
          setOpen(true)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  function close() {
    setOpen(false)
    // Testers keep their cards unseen so the set can be replayed anytime.
    if (!isTester && items && items.length > 0) {
      fetch('/api/achievements/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: items.map((a) => a.id) }),
      }).catch(() => {})
    }
  }

  if (!open || !items || items.length === 0) return null
  const current = items[idx]
  if (!current) return null
  const isLast = idx >= items.length - 1
  const isMilestone = current.tier === 'milestone'

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Achievement unlocked: ${current.title}`}
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={close}
    >
      {/* Confetti re-mounts per card so each one bursts. */}
      <div key={idx} className="pointer-events-none absolute inset-0"><Confetti /></div>

      <div
        className="relative w-full max-w-[440px] rounded-[22px] border text-center px-8 pt-10 pb-8 tc-rise"
        style={{
          borderColor: isMilestone ? 'var(--gold-line)' : 'var(--border-2)',
          background: 'radial-gradient(120% 130% at 50% 0%, var(--gold-soft) 0%, rgba(0,0,0,0) 60%), var(--surface)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.length > 1 && (
          <p className="absolute top-4 right-5 text-[11px] text-[var(--text-4)]">{idx + 1} of {items.length}</p>
        )}
        {isTester && (
          <p className="absolute top-4 left-5 text-[9px] tracking-[0.2em] uppercase text-[var(--text-4)]">Test mode</p>
        )}

        <div
          className="w-[84px] h-[84px] rounded-full flex items-center justify-center mx-auto mb-6 text-[40px]"
          style={{ border: '1px solid var(--gold-line)', background: 'var(--gold-soft)', boxShadow: '0 0 40px rgba(201,162,39,0.18)' }}
        >
          <span>{current.emoji}</span>
        </div>

        <p className="text-[10px] tracking-[0.28em] uppercase mb-3" style={{ color: 'var(--gold-text)' }}>
          {isMilestone ? 'Milestone unlocked' : 'Nice work'}
        </p>
        <h2 className="font-serif text-[28px] leading-tight text-[var(--text)] mb-3">{current.title}</h2>
        <p className="text-[14px] leading-[1.65] text-[var(--text-2)] max-w-[34ch] mx-auto" style={{ textWrap: 'pretty' }}>
          {current.body}
        </p>

        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            onClick={() => (isLast ? close() : setIdx((i) => i + 1))}
            className="inline-flex items-center justify-center rounded-full bg-[var(--gold)] text-[#0B0B0B] text-[13px] font-medium px-7 py-3 hover:brightness-110 transition-all"
          >
            {isLast ? (isTester ? 'Done' : "Let's keep going") : 'Next →'}
          </button>

          {/* Tester-only — re-experience the whole set from the top. */}
          {isTester && (
            <button
              onClick={() => setIdx(0)}
              className="inline-flex items-center justify-center rounded-full border text-[13px] px-5 py-3 text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
              style={{ borderColor: 'var(--border-2)' }}
            >
              ↻ Replay
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
