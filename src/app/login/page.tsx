'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'link' | 'code'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  const [mode, setMode] = useState<Mode>('link')
  const [codeStep, setCodeStep] = useState<'request' | 'enter'>('request')
  const [code, setCode] = useState('')
  const [suggestCode, setSuggestCode] = useState(false)

  // Recover the session from an implicit-flow magic link. Some links come back
  // with the tokens in the URL hash (#access_token=…), which the server route
  // can't read — so it bounces here. Catch them client-side and set the session.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash || !hash.includes('access_token')) return

    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    // Strip the tokens out of the address bar immediately.
    window.history.replaceState(null, '', window.location.pathname)
    if (!access_token || !refresh_token) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSigningIn(true)
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setError('That sign-in link could not be verified. Please request a new one.')
          setSigningIn(false)
        } else {
          window.location.href = '/dashboard'
        }
      })
  }, [])

  // A failed/expired sign-in link (from /auth/confirm) bounces here with
  // ?error=auth_failed. Surface a clear message + steer them to the code option,
  // which survives email link-scanners that "pre-click" one-time links.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'auth_failed') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('That sign-in link didn’t work — it may have expired, already been used, or been opened by your email’s security scanner. Get a login code instead (it works even when links don’t).')
      setSuggestCode(true)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // Send a magic link (default).
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

  // Request a login code.
  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/otp-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
      } else {
        setCodeStep('enter')
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Verify the login code and sign in.
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'That code is invalid or has expired.')
      } else {
        window.location.href = data.redirect ?? '/dashboard'
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  function switchTo(next: Mode) {
    setMode(next)
    setError('')
    setSuggestCode(false)
    setCodeStep('request')
    setCode('')
  }

  const inputClass =
    'w-full bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors'
  const primaryBtn =
    'w-full bg-[#C9A227] text-[#0D0D0D] font-medium text-sm py-3 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  const errorBox = error && (
    <div className="text-[var(--text-2)] text-xs leading-relaxed bg-[#C9A227]/10 border border-[#C9A227]/30 rounded px-3 py-2.5 space-y-2">
      <p>{error}</p>
      {suggestCode && mode === 'link' && (
        <button
          type="button"
          onClick={() => switchTo('code')}
          className="inline-block bg-[#C9A227] text-[#0D0D0D] font-medium text-xs px-3 py-1.5 rounded hover:bg-[#d4ac2d] transition-colors"
        >
          Email me a login code instead →
        </button>
      )}
    </div>
  )

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

        {signingIn ? (
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-[#C9A227]/30 border-t-[#C9A227] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--text-2)] text-sm">Signing you in…</p>
          </div>
        ) : sent ? (
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
            <p className="text-[var(--text-3)] text-xs mt-4 leading-relaxed">
              Link keeps bouncing you back here? Some email providers (Outlook/Hotmail) open the link
              automatically and use it up.
            </p>
            <button
              onClick={() => { setSent(false); switchTo('code') }}
              className="mt-2 text-xs text-[#C9A227] hover:underline"
            >
              Email me a login code instead →
            </button>
            <div>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-4 text-xs text-[var(--text-3)] hover:text-[#C9A227] transition-colors"
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : mode === 'code' ? (
          codeStep === 'enter' ? (
            /* Enter the code */
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-[var(--text)] font-serif text-lg mb-1">Enter your code</h2>
                <p className="text-[var(--text-3)] text-xs leading-relaxed">
                  We sent a login code to <span className="text-[#C9A227]">{email}</span>
                </p>
              </div>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                required
                placeholder="12345678"
                className={`${inputClass} text-center tracking-[0.35em] text-lg font-mono`}
              />
              {errorBox}
              <button type="submit" disabled={loading || code.length < 6} className={primaryBtn}>
                {loading ? 'Verifying…' : 'Verify & sign in'}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => setCodeStep('request')} className="text-[var(--text-3)] hover:text-[#C9A227] transition-colors">
                  ← Resend / change email
                </button>
                <button type="button" onClick={() => switchTo('link')} className="text-[var(--text-3)] hover:text-[#C9A227] transition-colors">
                  Use a link instead
                </button>
              </div>
            </form>
          ) : (
            /* Request a code */
            <form onSubmit={requestCode} className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-2">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>
              {errorBox}
              <button type="submit" disabled={loading || !email} className={primaryBtn}>
                {loading ? 'Sending…' : 'Email me a login code'}
              </button>
              <p className="text-center text-xs">
                <button type="button" onClick={() => switchTo('link')} className="text-[#C9A227] font-medium hover:underline underline-offset-2 transition-colors">
                  Prefer a login link? →
                </button>
              </p>
              <p className="text-center text-[var(--text-3)] text-xs">Access is by invitation only.</p>
            </form>
          )
        ) : (
          /* Default: send a magic link */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-2">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            {errorBox}

            <button type="submit" disabled={loading || !email} className={primaryBtn}>
              {loading ? 'Sending…' : 'Send login link'}
            </button>

            <p className="text-center text-xs">
              <button type="button" onClick={() => switchTo('code')} className="text-[#C9A227] font-medium hover:underline underline-offset-2 transition-colors">
                Trouble with the link? Email me a login code instead →
              </button>
            </p>

            <p className="text-center text-[var(--text-3)] text-xs">
              Access is by invitation only.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
