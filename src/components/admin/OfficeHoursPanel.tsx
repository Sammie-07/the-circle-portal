'use client'

import { useState, useEffect, useCallback } from 'react'

interface OfficeHour {
  id: string
  title: string
  video_url: string
  call_date: string | null
  notes: string | null
  created_at: string
}

interface FormState {
  title: string
  video_url: string
  call_date: string
  notes: string
}

const EMPTY_FORM: FormState = { title: '', video_url: '', call_date: '', notes: '' }

export default function OfficeHoursPanel() {
  const [calls, setCalls] = useState<OfficeHour[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OfficeHour | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadCalls = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/office-hours')
      const data = await res.json()
      if (res.ok) setCalls(data.calls ?? [])
    } catch {
      // network error — leave existing list in place
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch the list on mount (loader toggles its own loading state).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadCalls() }, [loadCalls])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setOpen(true)
  }

  function openEdit(call: OfficeHour) {
    setEditing(call)
    setForm({
      title: call.title,
      video_url: call.video_url,
      call_date: call.call_date ?? '',
      notes: call.notes ?? '',
    })
    setError('')
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.video_url.trim()) {
      setError('Title and video URL are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const isEdit = !!editing
      const res = await fetch(
        isEdit ? `/api/office-hours/${editing!.id}` : '/api/office-hours',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      )
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setOpen(false)
      await loadCalls()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(call: OfficeHour) {
    if (!confirm(`Delete "${call.title}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/office-hours/${call.id}`, { method: 'DELETE' })
      if (res.ok) await loadCalls()
    } catch {
      // ignore — list stays as-is
    }
  }

  const inputClass = "w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
  const labelClass = "block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5"

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[#C9A227] text-xs tracking-[0.2em] uppercase mb-1">Recorded Sessions</p>
          <h2 className="text-[var(--text)] font-serif text-xl">Office Hours Replay</h2>
          <p className="text-[var(--text-3)] text-xs mt-1">Weekly recordings shown to every member.</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-[#C9A227] text-[#0D0D0D] font-medium text-sm px-4 py-2 rounded hover:bg-[#d4ac2d] transition-colors"
        >
          + Add Recording
        </button>
      </div>

      {loading ? (
        <p className="text-[var(--text-3)] text-sm">Loading…</p>
      ) : calls.length === 0 ? (
        <p className="text-[var(--text-3)] text-sm">No office hours added yet. Add a recording URL and it will appear on every member&apos;s portal.</p>
      ) : (
        <ul className="space-y-3">
          {calls.map((call) => (
            <li
              key={call.id}
              className="flex items-start justify-between gap-4 bg-[var(--bg)] border border-[var(--border-color)] rounded px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-[var(--text)] font-medium text-sm truncate">{call.title}</p>
                {call.call_date && (
                  <p className="text-[var(--text-3)] text-xs mt-0.5">{fmtDate(call.call_date)}</p>
                )}
                {call.notes && (
                  <p className="text-[var(--text-2)] text-xs mt-1 line-clamp-2">{call.notes}</p>
                )}
                <a
                  href={call.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#C9A227]/80 hover:text-[#C9A227] text-xs mt-1 inline-block truncate max-w-xs"
                >
                  {call.video_url}
                </a>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(call)}
                  className="border border-[var(--border-color)] text-[var(--text-2)] text-xs px-3 py-1.5 rounded hover:border-[#C9A227] hover:text-[var(--text)] transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(call)}
                  className="border border-[#CC1F1F]/30 text-[#CC1F1F] text-xs px-3 py-1.5 rounded hover:border-[#CC1F1F]/60 transition-colors"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add / Edit modal */}
      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[var(--text)] font-serif text-xl">{editing ? 'Edit Recording' : 'Add Office Hours'}</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--text-3)] hover:text-[var(--text)] text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Title <span className="text-[#CC1F1F]">*</span></label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  placeholder="e.g. Office Hours — Week of Jun 2"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Video URL <span className="text-[#CC1F1F]">*</span></label>
                <input
                  type="url"
                  value={form.video_url}
                  onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                  required
                  placeholder="YouTube, Vimeo, Loom, Google Drive, or Zoom link"
                  className={inputClass}
                />
                <p className="text-[var(--text-4)] text-xs mt-1.5">
                  YouTube, Vimeo, Loom and Google Drive play inline. Zoom recordings open in a new tab (add the passcode in Notes if needed).
                </p>
              </div>
              <div>
                <label className={labelClass}>Call Date</label>
                <input
                  type="date"
                  value={form.call_date}
                  onChange={e => setForm(f => ({ ...f, call_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={4}
                  placeholder="What was covered, key takeaways…"
                  className={inputClass + ' resize-none'}
                />
              </div>

              {error && <p className="text-[#CC1F1F] text-xs">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 border border-[var(--border-color)] text-[var(--text-2)] text-sm py-2.5 rounded hover:border-[var(--border-hover)] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-[#C9A227] text-[#0D0D0D] text-sm font-medium py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Recording'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
