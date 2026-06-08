'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface MemberDocument {
  id: string
  doc_type: string
  title: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  uploaded_at: string
}

const DOC_TYPE_OPTIONS: { value: string; label: string; defaultTitle: string }[] = [
  { value: 'contract', label: 'Contract', defaultTitle: 'Signed Contract' },
  { value: 'disc', label: 'DISC Assessment', defaultTitle: 'DISC Assessment' },
  { value: 'application', label: 'Application', defaultTitle: 'Application' },
  { value: 'headshot', label: 'Headshot', defaultTitle: 'Headshot' },
  { value: 'other', label: 'Other', defaultTitle: '' },
]

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DOC_TYPE_OPTIONS.map(o => [o.value, o.label])
)

function isImage(doc: MemberDocument): boolean {
  if (doc.doc_type === 'headshot') return true
  return (doc.mime_type ?? '').startsWith('image/')
}

export default function MemberDocumentsPanel({ memberId }: { memberId: string }) {
  const router = useRouter()
  const [docs, setDocs] = useState<MemberDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [docType, setDocType] = useState('contract')
  const [title, setTitle] = useState('Signed Contract')
  const [file, setFile] = useState<File | null>(null)
  const [titleTouched, setTitleTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/member-documents?memberId=${memberId}`)
      const data = await res.json()
      if (res.ok) setDocs(data.documents ?? [])
    } catch {
      // network error — leave existing list in place
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setDocType('contract')
    setTitle('Signed Contract')
    setTitleTouched(false)
    setFile(null)
    setError('')
    setOpen(true)
  }

  function handleTypeChange(value: string) {
    setDocType(value)
    if (!titleTouched) {
      const opt = DOC_TYPE_OPTIONS.find(o => o.value === value)
      setTitle(opt?.defaultTitle ?? '')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    if (!file) { setError('Please choose a file.'); return }
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('member_id', memberId)
      fd.append('doc_type', docType)
      fd.append('title', title.trim())
      fd.append('file', file)
      const res = await fetch('/api/member-documents', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setOpen(false)
      await load()
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(doc: MemberDocument) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/member-documents/${doc.id}`, { method: 'DELETE' })
      if (res.ok) { await load(); router.refresh() }
    } catch {
      // ignore — list stays as-is
    }
  }

  const inputClass = "w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
  const labelClass = "block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5"

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[#C9A227] text-xs tracking-[0.2em] uppercase mb-1">Member Files</p>
          <h2 className="text-[var(--text)] font-serif text-xl">Documents</h2>
          <p className="text-[var(--text-3)] text-xs mt-1">Contract, DISC, application, headshot &amp; onboarding files.</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-[#C9A227] text-[#0D0D0D] font-medium text-sm px-4 py-2 rounded hover:bg-[#d4ac2d] transition-colors"
        >
          + Add Document
        </button>
      </div>

      {loading ? (
        <p className="text-[var(--text-3)] text-sm">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-[var(--text-3)] text-sm">No documents yet. Upload this member&apos;s contract, DISC, application or headshot.</p>
      ) : (
        <ul className="space-y-3">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-start justify-between gap-4 bg-[var(--bg)] border border-[var(--border-color)] rounded px-4 py-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                {isImage(doc) && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/member-documents/${doc.id}/download`}
                    alt={doc.title}
                    className="w-12 h-12 rounded object-cover border border-[var(--border-color)] flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-[#C9A227] border border-[#C9A227]/30 rounded px-1.5 py-0.5">
                      {TYPE_LABEL[doc.doc_type] ?? doc.doc_type}
                    </span>
                    <p className="text-[var(--text)] font-medium text-sm truncate">{doc.title}</p>
                  </div>
                  {doc.file_name && (
                    <p className="text-[var(--text-3)] text-xs mt-1 truncate">{doc.file_name}</p>
                  )}
                  <p className="text-[var(--text-3)] text-xs mt-0.5">Uploaded {fmtDate(doc.uploaded_at)}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a
                  href={`/api/member-documents/${doc.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-[var(--border-color)] text-[var(--text-2)] text-xs px-3 py-1.5 rounded hover:border-[#C9A227] hover:text-[var(--text)] transition-colors"
                >
                  Download
                </a>
                <button
                  onClick={() => handleDelete(doc)}
                  className="border border-[#CC1F1F]/30 text-[#CC1F1F] text-xs px-3 py-1.5 rounded hover:border-[#CC1F1F]/60 transition-colors"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[var(--text)] font-serif text-xl">Add Document</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--text-3)] hover:text-[var(--text)] text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Type</label>
                <select
                  value={docType}
                  onChange={e => handleTypeChange(e.target.value)}
                  className={inputClass}
                >
                  {DOC_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Title <span className="text-[#CC1F1F]">*</span></label>
                <input
                  value={title}
                  onChange={e => { setTitle(e.target.value); setTitleTouched(true) }}
                  required
                  placeholder="e.g. Signed Contract"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>File <span className="text-[#CC1F1F]">*</span></label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.csv,image/*"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  required
                  className={inputClass + ' file:mr-3 file:rounded file:border-0 file:bg-[#C9A227] file:px-3 file:py-1 file:text-[#0D0D0D] file:text-xs'}
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
                  {saving ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
