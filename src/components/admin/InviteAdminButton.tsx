'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'

type TeamRole = 'admin' | 'manager' | 'support'

const ROLES: { value: TeamRole; label: string; description: string }[] = [
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full access — members, blueprints, reports, team management. Same level as you.',
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Can log weeks, manage homework, generate and send reports. Cannot manage team or send blueprints.',
  },
  {
    value: 'support',
    label: 'Support / VA',
    description: 'View-only access to member profiles and logs. Cannot add, edit, or send anything.',
  },
]

export default function InviteAdminButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('manager')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setName('')
    setEmail('')
    setRole('manager')
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
        body: JSON.stringify({ name, email, role }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); toast(data.error ?? 'Could not send invite', 'error'); return }

      setSuccess(true)
      toast(`Invite sent to ${name}`)
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

  const selectedRole = ROLES.find(r => r.value === role)!

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-4 py-2 rounded hover:bg-[#d4ac2d] transition-colors"
      >
        + Invite Team Member
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[var(--text)] font-serif text-xl">Invite Team Member</h2>
                <p className="text-[var(--text-3)] text-xs mt-1">They&apos;ll receive a login link immediately.</p>
              </div>
              <button onClick={() => { setOpen(false); reset() }} className="text-[var(--text-3)] hover:text-[var(--text)] text-lg">✕</button>
            </div>

            {success ? (
              <div className="text-center py-8">
                <p className="text-[#C9A227] font-serif text-lg">Invite sent ✓</p>
                <p className="text-[var(--text-2)] text-sm mt-1">
                  Login link sent to {email} with <span className="capitalize">{role}</span> access.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Adriana Martinez"
                    className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
                  />
                </div>

                {/* Role selector */}
                <div>
                  <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-2">Access Level</label>
                  <div className="space-y-2">
                    {ROLES.map(r => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={`w-full text-left px-3 py-2.5 rounded border transition-all ${
                          role === r.value
                            ? 'border-[#C9A227] bg-[#C9A227]/8'
                            : 'border-[var(--border-color)] hover:border-[var(--border-hover)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-sm font-medium ${role === r.value ? 'text-[#C9A227]' : 'text-[var(--text)]'}`}>
                            {r.label}
                          </span>
                          {role === r.value && <span className="text-[#C9A227] text-xs">✓</span>}
                        </div>
                        <p className="text-[var(--text-3)] text-xs leading-snug">{r.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-[#CC1F1F] text-xs">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { setOpen(false); reset() }}
                    className="flex-1 border border-[var(--border-color)] text-[var(--text-2)] text-sm py-2.5 rounded hover:border-[var(--border-hover)] transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 bg-[#C9A227] text-[#0D0D0D] text-sm font-medium py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40">
                    {loading ? 'Sending…' : `Invite as ${selectedRole.label}`}
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
