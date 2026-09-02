'use client'

import { useState } from 'react'

interface NoteEntry {
  id: string
  title: string
  content: string
  updated_at: string
}

interface Props {
  initialEntries: NoteEntry[]
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function preview(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ')
  if (!trimmed) return 'Empty note'
  return trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed
}

export default function MyNotes({ initialEntries }: Props) {
  const [entries, setEntries] = useState<NoteEntry[]>(initialEntries)
  const [selectedId, setSelectedId] = useState<string | null>(initialEntries[0]?.id ?? null)
  const [title, setTitle] = useState<string>(initialEntries[0]?.title ?? '')
  const [content, setContent] = useState<string>(initialEntries[0]?.content ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [busy, setBusy] = useState(false)

  const selected = entries.find((e) => e.id === selectedId) ?? null

  function openEntry(entry: NoteEntry) {
    setSelectedId(entry.id)
    setTitle(entry.title)
    setContent(entry.content)
    setStatus('idle')
  }

  async function createNote() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/member-note-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled note', content: '' }),
      })
      if (!res.ok) return
      const { entry } = (await res.json()) as { entry: NoteEntry }
      setEntries((prev) => [entry, ...prev])
      openEntry(entry)
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!selectedId || busy) return
    setBusy(true)
    setStatus('saving')
    try {
      const res = await fetch(`/api/member-note-entries/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      if (!res.ok) {
        setStatus('idle')
        return
      }
      const { entry } = (await res.json()) as { entry: NoteEntry }
      setEntries((prev) =>
        [entry, ...prev.filter((e) => e.id !== entry.id)]
      )
      setTitle(entry.title)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!selectedId || busy) return
    if (!confirm('Delete this note? This cannot be undone.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/member-note-entries/${selectedId}`, { method: 'DELETE' })
      if (!res.ok) return
      const remaining = entries.filter((e) => e.id !== selectedId)
      setEntries(remaining)
      if (remaining[0]) {
        openEntry(remaining[0])
      } else {
        setSelectedId(null)
        setTitle('')
        setContent('')
        setStatus('idle')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
      {/* List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase">All Notes</p>
          <button
            onClick={createNote}
            disabled={busy}
            className="text-xs text-[var(--text-2)] border border-[var(--border-color)] rounded-full px-3 py-1 hover:border-[var(--gold-line)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
          >
            ＋ New note
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] p-5 text-center">
            <p className="text-[var(--text-3)] text-sm">No notes yet — create your first.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const active = entry.id === selectedId
              return (
                <li key={entry.id}>
                  <button
                    onClick={() => openEntry(entry)}
                    className="w-full text-left border rounded-[14px] px-3.5 py-2.5 transition-colors"
                    style={
                      active
                        ? { background: 'var(--gold-soft)', borderColor: 'var(--gold-line)' }
                        : { background: 'var(--surface)', borderColor: 'var(--border-color)' }
                    }
                  >
                    <p className="text-[var(--text)] text-sm font-medium truncate">{entry.title}</p>
                    <p className="text-[var(--text-3)] text-xs mt-0.5 truncate">{preview(entry.content)}</p>
                    <p className="text-[var(--text-4)] text-[10px] mt-1">updated {fmtDate(entry.updated_at)}</p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Editor */}
      <div>
        {selected ? (
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] overflow-hidden focus-within:border-[var(--gold-line)] transition-colors">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={save}
              placeholder="Untitled note"
              className="w-full bg-transparent text-[var(--text)] font-serif text-xl px-4 pt-4 pb-2 focus:outline-none placeholder-[var(--text-4)]"
            />
            <div className="px-4">
              <div className="h-px bg-[var(--border-color)]" />
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={save}
              placeholder="Write anything here — ideas, wins, reminders. Only you can see this."
              rows={18}
              className="w-full bg-transparent text-[var(--text-2)] placeholder-[var(--text-4)] text-sm leading-relaxed p-4 resize-none focus:outline-none focus:text-[var(--text)] transition-colors"
            />
            <div className="px-4 py-2 border-t border-[var(--border-color)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={save}
                  disabled={busy}
                  className="bg-[var(--gold)] text-black text-xs font-medium px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Save
                </button>
                {status === 'saving' && <span className="text-[var(--text-3)] text-[10px]">Saving…</span>}
                {status === 'saved' && <span className="text-green-500 text-[10px]">Saved ✓</span>}
              </div>
              <button
                onClick={remove}
                disabled={busy}
                className="text-[var(--red-text)] text-xs px-3 py-1.5 rounded-full hover:bg-[var(--red-soft)] transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] p-10 text-center h-full flex flex-col items-center justify-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ border: '1px solid var(--gold-line)', background: 'var(--gold-soft)' }}
            >
              <span className="text-[var(--gold)] text-2xl">◈</span>
            </div>
            <h2 className="text-[var(--text)] font-serif text-xl mb-3">No notes yet</h2>
            <p className="text-[var(--text-3)] text-sm leading-relaxed max-w-sm mx-auto">
              Create your first note with the “＋ New note” button.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
