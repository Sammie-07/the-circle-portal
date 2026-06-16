'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'

export default function SendInviteButton({ email, memberName }: { email: string; memberName: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSend() {
    if (!confirm(`Send portal access link to ${memberName} at ${email}?`)) return
    setStatus('sending')
    setError('')

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to send')
      setStatus('error')
      toast(data.error ?? 'Failed to send invite', 'error')
      return
    }

    setStatus('sent')
    toast(`Invite sent to ${memberName}`)
  }

  if (status === 'sent') {
    return (
      <span className="text-green-400 text-xs font-medium">
        ✓ Invite sent to {email}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[#CC1F1F] text-xs">{error}</span>}
      <button
        onClick={handleSend}
        disabled={status === 'sending'}
        className="text-xs bg-[#C9A227] text-[#0D0D0D] font-bold px-4 py-2 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
      >
        {status === 'sending' ? 'Sending…' : '✉ Send Portal Invite'}
      </button>
    </div>
  )
}
