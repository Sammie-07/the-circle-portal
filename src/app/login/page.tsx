'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // An old sign-in link that failed bounces here with ?error=auth_failed — point
  // them at the password setup/reset page instead of leaving them stuck.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'auth_failed') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('That old sign-in link no longer works. The portal now uses passwords — set yours below.')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) {
      setError('Incorrect email or password.')
      setLoading(false)
    } else {
      window.location.href = '/dashboard' // layout sends staff on to /admin
    }
  }

  const emailQ = email ? `&email=${encodeURIComponent(email)}` : ''
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
          <p className="text-[#C9A227] text-xs tracking-[0.3em] uppercase font-medium mb-2">
            The Circle · Coaching Program
          </p>
          <h1 className="text-[var(--text)] text-2xl font-serif text-center">Member Portal</h1>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227] to-transparent mb-6" />

        {/* Transition banner — the portal now uses passwords; existing members who
            haven't set one yet start here. (Safe to remove once everyone's migrated.) */}
        <a
          href={`/set-password?ctx=transition${emailQ}`}
          className="block mb-6 rounded-lg border border-[#C9A227]/40 bg-[#C9A227]/10 px-4 py-3 hover:bg-[#C9A227]/15 transition-colors"
        >
          <p className="text-[var(--text)] text-sm font-medium">🔒 New: the portal now uses passwords</p>
          <p className="text-[var(--text-2)] text-xs mt-0.5">
            Signing in for the first time since the change? <span className="text-[#C9A227] font-medium">Set your password →</span>
          </p>
        </a>

        <form onSubmit={handlePassword} className="space-y-4">
          <div>
            <label className={labelClass}>Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="username" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Your password" autoComplete="current-password" className={inputClass} />
          </div>
          {error && (
            <div className="text-[var(--text-2)] text-xs leading-relaxed bg-[#C9A227]/10 border border-[#C9A227]/30 rounded px-3 py-2.5">{error}</div>
          )}
          <button type="submit" disabled={loading || !email || !password} className="w-full bg-[#C9A227] text-[#0D0D0D] font-medium text-sm py-3 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center">
            <a href={`/set-password?ctx=reset${emailQ}`} className="text-[#C9A227] text-xs font-medium hover:underline underline-offset-2 transition-colors">
              Forgot your password? Reset it →
            </a>
          </p>
          <p className="text-center text-[var(--text-3)] text-xs">Access is by invitation only.</p>
        </form>
      </div>
    </div>
  )
}
