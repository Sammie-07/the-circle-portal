'use client'

import { useState } from 'react'

export interface Call {
  id: string
  title: string
  video_url: string
  call_date: string | null
  notes: string | null
  created_at: string
}

// Provider coverage matches the dashboard replays (YouTube / Drive / Loom / Vimeo).
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

function fmtShort(d: string | null): string {
  if (!d) return ''
  return new Date(d.length <= 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtLong(d: string | null): string {
  if (!d) return ''
  return new Date(d.length <= 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const PlayIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
)

interface Props {
  officeHours: Call[]
  clarityCalls: Call[]
}

export default function CallsScreen({ officeHours, clarityCalls }: Props) {
  const [active, setActive] = useState<{ call: Call; kind: 'clarity' | 'office' } | null>(null)

  // Featured = latest office hours, falling back to the latest clarity call.
  const featured = officeHours[0] ?? clarityCalls[0] ?? null
  const featuredKind: 'clarity' | 'office' = officeHours[0] ? 'office' : 'clarity'
  const ohGrid = officeHours.filter((c) => c.id !== featured?.id)
  const clarityList = clarityCalls.filter((c) => c.id !== featured?.id)

  const embedUrl = active ? getEmbedUrl(active.call.video_url) : null
  const isDrive = embedUrl?.includes('drive.google.com')

  // Nothing at all — single empty state.
  if (!featured) {
    return (
      <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--surface)] p-10 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ border: '1px solid var(--gold-line)', background: 'var(--gold-soft)' }}>
          <span className="text-[var(--gold)]"><PlayIcon size={18} /></span>
        </div>
        <h2 className="text-[var(--text)] font-serif text-xl mb-3">No Recordings Yet</h2>
        <p className="text-[var(--text-3)] text-sm leading-relaxed max-w-sm mx-auto">
          Your clarity call and weekly office hours recordings will appear here once they&apos;re posted.
        </p>
      </div>
    )
  }

  const featuredAccent = featuredKind === 'clarity' ? 'var(--red)' : 'var(--gold)'

  return (
    <div>
      {/* Featured player + side card */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[22px] mb-9">
        <button
          onClick={() => setActive({ call: featured, kind: featuredKind })}
          className="group relative rounded-[18px] overflow-hidden border flex items-center justify-center text-left"
          style={{ borderColor: 'var(--border-2)', background: 'var(--tile)', aspectRatio: '16 / 9' }}
        >
          <div
            className="w-[60px] h-[60px] rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ border: `1px solid ${featuredAccent}`, color: featuredAccent }}
          >
            <PlayIcon size={17} />
          </div>
          <div className="absolute left-6 bottom-[22px] right-6">
            <p className="font-serif text-[22px] text-[var(--text)] truncate">{featured.title}</p>
            <p className="text-[12px] text-[var(--text-2)] mt-1">
              {featuredKind === 'clarity' ? 'Clarity call' : 'Office Hours'}{featured.call_date ? ` · ${fmtShort(featured.call_date)}` : ''}
            </p>
          </div>
        </button>

        <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--surface)] px-7 py-[26px]">
          {featured.notes?.trim() ? (
            <>
              <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-3)] mb-3.5">In this call</p>
              <p className="text-[13.5px] text-[var(--text-2)] leading-[1.7] whitespace-pre-wrap" style={{ textWrap: 'pretty' }}>{featured.notes}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-3)] mb-3.5">About this recording</p>
              <p className="font-serif text-[19px] text-[var(--text)] mb-1.5">{featured.title}</p>
              <p className="text-[12.5px] text-[var(--text-3)]">{fmtLong(featured.call_date)}</p>
              <button
                onClick={() => setActive({ call: featured, kind: featuredKind })}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--gold)] text-[#0B0B0B] text-[12.5px] font-medium px-[18px] py-2.5 hover:brightness-110 transition-all"
              >
                <PlayIcon size={11} /> Play recording
              </button>
            </>
          )}
        </div>
      </div>

      {/* Office Hours Replay — grid of tiles */}
      <h2 className="font-serif text-[21px] text-[var(--text)] mb-1">Office Hours Replay</h2>
      <p className="text-[13px] text-[var(--text-3)] mb-[18px]">Weekly recordings shared with everyone in The Circle.</p>
      {ohGrid.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-9">
          {ohGrid.map((c) => (
            <button key={c.id} onClick={() => setActive({ call: c, kind: 'office' })} className="group block text-left">
              <div className="aspect-video rounded-[11px] border flex items-center justify-center mb-[11px] transition-transform group-hover:scale-[1.01]" style={{ borderColor: 'var(--border-2)', background: 'var(--tile)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}>
                  <PlayIcon size={11} />
                </div>
              </div>
              <p className="text-[13.5px] text-[var(--text)] truncate">{c.title}</p>
              <p className="text-[11.5px] text-[var(--text-3)] mt-[3px]">Office Hours{c.call_date ? ` · ${fmtShort(c.call_date)}` : ''}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--text-4)] mb-9">That&apos;s the latest recording so far — new ones appear here each week.</p>
      )}

      {/* Clarity Call Replay — compact rows */}
      <h2 className="font-serif text-[21px] text-[var(--text)] mb-1">Clarity Call Replay</h2>
      <p className="text-[13px] text-[var(--text-3)] mb-[18px]">Your personal coaching call recordings.</p>
      {clarityList.length > 0 ? (
        <div className="flex flex-col gap-3 max-w-[560px]">
          {clarityList.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive({ call: c, kind: 'clarity' })}
              className="group flex items-center gap-[18px] px-[22px] py-[18px] rounded-[14px] border text-left transition-colors hover:border-[var(--gold-line)]"
              style={{ borderColor: 'var(--border-color)', background: 'var(--surface)' }}
            >
              <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center flex-none transition-transform group-hover:scale-110" style={{ border: '1px solid var(--red)', color: 'var(--red)' }}>
                <PlayIcon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-[var(--text)] truncate">{c.title}</p>
                <p className="text-[12px] text-[var(--text-3)] mt-[3px]">{c.call_date ? fmtShort(c.call_date) : 'Clarity call'}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--text-4)]">Your clarity call recording will appear here once your coach adds it.</p>
      )}

      {/* Modal player */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={active.call.title}>
          <div className="absolute inset-0 bg-black/75" onClick={() => setActive(null)} />
          <div className="relative w-full max-w-3xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[var(--text)] text-sm font-medium">{active.call.title}</p>
                <p className="text-[var(--text-3)] text-xs">{active.kind === 'clarity' ? 'Clarity call' : 'Office Hours'}{active.call.call_date ? ` · ${fmtShort(active.call.call_date)}` : ''}</p>
              </div>
              <button onClick={() => setActive(null)} aria-label="Close" className="w-8 h-8 rounded-lg border border-[var(--border-2)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">×</button>
            </div>
            {embedUrl ? (
              <div className="relative w-full overflow-hidden rounded-xl bg-black border border-[var(--border-color)]" style={{ paddingTop: '56.25%' }}>
                <iframe
                  src={embedUrl}
                  title={active.call.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
                {isDrive && (
                  <div aria-hidden className="absolute top-0 right-0 w-20 h-16 bg-black rounded-bl-xl" style={{ zIndex: 2 }} onContextMenu={(e) => e.preventDefault()} />
                )}
              </div>
            ) : (
              <a href={active.call.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)] text-[#0B0B0B] font-medium text-sm px-5 py-2.5">
                Watch recording ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
