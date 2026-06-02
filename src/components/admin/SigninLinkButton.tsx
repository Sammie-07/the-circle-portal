'use client'

import { useState } from 'react'

export default function SigninLinkButton({ email }: { email: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')

  async function handleCopy() {
    setStatus('loading')
    try {
      const res = await fetch('/api/invite/signin-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setStatus('error'); setTimeout(() => setStatus('idle'), 3000); return }

      await navigator.clipboard.writeText(data.link)
      setStatus('copied')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={status === 'loading'}
      className="text-xs border border-[var(--border-color)] text-[var(--text-2)] px-3 py-1.5 rounded hover:border-[#C9A227] hover:text-[#C9A227] transition-all disabled:opacity-40"
    >
      {status === 'loading' ? 'Generating…'
        : status === 'copied' ? '✓ Link Copied'
        : status === 'error' ? 'Error — try again'
        : '⟳ Copy Sign-In Link'}
    </button>
  )
}
