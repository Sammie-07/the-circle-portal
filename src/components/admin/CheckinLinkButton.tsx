'use client'

import { useState } from 'react'

export default function CheckinLinkButton({ memberId }: { memberId: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')
  const [url, setUrl] = useState('')

  async function handleGenerate() {
    setStatus('loading')
    try {
      const res = await fetch('/api/checkin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const data = await res.json()
      if (!res.ok) { setStatus('error'); return }

      setUrl(data.url)
      await navigator.clipboard.writeText(data.url)
      setStatus('copied')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleGenerate}
        disabled={status === 'loading'}
        className="text-xs border border-[var(--border-color)] text-[var(--text-2)] px-3 py-1.5 rounded hover:border-[#C9A227] hover:text-[#C9A227] transition-all disabled:opacity-40"
      >
        {status === 'loading' ? 'Generating…'
          : status === 'copied' ? '✓ Link Copied'
          : status === 'error' ? 'Error — try again'
          : '⟳ Copy Check-In Link'}
      </button>
      {url && status === 'idle' && (
        <button
          onClick={() => { navigator.clipboard.writeText(url); setStatus('copied'); setTimeout(() => setStatus('idle'), 2000) }}
          className="text-[#C9A227] text-xs hover:underline truncate max-w-[160px]"
          title={url}
        >
          Copy again
        </button>
      )}
    </div>
  )
}
