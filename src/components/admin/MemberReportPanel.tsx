'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { toast } from '@/lib/toast'

interface Report {
  id: string
  period_type: string
  period_label: string
  generated_at: string
  sent_at: string | null
  content_html?: string
}

interface Props {
  memberId: string
  memberName: string
  memberEmail?: string | null
  reports: Report[]
}

export default function MemberReportPanel({ memberId, memberName, memberEmail, reports: initialReports }: Props) {
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  // Monthly reports cover a full calendar month. Default to LAST month (the most
  // recent completed month), so generating in early September reports on August.
  const [reportMonth, setReportMonth] = useState<string>(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const monthOptions = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      return {
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
        label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      }
    })
  }, [])

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [sending, setSending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Regenerate / refine state
  const [refineReportId, setRefineReportId] = useState<string | null>(null)
  const [refineFeedback, setRefineFeedback] = useState('')
  const [refineUploadLabel, setRefineUploadLabel] = useState('')
  const refineFileRef = useRef<HTMLInputElement | null>(null)

  // Warn before closing while generating
  useEffect(() => {
    if (!generating) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [generating])

  // Animate progress bar. Resetting progress when generation starts is the
  // intended effect of the `generating` flag flipping true.
  useEffect(() => {
    if (generating) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgress(0)
      setProgressLabel('Pulling from The Brain…')
      let elapsed = 0
      progressTimerRef.current = setInterval(() => {
        elapsed += 1
        // Reports are a single call ~30–45s — crawl to 88% over 40s then hold
        const next = Math.min(88, Math.round((elapsed / 40) * 88))
        setProgress(next)
        if (elapsed <= 5)  setProgressLabel('Pulling from The Brain…')
        else if (elapsed <= 15) setProgressLabel('Reading activity data…')
        else if (elapsed <= 28) setProgressLabel('Comparing against blueprint…')
        else setProgressLabel('Writing report in Gogo\'s voice…')
      }, 1000)
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    return () => { if (progressTimerRef.current) clearInterval(progressTimerRef.current) }
  }, [generating])

  async function handleRefineFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setRefineFeedback(prev => prev + (prev ? '\n\n' : '') + `[Uploaded: ${file.name}]\n${text.slice(0, 4000)}`)
    setRefineUploadLabel(file.name)
    if (refineFileRef.current) refineFileRef.current.value = ''
  }

  function openRefine(reportId: string) {
    setRefineReportId(reportId)
    setRefineFeedback('')
    setRefineUploadLabel('')
  }

  function closeRefine() {
    setRefineReportId(null)
    setRefineFeedback('')
    setRefineUploadLabel('')
  }

  async function handleGenerate(feedback?: string, reportIdToUpdate?: string) {
    setGenerating(true)
    setError('')
    closeRefine()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          period_type: periodType,
          ...(periodType === 'monthly' ? { period_start: reportMonth } : {}),
          ...(feedback ? { feedback } : {}),
          ...(reportIdToUpdate ? { report_id: reportIdToUpdate } : {}),
        }),
        signal: controller.signal,
      })

      let data: { error?: string; report?: Report } = {}
      const ct = res.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        data = await res.json()
      } else {
        const text = await res.text()
        setError(`Server error ${res.status}: ${text.slice(0, 200)}`)
        setGenerating(false)
        setProgress(0)
        return
      }

      if (!res.ok) {
        setError(data.error ?? 'Generation failed. Please try again.')
      } else if (data.report) {
        setProgress(100)
        setProgressLabel('Done!')
        setTimeout(() => {
          setReports(prev => {
            // If we updated an existing report in place, replace it; otherwise prepend
            const exists = prev.find(r => r.id === data.report!.id)
            if (exists) return prev.map(r => r.id === data.report!.id ? data.report! : r)
            return [data.report!, ...prev]
          })
          setPreviewId(data.report!.id)
          setGenerating(false)
          setProgress(0)
        }, 400)
        return
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('')
      } else {
        setError('Generation failed. Please try again.')
      }
    }

    setGenerating(false)
    setProgress(0)
  }

  function handleCancel() {
    abortRef.current?.abort()
    abortRef.current = null
    setGenerating(false)
    setProgress(0)
    setProgressLabel('')
  }

  async function handleSend(reportId: string, reportLabel: string) {
    const toEmail = memberEmail ?? memberName
    if (!confirm(`Send "${reportLabel}" to ${memberName} (${toEmail})?`)) return

    setSending(reportId)
    setError('')

    const res = await fetch('/api/reports/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: reportId }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Send failed.')
      toast(data.error ?? 'Could not send report', 'error')
    } else {
      setReports(prev =>
        prev.map(r => r.id === reportId ? { ...r, sent_at: new Date().toISOString() } : r)
      )
      toast(`Report sent to ${memberName}`)
    }
    setSending(null)
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const previewReport = reports.find(r => r.id === previewId)

  return (
    <div className="space-y-4">

      {/* ─── Generate card ─── */}
      <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-5">
        <div className="mb-4">
          <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase mb-1">Generate Report</p>
          <p className="text-[var(--text-3)] text-xs">Uses The Brain + activity data to write a progress report in Gogo&apos;s voice.</p>
        </div>

        {/* Period type selector */}
        {!generating && (
          <div className="flex gap-2 mb-4">
            {(['monthly', 'quarterly', 'yearly'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setPeriodType(type)}
                className={`flex-1 py-2 text-xs rounded border transition-all ${
                  periodType === type
                    ? 'bg-[#C9A227]/10 border-[#C9A227]/40 text-[#C9A227]'
                    : 'bg-[var(--input-bg)] border-[var(--border-color)] text-[var(--text-3)] hover:border-[var(--border-hover)] hover:text-[var(--text-2)]'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Month selector — a monthly report covers that whole calendar month */}
        {!generating && periodType === 'monthly' && (
          <div className="mb-4">
            <label className="block text-[var(--text-3)] text-[10px] uppercase tracking-wider mb-1.5">Report month</label>
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] text-sm rounded px-3 py-2 focus:outline-none focus:border-[#C9A227]/40"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-[var(--text-4)] text-[11px] mt-1.5">Attendance, homework, and questions are pulled from this month only. Defaults to last month.</p>
          </div>
        )}

        {/* Progress bar */}
        {generating && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text)] text-sm font-medium">{progressLabel}</span>
              <span className="text-[#C9A227] text-sm font-mono font-bold">{progress}%</span>
            </div>
            <div className="h-2 bg-[var(--bg)] border border-[var(--border-hover)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C9A227] rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 bg-[#1A0A00] border border-[#C9A227]/40 rounded px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[#C9A227] text-base leading-none">⚠</span>
                <p className="text-[#C9A227] text-xs font-medium">
                  Keep this tab open — closing will cancel generation.
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="flex-shrink-0 text-[#CC1F1F] text-xs font-medium border border-[#CC1F1F]/30 px-3 py-1 rounded hover:border-red-400/50 hover:text-red-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Generate button */}
        {!generating && (
          <button
            onClick={() => handleGenerate()}
            className="w-full bg-[#C9A227]/10 border border-[#C9A227]/40 text-[#C9A227] text-sm py-2.5 rounded hover:bg-[#C9A227]/15 transition-colors font-medium"
          >
            ✦ Generate {periodType.charAt(0).toUpperCase() + periodType.slice(1)} Report
          </button>
        )}

        {error && <p className="text-[#CC1F1F] text-xs mt-3">{error}</p>}
      </div>

      {/* ─── Report history ─── */}
      {reports.length > 0 && (
        <div>
          <p className="text-[var(--text-3)] text-[10px] tracking-[0.2em] uppercase mb-2">Report History</p>
          <div className="space-y-2">
            {reports.map((report) => (
              <div key={report.id}>
                <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[var(--text)] text-sm font-medium">{report.period_label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[var(--text-3)] text-xs">
                        Generated {fmtDate(report.generated_at)}
                      </p>
                      {report.sent_at && (
                        <>
                          <span className="text-[var(--text-4)]">·</span>
                          <span className="text-green-400 text-xs">Sent {fmtDate(report.sent_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewId(previewId === report.id ? null : report.id)}
                      className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)] border border-[var(--border-color)] px-2.5 py-1 rounded transition-colors"
                    >
                      {previewId === report.id ? 'Hide' : 'Preview'}
                    </button>
                    <button
                      onClick={() => openRefine(report.id)}
                      disabled={generating}
                      className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)] border border-[var(--border-color)] px-2.5 py-1 rounded transition-colors disabled:opacity-40"
                    >
                      ↺ Regen
                    </button>
                    {!report.sent_at ? (
                      <button
                        onClick={() => handleSend(report.id, report.period_label)}
                        disabled={sending === report.id}
                        className="text-xs text-[#C9A227] hover:text-[#d4ac2d] border border-[#C9A227]/30 px-2.5 py-1 rounded hover:border-[#C9A227]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {sending === report.id ? 'Sending…' : 'Send →'}
                      </button>
                    ) : (
                      <span className="text-xs text-green-400 border border-green-900 px-2.5 py-1 rounded">Sent ✓</span>
                    )}
                  </div>
                </div>

                {/* Inline preview */}
                {previewId === report.id && report.content_html && (
                  <div className="border border-[var(--border-color)] border-t-0 rounded-b overflow-hidden">
                    <div className="bg-[var(--surface-2)] px-4 py-2 border-b border-[var(--border-color)] flex items-center justify-between">
                      <p className="text-[var(--text-3)] text-xs">Report preview — {report.period_label}</p>
                      <button
                        onClick={() => setPreviewId(null)}
                        className="text-[var(--text-4)] hover:text-[var(--text-2)] text-xs transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <div
                      className="bg-[var(--bg)] p-6 max-h-[520px] overflow-y-auto text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: report.content_html }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {reports.length === 0 && !generating && (
        <p className="text-[var(--text-4)] text-xs text-center py-4">No reports generated yet.</p>
      )}

      {/* Preview modal for reports without stored HTML (fallback) */}
      {previewId && !previewReport?.content_html && (
        <p className="text-[var(--text-3)] text-xs text-center">Preview not available for this report.</p>
      )}

      {/* ─── Refine / Regenerate modal ─── */}
      {refineReportId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-6 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xl bg-[var(--surface)] border border-[#C9A227]/30 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 bg-[var(--surface-2)] border-b border-[var(--border-color)] flex items-center justify-between">
              <div>
                <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase mb-0.5">Regenerate Report</p>
                <p className="text-[var(--text)] text-sm font-medium">
                  {reports.find(r => r.id === refineReportId)?.period_label}
                </p>
              </div>
              <button onClick={closeRefine} className="text-[var(--text-4)] hover:text-[var(--text-2)] text-lg transition-colors">✕</button>
            </div>

            {/* Feedback textarea */}
            <div className="p-4">
              <p className="text-[var(--text-3)] text-xs mb-2">What needs to change? Be specific — Gogo will address every point.</p>
              <div className="relative">
                <textarea
                  value={refineFeedback}
                  onChange={e => setRefineFeedback(e.target.value)}
                  placeholder="e.g. The tone is too soft — push harder on the attendance gap. Also add a note about her Florida team situation."
                  rows={4}
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] text-sm rounded-lg px-4 py-3 pr-24 resize-none focus:outline-none focus:border-[#C9A227]/40 leading-relaxed"
                />
                {/* Upload button inside textarea */}
                <button
                  type="button"
                  onClick={() => refineFileRef.current?.click()}
                  title="Upload a file to include its content"
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 text-[var(--text-4)] hover:text-[var(--text-2)] text-xs border border-[var(--border-color)] px-2 py-1 rounded transition-colors bg-[var(--input-bg)]"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M6 8V1M3 4l3-3 3 3M1 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {refineUploadLabel ? refineUploadLabel.slice(0, 12) + (refineUploadLabel.length > 12 ? '…' : '') : 'File'}
                </button>
              </div>
              {refineUploadLabel && (
                <p className="text-[var(--text-3)] text-xs mt-1.5">📎 {refineUploadLabel} appended to feedback</p>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 flex items-center gap-3">
              <button onClick={closeRefine} className="text-[var(--text-3)] text-sm hover:text-[var(--text-2)] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleGenerate(refineFeedback || undefined, refineReportId)}
                disabled={generating}
                className="ml-auto bg-[#C9A227] text-[#090909] text-sm font-bold px-5 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
              >
                ✦ Apply &amp; Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={refineFileRef}
        type="file"
        accept=".txt,.md,.pdf,.doc,.docx,.csv"
        className="hidden"
        onChange={handleRefineFileUpload}
      />
    </div>
  )
}
