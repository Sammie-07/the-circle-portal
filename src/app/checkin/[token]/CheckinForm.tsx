'use client'

import { useState } from 'react'

interface HomeworkItem {
  id: string
  title: string
  description: string | null
  completed: boolean
  due_date: string | null
}

interface CheckinFormProps {
  token: string
  memberName: string
  weekLabel: string
  homework: HomeworkItem[]
  alreadySubmitted: boolean
}

export default function CheckinForm({ token, memberName, weekLabel, homework, alreadySubmitted }: CheckinFormProps) {
  const [checked, setChecked] = useState<Set<string>>(
    new Set(homework.filter(h => h.completed).map(h => h.id))
  )
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(alreadySubmitted)
  const [error, setError] = useState('')

  function toggleItem(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/checkin/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedIds: Array.from(checked),
          shownIds: homework.map(h => h.id),
          comments,
        }),
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
          <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-3">Submitted</p>
          <h1 className="text-white font-serif text-3xl mb-3">You&apos;re done.</h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Your check-in for the week of <span className="text-white">{weekLabel}</span> is in. See you Tuesday.
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

  const doneCount = checked.size
  const totalCount = homework.length

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
        <div className="mb-8">
          <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Weekly Check-In</p>
          <h1 className="text-white font-serif text-3xl mb-1">{memberName.split(' ')[0]}&rsquo;s Week</h1>
          <p className="text-[#555] text-sm">Week of {weekLabel}</p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Homework checklist */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-serif text-lg">This Week&rsquo;s Tasks</h2>
              {totalCount > 0 && (
                <span className="text-[#C9A227] text-xs">
                  {doneCount} of {totalCount} done
                </span>
              )}
            </div>

            {homework.length === 0 ? (
              <p className="text-[#555] text-sm">No tasks assigned for this week.</p>
            ) : (
              <div className="space-y-3">
                {homework.map(item => {
                  const isChecked = checked.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={`w-full text-left flex items-start gap-4 px-4 py-3.5 rounded-lg border transition-all ${
                        isChecked
                          ? 'bg-[#C9A227]/8 border-[#C9A227]/40'
                          : 'bg-[#0E0E0E] border-[#1A1A1A] hover:border-[#3A3A3A]'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-all ${
                        isChecked ? 'bg-[#C9A227] border-[#C9A227]' : 'border-[#444]'
                      }`}>
                        {isChecked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="#090909" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium leading-snug ${isChecked ? 'text-white line-through decoration-[#C9A227]/50' : 'text-white'}`}>
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-[#666] text-xs mt-1 leading-snug">{item.description}</p>
                        )}
                        {item.due_date && (
                          <p className={`text-xs mt-1 ${isChecked ? 'text-[#C9A227]/60' : 'text-[#555]'}`}>
                            Due {new Date(item.due_date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <h2 className="text-white font-serif text-lg mb-2">Notes for Your Admin</h2>
            <p className="text-[#555] text-xs mb-3">
              Anything they should know. Why something didn&rsquo;t get done. What you crushed that&rsquo;s not on the list. Blockers. Wins. All of it.
            </p>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={5}
              placeholder="This week I also..."
              className="w-full bg-[#0E0E0E] border border-[#1A1A1A] text-white placeholder-[#444] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#C9A227] resize-none transition-colors"
            />
          </div>

          {error && <p className="text-[#CC1F1F] text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#C9A227] text-[#090909] font-semibold text-sm py-4 rounded-lg hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
          >
            {submitting ? 'Submitting…' : 'Submit Check-In'}
          </button>

          <p className="text-[#444] text-xs text-center pb-4">
            The Circle · Weekly Check-In · Week of {weekLabel}
          </p>
        </form>
      </div>
    </div>
  )
}
