'use client'

import { useState } from 'react'
import Link from 'next/link'

export interface Replay {
  id: string
  title: string
  call_date: string | null
  kind: 'clarity' | 'office'
  video_url: string
}

// Same provider coverage as the Calls page (YouTube / Drive / Loom / Vimeo).
function getEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|.*[?&]id=)([\w-]+)/)
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  return new Date(d.length <= 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function RecentReplays({ replays }: { replays: Replay[] }) {
  const [active, setActive] = useState<Replay | null>(null)
  if (!replays.length) return null

  const embedUrl = active ? getEmbedUrl(active.video_url) : null
  const isDrive = embedUrl?.includes('drive.google.com')

  return (
    <section className="rounded-[18px] border border-[var(--border-color)] bg-[var(--surface)] p-7">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[var(--text)] font-serif text-[19px]">Recent replays</h2>
        <Link href="/dashboard/calls" className="text-[var(--gold-text)] text-[11.5px] hover:text-[var(--gold)]">All calls →</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {replays.map((r) => {
          const accent = r.kind === 'clarity' ? 'var(--red)' : 'var(--gold)'
          return (
            <button key={`${r.kind}-${r.id}`} onClick={() => setActive(r)} className="group block text-left">
              <div className="aspect-video rounded-[11px] border border-[var(--border-2)] flex items-center justify-center mb-[11px] transition-transform group-hover:scale-[1.01]" style={{ background: 'var(--tile)' }}>
                <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center transition-transform group-hover:scale-110" style={{ border: `1px solid ${accent}`, color: accent }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>
              <p className="text-[13.5px] text-[var(--text)] truncate">{r.title}</p>
              <p className="text-[11.5px] text-[var(--text-3)] mt-[3px]">
                {r.kind === 'clarity' ? 'Clarity call' : 'Office Hours'}{r.call_date ? ` · ${fmtDate(r.call_date)}` : ''}
              </p>
            </button>
          )
        })}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={active.title}>
          <div className="absolute inset-0 bg-black/75" onClick={() => setActive(null)} />
          <div className="relative w-full max-w-3xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[var(--text)] text-sm font-medium">{active.title}</p>
                <p className="text-[var(--text-3)] text-xs">{active.kind === 'clarity' ? 'Clarity call' : 'Office Hours'}{active.call_date ? ` · ${fmtDate(active.call_date)}` : ''}</p>
              </div>
              <button onClick={() => setActive(null)} aria-label="Close" className="w-8 h-8 rounded-lg border border-[var(--border-2)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">×</button>
            </div>
            {embedUrl ? (
              <div className="relative w-full overflow-hidden rounded-xl bg-black border border-[var(--border-color)]" style={{ paddingTop: '56.25%' }}>
                <iframe
                  src={embedUrl}
                  title={active.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
                {isDrive && (
                  <div aria-hidden className="absolute top-0 right-0 w-20 h-16 bg-black rounded-bl-xl" style={{ zIndex: 2 }} onContextMenu={(e) => e.preventDefault()} />
                )}
              </div>
            ) : (
              <a href={active.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)] text-[#0B0B0B] font-medium text-sm px-5 py-2.5">
                Watch recording ↗
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
