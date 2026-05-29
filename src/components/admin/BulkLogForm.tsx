'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Member {
  id: string
  name: string
  email: string
  cohort: string | null
}

interface LogEntry {
  showed_up: boolean
  homework_done: boolean
  questions_asked: number
  notes: string
}

interface BulkLogFormProps {
  members: Member[]
  defaultWeekOf: string
  existingLogs: Record<string, LogEntry>
}

export default function BulkLogForm({ members, defaultWeekOf, existingLogs }: BulkLogFormProps) {
  const supabase = createClient()

  const [weekOf, setWeekOf] = useState(defaultWeekOf)
  const [logs, setLogs] = useState<Record<string, LogEntry>>(() => {
    const init: Record<string, LogEntry> = {}
    for (const m of members) {
      init[m.id] = existingLogs[m.id] ?? {
        showed_up: false,
        homework_done: false,
        questions_asked: 0,
        notes: '',
      }
    }
    return init
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function toggle(memberId: string, field: 'showed_up' | 'homework_done') {
    setLogs(prev => ({
      ...prev,
      [memberId]: { ...prev[memberId], [field]: !prev[memberId][field] },
    }))
    setSaved(false)
  }

  function setQuestions(memberId: string, value: number) {
    setLogs(prev => ({
      ...prev,
      [memberId]: { ...prev[memberId], questions_asked: Math.max(0, value) },
    }))
    setSaved(false)
  }

  function setNotes(memberId: string, value: string) {
    setLogs(prev => ({
      ...prev,
      [memberId]: { ...prev[memberId], notes: value },
    }))
    setSaved(false)
  }

  // Mark all present or all absent
  function markAll(showed_up: boolean) {
    setLogs(prev => {
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], showed_up }
      }
      return next
    })
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const upserts = members.map(m => ({
      member_id: m.id,
      week_of: weekOf,
      showed_up: logs[m.id].showed_up,
      homework_done: logs[m.id].homework_done,
      questions_asked: logs[m.id].questions_asked,
      notes: logs[m.id].notes || null,
    }))

    const { error: err } = await supabase
      .from('weekly_logs')
      .upsert(upserts, { onConflict: 'member_id,week_of' })

    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  const attendanceCount = Object.values(logs).filter(l => l.showed_up).length
  const homeworkCount = Object.values(logs).filter(l => l.homework_done).length
  const total = members.length

  return (
    <div>
      {/* Week picker */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="block text-xs text-[#555] uppercase tracking-wider mb-1.5">Week of (Tuesday)</label>
          <input
            type="date"
            value={weekOf}
            onChange={e => { setWeekOf(e.target.value); setSaved(false) }}
            className="bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
          />
        </div>
        <div className="flex-1" />
        <div className="flex gap-2">
          <button
            onClick={() => markAll(true)}
            className="text-xs border border-[#2A2A2A] text-[#888] hover:text-white hover:border-[#C9A227]/40 px-3 py-2 rounded transition-all"
          >
            Mark all present
          </button>
          <button
            onClick={() => markAll(false)}
            className="text-xs border border-[#2A2A2A] text-[#888] hover:text-white hover:border-[#CC1F1F]/40 px-3 py-2 rounded transition-all"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-3 flex items-center justify-between">
          <span className="text-[#555] text-xs uppercase tracking-wider">Attendance</span>
          <span className="text-white font-serif text-lg">
            {attendanceCount}/{total}
            <span className="text-[#555] text-sm ml-1">
              ({total > 0 ? Math.round((attendanceCount / total) * 100) : 0}%)
            </span>
          </span>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-3 flex items-center justify-between">
          <span className="text-[#555] text-xs uppercase tracking-wider">Homework Done</span>
          <span className="text-white font-serif text-lg">
            {homeworkCount}/{total}
            <span className="text-[#555] text-sm ml-1">
              ({total > 0 ? Math.round((homeworkCount / total) * 100) : 0}%)
            </span>
          </span>
        </div>
      </div>

      {/* Member rows */}
      {members.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-8 text-center">
          <p className="text-[#555] text-sm">No active members yet.</p>
        </div>
      ) : (
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded overflow-hidden mb-6">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_120px_120px_90px_1fr] gap-4 px-5 py-3 border-b border-[#2A2A2A]">
            <span className="text-[#555] text-xs uppercase tracking-wider">Member</span>
            <span className="text-[#555] text-xs uppercase tracking-wider text-center">Showed Up</span>
            <span className="text-[#555] text-xs uppercase tracking-wider text-center">Homework</span>
            <span className="text-[#555] text-xs uppercase tracking-wider text-center">Questions</span>
            <span className="text-[#555] text-xs uppercase tracking-wider">Notes</span>
          </div>

          {/* Member rows */}
          {members.map((member, i) => {
            const log = logs[member.id]
            return (
              <div
                key={member.id}
                className={`grid grid-cols-[1fr_120px_120px_90px_1fr] gap-4 px-5 py-4 items-center ${
                  i < members.length - 1 ? 'border-b border-[#2A2A2A]' : ''
                } ${log.showed_up ? '' : 'opacity-60'}`}
              >
                {/* Name */}
                <div>
                  <p className="text-white text-sm font-medium">{member.name}</p>
                  {member.cohort && (
                    <p className="text-[#555] text-xs">{member.cohort}</p>
                  )}
                </div>

                {/* Showed up toggle */}
                <div className="flex justify-center">
                  <button
                    onClick={() => toggle(member.id, 'showed_up')}
                    className={`w-9 h-9 rounded border-2 flex items-center justify-center transition-all ${
                      log.showed_up
                        ? 'border-green-500 bg-green-500/20 text-green-500'
                        : 'border-[#2A2A2A] text-transparent hover:border-[#444]'
                    }`}
                    title={log.showed_up ? 'Present — click to mark absent' : 'Absent — click to mark present'}
                  >
                    ✓
                  </button>
                </div>

                {/* Homework toggle */}
                <div className="flex justify-center">
                  <button
                    onClick={() => toggle(member.id, 'homework_done')}
                    className={`w-9 h-9 rounded border-2 flex items-center justify-center transition-all ${
                      log.homework_done
                        ? 'border-[#C9A227] bg-[#C9A227]/20 text-[#C9A227]'
                        : 'border-[#2A2A2A] text-transparent hover:border-[#444]'
                    }`}
                    title={log.homework_done ? 'Done — click to unmark' : 'Not done — click to mark done'}
                  >
                    ✓
                  </button>
                </div>

                {/* Questions counter */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setQuestions(member.id, log.questions_asked - 1)}
                    className="w-6 h-6 rounded bg-[#2A2A2A] text-[#888] hover:text-white flex items-center justify-center text-xs transition-colors"
                  >−</button>
                  <span className="text-white text-sm w-4 text-center">{log.questions_asked}</span>
                  <button
                    onClick={() => setQuestions(member.id, log.questions_asked + 1)}
                    className="w-6 h-6 rounded bg-[#2A2A2A] text-[#888] hover:text-white flex items-center justify-center text-xs transition-colors"
                  >+</button>
                </div>

                {/* Notes */}
                <input
                  type="text"
                  value={log.notes}
                  onChange={e => setNotes(member.id, e.target.value)}
                  placeholder="Optional note…"
                  className="bg-[#111] border border-[#2A2A2A] text-[#888] placeholder-[#333] rounded px-3 py-2 text-xs w-full focus:outline-none focus:border-[#C9A227]/40 focus:text-white transition-colors"
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || members.length === 0}
          className="bg-[#C9A227] text-[#0D0D0D] font-medium text-sm px-6 py-3 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save All Logs'}
        </button>

        {saved && (
          <span className="text-green-500 text-sm flex items-center gap-1.5">
            <span>✓</span> All logs saved for {weekOf}
          </span>
        )}

        {error && (
          <span className="text-[#CC1F1F] text-sm">{error}</span>
        )}
      </div>

      <p className="text-[#444] text-xs mt-3">
        Saves upsert — running this twice for the same week just overwrites. Safe to re-run.
      </p>
    </div>
  )
}
