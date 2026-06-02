'use client'

import { useState } from 'react'

export default function InviteMemberButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cohort, setCohort] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, cohort }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }

      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
        setName('')
        setEmail('')
        setCohort('')
        window.location.reload()
      }, 2000)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-4 py-2 rounded hover:bg-[#d4ac2d] transition-colors"
      >
        + Add Member
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-serif text-xl">Add Member</h2>
              <button onClick={() => setOpen(false)} className="text-[#555] hover:text-white text-lg">✕</button>
            </div>
            <p className="text-[#555] text-xs mb-6">Creates their profile. No email sent — you control when they get portal access.</p>

            {success ? (
              <div className="text-center py-8">
                <p className="text-[#C9A227] font-serif text-lg">Member added ✓</p>
                <p className="text-[#888] text-sm mt-1">Go to their page to build out their backend.</p>
              </div>
            ) : (
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Christine Polizzi"
                    className="w-full bg-[#0D0D0D] border border-[#2A2A2A] text-white placeholder-[#444] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="member@example.com"
                    className="w-full bg-[#0D0D0D] border border-[#2A2A2A] text-white placeholder-[#444] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">Cohort <span className="text-[#444]">(optional)</span></label>
                  <input
                    value={cohort}
                    onChange={e => setCohort(e.target.value)}
                    placeholder="May 2026"
                    className="w-full bg-[#0D0D0D] border border-[#2A2A2A] text-white placeholder-[#444] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
                  />
                </div>

                {error && <p className="text-[#CC1F1F] text-xs">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setOpen(false)}
                    className="flex-1 border border-[#2A2A2A] text-[#888] text-sm py-2.5 rounded hover:border-[#444] transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 bg-[#C9A227] text-[#0D0D0D] text-sm font-medium py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40">
                    {loading ? 'Adding…' : 'Add Member'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
