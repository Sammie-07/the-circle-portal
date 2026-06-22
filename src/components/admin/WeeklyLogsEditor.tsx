'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

interface WeeklyLog {
  id: string
  week_of: string
  showed_up: boolean
  homework_done: boolean
  questions_asked: number | null
  notes: string | null
}

// Inline editor for a member's past weekly logs. Every field is editable and
// saves immediately (upsert keyed on member_id + week_of), so attendance and
// homework can be corrected after the fact without re-entering the whole week.
export default function WeeklyLogsEditor({ memberId, logs: initialLogs }: { memberId: string; logs: WeeklyLog[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [logs, setLogs] = useState<WeeklyLog[]>(initialLogs)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function persist(row: WeeklyLog) {
    setSavingId(row.id)
    const { error } = await supabase
      .from('weekly_logs')
      .upsert(
        {
          member_id: memberId,
          week_of: row.week_of,
          showed_up: row.showed_up,
          homework_done: row.homework_done,
          questions_asked: row.questions_asked ?? 0,
          notes: row.notes || null,
        },
        { onConflict: 'member_id,week_of' }
      )
    setSavingId(null)
    if (error) {
      toast(error.message ?? 'Could not save', 'error')
    } else {
      toast('Attendance updated')
      router.refresh()
    }
  }

  // Apply a change locally, then persist that row.
  function change(id: string, patch: Partial<WeeklyLog>) {
    let updated: WeeklyLog | null = null
    setLogs((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        updated = { ...l, ...patch }
        return updated
      })
    )
    if (updated) persist(updated)
  }

  async function remove(row: WeeklyLog) {
    const label = new Date(row.week_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    if (!confirm(`Delete the attendance record for ${label}? This can't be undone.`)) return
    setSavingId(row.id)
    const { error } = await supabase.from('weekly_logs').delete().eq('id', row.id)
    setSavingId(null)
    if (error) {
      toast(error.message ?? 'Could not delete', 'error')
      return
    }
    setLogs((prev) => prev.filter((l) => l.id !== row.id))
    toast('Record deleted')
    router.refresh()
  }

  if (logs.length === 0) return null

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="bg-[var(--surface)] border border-[var(--border-color)] rounded px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[var(--text-2)] text-xs w-20 flex-shrink-0">
              {new Date(log.week_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>

            <div className="flex items-center gap-2">
              {/* Showed up */}
              <button
                onClick={() => change(log.id, { showed_up: !log.showed_up })}
                className={`text-xs px-2.5 py-1 rounded border transition-all ${
                  log.showed_up
                    ? 'border-green-500/40 bg-green-500/10 text-green-400'
                    : 'border-red-500/30 bg-red-500/5 text-red-400'
                }`}
                title="Toggle attendance"
              >
                {log.showed_up ? '✓ Showed up' : '✗ Missed'}
              </button>

              {/* Homework */}
              <button
                onClick={() => change(log.id, { homework_done: !log.homework_done })}
                className={`text-xs px-2.5 py-1 rounded border transition-all ${
                  log.homework_done
                    ? 'border-[#C9A227]/40 bg-[#C9A227]/10 text-[#C9A227]'
                    : 'border-[var(--border-color)] text-[var(--text-3)] hover:border-[var(--border-hover)]'
                }`}
                title="Toggle homework"
              >
                {log.homework_done ? '✓ HW done' : '— No HW'}
              </button>

              {/* Questions */}
              <div className="flex items-center gap-1.5 border border-[var(--border-color)] rounded px-1.5 py-0.5">
                <button
                  onClick={() => change(log.id, { questions_asked: Math.max(0, (log.questions_asked ?? 0) - 1) })}
                  className="w-5 h-5 rounded text-[var(--text-3)] hover:text-[var(--text)] text-xs"
                >−</button>
                <span className="text-[var(--text-2)] text-xs w-7 text-center" title="Questions asked">{log.questions_asked ?? 0} Q</span>
                <button
                  onClick={() => change(log.id, { questions_asked: (log.questions_asked ?? 0) + 1 })}
                  className="w-5 h-5 rounded text-[var(--text-3)] hover:text-[var(--text)] text-xs"
                >+</button>
              </div>

              {savingId === log.id && <span className="text-[var(--text-4)] text-[10px]">saving…</span>}

              {/* Delete */}
              <button
                onClick={() => remove(log)}
                title="Delete this record"
                aria-label="Delete this record"
                className="w-7 h-7 rounded flex items-center justify-center text-[var(--text-4)] hover:text-[#CC1F1F] hover:bg-[#CC1F1F]/10 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </div>
          </div>

          {/* Notes */}
          <input
            type="text"
            defaultValue={log.notes ?? ''}
            onBlur={(e) => { if ((e.target.value || '') !== (log.notes ?? '')) change(log.id, { notes: e.target.value }) }}
            placeholder="Add a note for this week…"
            className="mt-2 w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-2)] placeholder-[var(--text-4)] rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#C9A227]/40"
          />
        </div>
      ))}
    </div>
  )
}
