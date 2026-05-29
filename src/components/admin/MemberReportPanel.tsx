'use client'

import { useState, useRef, useEffect } from 'react'

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

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [sending, setSending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Warn before closing while generating
  useEffect(() => {
    if (!generating) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [generating])

  // Animate progress bar
  useEffect(() => {
    if (generating) {
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

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, period_type: periodType }),
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
          setReports(prev => [data.report!, ...prev])
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
    } else {
      setReports(prev =>
        prev.map(r => r.id === reportId ? { ...r, sent_at: new Date().toISOString() } : r)
      )
    }
    setSending(null)
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const previewReport = reports.find(r => r.id === previewId)

  return (
    <div className="space-y-4">

      {/* ─── Generate card ─── */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-5">
        <div className="mb-4">
          <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase mb-1">Generate Report</p>
          <p className="text-[#555] text-xs">Uses The Brain + activity data to write a progress report in Gogo&apos;s voice.</p>
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
                    : 'bg-[#0D0D0D] border-[#2A2A2A] text-[#555] hover:border-[#444] hover:text-[#888]'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {generating && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium">{progressLabel}</span>
              <span className="text-[#C9A227] text-sm font-mono font-bold">{progress}%</span>
            </div>
            <div className="h-2 bg-[#0D0D0D] border border-[#333] rounded-full overflow-hidden">
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
            onClick={handleGenerate}
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
          <p className="text-[#555] text-[10px] tracking-[0.2em] uppercase mb-2">Report History</p>
          <div className="space-y-2">
            {reports.map((report) => (
              <div key={report.id}>
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{report.period_label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[#555] text-xs">
                        Generated {fmtDate(report.generated_at)}
                      </p>
                      {report.sent_at && (
                        <>
                          <span className="text-[#333]">·</span>
                          <span className="text-green-400 text-xs">Sent {fmtDate(report.sent_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewId(previewId === report.id ? null : report.id)}
                      className="text-xs text-[#555] hover:text-[#888] border border-[#2A2A2A] px-2.5 py-1 rounded transition-colors"
                    >
                      {previewId === report.id ? 'Hide' : 'Preview'}
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
                  <div className="border border-[#2A2A2A] border-t-0 rounded-b overflow-hidden">
                    <div className="bg-[#111] px-4 py-2 border-b border-[#2A2A2A] flex items-center justify-between">
                      <p className="text-[#555] text-xs">Report preview — {report.period_label}</p>
                      <button
                        onClick={() => setPreviewId(null)}
                        className="text-[#444] hover:text-[#888] text-xs transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <div
                      className="bg-[#0D0D0D] p-6 max-h-[520px] overflow-y-auto text-sm leading-relaxed"
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
        <p className="text-[#444] text-xs text-center py-4">No reports generated yet.</p>
      )}

      {/* Preview modal for reports without stored HTML (fallback) */}
      {previewId && !previewReport?.content_html && (
        <p className="text-[#555] text-xs text-center">Preview not available for this report.</p>
      )}
    </div>
  )
}
