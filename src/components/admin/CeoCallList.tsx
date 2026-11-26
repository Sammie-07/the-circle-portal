'use client'

import { useEffect, useState } from 'react'
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
  roadmap_status: 'none' | 'generating' | 'ready' | 'error'
  roadmap_error: string | null
  roadmap_token: string | null
  roadmap_fathom_link: string | null
  roadmap_has_transcript: boolean
  roadmap_generated_at: string | null
  roadmap_started_at: string | null
  roadmap_email: string | null
  roadmap_sent_at: string | null
}

const stamp = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET'
// A background run that outlived the 5-minute function limit never reports back.
const stuck = (c: CeoCall) => c.roadmap_status === 'generating' && !!c.roadmap_started_at && Date.now() - new Date(c.roadmap_started_at).getTime() > 7 * 60_000

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })

export default function CeoCallList({ calls }: { calls: CeoCall[] }) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Roadmaps take a couple of minutes: refresh while any are generating.
  const generating = calls.some((c) => c.roadmap_status === 'generating' && !stuck(c))
  useEffect(() => {
    if (!generating) return
    const t = setInterval(() => router.refresh(), 8000)
    return () => clearInterval(t)
  }, [generating, router])

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

          <RoadmapPanel c={c} onChange={() => router.refresh()} />

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

function RoadmapPanel({ c, onChange }: { c: CeoCall; onChange: () => void }) {
  const [fathom, setFathom] = useState(c.roadmap_fathom_link ?? '')
  const [paste, setPaste] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [showRefine, setShowRefine] = useState(false)
  const [email, setEmail] = useState(c.roadmap_email ?? c.email ?? '')
  const [working, setWorking] = useState<'' | 'generate' | 'send'>('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const isStuck = stuck(c)
  const ready = c.roadmap_status === 'ready' && c.roadmap_token
  const generatingNow = c.roadmap_status === 'generating' && !isStuck

  async function generate(withFeedback: boolean) {
    setWorking('generate')
    setMsg(null)
    const res = await fetch(`/api/admin/ceo-calls/${c.id}/roadmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fathom_link: fathom.trim() || undefined, transcript: paste.trim() || undefined, feedback: withFeedback ? feedback : undefined }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setWorking('')
    if (!res?.ok) { setMsg({ ok: false, text: data?.error ?? 'Could not start. Try again.' }); return }
    setFeedback('')
    setShowRefine(false)
    onChange()
  }

  async function send() {
    if (!confirm(`Email the 12-Month CEO Roadmap to ${email}?`)) return
    setWorking('send')
    setMsg(null)
    const res = await fetch(`/api/admin/ceo-calls/${c.id}/roadmap/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setWorking('')
    if (!res?.ok) { setMsg({ ok: false, text: data?.error ?? 'Could not send. Try again.' }); return }
    setMsg({ ok: true, text: `Sent to ${data.sent_to}` })
    onChange()
  }

  const input = 'w-full rounded-lg border border-[var(--border-2)] bg-transparent text-[var(--text)] text-[13px] px-3 py-2'
  const goldBtn = { borderColor: 'var(--gold-line)', background: 'var(--gold-soft)', color: 'var(--gold-text)' }

  return (
    <div className="mt-4 rounded-[12px] border border-[var(--border-color)] p-4" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold-text)]">12-Month CEO Roadmap</p>
        {c.roadmap_generated_at && ready && <span className="text-[11px] text-[var(--text-4)]">Generated {stamp(c.roadmap_generated_at)}{c.roadmap_sent_at ? ` · Sent ${stamp(c.roadmap_sent_at)}` : ''}</span>}
      </div>

      {generatingNow && (
        <div className="flex items-center gap-3 py-2">
          <div className="w-4 h-4 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin flex-none" />
          <p className="text-[13px] text-[var(--text-2)]">Writing the roadmap from the call… this takes 2-4 minutes. You can leave this page.</p>
        </div>
      )}

      {(c.roadmap_status === 'error' || isStuck) && (
        <p className="text-[12px] text-[#ff8080] mb-3">
          {isStuck ? 'The last run did not finish. Generate it again.' : `The last run failed${c.roadmap_error ? `: ${c.roadmap_error}` : ''}.`}
        </p>
      )}

      {!generatingNow && !ready && (
        <div className="space-y-2.5">
          <p className="text-[13px] text-[var(--text-3)]">After the CEO Call, add the call&apos;s Fathom link and generate their roadmap.</p>
          <input value={fathom} onChange={(e) => setFathom(e.target.value)} placeholder="https://fathom.video/share/..." className={input} />
          <button onClick={() => setShowPaste(!showPaste)} className="text-[12px] text-[var(--text-3)] hover:text-[var(--text)]">
            {showPaste ? 'Hide transcript box' : 'No Fathom link? Paste the transcript instead'}
          </button>
          {showPaste && <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} placeholder="Paste the full call transcript" className={input} />}
          <div>
            <button onClick={() => generate(false)} disabled={working !== '' || (!fathom.trim() && !paste.trim() && !c.roadmap_has_transcript)}
              className="text-[12px] rounded-full px-4 py-1.5 border disabled:opacity-40" style={goldBtn}>
              {working === 'generate' ? 'Starting…' : c.roadmap_has_transcript && !fathom.trim() && !paste.trim() ? 'Generate again from the saved transcript' : 'Generate roadmap'}
            </button>
          </div>
        </div>
      )}

      {ready && !generatingNow && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <a href={`/roadmap/${c.roadmap_token}`} target="_blank" className="text-[12px] rounded-full px-4 py-1.5 border" style={goldBtn}>Preview roadmap ↗</a>
            <button onClick={() => setShowRefine(!showRefine)} className="text-[12px] text-[var(--text-3)] hover:text-[var(--text)]">
              {showRefine ? 'Cancel changes' : '↻ Regenerate with changes'}
            </button>
          </div>
          {showRefine && (
            <div className="space-y-2">
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="What should change? e.g. make months 1-3 about hiring an assistant first, add more on content" className={input} />
              <button onClick={() => generate(true)} disabled={working !== '' || !feedback.trim()} className="text-[12px] rounded-full px-4 py-1.5 border disabled:opacity-40" style={goldBtn}>
                {working === 'generate' ? 'Starting…' : 'Regenerate'}
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="their@email.com" className={`${input} max-w-[280px]`} />
            <button onClick={send} disabled={working !== '' || !email.trim()} className="text-[12px] rounded-full px-4 py-2 font-medium disabled:opacity-40" style={{ background: 'var(--gold)', color: '#0B0B0B' }}>
              {working === 'send' ? 'Sending…' : c.roadmap_sent_at ? 'Send again' : `Send to ${(c.name ?? 'them').split(' ')[0]}`}
            </button>
          </div>
        </div>
      )}

      {msg && <p className="text-[12px] mt-2" style={{ color: msg.ok ? '#4cc38a' : '#ff8080' }}>{msg.text}</p>}
    </div>
  )
}
