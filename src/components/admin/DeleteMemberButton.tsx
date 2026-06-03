'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteMemberButton({
  memberId,
  memberName,
}: {
  memberId: string
  memberName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/members/${memberId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Delete failed'); setLoading(false); return }
      router.push('/admin')
    } catch {
      setError('Network error — please try again')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setConfirmText(''); setError('') }}
        className="border border-[#CC1F1F]/40 text-[#CC1F1F] text-sm px-4 py-2 rounded hover:bg-[#CC1F1F]/10 hover:border-[#CC1F1F]/70 transition-colors"
      >
        Delete Member
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] border border-[#CC1F1F]/30 rounded-lg w-full max-w-md p-6 text-left">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#CC1F1F] font-serif text-xl">Delete {memberName}?</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--text-3)] hover:text-[var(--text)] text-lg">✕</button>
            </div>

            <p className="text-[var(--text-2)] text-sm leading-relaxed mb-4">
              This permanently deletes the member, their login, all weekly logs, reports, and blueprint files.
              This <strong className="text-[var(--text)]">cannot be undone</strong>.
            </p>

            <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5">
              Type <span className="text-[#CC1F1F] normal-case font-medium">{memberName}</span> to confirm
            </label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#CC1F1F]"
            />

            {error && <p className="text-[#CC1F1F] text-xs mt-2">{error}</p>}

            <div className="flex gap-3 pt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 border border-[var(--border-color)] text-[var(--text-2)] text-sm py-2.5 rounded hover:border-[var(--border-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading || confirmText !== memberName}
                className="flex-1 bg-[#CC1F1F] text-white text-sm font-medium py-2.5 rounded hover:bg-[#d83333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
