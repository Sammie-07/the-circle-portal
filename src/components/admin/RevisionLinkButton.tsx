'use client'

import { useState } from 'react'

// Generates a blueprint-revision questionnaire link for a member, emails it to
// them, and also copies it to the clipboard as a backup for the admin.
export default function RevisionLinkButton({ memberId }: { memberId: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'copiedonly' | 'error'>('idle')
  const [url, setUrl] = useState('')

  async function handleGenerate() {
    setStatus('loading')
    try {
      const res = await fetch('/api/blueprints/revision/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const data = await res.json()
      if (!res.ok) { setStatus('error'); setTimeout(() => setStatus('idle'), 3000); return }

      setUrl(data.url)
      try { await navigator.clipboard.writeText(data.url) } catch {}
      // emailed === false means no email on file / send failed — link still copied.
      setStatus(data.emailed ? 'sent' : 'copiedonly')
      setTimeout(() => setStatus('idle'), 4000)
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
        {status === 'loading' ? 'Sending…'
          : status === 'sent' ? '✓ Emailed to member (link copied)'
          : status === 'copiedonly' ? '✓ Link copied (no email on file)'
          : status === 'error' ? 'Error — try again'
          : '⟳ Send Blueprint Revision Link'}
      </button>
      {url && status === 'idle' && (
        <button
          onClick={() => { navigator.clipboard.writeText(url); setStatus('copiedonly'); setTimeout(() => setStatus('idle'), 2000) }}
          className="text-[#C9A227] text-xs hover:underline truncate max-w-[160px]"
          title={url}
        >
          Copy again
        </button>
      )}
    </div>
  )
}
