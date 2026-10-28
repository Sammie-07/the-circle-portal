'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Notif {
  id: string
  type: 'celebration' | 'post_created' | 'revision_submitted'
  emoji: string | null
  title: string
  body: string
  member_id: string | null
  achievement_id: string | null
  post_id: string | null
  created_at: string
  read_at: string | null
  tier?: string | null
  canMakePost?: boolean
  posted?: boolean
}

interface Explanation {
  memberId: string
  memberName: string
  title: string
  awardedAt: string
  memberMessage: string
  meaning: string
  evidence: string[]
  note: string | null
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Admin-only bell + feed of achievement activity (a member was celebrated; a
// post was drafted from a celebration). Polls quietly; opening it marks all read.
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  // "What did they do?" panels: which notification is expanded + loaded details.
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, Explanation | { error: string } | 'loading'>>({})
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    fetch('/api/admin/notifications')
      .then((r) => r.json())
      .then((d: { notifications?: Notif[]; unread?: number }) => {
        setItems(d.notifications ?? [])
        setUnread(d.unread ?? 0)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0)
      fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      }).catch(() => {})
    }
  }

  // Open/close the explanation for one achievement (loaded once, then cached).
  function toggleDetails(n: Notif) {
    if (!n.achievement_id) return
    if (expanded === n.id) { setExpanded(null); return }
    setExpanded(n.id)
    const achId = n.achievement_id
    if (details[achId]) return
    setDetails((d) => ({ ...d, [achId]: 'loading' }))
    fetch(`/api/admin/achievements/${achId}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        setDetails((d) => ({ ...d, [achId]: r.ok ? (data as Explanation) : { error: (data as { error?: string }).error ?? 'Could not load the details' } }))
      })
      .catch(() => setDetails((d) => ({ ...d, [achId]: { error: 'Network error, try again' } })))
  }

  // Admin opts a small (non-milestone) celebration into a content post.
  function makePost(n: Notif) {
    if (!n.achievement_id || busyId) return
    setBusyId(n.id)
    fetch('/api/admin/achievements/make-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievementId: n.achievement_id }),
    })
      .then((r) => r.json())
      .then(() => load())
      .catch(() => {})
      .finally(() => setBusyId(null))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className="relative rounded-full border border-[var(--border-2)] w-9 h-9 flex items-center justify-center text-[var(--text-2)] hover:border-[var(--gold)] hover:text-[var(--text)] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
          className="absolute right-0 mt-2 w-[min(400px,calc(100vw-24px))] max-h-[min(560px,80vh)] overflow-auto rounded-[16px] border shadow-2xl z-50"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-color)' }}
        >
          <div className="px-4 py-3 border-b border-[var(--border-color)] sticky top-0" style={{ background: 'var(--surface)' }}>
            <p className="text-[var(--gold-text)] text-[10px] tracking-[0.24em] uppercase">Activity</p>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--text-3)]">No activity yet. Celebrations will show up here.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id} className="border-b border-[var(--border-color)] last:border-b-0">
                  <div className="flex gap-3 px-4 py-3">
                    <span className="text-[18px] leading-none mt-0.5 flex-none">{n.emoji ?? '🎉'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[var(--text)] leading-snug">{n.title}</p>
                      {n.body && <p className="text-[12px] text-[var(--text-3)] mt-0.5">{n.body}</p>}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-[11px] text-[var(--text-4)]">{timeAgo(n.created_at)}</span>
                        {n.type === 'post_created' && (
                          <Link href="/admin/content" onClick={() => setOpen(false)} className="text-[11px] text-[var(--gold-text)] hover:text-[var(--gold)]">Review in Content →</Link>
                        )}
                        {n.type === 'revision_submitted' && n.member_id && (
                          <Link href={`/admin/member/${n.member_id}`} onClick={() => setOpen(false)} className="text-[11px] text-[var(--gold-text)] hover:text-[var(--gold)]">Review & approve →</Link>
                        )}
                        {n.type === 'celebration' && n.achievement_id && (
                          <button
                            onClick={() => toggleDetails(n)}
                            className="text-[11px] text-[var(--gold-text)] hover:text-[var(--gold)]"
                            aria-expanded={expanded === n.id}
                          >
                            {expanded === n.id ? 'Hide details ▴' : 'What did they do? ▾'}
                          </button>
                        )}
                        {n.type === 'celebration' && n.canMakePost && (
                          <button
                            onClick={() => makePost(n)}
                            disabled={busyId === n.id}
                            className="text-[11px] rounded-full px-2.5 py-1 border transition-colors disabled:opacity-50"
                            style={{ borderColor: 'var(--gold-line)', background: 'var(--gold-soft)', color: 'var(--gold-text)' }}
                          >
                            {busyId === n.id ? 'Creating…' : '＋ Make post'}
                          </button>
                        )}
                        {n.type === 'celebration' && n.posted && (
                          <Link href="/admin/content" onClick={() => setOpen(false)} className="text-[11px] text-[var(--text-4)] hover:text-[var(--gold)]">Posted →</Link>
                        )}
                      </div>
                      {n.type === 'celebration' && n.achievement_id && expanded === n.id && (
                        <AchievementDetails d={details[n.achievement_id]} onOpenMember={() => setOpen(false)} />
                      )}
                    </div>
                    {!n.read_at && <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-none" style={{ background: 'var(--gold)' }} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function AchievementDetails({ d, onOpenMember }: { d: Explanation | { error: string } | 'loading' | undefined; onOpenMember: () => void }) {
  if (!d || d === 'loading') return <p className="text-[12px] text-[var(--text-3)] mt-2">Loading…</p>
  if ('error' in d) return <p className="text-[12px] text-[#ff8080] mt-2">{d.error}</p>
  return (
    <div className="mt-2.5 rounded-[10px] border border-[var(--border-color)] p-3 text-[12px] leading-relaxed" style={{ background: 'var(--bg)' }}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)] mb-1">What it means</p>
      <p className="text-[var(--text-2)]">{d.meaning}</p>
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)] mt-3 mb-1">What they did</p>
      <ul className="space-y-1 text-[var(--text)]">
        {d.evidence.map((e, i) => (
          <li key={i} className="flex gap-1.5"><span className="text-[var(--gold-text)]">•</span><span>{e}</span></li>
        ))}
      </ul>
      {d.note ? <p className="mt-2.5 text-[#ffb35c]">{d.note}</p> : null}
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)] mt-3 mb-1">What they were told</p>
      <p className="text-[var(--text-3)] italic">“{d.memberMessage}”</p>
      <Link href={`/admin/member/${d.memberId}`} onClick={onOpenMember} className="inline-block mt-3 text-[var(--gold-text)] hover:text-[var(--gold)]">
        Open {d.memberName.split(' ')[0]}&apos;s page →
      </Link>
    </div>
  )
}
