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
      style={{ background: 'radial-gradient(120% 90% at 50% 30%, rgba(201,162,39,0.14) 0%, rgba(0,0,0,0.82) 55%)' }}
      onClick={close}
    >
      {/* Confetti re-mounts per card so each one bursts fresh. */}
      <div key={`c-${idx}`} className="pointer-events-none absolute inset-0"><Confetti /></div>

      <div
        key={`card-${idx}`}
        className="relative w-full max-w-[460px] rounded-[26px] overflow-hidden text-center px-8 pt-9 pb-8"
        style={{
          background: 'linear-gradient(180deg, rgba(20,18,14,0.98), var(--surface))',
          border: '1px solid transparent',
          backgroundImage:
            'linear-gradient(180deg, rgba(22,19,14,0.98), var(--surface)), linear-gradient(160deg, var(--gold), rgba(201,162,39,0.15) 40%, rgba(255,255,255,0.05))',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          boxShadow: isMilestone
            ? '0 30px 90px rgba(0,0,0,0.6), 0 0 60px rgba(201,162,39,0.12)'
            : '0 24px 80px rgba(0,0,0,0.55)',
          animation: 'achv-pop .5s cubic-bezier(.2,.9,.3,1.25) both',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Shine sweep across the card */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0"
          style={{
            left: 0,
            width: '38%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
            animation: 'achv-shine 1.5s ease-out .25s both',
          }}
        />

        {/* Corner labels */}
        {items.length > 1 && (
          <p className="absolute top-4 right-5 text-[11px] text-[var(--text-4)]">{idx + 1} of {items.length}</p>
        )}
        {isTester && (
          <p className="absolute top-4 left-5 text-[9px] tracking-[0.2em] uppercase text-[var(--text-4)]">Test mode</p>
        )}

        {/* Medallion — rotating rays + pulsing glow + bouncing badge */}
        <div className="relative mx-auto mb-6" style={{ width: 124, height: 124 }}>
          <div
            aria-hidden
            className="absolute rounded-full"
            style={{
              inset: -16,
              background: 'repeating-conic-gradient(from 0deg, var(--gold) 0deg 2.4deg, transparent 2.4deg 17deg)',
              WebkitMaskImage: 'radial-gradient(closest-side, transparent 44%, #000 50%, #000 72%, transparent 84%)',
              maskImage: 'radial-gradient(closest-side, transparent 44%, #000 50%, #000 72%, transparent 84%)',
              opacity: isMilestone ? 0.5 : 0.26,
              animation: 'achv-ray-spin 16s linear infinite',
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(closest-side, rgba(201,162,39,0.5), rgba(201,162,39,0) 72%)',
              animation: 'achv-glow 2.4s ease-in-out infinite',
            }}
          />
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center"
            style={{
              border: '1px solid var(--gold-line)',
              background: 'radial-gradient(130% 130% at 50% 20%, rgba(201,162,39,0.22), rgba(14,14,14,0.9))',
              boxShadow: isMilestone
                ? '0 0 50px rgba(201,162,39,0.4), inset 0 0 34px rgba(201,162,39,0.16)'
                : '0 0 34px rgba(201,162,39,0.24), inset 0 0 26px rgba(201,162,39,0.10)',
              animation: 'achv-badge-in .7s cubic-bezier(.2,.8,.2,1.3) both',
            }}
          >
            <span className="text-[54px] leading-none" style={{ animation: 'achv-float 3.2s ease-in-out .7s infinite' }}>
              {current.emoji}
            </span>
          </div>
        </div>

        {/* Tier ribbon */}
        <div className="flex justify-center mb-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[10px] tracking-[0.24em] uppercase"
            style={
              isMilestone
                ? { background: 'linear-gradient(90deg, rgba(201,162,39,0.9), rgba(232,207,122,0.9))', color: '#0B0B0B', fontWeight: 600, boxShadow: '0 0 18px rgba(201,162,39,0.35)' }
                : { border: '1px solid var(--gold-line)', background: 'var(--gold-soft)', color: 'var(--gold-text)' }
            }
          >
            {isMilestone ? '★ Milestone unlocked' : 'Achievement'}
          </span>
        </div>

        <h2
          className="font-serif text-[30px] leading-[1.1] mb-3"
          style={
            isMilestone
              ? { backgroundImage: 'linear-gradient(180deg, #F7E7AE, #C9A227)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
              : { color: 'var(--text)' }
          }
        >
          {current.title}
        </h2>
        <p className="text-[14px] leading-[1.65] text-[var(--text-2)] max-w-[34ch] mx-auto" style={{ textWrap: 'pretty' }}>
          {current.body}
        </p>

        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            onClick={() => (isLast ? close() : setIdx((i) => i + 1))}
            className="inline-flex items-center justify-center rounded-full text-[13px] font-semibold px-7 py-3 transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(90deg, var(--gold), #E8CF7A)', color: '#0B0B0B', boxShadow: '0 8px 24px rgba(201,162,39,0.3)' }}
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
