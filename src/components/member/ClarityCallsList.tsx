'use client'

import { useState } from 'react'

interface ClarityCall {
  id: string
  title: string
  video_url: string
  call_date: string | null
  notes: string | null
  created_at: string
}

// Convert a share URL into an embeddable player URL. Returns null when no
// pattern matches, in which case the caller renders a plain "watch" link.
function getEmbedUrl(url: string): string | null {
  // YouTube — watch?v=ID, youtu.be/ID, /shorts/ID, or already /embed/ID
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/
  )
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`

  // Google Drive — /file/d/FILE_ID/... or ?id=FILE_ID
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|.*[?&]id=)([\w-]+)/)
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`

  // Loom — /share/ID (also tolerate /embed/ID already)
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`

  // Vimeo — vimeo.com/ID or player.vimeo.com/video/ID
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`

  return null
}

// Zoom cloud recordings (any *.zoom.us/rec/... share or play link). Zoom blocks
// third-party iframe embedding (X-Frame-Options) and recordings often need a
// passcode, so these can't play inline — we link out to Zoom instead.
function isZoomUrl(url: string): boolean {
  return /(?:^|\/\/|\.)zoom\.us\//i.test(url)
}

function VideoEmbed({ url, title }: { url: string; title: string }) {
  const embedUrl = getEmbedUrl(url)

  if (embedUrl) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-lg bg-black border border-[var(--border-color)]"
        style={{ paddingTop: '56.25%' }}
      >
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    )
  }

  // Zoom — can't embed; show a clear, branded "watch on Zoom" panel.
  if (isZoomUrl(url)) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--surface)] flex flex-col items-center justify-center text-center gap-3 px-6"
        style={{ paddingTop: '0', minHeight: '220px' }}
      >
        <div className="w-12 h-12 rounded-full bg-[#2D8CFF]/15 border border-[#2D8CFF]/40 flex items-center justify-center">
          <span className="text-[#2D8CFF] text-xl">▶</span>
        </div>
        <p className="text-[var(--text-2)] text-sm max-w-xs">
          This recording is hosted on Zoom and opens in a new tab.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#2D8CFF] text-white font-medium text-sm px-5 py-2.5 rounded hover:bg-[#2477e0] transition-colors"
        >
          Watch on Zoom ↗
        </a>
        <p className="text-[var(--text-4)] text-xs">If prompted, use the passcode your coach shared.</p>
      </div>
    )
  }

  // Fallback — no recognized embed pattern, link out instead
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 bg-[#C9A227] text-[#0D0D0D] font-medium text-sm px-5 py-3 rounded hover:bg-[#d4ac2d] transition-colors"
    >
      Watch recording ↗
    </a>
  )
}

interface ClarityCallsListProps {
  calls: ClarityCall[]
  heading?: string
  subtitle?: string
  emptyText?: string
}

export default function ClarityCallsList({
  calls,
  heading,
  subtitle,
  emptyText = 'Your recordings will appear here once your coach adds them.',
}: ClarityCallsListProps) {
  const [activeId, setActiveId] = useState<string | null>(calls[0]?.id ?? null)
  const activeCall = calls.find((c) => c.id === activeId) ?? calls[0]

  const sectionHeader = (heading || subtitle) ? (
    <div className="mb-4">
      {heading && <h2 className="text-[var(--text)] font-serif text-2xl">{heading}</h2>}
      {subtitle && <p className="text-[var(--text-3)] text-sm mt-1">{subtitle}</p>}
    </div>
  ) : null

  if (calls.length === 0) {
    return (
      <div>
        {sectionHeader}
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-10 text-center">
          <div className="w-14 h-14 rounded-full border border-[#C9A227]/30 bg-[#C9A227]/5 flex items-center justify-center mx-auto mb-5">
            <span className="text-[#C9A227] text-2xl">▶</span>
          </div>
          <h2 className="text-[var(--text)] font-serif text-xl mb-3">No Recordings Yet</h2>
          <p className="text-[var(--text-3)] text-sm leading-relaxed max-w-sm mx-auto">
            {emptyText}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {sectionHeader}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sidebar: call list */}
      <aside className="lg:col-span-1 space-y-2">
        {calls.map((call) => {
          const active = activeCall?.id === call.id
          return (
            <button
              key={call.id}
              onClick={() => setActiveId(call.id)}
              className={`w-full text-left px-4 py-3 rounded border transition-all ${
                active
                  ? 'bg-[#C9A227]/10 border-[#C9A227]/40 text-[var(--text)]'
                  : 'bg-[var(--surface)] border-[var(--border-color)] text-[var(--text-2)] hover:border-[#C9A227]/30 hover:text-[var(--text)]'
              }`}
            >
              <span className="block font-medium text-sm line-clamp-2">{call.title}</span>
              {call.call_date && (
                <span className="block text-xs mt-1 text-[var(--text-3)]">
                  {new Date(call.call_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              )}
            </button>
          )
        })}
      </aside>

      {/* Main: player + notes */}
      <div className="lg:col-span-2">
        {activeCall && (
          <div>
            <VideoEmbed url={activeCall.video_url} title={activeCall.title} />
            <div className="mt-4">
              <h2 className="text-[var(--text)] font-serif text-xl">{activeCall.title}</h2>
              {activeCall.call_date && (
                <p className="text-[var(--text-3)] text-xs mt-1">
                  {new Date(activeCall.call_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
              {activeCall.notes && (
                <div className="mt-4 bg-[var(--surface)] border border-[var(--border-color)] rounded p-4">
                  <p className="text-[#C9A227] text-[10px] tracking-[0.2em] uppercase mb-2">Notes</p>
                  <p className="text-[var(--text-2)] text-sm whitespace-pre-wrap leading-relaxed">{activeCall.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
