'use client'

import { useState, useRef, useEffect } from 'react'

interface BlueprintPanelProps {
  memberId: string
  memberName: string
  memberEmail: string | null
  blueprintHtml: string | null
  blueprintGeneratedAt: string | null
  blueprintSentToGogoAt: string | null
  blueprintSentToMemberAt: string | null
  blueprintShareToken: string | null
  blueprintTranscript: string | null
}

interface IntakeData {
  call_date: string
  fathom_link: string
  transcript: string
}

export default function BlueprintPanel({
  memberId,
  memberName,
  memberEmail,
  blueprintHtml: initialHtml,
  blueprintGeneratedAt: initialGeneratedAt,
  blueprintSentToGogoAt: initialSentGogo,
  blueprintSentToMemberAt: initialSentMember,
  blueprintShareToken: initialToken,
  blueprintTranscript: initialTranscript,
}: BlueprintPanelProps) {
  const [html, setHtml] = useState(initialHtml)
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt)
  const [sentGogoAt, setSentGogoAt] = useState(initialSentGogo)
  const [sentMemberAt, setSentMemberAt] = useState(initialSentMember)
  const [shareToken, setShareToken] = useState(initialToken)

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [sendingGogo, setSendingGogo] = useState(false)
  const [sendingMember, setSendingMember] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Refine (chat bubble) modal — shown when regenerating an existing blueprint
  const [showRefine, setShowRefine] = useState(false)
  const [refineFeedback, setRefineFeedback] = useState('')
  const [showRefineTranscript, setShowRefineTranscript] = useState(false)
  const [refineUploadLabel, setRefineUploadLabel] = useState('')
  const refineFileRef = useRef<HTMLInputElement>(null)

  // Warn before closing/refreshing while generating
  useEffect(() => {
    if (!generating) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [generating])

  // Animate progress bar during generation
  useEffect(() => {
    if (generating) {
      setProgress(0)
      setProgressLabel('Reading transcript…')
      let elapsed = 0

      progressTimerRef.current = setInterval(() => {
        elapsed += 1
        // Crawl from 0→88% over ~115s (3 API calls), then hold
        const next = Math.min(88, Math.round((elapsed / 115) * 88))
        setProgress(next)

        if (elapsed <= 5) setProgressLabel('Reading transcript…')
        else if (elapsed <= 15) setProgressLabel('Pulling from The Brain…')
        else if (elapsed <= 35) setProgressLabel('Writing your profile & CEO shift…')
        else if (elapsed <= 55) setProgressLabel('Building your hire sequence…')
        else if (elapsed <= 80) setProgressLabel('Crafting your 12-month roadmap…')
        else if (elapsed <= 100) setProgressLabel('Writing income architecture & rules…')
        else setProgressLabel('Almost there — finalising your blueprint…')
      }, 1000)
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [generating])

  // Intake modal
  const [showIntake, setShowIntake] = useState(false)
  const [intake, setIntake] = useState<IntakeData>({
    call_date: new Date().toISOString().split('T')[0],
    fathom_link: '',
    transcript: initialTranscript ?? '',
  })
  const [uploadLabel, setUploadLabel] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadLabel(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setIntake(p => ({ ...p, transcript: text }))
    }
    reader.readAsText(file)
  }

  function handleRefineFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setRefineUploadLabel(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setRefineFeedback(prev => prev ? `${prev}\n\n---\nFrom file (${file.name}):\n${text}` : text)
    }
    reader.readAsText(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  async function handleGenerate(feedback?: string) {
    if (!feedback && !intake.transcript.trim()) {
      setError('Please paste or upload the clarity call transcript before generating.')
      return
    }
    setShowIntake(false)
    setShowRefine(false)
    setGenerating(true)
    setError('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/blueprints/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          call_date: intake.call_date,
          fathom_link: intake.fathom_link,
          // If refining, send no transcript (server uses the saved one); if fresh, send the new transcript
          ...(feedback ? {} : { transcript: intake.transcript }),
          ...(feedback ? { feedback } : {}),
        }),
        signal: controller.signal,
      })

      let data: { error?: string; blueprint_html?: string; share_token?: string } = {}
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        // Server returned HTML (unhandled crash) — extract text for debugging
        const text = await res.text()
        setError(`Server error ${res.status}: ${text.slice(0, 200)}`)
        setGenerating(false)
        setProgress(0)
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Generation failed')
      } else {
        setProgress(100)
        setProgressLabel('Done!')
        setTimeout(() => {
          setHtml(data.blueprint_html ?? null)
          setGeneratedAt(new Date().toISOString())
          setShareToken(data.share_token ?? shareToken ?? null)
          setSentGogoAt(null)
          setSentMemberAt(null)
          setGenerating(false)
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

  async function handleSend(recipient: 'gogo' | 'member') {
    const toEmail = recipient === 'gogo' ? 'gogosrealestate@gmail.com' : (memberEmail ?? memberName)
    const label = recipient === 'gogo' ? `Gogo (${toEmail})` : `${memberName} (${toEmail})`
    const extraNote = recipient === 'member'
      ? '\n\nThis will also publish the blueprint to their portal so they can view it.'
      : ''
    if (!confirm(`Send blueprint to ${label}?${extraNote}`)) return

    if (recipient === 'gogo') setSendingGogo(true)
    else setSendingMember(true)
    setError('')

    const res = await fetch('/api/blueprints/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, recipient }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Send failed')
    } else {
      if (recipient === 'gogo') setSentGogoAt(new Date().toISOString())
      else setSentMemberAt(new Date().toISOString())
    }

    if (recipient === 'gogo') setSendingGogo(false)
    else setSendingMember(false)
  }

  function getShareUrl() {
    if (!shareToken) return ''
    return `${window.location.origin}/b/${shareToken}`
  }

  async function copyLink() {
    const url = getShareUrl()
    if (!url) return
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  function downloadHtml() {
    if (!html) return
    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${memberName.replace(/\s+/g, '-')}-Blueprint.html`
    a.click()
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  return (
    <>
      {/* ─── Intake Modal ─── */}
      {showIntake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="sticky top-0 bg-[var(--surface-2)] border-b border-[var(--border-color)] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase mb-0.5">12-Month Blueprint</p>
                <h3 className="text-[var(--text)] font-serif text-xl">{memberName}</h3>
              </div>
              <button onClick={() => setShowIntake(false)} className="text-[var(--text-3)] hover:text-[var(--text)] text-xl leading-none transition-colors">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <p className="text-[var(--text-2)] text-sm leading-relaxed">
                Paste the clarity call transcript below — or upload the file. Claude will read it alongside The Brain to write the full blueprint.
              </p>

              {/* Date + Fathom */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#C9A227] text-[10px] tracking-[0.2em] uppercase mb-2">Call Date</label>
                  <input
                    type="date"
                    value={intake.call_date}
                    onChange={e => setIntake(p => ({ ...p, call_date: e.target.value }))}
                    className="w-full bg-[var(--surface)] border border-[var(--border-hover)] text-[var(--text)] text-sm px-3 py-2.5 rounded focus:outline-none focus:border-[#C9A227]/50"
                  />
                </div>
                <div>
                  <label className="block text-[#C9A227] text-[10px] tracking-[0.2em] uppercase mb-2">Fathom Link <span className="text-[var(--text-4)] normal-case">(optional)</span></label>
                  <input
                    type="url"
                    value={intake.fathom_link}
                    onChange={e => setIntake(p => ({ ...p, fathom_link: e.target.value }))}
                    placeholder="https://fathom.video/..."
                    className="w-full bg-[var(--surface)] border border-[var(--border-hover)] text-[var(--text)] text-sm px-3 py-2.5 rounded focus:outline-none focus:border-[#C9A227]/50 placeholder:text-[var(--text-4)]"
                  />
                </div>
              </div>

              {/* Transcript */}
              <div>
                <label className="block text-[#C9A227] text-[10px] tracking-[0.2em] uppercase mb-3">
                  Clarity Call Transcript <span className="text-[#CC1F1F]">*</span>
                </label>

                {/* Upload button — full width, prominent */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`w-full mb-3 border-2 border-dashed rounded px-4 py-4 text-center transition-colors ${
                    uploadLabel
                      ? 'border-[#C9A227]/50 bg-[#C9A227]/5 text-[#C9A227]'
                      : 'border-[var(--border-hover)] hover:border-[#C9A227]/40 hover:bg-[#C9A227]/3 text-[var(--text-2)] hover:text-[#C9A227]'
                  }`}
                >
                  <span className="block text-xl mb-1">{uploadLabel ? '✓' : '↑'}</span>
                  <span className="text-sm font-medium">
                    {uploadLabel ? uploadLabel : 'Upload transcript file'}
                  </span>
                  <span className="block text-xs mt-0.5 opacity-60">
                    {uploadLabel ? 'Click to replace' : '.txt · .md · or paste below'}
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.text"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-[#2A2A2A]" />
                  <span className="text-[var(--text-4)] text-xs">or paste directly</span>
                  <div className="flex-1 h-px bg-[#2A2A2A]" />
                </div>

                <textarea
                  value={intake.transcript}
                  onChange={e => setIntake(p => ({ ...p, transcript: e.target.value }))}
                  rows={14}
                  placeholder="Paste the full transcript here — everything from the clarity call. The more complete, the more specific the blueprint will be."
                  className="w-full bg-[var(--surface)] border border-[var(--border-hover)] text-[var(--text)] text-sm px-3 py-2.5 rounded focus:outline-none focus:border-[#C9A227]/50 placeholder:text-[var(--text-4)] resize-none font-mono leading-relaxed"
                />
                {intake.transcript && (
                  <p className="text-[var(--text-4)] text-xs mt-1">
                    {intake.transcript.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                  </p>
                )}
              </div>

              {error && <p className="text-[#CC1F1F] text-xs">{error}</p>}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-[var(--surface-2)] border-t border-[var(--border-color)] px-6 py-4 flex items-center justify-between">
              <button onClick={() => { setShowIntake(false); setError('') }} className="text-[var(--text-3)] text-sm hover:text-[var(--text-2)] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleGenerate()}
                className="bg-[#C9A227] text-[#0D0D0D] font-medium text-sm px-6 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors"
              >
                ✦ Generate Blueprint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Refine / Chat Bubble Modal ─── */}
      {showRefine && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="bg-[var(--bg)] border-b border-[var(--border-color)] px-5 py-4 flex items-start justify-between">
              <div>
                <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase mb-1">Regenerate Blueprint</p>
                <h3 className="text-[var(--text)] font-serif text-lg">What needs to change?</h3>
                <p className="text-[var(--text-3)] text-xs mt-1">Describe what to fix or improve. The rest stays the same.</p>
              </div>
              <button onClick={() => setShowRefine(false)} className="text-[var(--text-3)] hover:text-[var(--text)] text-xl leading-none transition-colors mt-0.5">✕</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Feedback textarea + upload */}
              <div className="relative">
                <textarea
                  value={refineFeedback}
                  onChange={e => setRefineFeedback(e.target.value)}
                  autoFocus
                  rows={6}
                  placeholder={`e.g. "Make Q2 more focused on hiring — she mentioned she wants to bring on a full-time assistant by month 5. Also the income section needs to include the rental property she mentioned."`}
                  className="w-full bg-[var(--surface)] border border-[var(--border-hover)] text-[var(--text)] text-sm px-3 py-3 pb-10 rounded focus:outline-none focus:border-[#C9A227]/50 placeholder:text-[var(--text-4)] resize-none leading-relaxed"
                />
                {/* Upload button — sits in bottom-right of textarea */}
                <button
                  type="button"
                  onClick={() => refineFileRef.current?.click()}
                  title="Upload a notes or corrections file"
                  className={`absolute bottom-2.5 right-2.5 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border transition-colors ${
                    refineUploadLabel
                      ? 'border-[#C9A227]/40 text-[#C9A227] bg-[#C9A227]/8'
                      : 'border-[var(--border-hover)] text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--border-color)]'
                  }`}
                >
                  <span className="text-base leading-none">{refineUploadLabel ? '✓' : '↑'}</span>
                  <span>{refineUploadLabel ? refineUploadLabel : 'Upload file'}</span>
                </button>
                <input
                  ref={refineFileRef}
                  type="file"
                  accept=".txt,.md,.text"
                  className="hidden"
                  onChange={handleRefineFileUpload}
                />
              </div>

              {/* Optional: show/edit the existing transcript */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowRefineTranscript(v => !v)}
                  className="text-[var(--text-3)] text-xs hover:text-[var(--text-2)] transition-colors"
                >
                  {showRefineTranscript ? '▲ Hide transcript' : '▼ View / edit saved transcript'}
                </button>
                {showRefineTranscript && (
                  <div className="mt-2">
                    <p className="text-[var(--text-4)] text-xs mb-1.5">
                      This is the transcript used for the last generation. Edit if needed — changes will be saved.
                    </p>
                    <textarea
                      value={intake.transcript}
                      onChange={e => setIntake(p => ({ ...p, transcript: e.target.value }))}
                      rows={10}
                      className="w-full bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text-2)] text-xs px-3 py-2.5 rounded focus:outline-none focus:border-[#C9A227]/30 resize-none font-mono leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {error && <p className="text-[#CC1F1F] text-xs">{error}</p>}
            </div>

            {/* Footer */}
            <div className="bg-[var(--bg)] border-t border-[var(--border-color)] px-5 py-4 flex items-center justify-between gap-3">
              <button
                onClick={() => setShowRefine(false)}
                className="text-[var(--text-3)] text-sm hover:text-[var(--text-2)] transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    // Regenerate from scratch — switch to full intake form
                    setShowRefine(false)
                    setIntake(p => ({ ...p, transcript: initialTranscript ?? '' }))
                    setShowIntake(true)
                  }}
                  className="border border-[var(--border-hover)] text-[var(--text-3)] text-sm px-4 py-2 rounded hover:text-[var(--text-2)] hover:border-[var(--border-color)] transition-colors"
                >
                  Start fresh
                </button>
                <button
                  onClick={() => handleGenerate(refineFeedback.trim() || undefined)}
                  disabled={!refineFeedback.trim()}
                  className="bg-[#C9A227] text-[#0D0D0D] font-medium text-sm px-5 py-2 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ↺ Apply & Regenerate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Panel ─── */}
      <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[#C9A227] text-xs tracking-[0.2em] uppercase mb-1">One-Time Document</p>
            <h2 className="text-[var(--text)] font-serif text-xl">12-Month Blueprint</h2>
          </div>
          {html && (
            <button onClick={() => setPreview(!preview)} className="text-xs text-[var(--text-3)] hover:text-[#C9A227] transition-colors">
              {preview ? 'Hide preview' : 'Preview →'}
            </button>
          )}
        </div>

        {/* Status */}
        {html ? (
          <div className="space-y-2 mb-5">
            <div className="flex items-center gap-2 text-xs text-[var(--text-2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Generated {fmtDate(generatedAt)}
            </div>
            {sentGogoAt && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227]" />
                Sent to Gogo {fmtDate(sentGogoAt)}
              </div>
            )}
            {sentMemberAt && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227]" />
                Sent to {memberName} {fmtDate(sentMemberAt)} · <span className="text-green-400">Published to portal</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[var(--text-3)] text-sm mb-5">
            No blueprint yet. Click below — you&apos;ll paste the clarity call transcript and Claude will write the full 12-month plan using The Brain.
          </p>
        )}

        {/* Progress bar while generating */}
        {generating && (
          <div className="mb-5 space-y-3">
            {/* Label + % */}
            <div className="flex items-center justify-between">
              <span className="text-[var(--text)] text-sm font-medium">{progressLabel}</span>
              <span className="text-[#C9A227] text-sm font-mono font-bold">{progress}%</span>
            </div>

            {/* Bar */}
            <div className="h-2 bg-[var(--bg)] border border-[var(--border-hover)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C9A227] rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Subtitle */}
            <p className="text-[var(--text-2)] text-xs">
              Pulling from The Brain + reading the transcript — writing every section of the blueprint.
            </p>

            {/* Warning banner */}
            <div className="flex items-center justify-between gap-3 bg-[#1A0A00] border border-[#C9A227]/40 rounded px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[#C9A227] text-base leading-none">⚠</span>
                <p className="text-[#C9A227] text-xs font-medium">
                  Keep this tab open — closing or refreshing will cancel the generation.
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="flex-shrink-0 text-[#CC1F1F] text-xs font-medium hover:text-red-400 transition-colors border border-[#CC1F1F]/30 px-3 py-1 rounded hover:border-red-400/50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Generate + Send buttons (hidden while generating) */}
        {!generating && (
          <div className="flex flex-wrap gap-3 mb-5">
            <button
              onClick={() => {
                setError('')
                if (html) {
                  // Blueprint exists — show the refine/feedback chat bubble
                  setRefineFeedback('')
                  setRefineUploadLabel('')
                  setShowRefineTranscript(false)
                  setShowRefine(true)
                } else {
                  // No blueprint yet — show the full intake form
                  setShowIntake(true)
                }
              }}
              className="bg-[#C9A227] text-[#0D0D0D] font-medium text-sm px-5 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors"
            >
              {html ? '↺ Regenerate Blueprint' : '✦ Generate Blueprint'}
            </button>

            {html && (
              <>
                <button
                  onClick={() => handleSend('gogo')}
                  disabled={sendingGogo}
                  className="border border-[#C9A227]/40 text-[#C9A227] text-sm px-5 py-2.5 rounded hover:bg-[#C9A227]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sendingGogo ? 'Sending…' : sentGogoAt ? '✓ Sent to Gogo' : 'Send to Gogo'}
                </button>
                <button
                  onClick={() => handleSend('member')}
                  disabled={sendingMember}
                  className="border border-[var(--border-color)] text-[var(--text-2)] text-sm px-5 py-2.5 rounded hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sendingMember ? 'Sending…' : sentMemberAt ? `✓ Sent to ${memberName}` : `Send to ${memberName}`}
                </button>
              </>
            )}
          </div>
        )}

        {/* Share + Export row */}
        {html && shareToken && (
          <div className="border border-[var(--border-color)] rounded p-4 space-y-4">

            {/* Share link */}
            <div>
              <p className="text-[var(--text-3)] text-[10px] tracking-[0.2em] uppercase mb-2">Share Link</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/b/${shareToken}` : `/b/${shareToken}`}
                  className="flex-1 bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-2)] text-xs px-3 py-2 rounded font-mono truncate focus:outline-none"
                />
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 border border-[var(--border-color)] text-[var(--text-2)] text-xs px-3 py-2 rounded hover:text-[#C9A227] hover:border-[#C9A227]/40 transition-colors"
                >
                  {linkCopied ? '✓ Copied' : 'Copy'}
                </button>
                <a
                  href={`/b/${shareToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 border border-[var(--border-color)] text-[var(--text-2)] text-xs px-3 py-2 rounded hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors"
                >
                  Open ↗
                </a>
              </div>
            </div>

            {/* Download buttons */}
            <div>
              <p className="text-[var(--text-3)] text-[10px] tracking-[0.2em] uppercase mb-2">Download</p>
              <div className="flex gap-2">
                <button
                  onClick={downloadHtml}
                  className="flex items-center gap-2 border border-[var(--border-color)] text-[var(--text-2)] text-xs px-4 py-2.5 rounded hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors"
                >
                  <span className="text-sm leading-none">⬇</span>
                  HTML File
                </button>
                <a
                  href={`/b/${shareToken}?print=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-[#C9A227]/30 text-[#C9A227] text-xs px-4 py-2.5 rounded hover:bg-[#C9A227]/8 hover:border-[#C9A227]/50 transition-colors"
                >
                  <span className="text-sm leading-none">⬇</span>
                  PDF
                </a>
              </div>
              <p className="text-[var(--text-4)] text-[10px] mt-2 leading-relaxed">
                PDF opens a print-ready view — choose <span className="text-[var(--text-3)]">Save as PDF</span> as the destination in your browser&apos;s print dialog.
              </p>
            </div>

          </div>
        )}

        {error && <p className="text-[#CC1F1F] text-xs mt-3">{error}</p>}

        {/* Preview */}
        {preview && html && (
          <div className="mt-5 border border-[var(--border-color)] rounded overflow-hidden">
            <div className="bg-[var(--surface-2)] px-4 py-2 border-b border-[var(--border-color)] flex items-center justify-between">
              <p className="text-[var(--text-3)] text-xs">Blueprint preview</p>
              {shareToken && (
                <a href={`/b/${shareToken}`} target="_blank" className="text-[#C9A227] text-xs hover:text-[#d4ac2d]">
                  Full page ↗
                </a>
              )}
            </div>
            <div className="max-h-[500px] overflow-y-auto bg-[var(--bg)]">
              <iframe
                srcDoc={html}
                className="w-full"
                style={{ height: '500px', border: 'none' }}
                title="Blueprint preview"
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
