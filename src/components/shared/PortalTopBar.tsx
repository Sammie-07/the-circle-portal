'use client'

import NotificationBell from './NotificationBell'

// The design's sticky top bar: a context line on the left, and the two shell
// actions on the right — "Ask Gogo" (opens the existing chat bubble via a window
// event) and "Join office hours" (the existing Zoom link). Admins also get the
// achievements activity bell. No new features.
export default function PortalTopBar({ topline, zoomLink, showNotifications = false }: { topline: string; zoomLink?: string | null; showNotifications?: boolean }) {
  return (
    <div className="hidden md:flex items-center justify-between gap-6 px-10 py-[18px] border-b border-[var(--border-color)] bg-[var(--bg)] sticky top-0 z-[5]">
      <p className="text-[13px] text-[var(--text-3)] truncate">{topline}</p>
      <div className="flex items-center gap-2.5 flex-none">
        {showNotifications && <NotificationBell />}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('ask-gogo:open'))}
          className="rounded-full border border-[var(--border-2)] text-xs text-[var(--text-2)] px-4 py-2 hover:border-[var(--gold)] hover:text-[var(--text)] transition-colors"
        >
          Ask Gogo
        </button>
        {zoomLink && (
          <a
            href={zoomLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[var(--gold)] text-[#0B0B0B] text-xs font-medium px-4 py-2 hover:brightness-110 transition-all"
          >
            Join office hours
          </a>
        )}
      </div>
    </div>
  )
}
