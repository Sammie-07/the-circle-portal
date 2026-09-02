'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const DOC_TYPE_OPTIONS: { value: string; label: string; defaultTitle: string }[] = [
  { value: 'contract', label: 'Contract', defaultTitle: 'Signed Contract' },
  { value: 'disc', label: 'DISC Assessment', defaultTitle: 'DISC Assessment' },
  { value: 'application', label: 'Application', defaultTitle: 'Application' },
  { value: 'headshot', label: 'Headshot', defaultTitle: 'Headshot' },
  { value: 'other', label: 'Other', defaultTitle: '' },
]

export default function MemberDocumentUpload({ memberId }: { memberId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [docType, setDocType] = useState('contract')
  const [title, setTitle] = useState('Signed Contract')
  const [titleTouched, setTitleTouched] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      const opt = DOC_TYPE_OPTIONS.find((o) => o.value === value)
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
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]'
  const labelClass = 'block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5'

  return (
    <>
      <button
        onClick={openAdd}
        className="bg-[#C9A227] text-[#090909] font-medium text-sm px-4 py-2 rounded hover:bg-[#d4ac2d] transition-colors flex-shrink-0"
      >
        + Upload Document
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[var(--text)] font-serif text-xl">Upload Document</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--text-3)] hover:text-[var(--text)] text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Type</label>
                <select value={docType} onChange={(e) => handleTypeChange(e.target.value)} className={inputClass}>
                  {DOC_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Title <span className="text-[#CC1F1F]">*</span></label>
                <input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setTitleTouched(true) }}
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
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                  className={inputClass + ' file:mr-3 file:rounded file:border-0 file:bg-[#C9A227] file:px-3 file:py-1 file:text-[#090909] file:text-xs'}
                />
              </div>

              {error && <p className="text-[#CC1F1F] text-xs">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 border border-[var(--border-color)] text-[var(--text-2)] text-sm py-2.5 rounded hover:border-[#C9A227] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-[#C9A227] text-[#090909] text-sm font-medium py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40">
                  {saving ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
