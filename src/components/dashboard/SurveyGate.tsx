'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/lib/toast'
import { SURVEY_QUESTIONS } from '@/lib/survey-questions'
import type { SurveyQuestion, SurveyAnswers } from '@/lib/survey-questions'

interface SurveyPayload {
  due: boolean
  periodMonth?: string
  monthLabel?: string
  status?: string
  answers?: SurveyAnswers
  questions?: SurveyQuestion[]
}

const GOLD = '#C9A227'

// A blocking, non-dismissible monthly progress survey. When the current month's
// survey is due (open + not yet completed) it covers the portal until the member
// submits. Answers autosave as a draft, so they can leave and resume.
// In `preview` mode (staff "Preview member survey" button) it shows the exact
// member popup but fetches nothing, persists nothing, and is dismissible — for
// demos without touching any member data.
export default function SurveyGate({ preview = false, onClose }: { preview?: boolean; onClose?: () => void } = {}) {
  const previewPayload: SurveyPayload = {
    due: true,
    monthLabel: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    questions: SURVEY_QUESTIONS,
    answers: {},
  }
  const [payload, setPayload] = useState<SurveyPayload | null>(preview ? previewPayload : null)
  const [answers, setAnswers] = useState<SurveyAnswers>({})
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (preview) return // preview never fetches or persists
    let alive = true
    fetch('/api/surveys/me')
      .then((r) => r.json())
      .then((data: SurveyPayload) => {
        if (!alive) return
        setPayload(data)
        if (data.answers) setAnswers(data.answers)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [preview])

  // Preview is dismissible with Escape.
  useEffect(() => {
    if (!preview || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, onClose])

  const persist = useCallback(async (next: SurveyAnswers, submit: boolean) => {
    const res = await fetch('/api/surveys/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: next, submit }),
    })
    return res
  }, [])

  const scheduleSave = useCallback(
    (next: SurveyAnswers) => {
      if (preview) return // never persist in preview
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaving(true)
        try {
          await persist(next, false)
        } catch {
          /* draft save is best-effort */
        } finally {
          setSaving(false)
        }
      }, 700)
    },
    [persist, preview]
  )

  const update = useCallback(
    (key: string, value: string | number | boolean | null) => {
      setError(null)
      setAnswers((prev) => {
        const next = { ...prev, [key]: value }
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave]
  )

  const questions = payload?.questions ?? []
  const isAnswered = (q: SurveyQuestion) => {
    const v = answers[q.key]
    if (q.type === 'boolean') return v === true || v === false
    if (typeof v === 'string') return v.trim().length > 0
    return v !== null && v !== undefined
  }
  // Optional questions (e.g. the catch-all) never count toward completion.
  const requiredQuestions = questions.filter((q) => !q.optional)
  const answered = requiredQuestions.filter(isAnswered).length
  const total = requiredQuestions.length
  const allDone = total > 0 && answered === total

  async function handleSubmit() {
    if (!allDone || submitting) return
    if (preview) {
      toast('Preview only — nothing was saved.', 'success')
      onClose?.()
      return
    }
    setSubmitting(true)
    setError(null)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try {
      const res = await persist(answers, true)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Something went wrong. Please try again.')
        return
      }
      toast('Thank you — your progress check is in!', 'success')
      setPayload((p) => (p ? { ...p, due: false } : p))
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!payload?.due) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Monthly progress check"
      onClick={preview && onClose ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(8,8,8,0.92)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '24px 16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'var(--surface, #141414)',
          border: '1px solid var(--border-color, #2a2a2a)',
          borderRadius: 14,
          maxWidth: 640,
          width: '100%',
          margin: 'auto 0',
        }}
      >
        {preview && onClose ? (
          <button
            onClick={onClose}
            aria-label="Close preview"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--bg, #0d0d0d)',
              border: '1px solid var(--border-color, #2a2a2a)',
              color: 'var(--text-2, #888)',
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        ) : null}
        {/* Header */}
        <div style={{ padding: '28px 28px 16px', borderBottom: '1px solid var(--border-color, #2a2a2a)' }}>
          <div style={{ color: GOLD, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            {payload.monthLabel} · Progress Check{preview ? ' · Preview' : ''}
          </div>
          <h2 style={{ color: 'var(--text, #f5f5f5)', fontFamily: 'Georgia, serif', fontSize: 24, margin: '0 0 8px' }}>
            Your monthly check-in
          </h2>
          <p style={{ color: 'var(--text-2, #AAAAAA)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            A few quick numbers so Gogo and the team can track your growth. This takes
            about 3 minutes and needs to be completed to continue. Your answers save as
            you go.
          </p>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--border-color, #2a2a2a)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${total ? (answered / total) * 100 : 0}%`, height: '100%', background: GOLD, transition: 'width 0.2s' }} />
            </div>
            <span style={{ color: 'var(--text-2, #AAAAAA)', fontSize: 12, whiteSpace: 'nowrap' }}>
              {answered} / {total}
            </span>
          </div>
        </div>

        {/* Questions */}
        <div style={{ padding: '20px 28px' }}>
          {questions.map((q, i) => (
            <div key={q.key}>
              {q.section ? (
                <div style={{ margin: i === 0 ? '0 0 16px' : '30px 0 16px', paddingBottom: 8, borderBottom: '1px solid var(--border-color, #2a2a2a)' }}>
                  <span style={{ color: GOLD, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{q.section}</span>
                </div>
              ) : null}
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', color: 'var(--text, #f5f5f5)', fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>
                  <span style={{ color: GOLD, marginRight: 6 }}>{i + 1}.</span>
                  {q.label}
                  {q.optional ? <span style={{ color: 'var(--text-3, #666)', fontWeight: 400 }}> (optional)</span> : null}
                </label>
                <QuestionInput q={q} value={answers[q.key] ?? null} onChange={(v) => update(q.key, v)} />
                {q.hint ? (
                  <p style={{ color: 'var(--text-2, #888)', fontSize: 12, margin: '6px 0 0' }}>{q.hint}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 28px', borderTop: '1px solid var(--border-color, #2a2a2a)' }}>
          {error ? (
            <p style={{ color: '#ff8080', fontSize: 13, margin: '0 0 12px' }}>{error}</p>
          ) : null}
          <button
            onClick={handleSubmit}
            disabled={!allDone || submitting}
            style={{
              width: '100%',
              padding: '14px',
              background: allDone ? GOLD : 'var(--border-color, #2a2a2a)',
              color: allDone ? '#0D0D0D' : 'var(--text-2, #888)',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: allDone && !submitting ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s',
            }}
          >
            {submitting ? 'Submitting…' : allDone ? 'Submit my progress check' : `Answer all ${total} questions to submit`}
          </button>
          <p style={{ color: 'var(--text-2, #666)', fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
            {preview ? 'Preview mode — nothing is saved' : saving ? 'Saving…' : 'Progress saved automatically'}
          </p>
        </div>
      </div>
    </div>
  )
}

function QuestionInput({
  q,
  value,
  onChange,
}: {
  q: SurveyQuestion
  value: string | number | boolean | null
  onChange: (v: string | number | boolean | null) => void
}) {
  const baseInput: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg, #0d0d0d)',
    border: '1px solid var(--border-color, #2a2a2a)',
    borderRadius: 8,
    color: 'var(--text, #f5f5f5)',
    fontSize: 14,
    boxSizing: 'border-box',
  }

  if (q.type === 'boolean') {
    const opts: Array<{ label: string; val: boolean }> = [
      { label: 'Yes', val: true },
      { label: 'No', val: false },
    ]
    return (
      <div style={{ display: 'flex', gap: 10 }}>
        {opts.map((o) => {
          const active = value === o.val
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => onChange(o.val)}
              style={{
                flex: 1,
                padding: '10px',
                background: active ? GOLD : 'var(--bg, #0d0d0d)',
                color: active ? '#0D0D0D' : 'var(--text, #f5f5f5)',
                border: `1px solid ${active ? GOLD : 'var(--border-color, #2a2a2a)'}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === 'longtext') {
    return (
      <textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={{ ...baseInput, resize: 'vertical', fontFamily: 'inherit' }}
        placeholder="Share your biggest lesson…"
      />
    )
  }

  if (q.type === 'text') {
    return (
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        style={baseInput}
      />
    )
  }

  // numeric: currency / integer / number
  const isCurrency = q.type === 'currency'
  return (
    <div style={{ position: 'relative' }}>
      {isCurrency ? (
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2, #888)', fontSize: 14 }}>$</span>
      ) : null}
      <input
        type="number"
        inputMode={q.type === 'number' ? 'decimal' : 'numeric'}
        min={0}
        step={q.type === 'number' ? '0.5' : '1'}
        value={value === null || value === undefined || value === '' ? '' : Number(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        style={{ ...baseInput, paddingLeft: isCurrency ? 24 : 12 }}
        placeholder="0"
      />
    </div>
  )
}
