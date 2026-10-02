'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { BUCKETS, BUCKET_LABEL, VISUAL_LABEL, type Bucket } from '@/lib/content/buckets'
import type { ConceptBrief } from '@/lib/content/concepts'

export interface ContentSlide {
  headline: string
  body: string
  imageDirection: string
}
export interface ContentPost {
  id: string
  source_type: 'member_win' | 'community' | 'takeaway' | 'educational' | 'concept'
  bucket: Bucket | null
  brief: ConceptBrief | null
  trigger_summary: string
  format: 'single' | 'carousel' | 'video'
  platform: string
  caption: string
  hashtags: string
  slides: ContentSlide[]
  art_direction: string
  status: 'draft' | 'approved' | 'rejected' | 'posted'
  feedback: string | null
  created_at: string
}

const GOLD = '#C9A227'
const SOURCE_LABEL: Record<ContentPost['source_type'], string> = {
  member_win: 'Member win',
  community: 'Community',
  takeaway: 'Takeaway',
  educational: 'Educational',
  concept: 'Idea',
}
// Concept-brief statuses read as an idea pipeline.
const IDEA_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'draft', label: 'New ideas' },
  { key: 'approved', label: 'Using' },
  { key: 'posted', label: 'Posted' },
  { key: 'rejected', label: 'Passed' },
  { key: 'all', label: 'All' },
]
const DOES_LABEL: Record<ConceptBrief['does'][number], string> = {
  seen: 'Makes them feel seen',
  see_gogo: 'Shows Gogo as a coach',
  want_room: 'Makes them want the room',
}
const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'draft', label: 'Drafts' },
  { key: 'approved', label: 'Approved' },
  { key: 'posted', label: 'Posted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

export default function ContentQueue({ initialPosts }: { initialPosts: ContentPost[] }) {
  const router = useRouter()
  const [posts, setPosts] = useState<ContentPost[]>(initialPosts)
  const [view, setView] = useState<'ideas' | 'legacy'>('ideas')
  const [filter, setFilter] = useState<string>('draft')
  const [bucket, setBucket] = useState<Bucket | 'all'>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState(false)

  const ideas = useMemo(() => posts.filter((p) => p.source_type === 'concept'), [posts])
  const legacy = useMemo(() => posts.filter((p) => p.source_type !== 'concept'), [posts])
  const pool = view === 'ideas' ? ideas : legacy

  const counts = useMemo(() => {
    const scoped = view === 'ideas' && bucket !== 'all' ? pool.filter((p) => p.bucket === bucket) : pool
    const c: Record<string, number> = { all: scoped.length }
    for (const p of scoped) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [pool, view, bucket])

  const bucketCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of ideas) if (filter === 'all' || p.status === filter) c[p.bucket ?? ''] = (c[p.bucket ?? ''] ?? 0) + 1
    return c
  }, [ideas, filter])

  const visible = pool
    .filter((p) => filter === 'all' || p.status === filter)
    .filter((p) => view !== 'ideas' || bucket === 'all' || p.bucket === bucket)

  async function refresh() {
    setRefreshing(true)
    try {
      const listed = await fetch('/api/content').then((r) => r.json())
      if (Array.isArray(listed.posts)) setPosts(listed.posts)
      router.refresh() // also re-triggers the background auto-generation
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false)
    }
  }

  async function generateNow() {
    setGenerating(true)
    try {
      const res = await fetch('/api/content/generate', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast(data.error ?? 'Could not generate ideas', 'error'); return }
      const listed = await fetch('/api/content').then((r) => r.json())
      if (Array.isArray(listed.posts)) setPosts(listed.posts)
      toast(data.made ? `${data.made} new idea${data.made === 1 ? '' : 's'} added` : 'Nothing new worth posting right now. Try again after the next call or survey.')
      setView('ideas')
      setFilter('draft')
    } catch {
      toast('Network error, please try again', 'error')
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
    const isIdea = posts.find((p) => p.id === id)?.source_type === 'concept'
    if (!res.ok) toast('Could not update status', 'error')
    else toast(status === 'approved' ? (isIdea ? 'Moved to Using' : 'Approved') : status === 'posted' ? 'Marked as posted' : status === 'rejected' ? (isIdea ? 'Passed' : 'Rejected') : 'Updated')
  }

  async function remove(id: string) {
    if (!confirm('Delete this permanently?')) return
    const res = await fetch(`/api/content/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast('Could not delete', 'error'); return }
    setPosts((prev) => prev.filter((p) => p.id !== id))
    toast('Deleted')
  }

  const filters = view === 'ideas' ? IDEA_FILTERS : FILTERS

  return (
    <div>
      {/* View switch */}
      <div className="flex items-center gap-1 mb-5 border-b border-[var(--border-color)]">
        {([['ideas', `Content ideas${ideas.length ? ` · ${ideas.filter((p) => p.status === 'draft').length} new` : ''}`], ['legacy', `Old drafts${legacy.length ? ` · ${legacy.length}` : ''}`]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setView(k); setFilter('draft'); setBucket('all') }}
            className={`px-4 py-2.5 text-sm -mb-px border-b-2 transition-colors ${view === k ? 'border-[#C9A227] text-[var(--text)]' : 'border-transparent text-[var(--text-3)] hover:text-[var(--text)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
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
        <div className="flex items-center gap-2">
          {view === 'ideas' ? (
            <button
              onClick={generateNow}
              disabled={generating}
              className="bg-[#C9A227] text-[#090909] text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#d4ac2d] transition-colors disabled:opacity-50"
            >
              {generating ? 'Finding ideas… (1 to 3 min)' : '✦ Find new ideas'}
            </button>
          ) : null}
          <button
            onClick={refresh}
            disabled={refreshing}
            className="border border-[var(--border-color)] text-[var(--text-2)] text-sm px-4 py-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Bucket chips (ideas only) */}
      {view === 'ideas' ? (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {(['all', ...BUCKETS] as const).map((b) => {
            const active = bucket === b
            const n = b === 'all' ? Object.values(bucketCounts).reduce((a, x) => a + x, 0) : bucketCounts[b] ?? 0
            return (
              <button
                key={b}
                onClick={() => setBucket(b)}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors border ${
                  active ? 'border-[#C9A227] text-[#C9A227] bg-[#C9A227]/10' : 'border-[var(--border-color)] text-[var(--text-3)] hover:text-[var(--text)]'
                }`}
              >
                {b === 'all' ? 'All buckets' : BUCKET_LABEL[b]}
                {n ? <span className="ml-1 opacity-60">{n}</span> : null}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-[var(--text-3)] text-xs mb-6">
          Finished posts from the old generator (before concept briefs). Kept as they were.
        </p>
      )}

      {visible.length === 0 ? (
        <div className="border border-[var(--border-color)] rounded-xl p-10 text-center">
          <p className="text-[var(--text-2)] text-sm">
            {view === 'ideas'
              ? filter === 'draft'
                ? 'No new ideas yet. They arrive daily from Circle calls, member stories, testimonials and Gogo\'s teachings. Or hit Find new ideas.'
                : 'Nothing here yet.'
              : `No ${filter} posts.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {visible.map((p) =>
            p.source_type === 'concept' && p.brief ? (
              <BriefCard key={p.id} post={p} onStatus={setStatus} onRemove={remove} onEdit={patchLocal} />
            ) : (
              <PostCard key={p.id} post={p} onStatus={setStatus} onRemove={remove} onEdit={patchLocal} />
            )
          )}
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
  const [feedback, setFeedback] = useState(post.feedback ?? '')
  const [showFeedback, setShowFeedback] = useState(false)
  const [savingFb, setSavingFb] = useState(false)
  const dirty = caption !== post.caption || hashtags !== post.hashtags
  const slideCount = Math.max(1, post.slides?.length ?? 1)

  async function saveFeedback() {
    setSavingFb(true)
    try {
      const res = await fetch(`/api/content/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      })
      if (!res.ok) { toast('Could not save feedback', 'error'); return }
      onEdit(post.id, { feedback })
      toast('Feedback saved — future posts will use it')
      setShowFeedback(false)
    } finally {
      setSavingFb(false)
    }
  }

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
        <Badge>{post.format === 'carousel' ? `Carousel · ${slideCount}` : post.format === 'video' ? `Reel · ${slideCount} beats` : 'Single'}</Badge>
        <Badge>{post.platform === 'both' ? 'IG + FB' : post.platform}</Badge>
        <Badge tone={statusTone}>{post.status}</Badge>
        <span className="text-[var(--text-3)] text-sm ml-1 truncate">{post.trigger_summary}</span>
      </div>

      <div className="p-5 flex flex-col lg:flex-row gap-6">
        {/* Slides */}
        <div className="lg:w-[46%] shrink-0">
          {post.format === 'video' ? (
            /* Reel script — a shot-by-shot storyboard for a human to film. */
            <ol className="space-y-2.5">
              {post.slides.map((s, i) => {
                const label = i === 0 ? 'Hook · first 2s' : i === slideCount - 1 ? 'CTA beat' : `Beat ${i + 1}`
                return (
                  <li key={i} className="rounded-lg border border-[var(--border-color)] p-3 bg-[var(--bg)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: 'var(--gold-soft)', color: GOLD, border: `1px solid ${GOLD}` }}>{i + 1}</span>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-3)]">{label}</span>
                    </div>
                    {s.headline ? <p className="text-[12.5px] text-[var(--text)]"><span className="text-[var(--text-3)]">On-screen:</span> {s.headline}</p> : null}
                    {s.body ? <p className="text-[13px] text-[var(--text)] mt-1"><span style={{ color: GOLD }}>Say:</span> {s.body}</p> : null}
                    {s.imageDirection ? <p className="text-[12px] text-[var(--text-3)] mt-1">Shot: {s.imageDirection}</p> : null}
                  </li>
                )
              })}
            </ol>
          ) : (
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
          )}
          {post.art_direction ? (
            <button onClick={() => setShowBrief((v) => !v)} className="text-xs text-[var(--text-3)] hover:text-[#C9A227] mt-1">
              {showBrief ? '▾ Hide' : '▸ Show'} {post.format === 'video' ? 'reel notes (pacing / music / setting)' : 'visual / Canva brief'}
            </button>
          ) : null}
          {showBrief ? (
            <p className="text-[var(--text-2)] text-xs leading-relaxed mt-2 whitespace-pre-wrap border-l-2 border-[var(--border-color)] pl-3">
              {post.art_direction}
              {post.format !== 'video' && post.slides?.some((s) => s.imageDirection) ? (
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
              <button onClick={save} disabled={saving} className="bg-[#C9A227] text-[#090909] text-sm font-medium px-3.5 py-1.5 rounded-lg disabled:opacity-40">
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
                Discard
              </button>
            ) : null}
            <button
              onClick={() => setShowFeedback((v) => !v)}
              className={`border text-sm px-3.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] ${post.feedback ? 'border-[#C9A227] text-[#C9A227]' : 'border-[var(--border-color)] text-[var(--text-2)]'}`}
            >
              ✎ Feedback
            </button>
            <button onClick={() => onRemove(post.id)} className="text-[var(--text-3)] text-sm px-2 py-1.5 rounded-lg hover:text-[#ff8080] ml-auto">
              Delete
            </button>
          </div>

          {showFeedback ? (
            <div className="mt-3 border border-[var(--border-color)] rounded-lg p-3 bg-[var(--surface-2)]">
              <p className="text-[var(--text-3)] text-xs mb-2">
                Tell the system how to make posts better (tone, length, what to emphasize, what to avoid).
                This guides all future generations.
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={2}
                placeholder="e.g. Punchier hooks, less salesy, always lead with the number…"
                className="w-full bg-[var(--bg)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm text-[var(--text)]"
              />
              <button onClick={saveFeedback} disabled={savingFb} className="mt-2 bg-[#C9A227] text-[#090909] text-sm font-medium px-3.5 py-1.5 rounded-lg disabled:opacity-40">
                {savingFb ? 'Saving…' : 'Save feedback'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function briefAsText(post: ContentPost): string {
  const b = post.brief!
  const lines = [
    `BUCKET: ${post.bucket ? BUCKET_LABEL[post.bucket] : ''}`,
    `CONCEPT: ${b.concept}`,
    b.quote ? `QUOTE: "${b.quote}"` : '',
    `WHO THIS IS FOR: ${b.who}`,
    `PAIN: ${b.pain}`,
    `GOGO ANGLE: ${b.gogo_angle}`,
    b.story ? `STORY: Where they were: ${b.story.where} | The real problem: ${b.story.problem} | What they're changing: ${b.story.changing} | What they're building: ${b.story.building}` : '',
    `WHY THIS SELLS THE CIRCLE: ${b.why_circle}`,
    `FORMAT: ${b.format}`,
    `SUGGESTED VISUAL: ${VISUAL_LABEL[b.visual_type] ?? b.visual_type}${b.visual_note ? `. ${b.visual_note}` : ''}`,
  ]
  return lines.filter(Boolean).join('\n\n')
}

function BriefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[170px_1fr] gap-1 sm:gap-4 py-2.5 border-t border-[var(--border-color)]/60">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-3)] pt-0.5">{label}</p>
      <div className="text-sm text-[var(--text)] leading-relaxed">{children}</div>
    </div>
  )
}

function BriefCard({
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
  const b = post.brief!
  const [feedback, setFeedback] = useState(post.feedback ?? '')
  const [showFeedback, setShowFeedback] = useState(false)
  const [savingFb, setSavingFb] = useState(false)
  const statusTone = post.status === 'approved' ? 'green' : post.status === 'rejected' ? 'red' : post.status === 'posted' ? 'gold' : 'muted'
  const statusLabel = post.status === 'draft' ? 'new' : post.status === 'approved' ? 'using' : post.status === 'rejected' ? 'passed' : post.status

  async function saveFeedback() {
    setSavingFb(true)
    try {
      const res = await fetch(`/api/content/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      })
      if (!res.ok) { toast('Could not save feedback', 'error'); return }
      onEdit(post.id, { feedback })
      toast('Feedback saved, future ideas will use it')
      setShowFeedback(false)
    } finally {
      setSavingFb(false)
    }
  }

  function copyBrief() {
    navigator.clipboard.writeText(briefAsText(post)).then(
      () => toast('Brief copied'),
      () => toast('Copy failed', 'error')
    )
  }

  return (
    <div className="border border-[var(--border-color)] rounded-xl bg-[var(--surface)] overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-[var(--border-color)]">
        <Badge tone="gold">{post.bucket ? BUCKET_LABEL[post.bucket] : 'Idea'}</Badge>
        <Badge>{b.format}</Badge>
        <Badge tone={statusTone}>{statusLabel}</Badge>
        {b.named ? <Badge tone="green">Approved to name</Badge> : post.bucket === 'transformation' || post.bucket === 'pearls' || post.bucket === 'coach' ? <Badge>Anonymous</Badge> : null}
        <span className="text-[var(--text-3)] text-xs ml-auto truncate max-w-full" title={post.trigger_summary}>From: {post.trigger_summary}</span>
      </div>

      <div className="px-5 pt-4 pb-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--gold-text)] mb-1.5">Concept</p>
        <h3 className="font-serif text-[22px] leading-snug text-[var(--text)]">{b.concept}</h3>
        {b.quote && b.quote.replace(/\W+/g, '').toLowerCase() !== b.concept.replace(/\W+/g, '').toLowerCase() ? (
          <blockquote className="mt-3 border-l-2 border-[#C9A227] pl-3 text-[15px] italic text-[var(--text)]">
            &ldquo;{b.quote}&rdquo;
            <span className="not-italic block text-[11px] text-[var(--text-3)] mt-1">
              {b.quote_source === 'testimonial' ? 'From the testimonial, word for word' : b.quote_source === 'call' ? 'Gogo, on a Circle call, word for word' : 'Gogo, from her teachings'}
            </span>
          </blockquote>
        ) : null}
      </div>

      <div className="px-5 pb-4">
        <BriefRow label="Who this is for">{b.who}</BriefRow>
        <BriefRow label="Pain">{b.pain}</BriefRow>
        <BriefRow label="Gogo angle">{b.gogo_angle}</BriefRow>
        {b.story ? (
          <BriefRow label="The story">
            <ul className="space-y-1">
              {b.story.where ? <li><span className="text-[var(--text-3)]">Where they were:</span> {b.story.where}</li> : null}
              {b.story.problem ? <li><span className="text-[var(--text-3)]">The real problem:</span> {b.story.problem}</li> : null}
              {b.story.changing ? <li><span className="text-[var(--text-3)]">What they&apos;re changing:</span> {b.story.changing}</li> : null}
              {b.story.building ? <li><span className="text-[var(--text-3)]">What they&apos;re building:</span> {b.story.building}</li> : null}
            </ul>
          </BriefRow>
        ) : null}
        <BriefRow label="Why this sells The Circle">{b.why_circle}</BriefRow>
        <BriefRow label="Format">{b.format}</BriefRow>
        <BriefRow label="Suggested visual">
          <span className="text-[#C9A227]">{VISUAL_LABEL[b.visual_type] ?? b.visual_type}</span>
          {b.visual_note ? <span className="text-[var(--text-2)]">. {b.visual_note}</span> : null}
        </BriefRow>
        <BriefRow label="North star">
          <span className="text-[var(--text-2)]">{b.does.map((d) => DOES_LABEL[d]).join(' · ')}</span>
          <span className="text-[var(--text-3)] text-xs ml-2">“That&apos;s me” score {b.score}/10</span>
        </BriefRow>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button onClick={copyBrief} className="border border-[var(--border-color)] text-[var(--text-2)] text-sm px-3.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)]">
            Copy brief
          </button>
          {post.status !== 'approved' && post.status !== 'posted' ? (
            <button onClick={() => onStatus(post.id, 'approved')} className="border text-sm px-3.5 py-1.5 rounded-lg" style={{ borderColor: 'rgba(91,189,104,0.5)', color: '#5bbd68' }}>
              Use this
            </button>
          ) : null}
          {post.status === 'approved' ? (
            <button onClick={() => onStatus(post.id, 'posted')} className="border text-sm px-3.5 py-1.5 rounded-lg" style={{ borderColor: 'rgba(201,162,39,0.5)', color: GOLD }}>
              Mark posted
            </button>
          ) : null}
          {post.status !== 'rejected' ? (
            <button onClick={() => onStatus(post.id, 'rejected')} className="border border-[var(--border-color)] text-[var(--text-3)] text-sm px-3.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)]">
              Pass
            </button>
          ) : null}
          <button
            onClick={() => setShowFeedback((v) => !v)}
            className={`border text-sm px-3.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] ${post.feedback ? 'border-[#C9A227] text-[#C9A227]' : 'border-[var(--border-color)] text-[var(--text-2)]'}`}
          >
            ✎ Feedback
          </button>
          <button onClick={() => onRemove(post.id)} className="text-[var(--text-3)] text-sm px-2 py-1.5 rounded-lg hover:text-[#ff8080] ml-auto">
            Delete
          </button>
        </div>

        {showFeedback ? (
          <div className="mt-3 border border-[var(--border-color)] rounded-lg p-3 bg-[var(--surface-2)]">
            <p className="text-[var(--text-3)] text-xs mb-2">
              Tell the strategist what makes a better idea (what to look for, what to skip, angles that work). This guides all future ideas.
            </p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              placeholder="e.g. More ideas about investing, fewer about tech setup…"
              className="w-full bg-[var(--bg)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm text-[var(--text)]"
            />
            <button onClick={saveFeedback} disabled={savingFb} className="mt-2 bg-[#C9A227] text-[#090909] text-sm font-medium px-3.5 py-1.5 rounded-lg disabled:opacity-40">
              {savingFb ? 'Saving…' : 'Save feedback'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
