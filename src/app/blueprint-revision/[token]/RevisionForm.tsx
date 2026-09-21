'use client'

import { useState } from 'react'

interface RevisionFormProps {
  token: string
  memberName: string
  alreadySubmitted: boolean
}

// The questionnaire. Each question's `note` renders as small print beneath it.
const QUESTIONS: { key: string; question: string; placeholder: string; note?: string }[] = [
  {
    key: 'direction',
    question: "What's the new idea or direction you want to build into your blueprint?",
    placeholder: 'Describe the one or two big things you want to focus on. Be as detailed as you can, the more you give, the better your blueprint…',
    note: 'Remember: two big ideas at most. Focus on the one or two that matter most right now.',
  },
  {
    key: 'why_now',
    question: "Why now, what's changed since your last blueprint?",
    placeholder: 'What shifted in your business, your market, or your goals? Be as detailed as you can…',
  },
  {
    key: 'success_12mo',
    question: 'What does winning at this look like over the next 12 months?',
    placeholder: 'Paint the picture in as much detail as you can, numbers, milestones, what success feels like…',
  },
  {
    key: 'tradeoffs',
    question: 'What will you stop or pause to make room for it?',
    placeholder: "You can't add without subtracting, what comes off your plate? Be as detailed as you can…",
  },
]

export default function RevisionForm({ token, memberName, alreadySubmitted }: RevisionFormProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(alreadySubmitted)
  const [error, setError] = useState('')

  function setValue(key: string, v: string) {
    setValues(prev => ({ ...prev, [key]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const answers = QUESTIONS.map(q => ({ question: q.question, answer: values[q.key] ?? '' }))
    if (!answers.some(a => a.answer.trim())) {
      setError('Please fill in at least the first question.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/blueprint-revision/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        return
      }
      setDone(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#090909] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full border-2 border-[#C9A227] flex items-center justify-center mx-auto mb-6">
            <span className="text-[#C9A227] text-2xl">✓</span>
          </div>
          <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-3">Submitted</p>
          <h1 className="text-white font-serif text-[38px] mb-3">Got it.</h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Your new direction is in. Your coach will review it and update your blueprint, you&rsquo;ll be notified when the new version is live on your portal.
          </p>
          <a
            href="/dashboard"
            className="inline-block mt-8 bg-[#C9A227] text-[#090909] font-semibold text-sm px-6 py-3 rounded-lg hover:bg-[#d4ac2d] transition-colors"
          >
            Go to my portal →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#090909]">
      <div className="max-w-lg mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-7 h-7 rounded-full border border-[#CC1F1F] flex items-center justify-center flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F]" />
          </div>
          <span className="text-white font-serif text-base">The Circle</span>
        </div>

        {/* Title */}
        <div className="mb-6">
          <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">Blueprint Revision</p>
          <h1 className="text-white font-serif text-[38px] mb-1 leading-tight">{memberName.split(' ')[0]}&rsquo;s New Direction</h1>
          <p className="text-[#555] text-sm">Tell us what&rsquo;s changed, and we&rsquo;ll rebuild your blueprint around it.</p>
        </div>

        {/* The two-ideas rule — the most important note, up top */}
        <div className="bg-[#C9A227]/[0.06] border border-[#C9A227]/30 border-l-[3px] border-l-[#C9A227] rounded px-4 py-3 mb-4">
          <p className="text-[#C9A227] text-[10px] tracking-[0.18em] uppercase mb-1.5">Before you start</p>
          <p className="text-[#e6e6e6] text-xs leading-relaxed">
            You can only have <span className="text-[#C9A227] font-semibold">two big ideas going at once.</span> To stay efficient, don&rsquo;t try to get more than two done in a year, any more than that and you&rsquo;ll burn out. Pick the one or two that matter most right now.
          </p>
        </div>

        {/* Accountability note */}
        <div className="bg-[#0E0E0E] border border-[#1A1A1A] border-l-[3px] border-l-[#C9A227] rounded px-4 py-3 mb-8">
          <p className="text-[#bbb] text-xs leading-relaxed">
            The more detail you put into this report, the more detailed and useful your updated blueprint will be, and the better we can hold you accountable to it.
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

        <form onSubmit={handleSubmit} className="space-y-8">
          {QUESTIONS.map((q, i) => (
            <div key={q.key}>
              <label className="block text-white font-serif text-lg mb-1">
                <span className="text-[#C9A227] text-sm mr-2">{String(i + 1).padStart(2, '0')}</span>
                {q.question}
              </label>
              {q.note && (
                <p className="text-[#777] text-xs leading-relaxed mb-3 mt-1">{q.note}</p>
              )}
              <textarea
                value={values[q.key] ?? ''}
                onChange={e => setValue(q.key, e.target.value)}
                rows={4}
                placeholder={q.placeholder}
                className={`w-full bg-[#0E0E0E] border border-[#1A1A1A] text-white placeholder-[#444] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#C9A227] resize-none transition-colors ${q.note ? '' : 'mt-2'}`}
              />
            </div>
          ))}

          {error && <p className="text-[#CC1F1F] text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#C9A227] text-[#090909] font-semibold text-sm py-4 rounded-lg hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
          >
            {submitting ? 'Submitting…' : 'Submit My New Direction'}
          </button>

          <p className="text-[#444] text-xs text-center pb-4">
            The Circle · Blueprint Revision · {memberName}
          </p>
        </form>
      </div>
    </div>
  )
}
