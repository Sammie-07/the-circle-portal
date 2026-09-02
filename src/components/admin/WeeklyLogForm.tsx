'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import DateField from '@/components/shared/DateField'
import { toast } from '@/lib/toast'

function ToggleButton({ value, active, onClick, yes, no }: {
  value: boolean, active: boolean | null, onClick: (v: boolean) => void, yes: string, no: string
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`flex-1 py-2 text-sm rounded border transition-all ${
        active === value
          ? value
            ? 'bg-green-500/10 border-green-500/40 text-green-400'
            : 'bg-red-500/10 border-red-500/40 text-red-400'
          : 'bg-[var(--input-bg)] border-[var(--border-color)] text-[var(--text-3)] hover:border-[var(--border-hover)]'
      }`}
    >
      {value ? yes : no}
    </button>
  )
}

export default function WeeklyLogForm({ memberId }: { memberId: string }) {
  const today = new Date()
  // Get Monday of current week
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const defaultWeek = monday.toISOString().split('T')[0]

  const [weekOf, setWeekOf] = useState(defaultWeek)
  const [showedUp, setShowedUp] = useState<boolean | null>(null)
  const [questions, setQuestions] = useState(0)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (showedUp === null) return
    setLoading(true)

    const { error } = await supabase
      .from('weekly_logs')
      .upsert({
        member_id: memberId,
        week_of: weekOf,
        showed_up: showedUp,
        homework_done: false,
        questions_asked: questions,
        notes: notes || null,
      }, { onConflict: 'member_id,week_of' })

    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
      toast('Week logged')
    } else {
      toast(error.message ?? 'Could not save', 'error')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] p-5 space-y-4">
      <div>
        <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5">Week of</label>
        <DateField
          value={weekOf}
          onChange={setWeekOf}
          clearable={false}
          className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
        />
      </div>

      <div>
        <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5">Showed up to Tuesday call?</label>
        <div className="flex gap-2">
          <ToggleButton value={true} active={showedUp} onClick={setShowedUp} yes="✓ Yes" no="" />
          <ToggleButton value={false} active={showedUp} onClick={setShowedUp} yes="" no="✗ No" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5">Questions asked</label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setQuestions(Math.max(0, questions - 1))}
            className="w-8 h-8 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] hover:border-[#C9A227] transition-colors">−</button>
          <span className="text-[var(--text)] font-serif text-xl w-8 text-center">{questions}</span>
          <button type="button" onClick={() => setQuestions(questions + 1)}
            className="w-8 h-8 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] hover:border-[#C9A227] transition-colors">+</button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5">Notes <span className="text-[var(--text-4)]">(optional)</span></label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any context for this week…"
          className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227] resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading || showedUp === null}
        className="w-full bg-[#C9A227] text-[#090909] text-sm font-medium py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saved ? 'Saved ✓' : loading ? 'Saving…' : 'Save This Week'}
      </button>
    </form>
  )
}
