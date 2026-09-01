'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateField from '@/components/shared/DateField'
import { toast } from '@/lib/toast'

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
  const [fathomUrl, setFathomUrl] = useState('')
  const [importing, setImporting] = useState(false)

  // Pull the call transcript from a Fathom share link and pre-fill each member's
  // Showed Up, Questions (count of problems/asks raised) and Notes (the record of
  // what they raised). Everything stays editable, nothing saves until the admin
  // clicks Save.
  async function importFromFathom() {
    if (!fathomUrl.trim()) { toast('Paste a Fathom share link first', 'error'); return }
    setImporting(true)
    setError('')
    try {
      const res = await fetch('/api/logs/from-fathom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fathomUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error ?? 'Could not process the call', 'error'); return }
      setLogs(prev => {
        const next = { ...prev }
        for (const r of (data.rows ?? []) as { member_id: string; showed_up: boolean; questions_asked: number; notes: string }[]) {
          if (!next[r.member_id]) continue
          next[r.member_id] = { ...next[r.member_id], showed_up: r.showed_up, questions_asked: r.questions_asked, notes: r.notes }
        }
        return next
      })
      setSaved(false)
      const hw = data.suggestedHomework ?? 0
      toast(`Imported "${data.title}": ${data.attended} present${hw ? `, ${hw} suggested task${hw === 1 ? '' : 's'} added to member backends` : ''}. Review and save.`)
    } catch {
      toast('Network error, please try again', 'error')
    } finally {
      setImporting(false)
    }
  }

  // When the admin switches to a different week, load that week's existing logs
  // so they're editing real data, not blindly overwriting it. The initial week's
  // logs are already provided via `existingLogs`, so skip the first run.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('weekly_logs')
        .select('member_id, showed_up, homework_done, questions_asked, notes')
        .eq('week_of', weekOf)
        .in('member_id', members.map(m => m.id))
      if (cancelled) return
      const next: Record<string, LogEntry> = {}
      for (const m of members) next[m.id] = { showed_up: false, homework_done: false, questions_asked: 0, notes: '' }
      for (const row of data ?? []) {
        next[row.member_id] = {
          showed_up: row.showed_up,
          homework_done: row.homework_done,
          questions_asked: row.questions_asked ?? 0,
          notes: row.notes ?? '',
        }
      }
      setLogs(next)
      setSaved(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOf])

  function toggle(memberId: string, field: 'showed_up') {
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
      toast(err.message ?? 'Could not save', 'error')
    } else {
      setSaved(true)
      toast(`Logged ${members.length} member${members.length === 1 ? '' : 's'} for the week`)
    }
    setSaving(false)
  }

  const attendanceCount = Object.values(logs).filter(l => l.showed_up).length
  const total = members.length

  return (
    <div>
      {/* Week picker */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="block text-xs text-[#555] uppercase tracking-wider mb-1.5">Week of (Tuesday)</label>
          <DateField
            value={weekOf}
            onChange={v => { setWeekOf(v); setSaved(false) }}
            clearable={false}
            className="w-44 bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
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

      {/* Import from Fathom */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-4 mb-6">
        <p className="text-[#C9A227] text-xs uppercase tracking-wider mb-2">Import from Fathom</p>
        <p className="text-[#666] text-xs mb-3 leading-relaxed">
          Paste the call recording link. It reads the transcript and pre-fills Showed Up, Questions,
          and Notes for each member. Everything stays editable, nothing saves until you click Save below.
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={fathomUrl}
            onChange={e => setFathomUrl(e.target.value)}
            placeholder="https://fathom.video/share/..."
            className="flex-1 bg-[#0D0D0D] border border-[#2A2A2A] text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
          />
          <button
            onClick={importFromFathom}
            disabled={importing}
            className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-5 py-2 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {importing ? 'Processing…' : 'Process call'}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="mb-6">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-3 flex items-center justify-between">
          <span className="text-[#555] text-xs uppercase tracking-wider">Attendance</span>
          <span className="text-white font-serif text-lg">
            {attendanceCount}/{total}
            <span className="text-[#555] text-sm ml-1">
              ({total > 0 ? Math.round((attendanceCount / total) * 100) : 0}%)
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
          <div className="grid grid-cols-[1fr_120px_90px_1fr] gap-4 px-5 py-3 border-b border-[#2A2A2A]">
            <span className="text-[#555] text-xs uppercase tracking-wider">Member</span>
            <span className="text-[#555] text-xs uppercase tracking-wider text-center">Showed Up</span>
            <span className="text-[#555] text-xs uppercase tracking-wider text-center">Questions</span>
            <span className="text-[#555] text-xs uppercase tracking-wider">Notes</span>
          </div>

          {/* Member rows */}
          {members.map((member, i) => {
            const log = logs[member.id]
            return (
              <div
                key={member.id}
                className={`grid grid-cols-[1fr_120px_90px_1fr] gap-4 px-5 py-4 items-center ${
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
