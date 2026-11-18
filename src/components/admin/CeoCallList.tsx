'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface CeoCall {
  id: string
  created_at: string
  name: string | null
  email: string | null
  phone: string | null
  answers: Record<string, string>
  statement: string | null
  status: 'pending' | 'ready' | 'error'
  error: string | null
  ghl_sent_at: string | null
  ghl_error: string | null
}

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })

export default function CeoCallList({ calls }: { calls: CeoCall[] }) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function regenerate(id: string) {
    setBusy(id)
    await fetch(`/api/admin/ceo-calls/${id}`, { method: 'POST' }).catch(() => {})
    setBusy(null)
    router.refresh()
  }

  if (!calls.length) {
    return <p className="text-[var(--text-3)] text-sm py-10">No forms yet. They show up here as soon as someone submits the CEO Call Form.</p>
  }

  return (
    <div className="space-y-3">
      {calls.map((c) => (
        <div key={c.id} className="rounded-[16px] border border-[var(--border-color)] p-5" style={{ background: 'var(--surface)' }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div>
              <p className="text-[var(--text)] font-serif text-[20px]">{c.name ?? 'Unknown name'}</p>
              <p className="text-[var(--text-4)] text-[12px]">{[c.email, c.phone].filter(Boolean).join(' · ')}</p>
            </div>
            <span className="text-[var(--text-3)] text-[12px]">{when(c.created_at)}</span>
          </div>

          {c.status === 'ready' && c.statement && <p className="text-[var(--text)] text-[15px] leading-relaxed">{c.statement}</p>}
          {c.status === 'pending' && <p className="text-[var(--text-3)] text-sm">Writing the problem statement… refresh in a minute.</p>}
          {c.status === 'error' && <p className="text-[#ff8080] text-sm">Could not write the statement{c.error ? `: ${c.error}` : ''}.</p>}
          {c.status === 'ready' && (
            <p className="text-[11px] mt-2" style={{ color: c.ghl_error ? '#ff8080' : 'var(--text-4)' }}>
              {c.ghl_sent_at ? 'Sent to GHL ✓' : c.ghl_error ? `Not sent to GHL: ${c.ghl_error}` : 'Not sent to GHL yet'}
            </p>
          )}

          <div className="flex flex-wrap gap-4 mt-4 text-[12px]">
            <button onClick={() => setOpen(open === c.id ? null : c.id)} className="text-[var(--gold-text)] hover:text-[var(--gold)]">
              {open === c.id ? 'Hide their answers ▴' : 'See their answers ▾'}
            </button>
            {c.status !== 'pending' && (
              <button onClick={() => regenerate(c.id)} disabled={busy === c.id} className="text-[var(--text-3)] hover:text-[var(--text)] disabled:opacity-50">
                {busy === c.id ? 'Rewriting…' : '↻ Rewrite statement'}
              </button>
            )}
          </div>

          {open === c.id && (
            <dl className="mt-4 space-y-2.5 border-t border-[var(--border-color)] pt-4">
              {Object.entries(c.answers ?? {}).map(([q, a]) => (
                <div key={q}>
                  <dt className="text-[var(--text-4)] text-[12px]">{q}</dt>
                  <dd className="text-[var(--text)] text-[14px] whitespace-pre-wrap">{a}</dd>
                </div>
              ))}
              {!Object.keys(c.answers ?? {}).length && <p className="text-[var(--text-3)] text-sm">No answers came through with this submission.</p>}
            </dl>
          )}
        </div>
      ))}
    </div>
  )
}
