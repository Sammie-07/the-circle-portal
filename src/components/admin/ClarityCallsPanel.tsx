'use client'

import { useState, useEffect, useCallback } from 'react'
import DateField from '@/components/shared/DateField'
import { toast } from '@/lib/toast'

interface ClarityCall {
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

// Zoom cloud recording share links expire (often ~2 weeks), after which they
// stop playing. Warn admins so they can re-host before the link dies.
const ZOOM_EXPIRY_DAYS = 14
function zoomExpiryWarning(url: string, callDate: string | null, createdAt: string): { text: string; urgent: boolean } | null {
  if (!/zoom\.us\//i.test(url)) return null
  const ref = callDate ? new Date(callDate) : new Date(createdAt)
  const days = Math.floor((Date.now() - ref.getTime()) / 86400000)
  if (days >= ZOOM_EXPIRY_DAYS) {
    return { text: `This recording is ${days} days old. Zoom replays usually expire ~2 weeks after the call, so this link may no longer work — expired Zoom recordings can't be recovered.`, urgent: true }
  }
  return { text: `Heads up: Zoom links usually expire ~2 weeks after the call. To keep this replay permanently, re-upload it to YouTube/Drive before then.`, urgent: false }
}

export default function ClarityCallsPanel({ memberId }: { memberId: string }) {
  const [calls, setCalls] = useState<ClarityCall[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ClarityCall | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadCalls = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clarity-calls?memberId=${memberId}`)
      const data = await res.json()
      if (res.ok) setCalls(data.calls ?? [])
    } catch {
      // network error — leave existing list in place
    } finally {
      setLoading(false)
    }
  }, [memberId])

  // Fetch the list on mount (loader toggles its own loading state).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadCalls() }, [loadCalls])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setOpen(true)
  }

  function openEdit(call: ClarityCall) {
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
        isEdit ? `/api/clarity-calls/${editing!.id}` : '/api/clarity-calls',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isEdit ? form : { member_id: memberId, ...form }),
        }
      )
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); toast(data.error ?? 'Could not save', 'error'); return }
      setOpen(false)
      await loadCalls()
      toast(isEdit ? 'Recording updated' : 'Recording added')
    } catch {
      setError('Network error — please try again')
      toast('Network error — please try again', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(call: ClarityCall) {
    if (!confirm(`Delete "${call.title}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/clarity-calls/${call.id}`, { method: 'DELETE' })
      if (res.ok) { await loadCalls(); toast('Recording deleted') }
      else toast('Could not delete', 'error')
    } catch {
      toast('Network error — please try again', 'error')
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
          <h2 className="text-[var(--text)] font-serif text-xl">Clarity Call Replay</h2>
          <p className="text-[var(--text-3)] text-xs mt-1">The member&apos;s clarity / onboarding call recording.</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-[#C9A227] text-[#0D0D0D] font-medium text-sm px-4 py-2 rounded hover:bg-[#d4ac2d] transition-colors"
        >
          + Add Call
        </button>
      </div>

      {loading ? (
        <p className="text-[var(--text-3)] text-sm">Loading…</p>
      ) : calls.length === 0 ? (
        <p className="text-[var(--text-3)] text-sm">No clarity calls added yet. Add a recording URL so this member can rewatch it.</p>
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
                {(() => {
                  const w = zoomExpiryWarning(call.video_url, call.call_date, call.created_at)
                  if (!w) return null
                  return (
                    <p className={`text-xs mt-1.5 flex items-start gap-1.5 ${w.urgent ? 'text-[#CC1F1F]' : 'text-amber-500'}`}>
                      <span className="flex-shrink-0">⚠</span>
                      <span>{w.text}</span>
                    </p>
                  )
                })()}
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
              <h2 className="text-[var(--text)] font-serif text-xl">{editing ? 'Edit Call' : 'Add Clarity Call'}</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--text-3)] hover:text-[var(--text)] text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Title <span className="text-[#CC1F1F]">*</span></label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  placeholder="e.g. Clarity Call — Week 1"
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
                <p className="text-amber-500 text-xs mt-1.5">
                  ⚠ Zoom share links usually expire ~2 weeks after the call. For a permanent replay, download the recording and re-upload it to YouTube (unlisted) or Google Drive.
                </p>
              </div>
              <div>
                <label className={labelClass}>Call Date</label>
                <DateField
                  value={form.call_date}
                  onChange={(v: string) => setForm(f => ({ ...f, call_date: v }))}
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
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
