'use client'

import { useState } from 'react'

type Role = 'member' | 'admin'

export default function InviteMemberButton() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<Role>('member')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cohort, setCohort] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setRole('member')
    setName('')
    setEmail('')
    setCohort('')
    setError('')
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const endpoint = role === 'admin' ? '/api/admin-invite' : '/api/members'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, cohort: cohort || undefined }),
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
        + Add Member
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-serif text-xl">Add to The Circle</h2>
              <button onClick={() => { setOpen(false); reset() }} className="text-[#555] hover:text-white text-lg">✕</button>
            </div>

            {success ? (
              <div className="text-center py-8">
                <p className="text-[#C9A227] font-serif text-lg">
                  {role === 'admin' ? 'Admin invited ✓' : 'Member added ✓'}
                </p>
                <p className="text-[#888] text-sm mt-1">
                  {role === 'admin'
                    ? `Login link sent to ${email}. They'll have full admin access.`
                    : `Go to their page to build out their backend, then send portal access.`}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Role toggle */}
                <div className="flex rounded overflow-hidden border border-[#2A2A2A]">
                  {(['member', 'admin'] as Role[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                        role === r
                          ? 'bg-[#C9A227] text-[#0D0D0D]'
                          : 'text-[#555] hover:text-[#888]'
                      }`}
                    >
                      {r === 'member' ? '◉ Member Access' : '◆ Admin Access'}
                    </button>
                  ))}
                </div>

                <p className="text-[#444] text-xs">
                  {role === 'member'
                    ? 'Creates their profile. No email sent — you control when they get portal access.'
                    : 'Sends a login link immediately. They can access all admin pages.'}
                </p>

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
                    placeholder="name@example.com"
                    className="w-full bg-[#0D0D0D] border border-[#2A2A2A] text-white placeholder-[#444] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
                  />
                </div>

                {role === 'member' && (
                  <div>
                    <label className="block text-xs text-[#888] uppercase tracking-wider mb-1.5">Cohort <span className="text-[#444]">(optional)</span></label>
                    <input
                      value={cohort}
                      onChange={e => setCohort(e.target.value)}
                      placeholder="May 2026"
                      className="w-full bg-[#0D0D0D] border border-[#2A2A2A] text-white placeholder-[#444] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
                    />
                  </div>
                )}

                {error && <p className="text-[#CC1F1F] text-xs">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setOpen(false); reset() }}
                    className="flex-1 border border-[#2A2A2A] text-[#888] text-sm py-2.5 rounded hover:border-[#444] transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 bg-[#C9A227] text-[#0D0D0D] text-sm font-medium py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40">
                    {loading
                      ? (role === 'admin' ? 'Sending…' : 'Adding…')
                      : (role === 'admin' ? 'Send Admin Invite' : 'Add Member')}
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
