'use client'

import { useMemo, useState } from 'react'
import { SURVEY_QUESTIONS, SURVEY_QUESTION_BY_KEY, type SurveyAnswers } from '@/lib/survey-questions'
import { indicatorFor, highlightsBetween, type Highlight } from '@/lib/survey'

interface MemberResponse {
  periodMonth: string
  answers: SurveyAnswers
  completedAt: string | null
}
interface Member {
  id: string
  name: string
  status: string
  responses: MemberResponse[]
  baseline: SurveyAnswers | null
}

const GOLD = '#C9A227'
const GREEN = '#5bbd68'
const RED = '#ff8080'

// The four headline metrics surfaced as stat cards up top.
const KPI_KEYS = ['total_income', 'credit_score', 'total_debt', 'closings'] as const

function monthShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
function monthLong(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    if (v.trim() === '') return null
    const n = Number(v.replace(/[$,\s]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function fmtValue(key: string, v: unknown): string {
  const q = SURVEY_QUESTION_BY_KEY[key]
  if (v === null || v === undefined || v === '') return '—'
  if (q?.type === 'boolean') return v === true || v === 'true' || v === 'yes' ? 'Yes' : 'No'
  if (q?.type === 'currency') {
    const n = Number(v)
    return Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : String(v)
  }
  return String(v)
}

// Tiny inline sparkline from a numeric series (oldest → newest).
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 72
  const h = 28
  const pad = 3
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (values.length - 1)
    const y = h - pad - ((v - min) / span) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = pts[pts.length - 1].split(',')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <polyline points={pts.join(' ')} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </svg>
  )
}

function DeltaChip({ trend, good, deltaLabel }: { trend: string; good: boolean | null; deltaLabel?: string }) {
  if ((trend !== 'up' && trend !== 'down') || !deltaLabel) return null
  const color = good ? GREEN : RED
  const arrow = trend === 'up' ? '▲' : '▼'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color, background: `${color}1f` }}
    >
      {arrow} {deltaLabel}
    </span>
  )
}

