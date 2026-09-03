'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Achievement {
  id: string
  key: string
  title: string
  body: string
  emoji: string
  tier: 'small' | 'milestone'
  badgeKey?: string | null
  seen?: boolean
}

// Member's own achievement feed. Lights up when they earn a sticker (even the
// ones that don't email), and clicking any entry re-opens its celebration popup
// via the `achievements:show` window event (handled by AchievementGate). Renders
// nothing until the member has at least one achievement.
export default function MemberNotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Achievement[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    fetch('/api/achievements/me?scope=all')
      .then((r) => r.json())
      .then((d: { achievements?: (Achievement & { created_at?: string })[]; unread?: number }) => {
        // newest first for the feed
        const list = (d.achievements ?? []).slice().reverse()
        setItems(list)
        setUnread(d.unread ?? 0)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function replay(a: Achievement) {
    window.dispatchEvent(new CustomEvent('achievements:show', { detail: { achievements: [a] } }))
    setOpen(false)
    if (!a.seen) {
      setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, seen: true } : x)))
      setUnread((u) => Math.max(0, u - 1))
      fetch('/api/achievements/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [a.id] }),
      }).catch(() => {})
    }
  }

  // Nothing earned yet → no bell at all.
  if (items.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Your achievements"
        className="relative rounded-full border border-[var(--border-2)] w-9 h-9 flex items-center justify-center text-[var(--text-2)] hover:border-[var(--gold)] hover:text-[var(--text)] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
          <path d="M17 5h2a2 2 0 0 1 0 4h-2M7 5H5a2 2 0 0 0 0 4h2" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
            style={{ background: 'var(--gold)', color: '#0B0B0B' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[340px] max-h-[440px] overflow-auto rounded-[16px] border shadow-2xl z-50"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-color)' }}
        >
          <div className="px-4 py-3 border-b border-[var(--border-color)] sticky top-0" style={{ background: 'var(--surface)' }}>
            <p className="text-[var(--gold-text)] text-[10px] tracking-[0.24em] uppercase">Your achievements</p>
          </div>
          <ul>
            {items.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => replay(a)}
                  className="w-full text-left flex gap-3 px-4 py-3 border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--gold-soft)] transition-colors"
                >
                  <span className="text-[20px] leading-none mt-0.5 flex-none">{a.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-[var(--text)] leading-snug">{a.title}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: a.tier === 'milestone' ? 'var(--gold-text)' : 'var(--text-4)' }}>
                      {a.tier === 'milestone' ? 'Milestone' : 'Achievement'} · tap to replay
                    </p>
                  </div>
                  {!a.seen && <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-none" style={{ background: 'var(--gold)' }} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
