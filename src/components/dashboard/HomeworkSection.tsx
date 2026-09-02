'use client'

import { useState } from 'react'

interface HomeworkItem {
  id: string
  title: string
  description: string | null
  due_date: string | null
  type: 'homework' | 'task'
  completed: boolean
  completed_at: string | null
  created_at?: string | null
  notes: string | null
  auto_suggested?: boolean
  source_note_homework_id?: string | null
}

interface Props {
  memberId: string
  initialItems: HomeworkItem[]
}

function hwFmtDate(d: string | null | undefined, dateOnly = false): string {
  if (!d) return '—'
  const dt = dateOnly ? new Date(d + 'T00:00:00') : new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function dueBadge(due: string | null) {
  if (!due) return null
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: 'text-[#CC1F1F] bg-[#CC1F1F]/10 border-[#CC1F1F]/20' }
  if (days === 0) return { label: 'Due today', cls: 'text-orange-400 bg-orange-400/10 border-orange-400/20' }
  if (days <= 3) return { label: `${days}d left`, cls: 'text-orange-400 bg-orange-400/10 border-orange-400/20' }
  if (days <= 7) return { label: `${days}d left`, cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' }
  return {
    label: new Date(due + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cls: 'text-[var(--text-3)] border-[var(--border-color)]'
  }
}

export interface NoteSaveResult {
  ok: boolean
  note: string
  created: boolean
  task?: HomeworkItem
}

interface FollowUp { id: string; title: string }

export default function HomeworkSection({ initialItems }: Props) {
  const [items, setItems] = useState<HomeworkItem[]>(initialItems)
  const [toggling, setToggling] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  // Show unfinished work first, then completed at the bottom; within each group,
  // soonest due date first (undated last). Keeps the list from looking mixed-up.
  const byPendingThenDue = (a: HomeworkItem, b: HomeworkItem) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  }
  const homework = items.filter(i => i.type === 'homework').sort(byPendingThenDue)
  const tasks = items.filter(i => i.type === 'task').sort(byPendingThenDue)

  // Map: source task id -> follow-up tasks its note generated
  const followUpsBySource = new Map<string, FollowUp[]>()
  for (const it of items) {
    if (it.source_note_homework_id) {
      const arr = followUpsBySource.get(it.source_note_homework_id) ?? []
      arr.push({ id: it.id, title: it.title })
      followUpsBySource.set(it.source_note_homework_id, arr)
    }
  }

  function jumpTo(id: string) {
    if (typeof document === 'undefined') return
    const el = document.getElementById(`hw-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(id)
    setTimeout(() => setHighlightId(null), 1600)
  }

  async function handleToggle(item: HomeworkItem) {
    if (toggling) return
    const next = !item.completed
    setToggling(item.id)
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, completed: next, completed_at: next ? new Date().toISOString() : null }
      : i
    ))
    await fetch(`/api/homework/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: next }),
    })
    setToggling(null)
  }

  async function handleSaveNote(itemId: string, note: string): Promise<NoteSaveResult> {
    const res = await fetch(`/api/homework/${itemId}/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    const data: NoteSaveResult = await res.json()
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, notes: data.note ?? note } : i))
    if (data.created && data.task) {
      const task = data.task
      setItems(prev => prev.some(i => i.id === task.id) ? prev : [...prev, task])
    }
    return data
  }

  async function handleCreateFollowUp(itemId: string, title: string, note?: string): Promise<HomeworkItem | null> {
    const res = await fetch(`/api/homework/${itemId}/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, note }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (note !== undefined) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, notes: note } : i))
    }
    if (data.task) {
      const task: HomeworkItem = data.task
      setItems(prev => prev.some(i => i.id === task.id) ? prev : [...prev, task])
      return task
    }
    return null
  }

  if (homework.length === 0 && tasks.length === 0) return null

  return (
    <div className="space-y-6 mt-6">

      {/* Homework */}
      {homework.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase">This Week&apos;s Homework</p>
            <div className="flex-1 h-px bg-[var(--border-color)]" />
            <span className="text-[var(--text-3)] text-xs">
              {homework.filter(i => i.completed).length}/{homework.length} done
            </span>
          </div>
          <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden">
            {homework.map(item => (
              <CheckItem key={item.id} item={item} onToggle={handleToggle} toggling={toggling}
                onSaveNote={handleSaveNote} followUps={followUpsBySource.get(item.id) ?? []}
                onCreateFollowUp={handleCreateFollowUp}
                onJump={jumpTo} highlighted={highlightId === item.id} />
            ))}
          </div>
        </div>
      )}

      {/* Blueprint Tasks */}
      {tasks.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase">Blueprint Tasks</p>
            <div className="flex-1 h-px bg-[var(--border-color)]" />
            <span className="text-[var(--text-3)] text-xs">
              {tasks.filter(i => i.completed).length}/{tasks.length} complete
            </span>
          </div>
          <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden">
            {tasks.map(item => (
              <CheckItem key={item.id} item={item} onToggle={handleToggle} toggling={toggling}
                onSaveNote={handleSaveNote} followUps={followUpsBySource.get(item.id) ?? []}
                onCreateFollowUp={handleCreateFollowUp}
                onJump={jumpTo} highlighted={highlightId === item.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CheckItem({ item, onToggle, toggling, onSaveNote, onCreateFollowUp, followUps, onJump, highlighted }: {
  item: HomeworkItem
  onToggle: (item: HomeworkItem) => void
  toggling: string | null
  onSaveNote: (itemId: string, note: string) => Promise<NoteSaveResult>
  onCreateFollowUp: (itemId: string, title: string, note?: string) => Promise<HomeworkItem | null>
  followUps: FollowUp[]
  onJump: (id: string) => void
  highlighted: boolean
}) {
  const badge = dueBadge(item.due_date)
  const isLoading = toggling === item.id

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      await onSaveNote(item.id, draft.trim())
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  // Manually turn the note text into a follow-up task (no AI).
  async function makeTask(title: string, note?: string) {
    const t = title.trim()
    if (!t || creating) return
    setCreating(true)
    try {
      const task = await onCreateFollowUp(item.id, t, note)
      setEditing(false)
      if (task) onJump(task.id)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      id={`hw-${item.id}`}
      className={`flex items-start gap-3 px-6 py-[18px] border-b border-[var(--border-color)] last:border-b-0 transition-colors ${
        highlighted ? 'bg-[var(--gold-soft)]' :
        item.completed ? 'opacity-55' : ''
      }`}
    >
      {/* Circle checkbox — its own toggle control */}
      <button
        type="button"
        onClick={() => onToggle(item)}
        disabled={!!toggling}
        aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all disabled:cursor-default ${
          isLoading ? 'border-[#C9A227]/40 bg-[#C9A227]/10' :
          item.completed ? 'border-[#C9A227] bg-[#C9A227]' : 'border-[var(--border-hover)] hover:border-[#C9A227]'
        }`}
      >
        {item.completed && !isLoading && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="#090909" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {isLoading && <div className="w-2 h-2 rounded-full bg-[#C9A227] animate-pulse" />}
      </button>

      {/* Text + notes */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${item.completed ? 'line-through text-[var(--text-4)]' : 'text-[var(--text)]'}`}>
            {item.title}
          </span>
          {item.auto_suggested && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#C9A227]/30 bg-[#C9A227]/10 text-[#C9A227]">✨ from your note</span>
          )}
          {badge && !item.completed && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
          )}
        </div>
        {item.description && (
          <p className={`text-xs mt-0.5 ${item.completed ? 'text-[var(--text-4)]' : 'text-[var(--text-3)]'}`}>{item.description}</p>
        )}
        {/* Added · Due · Completed */}
        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--text-4)] flex-wrap">
          {item.created_at && <><span>Added {hwFmtDate(item.created_at)}</span><span>·</span></>}
          <span>Due {item.due_date ? hwFmtDate(item.due_date, true) : 'not set'}</span>
          <span>·</span>
          <span>Completed {item.completed_at ? hwFmtDate(item.completed_at) : '—'}</span>
        </div>

        {/* Saved note — comment bubble */}
        {item.notes && !editing && (
          <div className="mt-2.5 rounded-lg rounded-tl-sm border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-4)]">
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3h10v7H6l-3 2.5V10H2V3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                Your note
              </span>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => makeTask(item.notes ?? '', undefined)}
                  disabled={creating}
                  className="text-[11px] text-[#C9A227] hover:text-[#d4ac2d] transition-colors disabled:opacity-50"
                >
                  {creating ? 'Adding…' : '✨ Make follow-up task'}
                </button>
                <button
                  type="button"
                  onClick={() => { setDraft(item.notes ?? ''); setEditing(true) }}
                  className="text-[11px] text-[var(--text-3)] hover:text-[#C9A227] transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--text-2)] whitespace-pre-wrap leading-relaxed">{item.notes}</p>
          </div>
        )}

        {/* Follow-up tasks this note generated — clickable chips */}
        {followUps.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {followUps.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => onJump(f.id)}
                title="Jump to this follow-up task"
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-[#C9A227]/40 bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 transition-colors max-w-full"
              >
                <span className="flex-shrink-0">✨</span>
                <span className="truncate">{f.title}</span>
                <span className="flex-shrink-0">→</span>
              </button>
            ))}
          </div>
        )}

        {/* Add-note button (only when no note and not editing) */}
        {!item.notes && !editing && (
          <button
            type="button"
            onClick={() => { setDraft(''); setEditing(true) }}
            className="mt-2 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-[var(--border-color)] text-[var(--text-2)] hover:border-[#C9A227]/50 hover:text-[#C9A227] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
              <path d="M9.5 1.5l3 3L5 12l-3.5.5L2 9 9.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            Add note
          </button>
        )}

        {/* Editor */}
        {editing && (
          <div className="mt-2 space-y-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Jot down a thought, update, or next step…"
              className="w-full text-xs rounded border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text)] p-2 resize-y focus:outline-none focus:border-[#C9A227]/50"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="text-xs bg-[#C9A227] text-[#090909] font-medium px-3 py-1.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save note'}
              </button>
              <button
                type="button"
                onClick={() => makeTask(draft, draft.trim())}
                disabled={creating || saving || !draft.trim()}
                className="text-xs px-3 py-1.5 rounded border border-[#C9A227]/40 bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 transition-colors disabled:opacity-50"
              >
                {creating ? 'Adding…' : '✨ Make follow-up task'}
              </button>
              <button
                type="button"
                onClick={() => { setDraft(item.notes ?? ''); setEditing(false) }}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded border border-[var(--border-color)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <span className="text-[10px] text-[var(--text-4)]">Save, or turn this note into a task</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
