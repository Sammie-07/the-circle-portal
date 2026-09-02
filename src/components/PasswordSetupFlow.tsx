'use client'

import { useEffect, useState } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type Ctx = 'activate' | 'transition' | 'reset'
type Step = 'email' | 'code' | 'password'

const COPY: Record<Ctx, { eyebrow: string; heading: string; blurb: string }> = {
  activate: {
    eyebrow: 'Account Activated',
    heading: 'Your account is live',
    blurb: 'Welcome to The Circle. Verify your email and set a password — that’s how you’ll sign in from now on.',
  },
  transition: {
    eyebrow: 'Security Update',
    heading: 'Set your password',
    blurb: 'We’ve moved The Circle to password login. Verify your email once and choose a password — you’ll use it to sign in from now on.',
  },
  reset: {
    eyebrow: 'Password Reset',
    heading: 'Reset your password',
    blurb: 'Verify your email with a code, then choose a new password.',
  },
}

export default function PasswordSetupFlow() {
  const [ctx, setCtx] = useState<Ctx>('transition')
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  // Read ?ctx / ?email and detect an existing session (e.g. arrived via an older
  // link that already signed them in → skip straight to choosing a password).
  useEffect(() => {
    if (typeof window === 'undefined') return
    /* eslint-disable react-hooks/set-state-in-effect -- mount-time init from URL + session probe */
    const params = new URLSearchParams(window.location.search)
    const c = params.get('ctx')
    if (c === 'activate' || c === 'transition' || c === 'reset') setCtx(c)
    const e = params.get('email')
    if (e) setEmail(e)
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? e ?? '')
        setStep('password')
      }
      setReady(true)
    })
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/otp-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Something went wrong. Please try again.')
      } else setStep('code')
    } catch { setError('Network error — please try again.') }
    finally { setLoading(false) }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    let ok = false
    for (const type of ['email', 'magiclink'] as EmailOtpType[]) {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type })
      if (!error) { ok = true; break }
    }
    if (!ok) {
      setError('That code is invalid or has expired. Request a new one.')
      setLoading(false)
      return
    }
    setStep('password')
    setLoading(false)
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 8) { setError('Please use at least 8 characters.'); return }
    if (pw !== confirm) { setError('Those passwords don’t match.'); return }
    setLoading(true); setError('')
    const { error } = await createClient().auth.updateUser({ password: pw })
    if (error) {
      setError(error.message || 'Could not save your password. Please try again.')
      setLoading(false)
      return
    }
    window.location.href = '/dashboard' // layout routes staff on to /admin
  }

  const inputClass =
    'w-full bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors'
  const labelClass = 'block text-xs text-[var(--text-2)] uppercase tracking-wider mb-2'
  const primaryBtn =
    'w-full bg-[#C9A227] text-[#090909] font-medium text-sm py-3 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const errorBox = error && (
    <div className="text-[var(--text-2)] text-xs leading-relaxed bg-[#C9A227]/10 border border-[#C9A227]/30 rounded px-3 py-2.5">{error}</div>
  )
  const c = COPY[ctx]

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
          <p className="text-[#C9A227] text-xs tracking-[0.3em] uppercase font-medium mb-2">{c.eyebrow}</p>
          <h1 className="text-[var(--text)] text-2xl font-serif text-center">{c.heading}</h1>
          <p className="text-[var(--text-3)] text-xs mt-2 text-center leading-relaxed">{c.blurb}</p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227] to-transparent mb-8" />

        {!ready ? (
          <div className="text-center"><div className="w-8 h-8 border-2 border-[#C9A227]/30 border-t-[#C9A227] rounded-full animate-spin mx-auto" /></div>
        ) : step === 'email' ? (
          <form onSubmit={requestCode} className="space-y-4">
            <div>
              <label className={labelClass}>Your email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className={inputClass} />
            </div>
            {errorBox}
            <button type="submit" disabled={loading || !email} className={primaryBtn}>
              {loading ? 'Sending…' : 'Email me a verification code'}
            </button>
            <p className="text-center text-[var(--text-4)] text-[11px] leading-relaxed">
              We’ll send an 8-digit code to confirm it’s really you. No links — nothing for your email
              provider to block.
            </p>
          </form>
        ) : step === 'code' ? (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-center text-[var(--text-3)] text-xs">
              We sent a code to <span className="text-[#C9A227]">{email}</span>.
            </p>
            <input
              inputMode="numeric" autoComplete="one-time-code" value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
              required placeholder="12345678"
              className={`${inputClass} text-center tracking-[0.35em] text-lg font-mono`}
            />
            {errorBox}
            <button type="submit" disabled={loading || code.length < 6} className={primaryBtn}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError('') }} className="w-full text-center text-xs text-[var(--text-3)] hover:text-[#C9A227] transition-colors">
              ← Resend or change email
            </button>
          </form>
        ) : (
          <form onSubmit={savePassword} className="space-y-4">
            <div>
              <label className={labelClass}>New password</label>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} placeholder="At least 8 characters" autoComplete="new-password" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Re-enter your password" autoComplete="new-password" className={inputClass} />
            </div>
            {errorBox}
            <button type="submit" disabled={loading || !pw || !confirm} className={primaryBtn}>
              {loading ? 'Saving…' : 'Save password & enter'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
