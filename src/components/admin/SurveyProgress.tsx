'use client'

import { useMemo, useState } from 'react'
import { SURVEY_QUESTIONS, type SurveyAnswers } from '@/lib/survey-questions'
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

function monthShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function fmtValue(key: string, v: unknown): string {
  const q = SURVEY_QUESTIONS.find((x) => x.key === key)
  if (v === null || v === undefined || v === '') return '—'
  if (q?.type === 'boolean') return v === true || v === 'true' || v === 'yes' ? 'Yes' : 'No'
  if (q?.type === 'currency') {
    const n = Number(v)
    return Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : String(v)
  }
  return String(v)
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

  if (members.length === 0) {
    return <p className="text-[var(--text-3)] text-sm">No members yet.</p>
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Member list */}
      <div className="md:w-56 shrink-0">
        <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
          {members.map((m) => {
            const active = m.id === selectedId
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--border-color)] last:border-b-0 transition-colors ${
                  active ? 'bg-[#C9A227]/10' : 'hover:bg-[var(--surface-2)]'
                }`}
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
          <div className="border border-[var(--border-color)] rounded-lg p-8 text-center">
            <p className="text-[var(--text-2)] text-sm">
              {selected?.name ?? 'This member'} hasn&apos;t completed a progress check yet.
              {selected?.baseline ? ' Intake data is on file and will anchor their first month.' : ''}
            </p>
          </div>
        ) : (
          <>
            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="mb-6">
                <h3 className="text-[var(--text)] text-sm font-medium mb-3 flex items-center gap-2">
                  <span style={{ color: GOLD }}>★</span> Highlights &amp; content ideas
                </h3>
                <div className="flex flex-col gap-2">
                  {highlights.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
                      style={{
                        borderColor: h.tone === 'win' ? 'rgba(201,162,39,0.35)' : 'rgba(255,128,128,0.3)',
                        background: h.tone === 'win' ? 'rgba(201,162,39,0.07)' : 'rgba(255,128,128,0.06)',
                      }}
                    >
                      <span style={{ color: h.tone === 'win' ? GOLD : '#ff8080', fontSize: 14, lineHeight: '20px' }}>
                        {h.tone === 'win' ? '▲' : '▼'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[var(--text)] text-sm leading-snug">{h.message}</p>
                        <p className="text-[var(--text-3)] text-xs mt-0.5">{h.when} · {h.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pivot table */}
            <div className="border border-[var(--border-color)] rounded-lg overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 520, borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="text-left font-medium text-[var(--text-3)] px-4 py-3" style={{ minWidth: 220 }}>
                      Question
                    </th>
                    {columns.map((c, i) => (
                      <th
                        key={i}
                        className="text-right font-medium px-4 py-3 whitespace-nowrap"
                        style={{ color: c.isBaseline ? 'var(--text-3)' : GOLD }}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SURVEY_QUESTIONS.map((q) => (
                    <tr key={q.key} className="border-b border-[var(--border-color)] last:border-b-0 align-top">
                      <td className="px-4 py-3 text-[var(--text-2)]" style={{ lineHeight: 1.4 }}>
                        {q.label}
                      </td>
                      {columns.map((c, i) => {
                        const val = c.answers[q.key]
                        const prev = i > 0 ? columns[i - 1].answers[q.key] : undefined
                        const ind = i > 0 ? indicatorFor(q.key, val, prev) : { trend: 'none' as const, good: null }
                        const arrow = ind.trend === 'up' ? '▲' : ind.trend === 'down' ? '▼' : ''
                        const has = val !== null && val !== undefined && val !== ''
                        return (
                          <td key={i} className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={has ? 'text-[var(--text)]' : 'text-[var(--text-3)]'}>
                              {fmtValue(q.key, val)}
                            </span>
                            {arrow && ind.deltaLabel ? (
                              <span style={{ color: ind.good ? '#5bbd68' : '#ff8080', fontSize: 11, marginLeft: 6, whiteSpace: 'nowrap' }}>
                                {arrow} {ind.deltaLabel}
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
            <p className="text-[var(--text-3)] text-xs mt-3">
              ▲ / ▼ compares each month to the column on its left. Green = progress,
              red = moved the wrong way. Neutral fields (hours, price range, takeaway)
              show no arrow.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
