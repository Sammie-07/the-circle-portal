'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'

export default function WeeklyDigestCard() {
  const [sending, setSending] = useState(false)

  async function sendPreview() {
    setSending(true)
    try {
      const res = await fetch('/api/admin/digest-preview', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast(data.error ?? 'Could not send preview', 'error'); return }
      toast(`Preview sent to ${data.sent_to}`)
    } catch {
      toast('Network error — please try again', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-5 max-w-md">
      <h2 className="text-[var(--text)] font-serif text-lg mb-1">Weekly Member Digest</h2>
      <p className="text-[var(--text-3)] text-xs leading-relaxed mb-4">
        Every <strong className="text-[var(--text-2)]">Tuesday at 9am ET</strong>, the team (you and the admins)
        gets an email recap of each member&apos;s past week — what they completed, their portal comments, and
        attendance — to get everyone up to speed before office hours. Send yourself a preview anytime.
      </p>
      <button
        onClick={sendPreview}
        disabled={sending}
        className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-5 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
      >
        {sending ? 'Sending…' : 'Send me a preview now'}
      </button>
    </div>
  )
}
