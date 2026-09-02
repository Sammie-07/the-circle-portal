'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// The Circle — new design tokens (scoped to login; the global roll-out follows).
const C = {
  bg: '#090909', surface: '#0E0E0E', border: '#0E0E0E', border2: '#262421',
  text: '#F2F0EC', text2: '#9A958D', text3: '#6E6A64',
  gold: '#C9A227', goldText: '#E8CF7A', goldSoft: 'rgba(201,162,39,0.13)', goldLine: 'rgba(201,162,39,0.35)',
  red: '#CC1F1F',
}
const serif = "'Playfair Display', Georgia, serif"
const sans = "'DM Sans', system-ui, sans-serif"

// The Circle network mark — a ring with four connection nodes.
function CircleMark({ size = 30 }: { size?: number }) {
  const dot = Math.round(size * 0.13)
  const off = Math.round(size * 0.1)
  const mid = size / 2 - dot / 2
  const d = (pos: React.CSSProperties): React.CSSProperties => ({ width: dot, height: dot, borderRadius: '50%', background: C.red, position: 'absolute', ...pos })
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', border: `1px solid ${C.red}`, position: 'relative', flex: 'none' }}>
      <div style={d({ top: off, left: mid })} />
      <div style={d({ bottom: off, left: mid })} />
      <div style={d({ left: off, top: mid })} />
      <div style={d({ right: off, top: mid })} />
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
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

  const fieldWrap: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '13px 15px', borderRadius: 10, border: `1px solid ${C.border2}`,
    background: C.surface,
  }
  const input: React.CSSProperties = {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: C.text, fontSize: 14, fontFamily: sans,
  }
  const eyebrow: React.CSSProperties = {
    margin: '0 0 8px', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.text2,
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: sans }} className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr]">

      {/* Left brand panel (desktop only) */}
      <div
        className="hidden md:flex"
        style={{
          position: 'relative', overflow: 'hidden', padding: 64,
          flexDirection: 'column', justifyContent: 'space-between',
          background: `radial-gradient(90% 80% at 15% 0%, rgba(204,31,31,0.16) 0%, rgba(0,0,0,0) 60%), ${C.surface}`,
          borderRight: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CircleMark />
          <span style={{ fontFamily: serif, fontSize: 19 }}>The Circle</span>
        </div>
        <div style={{ maxWidth: '30ch' }}>
          <p style={{ margin: '0 0 18px', fontSize: 10, letterSpacing: '0.32em', textTransform: 'uppercase', color: C.goldText }}>Coaching Program</p>
          <h1 style={{ margin: 0, fontFamily: serif, fontSize: 56, fontWeight: 400, lineHeight: 1.08, letterSpacing: '-0.02em' }}>A room built for the ones who show up.</h1>
          <p style={{ margin: '22px 0 0', fontSize: 14.5, lineHeight: 1.7, color: C.text2 }}>Your blueprint, your homework, your call replays and Gogo&apos;s brain — all in one place.</p>
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: C.text3 }}>Access is by invitation only.</p>
      </div>

      {/* Right sign-in panel */}
      <div className="flex items-center justify-center" style={{ padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: 352 }}>
          {/* Mobile brand mark (left panel is hidden) */}
          <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 26 }}>
            <CircleMark />
            <span style={{ fontFamily: serif, fontSize: 18 }}>The Circle</span>
          </div>

          <h2 style={{ margin: '0 0 6px', fontFamily: serif, fontSize: 28, fontWeight: 400 }}>Member sign in</h2>
          <p style={{ margin: '0 0 22px', fontSize: 13.5, color: C.text2 }}>Welcome back to The Circle.</p>

          {/* Passwords notice → first-time / transition set-password */}
          <a
            href={`/set-password?ctx=transition${emailQ}`}
            style={{ display: 'block', marginBottom: 26, padding: '16px 18px', borderRadius: 12, border: `1px solid ${C.goldLine}`, background: C.goldSoft }}
          >
            <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 500, color: C.text }}>The portal now uses passwords</p>
            <p style={{ margin: 0, fontSize: 12, color: C.text2 }}>First time since the change? <span style={{ color: C.goldText }}>Set your password →</span></p>
          </a>

          <form onSubmit={handlePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={eyebrow}>Email address</p>
              <div style={fieldWrap}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="username" style={input} />
              </div>
            </div>
            <div>
              <p style={eyebrow}>Password</p>
              <div style={{ ...fieldWrap, borderColor: C.goldLine }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Your password" autoComplete="current-password" style={input} />
                <button type="button" onClick={() => setShowPw((s) => !s)} style={{ background: 'none', border: 'none', color: C.text3, fontSize: 11, cursor: 'pointer', fontFamily: sans }}>
                  {showPw ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ fontSize: 12, lineHeight: 1.55, color: C.text2, background: C.goldSoft, border: `1px solid ${C.goldLine}`, borderRadius: 10, padding: '11px 13px' }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{ marginTop: 4, padding: '13px 0', borderRadius: 10, background: C.gold, color: '#0B0B0B', fontSize: 14, fontWeight: 500, fontFamily: sans, border: 'none', cursor: loading || !email || !password ? 'not-allowed' : 'pointer', opacity: loading || !email || !password ? 0.45 : 1 }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <a href={`/set-password?ctx=reset${emailQ}`} style={{ textAlign: 'center', fontSize: 12, color: C.goldText }}>Forgot your password? Reset it →</a>
          </form>
        </div>
      </div>
    </div>
  )
}
