'use client'

import { useEffect, useRef, useState } from 'react'

interface NoteEntry {
  id: string
  title: string
  content: string
  updated_at: string
}

interface Props {
  initialEntries: NoteEntry[]
}

type Status = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const AUTOSAVE_MS = 1200
const draftKey = (id: string) => `circle:note-draft:${id}`

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function preview(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ')
  if (!trimmed) return 'Empty note'
  return trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed
}

const isBlank = (e: { title: string; content: string }) =>
  !e.content.trim() && (!e.title.trim() || e.title.trim() === 'Untitled note')

function readDraft(id: string): { title: string; content: string } | null {
  try {
    const raw = localStorage.getItem(draftKey(id))
    return raw ? (JSON.parse(raw) as { title: string; content: string }) : null
  } catch {
    return null
  }
}
function writeDraft(id: string, title: string, content: string) {
  try { localStorage.setItem(draftKey(id), JSON.stringify({ title, content })) } catch {}
}
function clearDraft(id: string) {
  try { localStorage.removeItem(draftKey(id)) } catch {}
}

// Notes save as you type (and when you leave the page), not only when the
// box loses focus. Every keystroke is also kept on this device until the
// server confirms it, so a dropped connection or expired session never
// loses what was written. On phones the editor sits below the list, so
// opening or creating a note scrolls to it and puts the cursor in it.
export default function MyNotes({ initialEntries }: Props) {
  const [entries, setEntries] = useState<NoteEntry[]>(initialEntries)
  const [selectedId, setSelectedId] = useState<string | null>(initialEntries[0]?.id ?? null)
  const [title, setTitle] = useState<string>(initialEntries[0]?.title ?? '')
  const [content, setContent] = useState<string>(initialEntries[0]?.content ?? '')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [creating, setCreating] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  // Latest values for timers and page-leave handlers (closures go stale).
  const live = useRef({ id: selectedId, title, content, dirty: false })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = entries.find((e) => e.id === selectedId) ?? null

  async function persist(id: string, t: string, c: string): Promise<boolean> {
    if (live.current.id === id) setStatus('saving')
    try {
      const res = await fetch(`/api/member-note-entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, content: c }),
      })
      // An expired session redirects to the login page (HTML, not JSON).
      const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null
      if (!res.ok || !data?.entry) {
        throw new Error(data?.error ?? (res.redirected || !data ? 'Your session expired. Sign in again; your text is kept on this device.' : 'Could not save'))
      }
      const entry = data.entry as NoteEntry
      setEntries((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)])
      // Only clear the device copy if nothing new was typed meanwhile.
      if (!(live.current.id === id && live.current.dirty && (live.current.content !== c || live.current.title !== t))) {
        clearDraft(id)
        if (live.current.id === id) {
          live.current.dirty = false
          setStatus('saved')
          setErrorMsg('')
        }
      }
      return true
    } catch (e) {
      if (live.current.id === id) {
        setStatus('error')
        setErrorMsg(e instanceof Error ? e.message : 'Could not save')
      }
      return false
    }
  }

  async function flush() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const { id, title: t, content: c, dirty } = live.current
    if (id && dirty) await persist(id, t, c)
  }

  // Bring back anything typed on this device that never reached the server.
  useEffect(() => {
    const t = setTimeout(() => {
      const restored: NoteEntry[] = []
      for (const e of initialEntries) {
        const d = readDraft(e.id)
        if (d && (d.content !== e.content || d.title !== e.title)) restored.push({ ...e, ...d })
        else if (d) clearDraft(e.id)
      }
      if (!restored.length) return
      setEntries((prev) => prev.map((e) => restored.find((r) => r.id === e.id) ?? e))
      const cur = restored.find((r) => r.id === live.current.id)
      if (cur) {
        setTitle(cur.title)
        setContent(cur.content)
      }
      for (const r of restored) void persist(r.id, r.title, r.content)
    })
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  function edit(next: { title?: string; content?: string }) {
    const t = next.title ?? title
    const c = next.content ?? content
    if (next.title !== undefined) setTitle(t)
    if (next.content !== undefined) setContent(c)
    if (!selectedId) return
    live.current = { id: selectedId, title: t, content: c, dirty: true }
    writeDraft(selectedId, t, c)
    setStatus('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, AUTOSAVE_MS)
  }

  // Leaving the page (closing the tab, switching apps on a phone, following
  // a link) saves immediately; keepalive lets the request finish after unload.
  useEffect(() => {
    const send = () => {
      const { id, title: t, content: c, dirty } = live.current
      if (!id || !dirty) return
      fetch(`/api/member-note-entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, content: c }),
        keepalive: true,
      }).catch(() => {})
    }
    const onHide = () => { if (document.visibilityState === 'hidden') send() }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (live.current.dirty) { send(); e.preventDefault() }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', send)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', send)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  function showEditor(focus: boolean) {
    requestAnimationFrame(() => {
      // Phones stack the editor under the list; desktop shows both side by side.
      if (window.matchMedia('(max-width: 767px)').matches) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (focus) textRef.current?.focus({ preventScroll: true })
    })
  }

  async function openEntry(entry: NoteEntry, focus = false) {
    if (entry.id !== selectedId) await flush()
    setSelectedId(entry.id)
    setTitle(entry.title)
    setContent(entry.content)
    live.current = { id: entry.id, title: entry.title, content: entry.content, dirty: false }
    setStatus('idle')
    setErrorMsg('')
    showEditor(focus)
  }

  async function createNote() {
    if (creating) return
    // Reuse a blank note instead of stacking up empty ones.
    const blank = entries.find((e) => isBlank(e) && !(e.id === selectedId && (title.trim() && title !== 'Untitled note' || content.trim())))
    if (blank) { await openEntry(blank, true); return }
    setCreating(true)
    try {
      await flush()
      const res = await fetch('/api/member-note-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled note', content: '' }),
      })
      const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null
      if (!res.ok || !data?.entry) {
        setStatus('error')
        setErrorMsg(data?.error ?? 'Could not create a note. If this keeps happening, sign out and back in.')
        return
      }
      const entry = data.entry as NoteEntry
      setEntries((prev) => [entry, ...prev])
      await openEntry(entry, true)
    } finally {
      setCreating(false)
    }
  }

  async function remove() {
    if (!selectedId || creating) return
    if (!confirm('Delete this note? This cannot be undone.')) return
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const id = selectedId
    const res = await fetch(`/api/member-note-entries/${id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) { setStatus('error'); setErrorMsg('Could not delete the note.'); return }
    clearDraft(id)
    live.current = { id: null, title: '', content: '', dirty: false }
    const remaining = entries.filter((e) => e.id !== id)
    setEntries(remaining)
    if (remaining[0]) {
      await openEntry(remaining[0])
    } else {
      setSelectedId(null)
      setTitle('')
      setContent('')
      setStatus('idle')
    }
  }

  // The list shows what is on screen for the open note, even before it saves.
  const listed = entries.map((e) => (e.id === selectedId ? { ...e, title, content } : e))

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
      {/* List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase">
            All Notes{entries.length > 0 ? ` · ${entries.length}` : ''}
          </p>
          <button
            onClick={createNote}
            disabled={creating}
            className="inline-flex items-center gap-1.5 bg-[var(--gold)] text-[#0B0B0B] text-[12px] font-medium rounded-full px-3.5 py-1.5 hover:brightness-110 transition-all disabled:opacity-50"
          >
            <span className="text-[13px] leading-none">＋</span> New note
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] p-6 text-center">
            <p className="text-[var(--text-3)] text-sm">No notes yet — start your first.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {listed.map((entry) => {
              const active = entry.id === selectedId
              return (
                <li key={entry.id}>
                  <button
                    onClick={() => openEntry(entry)}
                    className="w-full text-left border rounded-[14px] px-4 py-3 transition-colors"
                    style={
                      active
                        ? { background: 'var(--gold-soft)', borderColor: 'var(--gold-line)', boxShadow: 'inset 2px 0 0 var(--gold)' }
                        : { background: 'var(--surface)', borderColor: 'var(--border-color)' }
                    }
                  >
                    <p className="text-[var(--text)] text-[13.5px] font-medium truncate">{entry.title || 'Untitled note'}</p>
                    <p className="text-[var(--text-3)] text-xs mt-1 truncate">{preview(entry.content)}</p>
                    <p className="text-[var(--text-4)] text-[10px] tracking-[0.02em] mt-1.5 uppercase">Updated {fmtDate(entry.updated_at)}</p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Editor */}
      <div ref={editorRef} className="scroll-mt-4">
        {selected ? (
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] overflow-hidden focus-within:border-[var(--gold-line)] transition-colors">
            <div className="px-6 pt-5 pb-0 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: 'var(--gold)' }} />
              <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-4)]">Private to you · updated {fmtDate(selected.updated_at)}</p>
            </div>
            <input
              value={title}
              onChange={(e) => edit({ title: e.target.value })}
              onBlur={() => { void flush() }}
              placeholder="Untitled note"
              className="w-full bg-transparent text-[var(--text)] font-serif text-[26px] leading-tight px-6 pt-2.5 pb-3.5 focus:outline-none placeholder-[var(--text-4)]"
            />
            <div className="px-6">
              <div className="h-px" style={{ background: 'var(--gold-line)' }} />
            </div>
            <textarea
              ref={textRef}
              value={content}
              onChange={(e) => edit({ content: e.target.value })}
              onBlur={() => { void flush() }}
              placeholder="Write or paste anything here — ideas, wins, reminders, scripts you want to remember. Only you can see this."
              rows={16}
              className="w-full bg-transparent text-[var(--text-2)] placeholder-[var(--text-4)] text-[14.5px] leading-[1.75] px-6 py-5 resize-none focus:outline-none focus:text-[var(--text)] transition-colors"
            />
            <div className="px-6 py-3.5 border-t border-[var(--border-color)] flex items-center justify-between gap-3" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => { void flush() }}
                  disabled={status === 'saving'}
                  className="bg-[var(--gold)] text-[#0B0B0B] text-xs font-medium px-4 py-1.5 rounded-full hover:brightness-110 transition-all disabled:opacity-50 flex-none"
                >
                  Save
                </button>
                {status === 'saving' && <span className="text-[var(--text-3)] text-[11px]">Saving…</span>}
                {status === 'saved' && <span className="text-[11px]" style={{ color: 'var(--gold-text)' }}>Saved ✓</span>}
                {status === 'dirty' && <span className="text-[var(--text-4)] text-[11px]">Saving as you type…</span>}
                {status === 'idle' && <span className="text-[var(--text-4)] text-[11px]">Saves automatically as you type</span>}
                {status === 'error' && <span className="text-[var(--red-text)] text-[11px]">{errorMsg || 'Could not save'} · <button onClick={() => { void flush() }} className="underline">Try again</button></span>}
              </div>
              <button
                onClick={remove}
                disabled={creating}
                className="text-[var(--red-text)] text-xs px-3 py-1.5 rounded-full hover:bg-[var(--red-soft)] transition-colors disabled:opacity-50 flex-none"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] p-12 text-center h-full flex flex-col items-center justify-center min-h-[320px]">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ border: '1px solid var(--gold-line)', background: 'var(--gold-soft)' }}
            >
              <span className="text-[var(--gold)] text-2xl">◈</span>
            </div>
            <h2 className="text-[var(--text)] font-serif text-xl mb-3">Your private workspace</h2>
            <p className="text-[var(--text-3)] text-sm leading-relaxed max-w-sm mx-auto">
              Ideas, wins, reminders, scripts — anything on your mind. Only you can see what you write here.
            </p>
            <button
              onClick={createNote}
              disabled={creating}
              className="mt-6 inline-flex items-center gap-1.5 bg-[var(--gold)] text-[#0B0B0B] text-[12.5px] font-medium rounded-full px-5 py-2.5 hover:brightness-110 transition-all disabled:opacity-50"
            >
              <span className="text-[13px] leading-none">＋</span> Create your first note
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
