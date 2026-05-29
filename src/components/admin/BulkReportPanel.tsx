'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

interface Member {
  id: string
  name: string
  email: string
  cohort: string | null
  status: string
}

type RowStatus = 'idle' | 'generating' | 'done' | 'error' | 'sending' | 'sent'

interface MemberRow {
  member: Member
  checked: boolean
  status: RowStatus
  reportId: string | null
  reportHtml: string | null
  reportLabel: string | null
  previewOpen: boolean
  error: string | null
}

interface Props {
  members: Member[]
}

export default function BulkReportPanel({ members }: Props) {
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [rows, setRows] = useState<MemberRow[]>(() =>
    members.map(m => ({
      member: m,
      checked: true,
      status: 'idle',
      reportId: null,
      reportHtml: null,
      reportLabel: null,
      previewOpen: false,
      error: null,
    }))
  )

  // Per-row regenerate state
  const [refineRowId, setRefineRowId] = useState<string | null>(null)
  const [refineFeedback, setRefineFeedback] = useState('')
  const [refineUploadLabel, setRefineUploadLabel] = useState('')
  const refineFileRef = useRef<HTMLInputElement | null>(null)
  const singleAbortRef = useRef<AbortController | null>(null)

  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 })
  const [memberProgress, setMemberProgress] = useState(0)   // 0-100 within current member
  const [currentMemberName, setCurrentMemberName] = useState('')
  const [globalError, setGlobalError] = useState('')
  const cancelRef = useRef(false)
  const currentFetchAbortRef = useRef<AbortController | null>(null)
  const memberTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Warn before closing while bulk generation is running
  useEffect(() => {
    if (!bulkRunning) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [bulkRunning])

  // Per-member animated sub-progress — crawls to 88% over ~40s then holds
  function startMemberTimer() {
    if (memberTimerRef.current) clearInterval(memberTimerRef.current)
    setMemberProgress(0)
    let elapsed = 0
    memberTimerRef.current = setInterval(() => {
      elapsed += 1
      setMemberProgress(Math.min(88, Math.round((elapsed / 40) * 88)))
    }, 1000)
  }

  function stopMemberTimer(finishedClean: boolean) {
    if (memberTimerRef.current) clearInterval(memberTimerRef.current)
    memberTimerRef.current = null
    setMemberProgress(finishedClean ? 100 : 0)
  }

  // Combined bar: each member occupies an equal slice of 100%
  // Within the current member's slice, memberProgress fills it smoothly
  const bulkPct = bulkProgress.total > 0
    ? Math.min(100, Math.round(
        ((bulkProgress.done + memberProgress / 100) / bulkProgress.total) * 100
      ))
    : 0

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function updateRow(id: string, patch: Partial<MemberRow>) {
    setRows(prev => prev.map(r => r.member.id === id ? { ...r, ...patch } : r))
  }

  const checkedRows = rows.filter(r => r.checked)
  const generatedRows = rows.filter(r => r.status === 'done' && r.checked)
  const allChecked = rows.length > 0 && rows.every(r => r.checked)
  const someChecked = rows.some(r => r.checked)

  function toggleAll() {
    const next = !allChecked
    setRows(prev => prev.map(r => ({ ...r, checked: next })))
  }

  // ─── Reset to idle for re-generation ──────────────────────────────────────

  function resetGenerated() {
    setRows(prev => prev.map(r =>
      r.status === 'done' || r.status === 'error'
        ? { ...r, status: 'idle', reportId: null, reportHtml: null, reportLabel: null, previewOpen: false, error: null }
        : r
    ))
  }

  // ─── Per-row regenerate ───────────────────────────────────────────────────

  function openRefine(memberId: string) {
    setRefineRowId(memberId)
    setRefineFeedback('')
    setRefineUploadLabel('')
  }

  function closeRefine() {
    setRefineRowId(null)
    setRefineFeedback('')
    setRefineUploadLabel('')
  }

  async function handleRefineFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setRefineFeedback(prev => prev + (prev ? '\n\n' : '') + `[Uploaded: ${file.name}]\n${text.slice(0, 4000)}`)
    setRefineUploadLabel(file.name)
    if (refineFileRef.current) refineFileRef.current.value = ''
  }

  async function handleRegenerateOne(memberId: string, reportId: string | null, feedback: string) {
    closeRefine()
    updateRow(memberId, { status: 'generating', error: null })

    const controller = new AbortController()
    singleAbortRef.current = controller

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          period_type: periodType,
          ...(feedback ? { feedback } : {}),
          ...(reportId ? { report_id: reportId } : {}),
        }),
        signal: controller.signal,
      })

      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        const text = await res.text()
        updateRow(memberId, { status: 'error', error: `Server error ${res.status}: ${text.slice(0, 120)}` })
        return
      }

      const data = await res.json()
      if (!res.ok || !data.report) {
        updateRow(memberId, { status: 'error', error: data.error ?? 'Generation failed' })
      } else {
        updateRow(memberId, {
          status: 'done',
          reportId: data.report.id,
          reportHtml: data.report.content_html ?? null,
          reportLabel: data.report.period_label,
          error: null,
        })
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        updateRow(memberId, { status: 'idle', error: null })
        return
      }
      updateRow(memberId, { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      singleAbortRef.current = null
    }
  }

  // ─── Generate for all checked ─────────────────────────────────────────────

  const handleGenerateAll = useCallback(async () => {
    const targets = rows.filter(r => r.checked && r.status === 'idle')
    if (targets.length === 0) return

    cancelRef.current = false
    setBulkRunning(true)
    setGlobalError('')
    setBulkProgress({ done: 0, total: targets.length })

    for (let i = 0; i < targets.length; i++) {
      if (cancelRef.current) break

      const row = targets[i]
      setCurrentMemberName(row.member.name)
      updateRow(row.member.id, { status: 'generating', error: null })
      startMemberTimer()

      const controller = new AbortController()
      currentFetchAbortRef.current = controller

      try {
        const res = await fetch('/api/reports/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: row.member.id, period_type: periodType }),
          signal: controller.signal,
        })

        const ct = res.headers.get('content-type') ?? ''
        if (!ct.includes('application/json')) {
          const text = await res.text()
          stopMemberTimer(false)
          updateRow(row.member.id, { status: 'error', error: `Server error ${res.status}: ${text.slice(0, 120)}` })
          setBulkProgress(p => ({ ...p, done: p.done + 1 }))
          continue
        }

        const data = await res.json()
        if (!res.ok || !data.report) {
          stopMemberTimer(false)
          updateRow(row.member.id, { status: 'error', error: data.error ?? 'Generation failed' })
        } else {
          stopMemberTimer(true)
          updateRow(row.member.id, {
            status: 'done',
            reportId: data.report.id,
            reportHtml: data.report.content_html ?? null,
            reportLabel: data.report.period_label,
            error: null,
          })
        }
      } catch (err) {
        stopMemberTimer(false)
        if (err instanceof Error && err.name === 'AbortError') {
          // Stopped by the user — revert this member back to idle
          updateRow(row.member.id, { status: 'idle', error: null })
          break
        }
        updateRow(row.member.id, { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' })
      }

      setBulkProgress(p => ({ ...p, done: p.done + 1 }))
    }

    currentFetchAbortRef.current = null
    if (memberTimerRef.current) clearInterval(memberTimerRef.current)
    memberTimerRef.current = null
    setMemberProgress(0)
    setCurrentMemberName('')
    setBulkRunning(false)
  }, [rows, periodType])

  // ─── Send all checked + done ───────────────────────────────────────────────

  const handleSendAll = useCallback(async () => {
    const targets = rows.filter(r => r.checked && r.status === 'done' && r.reportId)
    if (targets.length === 0) return
    if (!confirm(`Send reports to ${targets.length} member${targets.length > 1 ? 's' : ''}?`)) return

    for (const row of targets) {
      updateRow(row.member.id, { status: 'sending' })
      try {
        const res = await fetch('/api/reports/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report_id: row.reportId }),
        })
        const data = await res.json()
        if (!res.ok) {
          updateRow(row.member.id, { status: 'done', error: data.error ?? 'Send failed' })
        } else {
          updateRow(row.member.id, { status: 'sent', error: null })
        }
      } catch (err) {
        updateRow(row.member.id, { status: 'done', error: err instanceof Error ? err.message : 'Send failed' })
      }
    }
  }, [rows])

  // ─── Send single ──────────────────────────────────────────────────────────

  async function handleSendOne(memberId: string, reportId: string, memberName: string, email: string) {
    if (!confirm(`Send report to ${memberName} (${email})?`)) return
    updateRow(memberId, { status: 'sending' })
    try {
      const res = await fetch('/api/reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId }),
      })
      const data = await res.json()
      if (!res.ok) {
        updateRow(memberId, { status: 'done', error: data.error ?? 'Send failed' })
      } else {
        updateRow(memberId, { status: 'sent', error: null })
      }
    } catch (err) {
      updateRow(memberId, { status: 'done', error: err instanceof Error ? err.message : 'Send failed' })
    }
  }

  // ─── Status badge ─────────────────────────────────────────────────────────

  function StatusBadge({ status }: { status: RowStatus }) {
    if (status === 'idle') return <span className="text-[#444] text-xs">—</span>
    if (status === 'generating') return (
      <span className="flex items-center gap-1.5 text-[#C9A227] text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-pulse" />
        Generating…
      </span>
    )
    if (status === 'done') return (
      <span className="flex items-center gap-1.5 text-blue-400 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        Ready to send
      </span>
    )
    if (status === 'error') return (
      <span className="flex items-center gap-1.5 text-[#CC1F1F] text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F]" />
        Error
      </span>
    )
    if (status === 'sending') return (
      <span className="flex items-center gap-1.5 text-[#888] text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-[#888] animate-pulse" />
        Sending…
      </span>
    )
    if (status === 'sent') return (
      <span className="flex items-center gap-1.5 text-green-400 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Sent ✓
      </span>
    )
    return null
  }

  const anyDoneChecked = rows.some(r => r.checked && r.status === 'done' && r.reportId)
  const anyIdleChecked = rows.some(r => r.checked && r.status === 'idle')
  const periodLabel = periodType.charAt(0).toUpperCase() + periodType.slice(1)

  return (
    <div className="space-y-6">

      {/* ─── Step 1: Choose period ─────────────────────────────────────────── */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-5">
        <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase mb-1">Step 1</p>
        <p className="text-white text-sm font-medium mb-4">Choose report period</p>
        <div className="flex gap-2">
          {(['monthly', 'quarterly', 'yearly'] as const).map(type => (
            <button
              key={type}
              onClick={() => { if (!bulkRunning) { setPeriodType(type); resetGenerated() } }}
              disabled={bulkRunning}
              className={`px-5 py-2 text-sm rounded border transition-all disabled:cursor-not-allowed ${
                periodType === type
                  ? 'bg-[#C9A227]/10 border-[#C9A227]/50 text-[#C9A227]'
                  : 'bg-[#0D0D0D] border-[#2A2A2A] text-[#555] hover:border-[#444] hover:text-[#888]'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Step 2: Select members + generate ────────────────────────────── */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded overflow-hidden">

        {/* Table header / toolbar */}
        <div className="px-5 py-4 border-b border-[#2A2A2A] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Select all checkbox */}
            <button
              onClick={toggleAll}
              disabled={bulkRunning}
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                allChecked
                  ? 'bg-[#C9A227] border-[#C9A227]'
                  : someChecked
                  ? 'bg-[#C9A227]/40 border-[#C9A227]/60'
                  : 'bg-transparent border-[#444] hover:border-[#C9A227]/60'
              }`}
            >
              {(allChecked || someChecked) && (
                <span className="text-[#0D0D0D] text-[10px] font-bold leading-none">{allChecked ? '✓' : '–'}</span>
              )}
            </button>
            <div>
              <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase mb-0.5">Step 2</p>
              <p className="text-white text-sm font-medium">
                {checkedRows.length} of {rows.length} members selected
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {anyDoneChecked && (
              <button
                onClick={handleSendAll}
                disabled={bulkRunning}
                className="flex items-center gap-2 border border-green-700/50 text-green-400 text-xs px-4 py-2 rounded hover:bg-green-900/20 hover:border-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>↑</span>
                Send {generatedRows.length} Report{generatedRows.length !== 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={handleGenerateAll}
              disabled={bulkRunning || !anyIdleChecked}
              className="flex items-center gap-2 bg-[#C9A227] text-[#0D0D0D] text-xs font-bold px-4 py-2 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {bulkRunning ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#0D0D0D] animate-pulse" />
                  {bulkProgress.done}/{bulkProgress.total} generated…
                </>
              ) : (
                <>✦ Generate {checkedRows.length > 0 ? checkedRows.length : 'Selected'} {periodLabel} Report{checkedRows.length !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>

        {/* Bulk progress bar — full styled block while running */}
        {bulkRunning && (
          <div className="px-5 py-4 bg-[#111] border-b border-[#2A2A2A] space-y-3">
            {/* Label row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-pulse flex-shrink-0" />
                <span className="text-white text-sm font-medium">
                  {currentMemberName ? `Generating for ${currentMemberName}…` : 'Starting…'}
                </span>
              </div>
              <span className="text-[#C9A227] text-sm font-mono font-bold">{bulkPct}%</span>
            </div>

            {/* Bar */}
            <div className="h-2 bg-[#0D0D0D] border border-[#333] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C9A227] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${bulkPct}%` }}
              />
            </div>

            {/* Sub-label + cancel */}
            <div className="flex items-center justify-between gap-3 bg-[#1A0A00] border border-[#C9A227]/40 rounded px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[#C9A227] text-base leading-none">⚠</span>
                <p className="text-[#C9A227] text-xs font-medium">
                  Keep this tab open — {bulkProgress.done} of {bulkProgress.total} reports done.
                  Closing will stop the batch.
                </p>
              </div>
              <button
                onClick={() => {
                  cancelRef.current = true
                  currentFetchAbortRef.current?.abort()
                }}
                className="flex-shrink-0 text-[#CC1F1F] text-xs font-medium border border-[#CC1F1F]/30 px-3 py-1 rounded hover:border-red-400/50 hover:text-red-400 transition-colors"
              >
                Stop
              </button>
            </div>
          </div>
        )}

        {/* Member rows */}
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[#555] text-sm">No active members found.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#222]">
            {rows.map(row => (
              <div key={row.member.id}>
                {/* Member row */}
                <div className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                  row.checked ? 'bg-transparent' : 'opacity-50'
                }`}>
                  {/* Checkbox */}
                  <button
                    onClick={() => !bulkRunning && updateRow(row.member.id, { checked: !row.checked })}
                    disabled={bulkRunning}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      row.checked
                        ? 'bg-[#C9A227] border-[#C9A227]'
                        : 'bg-transparent border-[#444] hover:border-[#C9A227]/60'
                    }`}
                  >
                    {row.checked && <span className="text-[#0D0D0D] text-[10px] font-bold leading-none">✓</span>}
                  </button>

                  {/* Name + cohort */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{row.member.name}</p>
                    <p className="text-[#555] text-xs truncate">{row.member.email}</p>
                  </div>

                  {/* Cohort tag */}
                  {row.member.cohort && (
                    <span className="text-[#555] text-[10px] border border-[#2A2A2A] px-2 py-0.5 rounded hidden sm:inline">
                      {row.member.cohort}
                    </span>
                  )}

                  {/* Status */}
                  <div className="w-28 flex-shrink-0">
                    <StatusBadge status={row.status} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Preview toggle */}
                    {row.status === 'done' && row.reportHtml && (
                      <button
                        onClick={() => updateRow(row.member.id, { previewOpen: !row.previewOpen })}
                        className={`text-xs border px-2.5 py-1 rounded transition-colors ${
                          row.previewOpen
                            ? 'border-[#C9A227]/50 text-[#C9A227] bg-[#C9A227]/8'
                            : 'border-[#2A2A2A] text-[#555] hover:text-[#888] hover:border-[#444]'
                        }`}
                      >
                        {row.previewOpen ? 'Hide' : 'Preview'}
                      </button>
                    )}

                    {/* Regenerate */}
                    {row.status === 'done' && (
                      <button
                        onClick={() => refineRowId === row.member.id ? closeRefine() : openRefine(row.member.id)}
                        disabled={bulkRunning}
                        className={`text-xs border px-2.5 py-1 rounded transition-colors disabled:opacity-40 ${
                          refineRowId === row.member.id
                            ? 'border-[#C9A227]/40 text-[#C9A227]'
                            : 'border-[#2A2A2A] text-[#555] hover:text-[#888] hover:border-[#444]'
                        }`}
                      >
                        ↺ Regen
                      </button>
                    )}

                    {/* Per-row send */}
                    {row.status === 'done' && row.reportId && (
                      <button
                        onClick={() => handleSendOne(row.member.id, row.reportId!, row.member.name, row.member.email)}
                        className="text-xs border border-[#C9A227]/30 text-[#C9A227] px-2.5 py-1 rounded hover:bg-[#C9A227]/10 hover:border-[#C9A227]/50 transition-colors"
                      >
                        Send →
                      </button>
                    )}

                    {/* Retry on error */}
                    {row.status === 'error' && (
                      <button
                        onClick={() => updateRow(row.member.id, { status: 'idle', error: null })}
                        className="text-xs border border-[#CC1F1F]/30 text-[#CC1F1F] px-2.5 py-1 rounded hover:bg-[#CC1F1F]/10 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>

                {/* Error inline */}
                {row.error && (
                  <div className="px-5 pb-3">
                    <p className="text-[#CC1F1F] text-xs bg-[#1a0a0a] border border-[#CC1F1F]/20 rounded px-3 py-2">
                      {row.error}
                    </p>
                  </div>
                )}

                {/* Inline refine form */}
                {refineRowId === row.member.id && (
                  <div className="border-t border-[#C9A227]/20 bg-[#1A1200] px-5 py-4 space-y-3">
                    <p className="text-[#C9A227] text-[10px] tracking-[0.2em] uppercase">Regenerate — {row.member.name}</p>
                    <div className="relative">
                      <textarea
                        value={refineFeedback}
                        onChange={e => setRefineFeedback(e.target.value)}
                        placeholder="What needs to change? e.g. Push harder on the attendance gap. Mention her Florida team."
                        rows={3}
                        className="w-full bg-[#0D0D0D] border border-[#2A2A2A] text-white placeholder-[#333] text-sm rounded px-3 py-2.5 pr-20 resize-none focus:outline-none focus:border-[#C9A227]/40"
                      />
                      <button
                        type="button"
                        onClick={() => refineFileRef.current?.click()}
                        className="absolute bottom-2.5 right-2.5 text-[#444] hover:text-[#888] text-xs border border-[#2A2A2A] px-2 py-0.5 rounded bg-[#0D0D0D] transition-colors"
                      >
                        {refineUploadLabel ? '📎' : '+ File'}
                      </button>
                    </div>
                    {refineUploadLabel && (
                      <p className="text-[#555] text-xs">📎 {refineUploadLabel} appended</p>
                    )}
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={closeRefine} className="text-[#555] text-xs hover:text-[#888] transition-colors">Cancel</button>
                      <button
                        onClick={() => handleRegenerateOne(row.member.id, row.reportId, refineFeedback)}
                        className="bg-[#C9A227] text-[#0D0D0D] text-xs font-bold px-4 py-1.5 rounded hover:bg-[#d4ac2d] transition-colors"
                      >
                        ✦ Apply &amp; Regenerate
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline preview */}
                {row.previewOpen && row.reportHtml && (
                  <div className="border-t border-[#2A2A2A]">
                    <div className="bg-[#111] px-5 py-2 border-b border-[#2A2A2A] flex items-center justify-between">
                      <p className="text-[#555] text-xs">{row.member.name} — {row.reportLabel}</p>
                      <button
                        onClick={() => updateRow(row.member.id, { previewOpen: false })}
                        className="text-[#444] hover:text-[#888] text-xs transition-colors"
                      >
                        ✕ Close
                      </button>
                    </div>
                    <div
                      className="bg-[#0D0D0D] p-6 max-h-[480px] overflow-y-auto text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: row.reportHtml }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bottom toolbar (mirrors top when list is long) */}
        {rows.length > 5 && (
          <div className="px-5 py-3 border-t border-[#2A2A2A] flex items-center justify-between bg-[#111]">
            <p className="text-[#555] text-xs">{checkedRows.length} selected</p>
            <div className="flex items-center gap-2">
              {anyDoneChecked && (
                <button
                  onClick={handleSendAll}
                  disabled={bulkRunning}
                  className="border border-green-700/50 text-green-400 text-xs px-3 py-1.5 rounded hover:bg-green-900/20 transition-colors disabled:opacity-40"
                >
                  Send {generatedRows.length} Report{generatedRows.length !== 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={handleGenerateAll}
                disabled={bulkRunning || !anyIdleChecked}
                className="bg-[#C9A227] text-[#0D0D0D] text-xs font-bold px-3 py-1.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
              >
                ✦ Generate Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {globalError && (
        <p className="text-[#CC1F1F] text-xs">{globalError}</p>
      )}

      {/* Hidden file input for refine uploads */}
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
