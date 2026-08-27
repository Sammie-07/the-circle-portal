'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'

export default function SendResetButton({ email, memberName }: { email: string; memberName: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleSend() {
    if (!confirm(`Email a password reset link to ${memberName} at ${email}?`)) return
    setStatus('sending')
    try {
      const res = await fetch('/api/auth/admin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        toast(data.error ?? 'Could not send reset link', 'error')
        setTimeout(() => setStatus('idle'), 3000)
        return
      }
      setStatus('sent')
      toast(`Password reset link sent to ${memberName}`)
      setTimeout(() => setStatus('idle'), 4000)
    } catch {
      setStatus('error')
      toast('Could not send the reset link', 'error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={status === 'sending'}
      className="text-xs border border-[var(--border-color)] text-[var(--text-2)] px-3 py-1.5 rounded hover:border-[#C9A227] hover:text-[#C9A227] transition-all disabled:opacity-40"
    >
      {status === 'sending' ? 'Sending…'
        : status === 'sent' ? '✓ Reset link sent'
        : status === 'error' ? 'Error — try again'
        : '🔑 Send Password Reset'}
    </button>
  )
}
