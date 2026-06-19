'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-10">
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

        <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227] to-transparent mb-8" />

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border border-[#C9A227]/30 bg-[#C9A227]/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-[#C9A227]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-[var(--text)] font-serif text-lg mb-2">Check your inbox</h2>
            <p className="text-[var(--text-2)] text-sm leading-relaxed">
              We sent a login link to<br />
              <span className="text-[#C9A227]">{email}</span>
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="mt-6 text-xs text-[var(--text-2)] hover:text-[#C9A227] transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors"
              />
            </div>

            {error && (
              <p className="text-[#CC1F1F] text-xs">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-[#C9A227] text-[#0D0D0D] font-medium text-sm py-3 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Send login link'}
            </button>

            <p className="text-center text-[var(--text-3)] text-xs">
              Access is by invitation only.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
