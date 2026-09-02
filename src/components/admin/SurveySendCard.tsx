'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SurveySendCard({
  monthName,
  sentAt,
}: {
  monthName: string
  sentAt: string | null
}) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(sentAt)

  async function send(force: boolean) {
    const verb = force ? 'Resend' : 'Send'
    if (
      !window.confirm(
        `${verb} the ${monthName} progress check now?\n\nThis emails every eligible member and makes the survey pop up in their portal until they complete it.`
      )
    )
      return
    setSending(true)
    try {
      const res = await fetch('/api/surveys/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error ?? 'Could not send the survey', 'error')
        return
      }
      if (data.alreadySent) {
        toast(`${monthName} was already sent. Use Resend if you need to send it again.`)
        return
      }
      setSent(new Date().toISOString())
      toast(`Sent the ${monthName} progress check to ${data.sent} member${data.sent === 1 ? '' : 's'} — it's now live in their portal.`)
    } catch {
      toast('Network error — please try again', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-5 max-w-md">
      <h2 className="text-[var(--text)] font-serif text-lg mb-1">Monthly Progress Survey</h2>
      <p className="text-[var(--text-3)] text-xs leading-relaxed mb-4">
        Automatic sending is <strong className="text-[var(--text-2)]">off</strong> while we review the survey.
        When you&apos;re ready, send this month&apos;s check-in yourself — it emails every eligible member and
        makes the survey pop up in their portal until they complete it.
      </p>

      {sent ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-[#5bbd68]" />
            <span className="text-[var(--text-2)]">
              {monthName} sent <span className="text-[var(--text-3)]">on {fmtDate(sent)}</span>
            </span>
          </div>
          <button
            onClick={() => send(true)}
            disabled={sending}
            className="self-start border border-[var(--border-color)] text-[var(--text-2)] text-sm px-4 py-2 rounded hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
          >
            {sending ? 'Resending…' : `Resend ${monthName} survey`}
          </button>
        </div>
      ) : (
        <button
          onClick={() => send(false)}
          disabled={sending}
          className="bg-[#C9A227] text-[#090909] text-sm font-medium px-5 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
        >
          {sending ? 'Sending…' : `Send ${monthName} survey now`}
        </button>
      )}
    </div>
  )
}
