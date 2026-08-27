'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SetPasswordForm({ email }: { email: string }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 8) { setError('Please use at least 8 characters.'); return }
    if (pw !== confirm) { setError('Those passwords don’t match.'); return }
    setLoading(true)
    setError('')
    const { error } = await createClient().auth.updateUser({ password: pw })
    if (error) {
      setError(error.message || 'Could not set your password. Please try again.')
      setLoading(false)
      return
    }
    // Straight into the portal; the dashboard layout routes staff on to /admin.
    window.location.href = '/dashboard'
  }

  const inputClass =
    'w-full bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors'
  const labelClass = 'block text-xs text-[var(--text-2)] uppercase tracking-wider mb-2'

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full border-2 border-[#CC1F1F] flex items-center justify-center mb-4 relative">
            <div className="w-2 h-2 rounded-full bg-[#CC1F1F] absolute top-2 left-1/2 -translate-x-1/2" />
            <div className="w-2 h-2 rounded-full bg-[#CC1F1F] absolute bottom-2 left-1/2 -translate-x-1/2" />
            <div className="w-2 h-2 rounded-full bg-[#CC1F1F] absolute left-2 top-1/2 -translate-y-1/2" />
            <div className="w-2 h-2 rounded-full bg-[#CC1F1F] absolute right-2 top-1/2 -translate-y-1/2" />
          </div>
          <p className="text-[#C9A227] text-xs tracking-[0.3em] uppercase font-medium mb-2">The Circle · Coaching Program</p>
          <h1 className="text-[var(--text)] text-2xl font-serif text-center">Set your password</h1>
          <p className="text-[var(--text-3)] text-xs mt-2 text-center leading-relaxed">
            You’re verified as <span className="text-[#C9A227]">{email}</span>.<br />
            Choose a password — you’ll use it to sign in from now on.
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227] to-transparent mb-8" />

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>New password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} placeholder="At least 8 characters" autoComplete="new-password" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Re-enter your password" autoComplete="new-password" className={inputClass} />
          </div>
          {error && (
            <div className="text-[var(--text-2)] text-xs leading-relaxed bg-[#C9A227]/10 border border-[#C9A227]/30 rounded px-3 py-2.5">{error}</div>
          )}
          <button type="submit" disabled={loading || !pw || !confirm} className="w-full bg-[#C9A227] text-[#0D0D0D] font-medium text-sm py-3 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Saving…' : 'Save password & continue'}
          </button>
          <p className="text-center">
            <a href="/dashboard" className="text-[var(--text-3)] text-xs hover:text-[#C9A227] transition-colors">
              Skip for now
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}
