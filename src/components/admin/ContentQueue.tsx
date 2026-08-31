'use client'

import { useMemo, useState } from 'react'
import { toast } from '@/lib/toast'

export interface ContentSlide {
  headline: string
  body: string
  imageDirection: string
}
export interface ContentPost {
  id: string
  source_type: 'member_win' | 'community' | 'takeaway' | 'educational'
  trigger_summary: string
  format: 'single' | 'carousel'
  platform: string
  caption: string
  hashtags: string
  slides: ContentSlide[]
  art_direction: string
  status: 'draft' | 'approved' | 'rejected' | 'posted'
  created_at: string
}

const GOLD = '#C9A227'
const SOURCE_LABEL: Record<ContentPost['source_type'], string> = {
  member_win: 'Member win',
  community: 'Community',
  takeaway: 'Takeaway',
  educational: 'Educational',
}
const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'draft', label: 'Drafts' },
  { key: 'approved', label: 'Approved' },
  { key: 'posted', label: 'Posted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

export default function ContentQueue({ initialPosts }: { initialPosts: ContentPost[] }) {
  const [posts, setPosts] = useState<ContentPost[]>(initialPosts)
  const [filter, setFilter] = useState<string>('draft')
  const [generating, setGenerating] = useState(false)

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length }
    for (const p of posts) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [posts])

  const visible = filter === 'all' ? posts : posts.filter((p) => p.status === filter)

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/content/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error ?? 'Could not generate', 'error')
        return
      }
      if (data.generated === 0) {
        toast(data.reason === 'no activity to post about yet' ? 'No new activity to post about yet.' : 'Nothing new to generate right now.')
      } else {
        toast(`Generated ${data.generated} new post${data.generated === 1 ? '' : 's'}${data.remaining ? ` (${data.remaining} more queued — click again)` : ''}.`)
        // Reload to pull the fresh drafts.
        const listed = await fetch('/api/content').then((r) => r.json())
        if (Array.isArray(listed.posts)) setPosts(listed.posts)
        setFilter('draft')
      }
    } catch {
      toast('Network error — please try again', 'error')
    } finally {
      setGenerating(false)
    }
  }

  function patchLocal(id: string, patch: Partial<ContentPost>) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  async function setStatus(id: string, status: ContentPost['status']) {
    patchLocal(id, { status })
    const res = await fetch(`/api/content/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) toast('Could not update status', 'error')
    else toast(status === 'approved' ? 'Approved' : status === 'posted' ? 'Marked as posted' : status === 'rejected' ? 'Rejected' : 'Updated')
  }

  async function remove(id: string) {
    if (!confirm('Delete this post permanently?')) return
    const res = await fetch(`/api/content/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast('Could not delete', 'error'); return }
    setPosts((prev) => prev.filter((p) => p.id !== id))
    toast('Deleted')
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                  active
                    ? 'border-[#C9A227] text-[#C9A227] bg-[#C9A227]/10'
                    : 'border-[var(--border-color)] text-[var(--text-2)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {f.label}
                {counts[f.key] ? <span className="ml-1.5 opacity-60">{counts[f.key]}</span> : null}
              </button>
            )
          })}
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
        >
          {generating ? 'Generating…' : '✦ Generate from activity'}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="border border-[var(--border-color)] rounded-xl p-10 text-center">
          <p className="text-[var(--text-2)] text-sm">
            {filter === 'draft'
              ? 'No drafts yet. Click “Generate from activity” to turn recent member wins into posts.'
              : `No ${filter} posts.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {visible.map((p) => (
            <PostCard key={p.id} post={p} onStatus={setStatus} onRemove={remove} onEdit={patchLocal} />
          ))}
        </div>
      )}
    </div>
  )
}

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'gold' | 'muted' | 'green' | 'red' }) {
  const map = {
    gold: { color: GOLD, bg: 'rgba(201,162,39,0.12)' },
    green: { color: '#5bbd68', bg: 'rgba(91,189,104,0.12)' },
    red: { color: '#ff8080', bg: 'rgba(255,128,128,0.12)' },
    muted: { color: 'var(--text-2)', bg: 'var(--surface-2)' },
  }[tone]
  return (
    <span style={{ color: map.color, background: map.bg }} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs">
      {children}
    </span>
  )
}

function PostCard({
  post,
  onStatus,
  onRemove,
  onEdit,
}: {
  post: ContentPost
  onStatus: (id: string, s: ContentPost['status']) => void
  onRemove: (id: string) => void
  onEdit: (id: string, patch: Partial<ContentPost>) => void
}) {
  const [caption, setCaption] = useState(post.caption)
  const [hashtags, setHashtags] = useState(post.hashtags)
  const [showBrief, setShowBrief] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = caption !== post.caption || hashtags !== post.hashtags
  const slideCount = Math.max(1, post.slides?.length ?? 1)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/content/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, hashtags }),
      })
      if (!res.ok) { toast('Could not save', 'error'); return }
      onEdit(post.id, { caption, hashtags })
      toast('Saved')
    } finally {
      setSaving(false)
    }
  }

  function copyCaption() {
    const text = `${caption}\n\n${hashtags}`.trim()
    navigator.clipboard.writeText(text).then(
      () => toast('Caption copied'),
      () => toast('Copy failed', 'error')
    )
  }

  const statusTone = post.status === 'approved' ? 'green' : post.status === 'rejected' ? 'red' : post.status === 'posted' ? 'gold' : 'muted'

  return (
    <div className="border border-[var(--border-color)] rounded-xl bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-[var(--border-color)]">
        <Badge tone="gold">{SOURCE_LABEL[post.source_type]}</Badge>
        <Badge>{post.format === 'carousel' ? `Carousel · ${slideCount}` : 'Single'}</Badge>
        <Badge>{post.platform === 'both' ? 'IG + FB' : post.platform}</Badge>
        <Badge tone={statusTone}>{post.status}</Badge>
        <span className="text-[var(--text-3)] text-sm ml-1 truncate">{post.trigger_summary}</span>
      </div>

      <div className="p-5 flex flex-col lg:flex-row gap-6">
        {/* Slides */}
        <div className="lg:w-[46%] shrink-0">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: slideCount }).map((_, i) => (
              <div key={i} className="shrink-0 w-44">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/content/${post.id}/image?i=${i}`}
                  alt={`Slide ${i + 1}`}
                  width={176}
                  height={176}
                  loading="lazy"
                  className="w-44 h-44 rounded-lg border border-[var(--border-color)] object-cover"
                />
                <a
                  href={`/api/content/${post.id}/image?i=${i}`}
                  download={`circle-${post.id.slice(0, 6)}-${i + 1}.png`}
                  className="block text-center text-xs text-[var(--text-3)] hover:text-[#C9A227] mt-1.5"
                >
                  ↓ Download {slideCount > 1 ? `slide ${i + 1}` : 'image'}
                </a>
              </div>
            ))}
          </div>
          {post.art_direction ? (
            <button onClick={() => setShowBrief((v) => !v)} className="text-xs text-[var(--text-3)] hover:text-[#C9A227] mt-1">
              {showBrief ? '▾ Hide' : '▸ Show'} visual / Canva brief
            </button>
          ) : null}
          {showBrief ? (
            <p className="text-[var(--text-2)] text-xs leading-relaxed mt-2 whitespace-pre-wrap border-l-2 border-[var(--border-color)] pl-3">
              {post.art_direction}
              {post.slides?.some((s) => s.imageDirection) ? (
                <>
                  {'\n\n'}
                  {post.slides.map((s, i) => (s.imageDirection ? `Slide ${i + 1}: ${s.imageDirection}\n` : '')).join('')}
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        {/* Caption + actions */}
        <div className="flex-1 min-w-0 flex flex-col">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={7}
            className="w-full bg-[var(--bg)] border border-[var(--border-color)] rounded-lg p-3 text-sm text-[var(--text)] leading-relaxed resize-y"
          />
          <input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm text-[#C9A227] mt-2"
          />

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {dirty ? (
              <button onClick={save} disabled={saving} className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-3.5 py-1.5 rounded-lg disabled:opacity-40">
                {saving ? 'Saving…' : 'Save edits'}
              </button>
            ) : null}
            <button onClick={copyCaption} className="border border-[var(--border-color)] text-[var(--text-2)] text-sm px-3.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)]">
              Copy caption
            </button>
            {post.status !== 'approved' && post.status !== 'posted' ? (
              <button onClick={() => onStatus(post.id, 'approved')} className="border text-sm px-3.5 py-1.5 rounded-lg" style={{ borderColor: 'rgba(91,189,104,0.5)', color: '#5bbd68' }}>
                Approve
              </button>
            ) : null}
            {post.status === 'approved' ? (
              <button onClick={() => onStatus(post.id, 'posted')} className="border text-sm px-3.5 py-1.5 rounded-lg" style={{ borderColor: 'rgba(201,162,39,0.5)', color: GOLD }}>
                Mark posted
              </button>
            ) : null}
            {post.status !== 'rejected' ? (
              <button onClick={() => onStatus(post.id, 'rejected')} className="border border-[var(--border-color)] text-[var(--text-3)] text-sm px-3.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)]">
                Reject
              </button>
            ) : null}
            <button onClick={() => onRemove(post.id)} className="text-[var(--text-3)] text-sm px-2 py-1.5 rounded-lg hover:text-[#ff8080] ml-auto">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
