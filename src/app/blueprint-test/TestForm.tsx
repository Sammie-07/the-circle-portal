'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TEST_STEPS, isAnswered, type TestAnswers, type TestQuestion } from '@/lib/blueprint-test/questions'

const DRAFT_KEY = 'blueprint-test:draft'
const SCALE_LABELS = ['Not me at all', '', 'Somewhat', '', 'Exactly me']

// Steps: 0 = intro, 1..N = question steps, N+1 = contact details.
export default function TestForm() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<TestAnswers>({})
  const [contact, setContact] = useState({ name: '', email: '', phone: '', website: '' })
  const [consent, setConsent] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const topRef = useRef<HTMLDivElement>(null)

  const contactStep = TEST_STEPS.length + 1

  // Restore a half-finished test (refresh, phone call, back button). Saving
  // waits until the restore has run so the empty first render can't wipe it.
  const restored = useRef(false)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY)
        if (raw) {
          const d = JSON.parse(raw) as { answers?: TestAnswers; contact?: typeof contact; step?: number }
          if (d.answers) setAnswers(d.answers)
          if (d.contact) setContact((c) => ({ ...c, ...d.contact, website: '' }))
          if (typeof d.step === 'number' && d.step > 0) setStep(Math.min(d.step, contactStep))
        }
      } catch {}
      restored.current = true
    })
    return () => clearTimeout(t)
  }, [contactStep])

  useEffect(() => {
    if (!restored.current) return
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, contact: { ...contact, website: '' }, step })) } catch {}
  }, [answers, contact, step])

  function go(n: number) {
    setShowMissing(false)
    setError('')
    setStep(n)
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function set(key: string, v: string | string[] | number) {
    setAnswers((a) => ({ ...a, [key]: v }))
  }

  function next() {
    const s = TEST_STEPS[step - 1]
    const missing = s.questions.filter((q) => !isAnswered(q, answers[q.key]))
    if (missing.length) {
      setShowMissing(true)
      document.querySelector(`[data-q="${missing[0].key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    go(step + 1)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) { setError('Please tick the box so we can send you your results.'); return }
    setSubmitting(true)
    setError('')
    try {
      const params = new URLSearchParams(window.location.search)
      const source: Record<string, string> = {}
      params.forEach((v, k) => { source[k] = v })
      const res = await fetch('/api/blueprint-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contact, answers, source }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.token) { setError(data.error ?? 'Something went wrong. Please try again.'); return }
      try { localStorage.removeItem(DRAFT_KEY) } catch {}
      router.push(`/blueprint-test/r/${data.token}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const progress = step === 0 ? 0 : Math.round((step / (contactStep + 1)) * 100)

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <div ref={topRef} className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-7 h-7 rounded-full border border-[#CC1F1F] flex items-center justify-center flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F]" />
          </div>
          <span className="font-serif text-base">Gogo Bethke</span>
        </div>

        {step > 0 && (
          <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6 bg-[#090909]/95 backdrop-blur">
            <div className="flex justify-between text-[11px] text-[#777] mb-1.5">
              <span>{step <= TEST_STEPS.length ? TEST_STEPS[step - 1].title : 'Your results'}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 rounded-full bg-[#1c1c1c] overflow-hidden">
              <div className="h-full bg-[#C9A227] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {step === 0 && (
          <div>
            <p className="text-[#C9A227] text-[10px] tracking-[0.28em] uppercase mb-3">The Blueprint Test</p>
            <h1 className="font-serif text-[36px] sm:text-[44px] leading-[1.1] mb-5">Is your business giving you freedom, or taking it?</h1>
            <p className="text-[#aaa] leading-relaxed mb-4">
              I measure every business I coach on four freedoms: time, location, financial freedom and the CEO mindset that holds them together.
            </p>
            <p className="text-[#aaa] leading-relaxed mb-8">
              Answer honestly and I will show you where you stand on each one, the bottleneck that is really holding you back, and your first three moves. About 6 minutes.
            </p>
            <button onClick={() => go(1)} className="w-full sm:w-auto bg-[#C9A227] text-[#090909] font-semibold px-8 py-3.5 rounded-lg hover:bg-[#d4ac2d] transition-colors">
              Start the test →
            </button>
          </div>
        )}

        {step >= 1 && step <= TEST_STEPS.length && (() => {
          const s = TEST_STEPS[step - 1]
          return (
            <div>
              <h2 className="font-serif text-[30px] mb-1">{s.title}</h2>
              <p className="text-[#888] text-sm mb-8">{s.intro}</p>
              <div className="space-y-8">
                {s.questions.map((q) => (
                  <Question key={q.key} q={q} value={answers[q.key]} onChange={(v) => set(q.key, v)} missing={showMissing && !isAnswered(q, answers[q.key])} />
                ))}
              </div>
              <div className="flex gap-3 mt-10">
                <button onClick={() => go(step - 1)} className="px-5 py-3 rounded-lg border border-[#333] text-[#aaa] hover:border-[#555]">Back</button>
                <button onClick={next} className="flex-1 bg-[#C9A227] text-[#090909] font-semibold py-3 rounded-lg hover:bg-[#d4ac2d] transition-colors">
                  {step === TEST_STEPS.length ? 'Almost done →' : 'Next →'}
                </button>
              </div>
              {showMissing && <p className="text-[#ff8080] text-sm mt-3">Answer the highlighted questions to keep going.</p>}
            </div>
          )
        })()}

        {step === contactStep && (
          <form onSubmit={submit}>
            <h2 className="font-serif text-[30px] mb-1">Where should I send your results?</h2>
            <p className="text-[#888] text-sm mb-8">Your results open on the next screen. Bookmark that page to come back to them.</p>
            <div className="space-y-4">
              <Field label="Full name" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} autoComplete="name" required />
              <Field label="Email" type="email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} autoComplete="email" required />
              <Field label="Phone (optional)" type="tel" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} autoComplete="tel" />
              {/* Honeypot for bots: hidden from people and screen readers. */}
              <input tabIndex={-1} aria-hidden="true" autoComplete="off" className="hidden" value={contact.website} onChange={(e) => setContact({ ...contact, website: e.target.value })} name="website" />
              <label className="flex gap-3 items-start text-sm text-[#aaa] pt-2 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-[#C9A227]" />
                <span>Yes, Gogo&apos;s team can contact me about my results and the programs that fit.</span>
              </label>
            </div>
            {error && <p className="text-[#ff8080] text-sm mt-4">{error}</p>}
            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => go(step - 1)} className="px-5 py-3 rounded-lg border border-[#333] text-[#aaa] hover:border-[#555]">Back</button>
              <button type="submit" disabled={submitting} className="flex-1 bg-[#C9A227] text-[#090909] font-semibold py-3 rounded-lg hover:bg-[#d4ac2d] transition-colors disabled:opacity-60">
                {submitting ? 'Sending…' : 'Show me my results →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Question({ q, value, onChange, missing }: { q: TestQuestion; value: unknown; onChange: (v: string | string[] | number) => void; missing: boolean }) {
  return (
    <div data-q={q.key} className={missing ? 'rounded-xl ring-1 ring-[#ff8080]/60 p-3 -m-3' : ''}>
      <p className="text-[15px] leading-snug mb-3">{q.label}</p>
      {q.hint && <p className="text-[12px] text-[#777] -mt-2 mb-3">{q.hint}</p>}

      {q.type === 'single' && (
        <div className="grid gap-2">
          {q.options.map((o) => (
            <button key={o.value} type="button" onClick={() => onChange(o.value)}
              className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${value === o.value ? 'border-[#C9A227] bg-[#C9A227]/10 text-white' : 'border-[#2a2a2a] text-[#ccc] hover:border-[#444]'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {q.type === 'multi' && (
        <div className="grid gap-2">
          {q.options.map((o) => {
            const arr = Array.isArray(value) ? value as string[] : []
            const on = arr.includes(o.value)
            const toggle = () => {
              if (o.value === 'none') return onChange(on ? [] : ['none'])
              const rest = arr.filter((x) => x !== 'none')
              onChange(on ? rest.filter((x) => x !== o.value) : [...rest, o.value])
            }
            return (
              <button key={o.value} type="button" onClick={toggle}
                className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors flex gap-3 items-center ${on ? 'border-[#C9A227] bg-[#C9A227]/10 text-white' : 'border-[#2a2a2a] text-[#ccc] hover:border-[#444]'}`}>
                <span className={`w-4 h-4 rounded border flex-none flex items-center justify-center text-[10px] ${on ? 'border-[#C9A227] bg-[#C9A227] text-[#090909]' : 'border-[#555]'}`}>{on ? '✓' : ''}</span>
                {o.label}
              </button>
            )
          })}
        </div>
      )}

      {q.type === 'scale' && (
        <div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => onChange(n)}
                className={`py-3 rounded-lg border text-sm font-semibold transition-colors ${value === n ? 'border-[#C9A227] bg-[#C9A227] text-[#090909]' : 'border-[#2a2a2a] text-[#ccc] hover:border-[#444]'}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2 mt-1.5 text-[10px] text-[#666] text-center">
            {SCALE_LABELS.map((l, i) => <span key={i}>{l}</span>)}
          </div>
        </div>
      )}

      {q.type === 'text' && (
        <textarea value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} rows={q.long ? 4 : 2} maxLength={2000}
          className="w-full rounded-lg bg-[#111] border border-[#2a2a2a] focus:border-[#C9A227] outline-none px-4 py-3 text-sm leading-relaxed" />
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', autoComplete, required }: { label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-[#888] mb-1.5">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required={required}
        className="w-full rounded-lg bg-[#111] border border-[#2a2a2a] focus:border-[#C9A227] outline-none px-4 py-3 text-sm" />
    </label>
  )
}
