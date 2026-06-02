'use client'

import { useState } from 'react'

export default function InviteAdminButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setName('')
    setEmail('')
    setError('')
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }

      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        reset()
        window.location.reload()
      }, 2500)
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
        + Invite Admin
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-serif text-xl">Invite Admin</h2>
                <p className="text-[#555] text-xs mt-1">Sends a login link immediately. They'll have full admin access.</p>
              </div>
              <button onClick={() => { setOpen(false); reset() }} className="text-[#555] hover:text-white text-lg">✕</button>
            </div>

            {success ? (
              <div className="text-center py-8">
                <p className="text-[#C9A227] font-serif text-lg">Admin invited ✓</p>
                <p className="text-[#888] text-sm mt-1">Login link sent to {email}. They'll have full admin access.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Adriana Martinez"
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
                    placeholder="name@example.com"
                    className="w-full bg-[#0D0D0D] border border-[#2A2A2A] text-white placeholder-[#444] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
                  />
                </div>

                {error && <p className="text-[#CC1F1F] text-xs">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setOpen(false); reset() }}
                    className="flex-1 border border-[#2A2A2A] text-[#888] text-sm py-2.5 rounded hover:border-[#444] transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 bg-[#C9A227] text-[#0D0D0D] text-sm font-medium py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40">
                    {loading ? 'Sending…' : 'Send Login Link'}
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