export default function SurveyProgress({ members }: { members: Member[] }) {
  const withData = members.filter((m) => m.responses.length > 0)
  const [selectedId, setSelectedId] = useState<string>(withData[0]?.id ?? members[0]?.id ?? '')
  const selected = members.find((m) => m.id === selectedId) ?? null

  // Columns = optional intake baseline + each completed month (oldest → newest).
  const columns = useMemo(() => {
    if (!selected) return []
    const cols: Array<{ label: string; answers: SurveyAnswers; isBaseline: boolean }> = []
    if (selected.baseline) cols.push({ label: 'Intake', answers: selected.baseline, isBaseline: true })
    for (const r of selected.responses) {
      cols.push({ label: monthShort(r.periodMonth), answers: r.answers, isBaseline: false })
    }
    return cols
  }, [selected])

  const latestResponse = selected && selected.responses.length > 0 ? selected.responses[selected.responses.length - 1] : null

  // Highlights across every consecutive column pair, newest first.
  const highlights = useMemo(() => {
    if (!selected) return []
    const out: Array<Highlight & { when: string }> = []
    for (let i = 1; i < columns.length; i++) {
      const hs = highlightsBetween(columns[i].answers, columns[i - 1].answers)
      for (const h of hs) out.push({ ...h, when: columns[i].label })
    }
    return out.reverse()
  }, [selected, columns])

  // Metric rows shown in the table (takeaway is pulled out into its own block).
  const tableQuestions = SURVEY_QUESTIONS.filter((q) => q.key !== 'takeaway')

  if (members.length === 0) {
    return <p className="text-[var(--text-3)] text-sm">No members yet.</p>
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Member list */}
      <div className="md:w-60 shrink-0">
        <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
          {members.map((m) => {
            const active = m.id === selectedId
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--border-color)] last:border-b-0 transition-colors ${
                  active ? 'bg-[#C9A227]/10' : 'hover:bg-[var(--surface-2)]'
                }`}
                style={active ? { boxShadow: `inset 3px 0 0 ${GOLD}` } : undefined}
              >
                <div className="text-[var(--text)] text-sm font-medium">{m.name}</div>
                <div className="text-[var(--text-3)] text-xs mt-0.5">
                  {m.responses.length === 0
                    ? 'No check-ins yet'
                    : `${m.responses.length} month${m.responses.length === 1 ? '' : 's'} tracked`}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0">
        {!selected || columns.length === 0 ? (
          <div className="border border-[var(--border-color)] rounded-xl p-8 text-center">
            <p className="text-[var(--text-2)] text-sm">
              {selected?.name ?? 'This member'} hasn&apos;t completed a progress check yet.
              {selected?.baseline ? ' Intake data is on file and will anchor their first month.' : ''}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-serif text-2xl text-[var(--text)]">{selected.name}</h2>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                    style={{
                      color: selected.status === 'active' ? GREEN : 'var(--text-3)',
                      background: selected.status === 'active' ? `${GREEN}1f` : 'var(--surface-2)',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: selected.status === 'active' ? GREEN : 'var(--text-3)' }} />
                    {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                  </span>
                </div>
                <p className="text-[var(--text-3)] text-sm mt-1">
                  {selected.responses.length} monthly check-in{selected.responses.length === 1 ? '' : 's'} tracked
                  {latestResponse ? ` · latest ${monthLong(latestResponse.periodMonth)}` : ''}
                </p>
              </div>
            </div>

            {/* KPI stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              {KPI_KEYS.map((key) => {
                const q = SURVEY_QUESTION_BY_KEY[key]
                const latest = columns[columns.length - 1].answers[key]
                const prev = columns.length > 1 ? columns[columns.length - 2].answers[key] : undefined
                const ind = columns.length > 1 ? indicatorFor(key, latest, prev) : { trend: 'none' as const, good: null as boolean | null, deltaLabel: undefined }
                const series = columns.map((c) => toNum(c.answers[key])).filter((n): n is number => n !== null)
                const sparkColor = ind.good === false ? RED : GREEN
                const shortLabel: Record<string, string> = {
                  total_income: 'Monthly income',
                  credit_score: 'Credit score',
                  total_debt: 'Total debt',
                  closings: 'Closings',
                }
                return (
                  <div
                    key={key}
                    className="relative overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 flex flex-col gap-3"
                  >
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
                    <div className="text-[11px] uppercase tracking-wider text-[var(--text-3)]">{shortLabel[key] ?? q.label}</div>
                    <div className="flex items-end justify-between gap-2">
                      <div className="font-serif text-2xl text-[var(--text)] leading-none">{fmtValue(key, latest)}</div>
                      <Sparkline values={series} color={sparkColor} />
                    </div>
                    <div className="flex items-center gap-2 min-h-[22px]">
                      <DeltaChip trend={ind.trend} good={ind.good} deltaLabel={ind.deltaLabel} />
                      {prev !== undefined && prev !== null && prev !== '' ? (
                        <span className="text-[var(--text-3)] text-xs">vs {columns[columns.length - 2].label}</span>
                      ) : (
                        <span className="text-[var(--text-3)] text-xs">first month</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-4">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={GOLD} aria-hidden="true">
                    <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" />
                  </svg>
                  <h3 className="font-serif text-lg text-[var(--text)]">Highlights &amp; content ideas</h3>
                  <span className="text-[var(--text-3)] text-xs">{highlights.length} worth celebrating</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {highlights.map((h, i) => {
                    const win = h.tone === 'win'
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3.5 rounded-xl border p-4"
                        style={{
                          borderColor: win ? 'rgba(201,162,39,0.35)' : 'rgba(255,128,128,0.3)',
                          background: 'var(--surface)',
                        }}
                      >
                        <div
                          className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ background: win ? 'rgba(201,162,39,0.12)' : 'rgba(255,128,128,0.12)' }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={win ? GOLD : RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {win ? <><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></> : <><path d="M3 7l6 6 4-4 8 8" /><path d="M17 17h4v-4" /></>}
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[var(--text)] text-sm font-medium leading-snug">{h.message}</p>
                          <p className="text-[var(--text-3)] text-xs mt-1">{h.when} · {h.label}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* All-metrics table */}
            <div className="mb-8">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-serif text-lg text-[var(--text)]">All metrics</h3>
                <span className="text-[var(--text-3)] text-xs">Arrows compare each month to the one before</span>
              </div>
              <div className="border border-[var(--border-color)] rounded-xl overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 520, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-[var(--surface-2)]">
                      <th className="text-left font-medium text-[var(--text-3)] px-5 py-3.5" style={{ minWidth: 240 }}>
                        Metric
                      </th>
                      {columns.map((c, i) => {
                        const isLatest = !c.isBaseline && i === columns.length - 1
                        return (
                          <th
                            key={i}
                            className="text-right font-medium px-5 py-3.5 whitespace-nowrap"
                            style={{
                              color: c.isBaseline ? 'var(--text-3)' : isLatest ? GOLD : 'var(--text-2)',
                              background: isLatest ? 'rgba(201,162,39,0.06)' : undefined,
                            }}
                          >
                            {isLatest ? (
                              <span className="inline-flex items-center gap-1.5">
                                {c.label}
                                <span className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider" style={{ color: '#090909', background: GOLD }}>Latest</span>
                              </span>
                            ) : (
                              c.label
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {tableQuestions.map((q, rowIdx) => (
                      <tr key={q.key} className="border-t border-[var(--border-color)]" style={rowIdx % 2 === 1 ? { background: 'var(--surface-2)' } : undefined}>
                        <td className="px-5 py-3 text-[var(--text-2)]" style={{ lineHeight: 1.4 }}>
                          {SURVEY_QUESTION_BY_KEY[q.key]?.label}
                        </td>
                        {columns.map((c, i) => {
                          const val = c.answers[q.key]
                          const prev = i > 0 ? columns[i - 1].answers[q.key] : undefined
                          const ind = i > 0 ? indicatorFor(q.key, val, prev) : { trend: 'none' as const, good: null, deltaLabel: undefined }
                          const has = val !== null && val !== undefined && val !== ''
                          const isLatest = !c.isBaseline && i === columns.length - 1
                          return (
                            <td
                              key={i}
                              className="px-5 py-3 text-right whitespace-nowrap"
                              style={isLatest ? { background: 'rgba(201,162,39,0.04)' } : undefined}
                            >
                              <span className={has ? 'text-[var(--text)]' : 'text-[var(--text-3)]'}>{fmtValue(q.key, val)}</span>
                              {ind.trend === 'up' || ind.trend === 'down' ? (
                                <span style={{ color: ind.good ? GREEN : RED, fontSize: 11, marginLeft: 6 }}>
                                  {ind.trend === 'up' ? '▲' : '▼'} {ind.deltaLabel}
                                </span>
                              ) : null}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly takeaways */}
            {selected.responses.some((r) => {
              const t = r.answers['takeaway']
              return typeof t === 'string' && t.trim() !== ''
            }) && (
              <div>
                <h3 className="font-serif text-lg text-[var(--text)] mb-3">Monthly takeaways</h3>
                <div className="flex flex-col gap-3">
                  {selected.responses
                    .slice()
                    .reverse()
                    .map((r, idx) => {
                      const t = r.answers['takeaway']
                      if (typeof t !== 'string' || t.trim() === '') return null
                      const isLatest = idx === 0
                      return (
                        <div
                          key={r.periodMonth}
                          className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[var(--text-3)] text-xs uppercase tracking-wider">{monthLong(r.periodMonth)}</span>
                            {isLatest && (
                              <span className="rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider" style={{ color: '#090909', background: GOLD }}>Latest</span>
                            )}
                          </div>
                          <p
                            className="text-[var(--text-2)] text-sm italic leading-relaxed"
                            style={{ borderLeft: `2px solid ${isLatest ? GOLD : 'var(--border-color)'}`, paddingLeft: 12 }}
                          >
                            &ldquo;{t}&rdquo;
                          </p>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
