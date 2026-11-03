'use client'

import { useMemo, useState } from 'react'
import { ALL_QUESTIONS, FREEDOM_LABEL, answerLabel, type FreedomKey, type TestAnswers } from '@/lib/blueprint-test/questions'
import { DESTINATIONS, type Route, type Scores } from '@/lib/blueprint-test/score'
import type { TestResult } from '@/lib/blueprint-test/results'

export interface Lead {
  id: string
  token: string
  created_at: string
  name: string
  email: string
  phone: string | null
  answers: TestAnswers
  scores: Scores
  bottleneck: FreedomKey
  route: Route
  second_route: Route | null
  flags: string[]
  result: TestResult | null
  result_status: 'pending' | 'ready' | 'error'
  source: Record<string, unknown>
  status: 'new' | 'contacted' | 'booked' | 'joined' | 'not_fit'
  notes: string | null
}

const STATUS_LABEL: Record<Lead['status'], string> = {
  new: 'New', contacted: 'Contacted', booked: 'Call booked', joined: 'Joined', not_fit: 'Not a fit',
}
const ROUTE_SHORT: Record<Route, string> = { circle: 'The Circle', partner: 'Partner', community: 'GGTC', not_ready: 'Not ready' }
const ROUTE_COLOR: Record<Route, string> = { circle: '#C9A227', partner: '#5c9dff', community: '#4cc38a', not_ready: '#888' }

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function LeadsTable({ leads: initial }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initial)
  const [route, setRoute] = useState<Route | 'all'>('all')
  const [status, setStatus] = useState<Lead['status'] | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)

  const shown = useMemo(
    () => leads.filter((l) => (route === 'all' || l.route === route) && (status === 'all' || l.status === status)),
    [leads, route, status],
  )
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of leads) c[l.route] = (c[l.route] ?? 0) + 1
    return c
  }, [leads])

  async function update(id: string, patch: Partial<Pick<Lead, 'status' | 'notes'>>) {
    const prev = leads
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    const res = await fetch(`/api/admin/blueprint-tests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => null)
    if (!res?.ok) setLeads(prev)
  }

  if (!leads.length) {
    return <p className="text-[var(--text-3)] text-sm py-10">No one has taken the test yet. Share the public link to start collecting leads.</p>
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        <Chip on={route === 'all'} onClick={() => setRoute('all')}>All ({leads.length})</Chip>
        {(Object.keys(ROUTE_SHORT) as Route[]).map((r) => (
          <Chip key={r} on={route === r} onClick={() => setRoute(r)}>{ROUTE_SHORT[r]} ({counts[r] ?? 0})</Chip>
        ))}
        <select value={status} onChange={(e) => setStatus(e.target.value as Lead['status'] | 'all')}
          className="ml-auto rounded-full border border-[var(--border-2)] bg-transparent text-[var(--text-2)] text-[12px] px-3 py-1.5">
          <option value="all">Any status</option>
          {(Object.keys(STATUS_LABEL) as Lead['status'][]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="rounded-[16px] border border-[var(--border-color)] overflow-hidden" style={{ background: 'var(--surface)' }}>
        {shown.map((l) => (
          <div key={l.id} className="border-b border-[var(--border-color)] last:border-b-0">
            <button onClick={() => setOpen(open === l.id ? null : l.id)} className="w-full text-left px-4 py-3.5 grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_1fr_1fr_auto] gap-3 items-center hover:bg-[var(--bg)]/40">
              <div className="min-w-0">
                <p className="text-[var(--text)] text-[14px] truncate">{l.name}</p>
                <p className="text-[var(--text-4)] text-[12px] truncate">{l.email} · {day(l.created_at)}</p>
              </div>
              <div className="hidden sm:block text-[12px]">
                <span className="rounded-full px-2.5 py-1 border" style={{ borderColor: ROUTE_COLOR[l.route], color: ROUTE_COLOR[l.route] }}>{ROUTE_SHORT[l.route]}</span>
                {l.second_route && <span className="text-[var(--text-4)] ml-2">+ {ROUTE_SHORT[l.second_route]}</span>}
              </div>
              <div className="hidden sm:block text-[12px] text-[var(--text-3)]">
                {answerLabel('revenue', l.answers.revenue)} · score {l.scores.overall}
                <span className="block text-[var(--text-4)]">Bottleneck: {FREEDOM_LABEL[l.bottleneck]}</span>
              </div>
              <span className="text-[11px] text-[var(--text-3)] whitespace-nowrap">{STATUS_LABEL[l.status]} {open === l.id ? '▴' : '▾'}</span>
            </button>
            {open === l.id && <LeadDetail l={l} onUpdate={(p) => update(l.id, p)} />}
          </div>
        ))}
        {!shown.length && <p className="px-4 py-8 text-center text-[13px] text-[var(--text-3)]">No leads match these filters.</p>}
      </div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-full px-3 py-1.5 text-[12px] border transition-colors"
      style={on ? { borderColor: 'var(--gold-line)', background: 'var(--gold-soft)', color: 'var(--gold-text)' } : { borderColor: 'var(--border-2)', color: 'var(--text-3)' }}>
      {children}
    </button>
  )
}

function LeadDetail({ l, onUpdate }: { l: Lead; onUpdate: (p: Partial<Pick<Lead, 'status' | 'notes'>>) => void }) {
  const [notes, setNotes] = useState(l.notes ?? '')
  const reasons = Array.isArray(l.source?.reasons) ? (l.source.reasons as string[]) : []
  const utm = Object.entries(l.source ?? {}).filter(([k]) => k !== 'reasons')

  return (
    <div className="px-4 pb-5 pt-1 grid gap-5 lg:grid-cols-2 text-[13px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <select value={l.status} onChange={(e) => onUpdate({ status: e.target.value as Lead['status'] })}
            className="rounded-lg border border-[var(--border-2)] bg-transparent text-[var(--text)] px-3 py-1.5">
            {(Object.keys(STATUS_LABEL) as Lead['status'][]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          {l.phone && <a href={`tel:${l.phone}`} className="text-[var(--gold-text)] hover:underline">{l.phone}</a>}
          <a href={`mailto:${l.email}`} className="text-[var(--gold-text)] hover:underline">{l.email}</a>
          <a href={`/blueprint-test/r/${l.token}`} target="_blank" className="text-[var(--gold-text)] hover:underline">Their results page →</a>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)] mb-1">Sent to</p>
          <p className="text-[var(--text)]">{DESTINATIONS[l.route].label}{l.second_route ? `, also ${DESTINATIONS[l.second_route].label}` : ''}</p>
          {reasons.map((r, i) => <p key={i} className="text-[var(--text-3)]">• {r}</p>)}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)] mb-1.5">Scores</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {(['time', 'location', 'financial', 'ceo'] as FreedomKey[]).map((k) => (
              <p key={k} className={k === l.bottleneck ? 'text-[#ff8a5c]' : 'text-[var(--text-2)]'}>{FREEDOM_LABEL[k]}: {l.scores[k]}</p>
            ))}
          </div>
        </div>

        {l.flags?.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)] mb-1">Know before the call</p>
            <div className="flex flex-wrap gap-1.5">
              {l.flags.map((f) => <span key={f} className="rounded-full px-2.5 py-0.5 text-[11px] border border-[#ffb35c]/50 text-[#ffb35c]">{f}</span>)}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)] mb-1">Notes</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (l.notes ?? '') && onUpdate({ notes })} rows={3}
            placeholder="Call notes, follow-up…" className="w-full rounded-lg border border-[var(--border-2)] bg-transparent text-[var(--text)] px-3 py-2" />
        </div>

        {utm.length > 0 && <p className="text-[11px] text-[var(--text-4)]">Source: {utm.map(([k, v]) => `${k}=${String(v)}`).join(' · ')}</p>}
        <p className="text-[11px] text-[var(--text-4)]">Write-up: {l.result_status === 'ready' ? 'ready' : l.result_status === 'pending' ? 'still writing' : 'failed (they can retry from their page)'}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)] mb-2">Their answers</p>
        <dl className="space-y-2">
          {ALL_QUESTIONS.map((q) => (
            <div key={q.key}>
              <dt className="text-[var(--text-4)] text-[12px]">{q.label}</dt>
              <dd className="text-[var(--text)] whitespace-pre-wrap">{answerLabel(q.key, l.answers[q.key])}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
