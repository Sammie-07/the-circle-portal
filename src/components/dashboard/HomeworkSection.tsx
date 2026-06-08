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
  notes: string | null
  auto_suggested?: boolean
}

interface Props {
  memberId: string
  initialItems: HomeworkItem[]
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

export default function HomeworkSection({ memberId, initialItems }: Props) {
  const [items, setItems] = useState<HomeworkItem[]>(initialItems)
  const [toggling, setToggling] = useState<string | null>(null)

  const homework = items.filter(i => i.type === 'homework')
  const tasks = items.filter(i => i.type === 'task')

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
    // Update this item's notes in local state
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, notes: data.note ?? note } : i))
    // Append any auto-created follow-up task so it appears immediately
    if (data.created && data.task) {
      const task = data.task
      setItems(prev => prev.some(i => i.id === task.id) ? prev : [...prev, task])
    }
    return data
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
          <div className="space-y-2">
            {homework.map(item => <CheckItem key={item.id} item={item} onToggle={handleToggle} toggling={toggling} onSaveNote={handleSaveNote} />)}
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
          <div className="space-y-2">
            {tasks
              .sort((a, b) => {
                // Sort: incomplete first, then by due date
                if (a.completed !== b.completed) return a.completed ? 1 : -1
                if (!a.due_date && !b.due_date) return 0
                if (!a.due_date) return 1
                if (!b.due_date) return -1
                return a.due_date.localeCompare(b.due_date)
              })
              .map(item => <CheckItem key={item.id} item={item} onToggle={handleToggle} toggling={toggling} onSaveNote={handleSaveNote} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function CheckItem({ item, onToggle, toggling, onSaveNote }: {
  item: HomeworkItem
  onToggle: (item: HomeworkItem) => void
  toggling: string | null
  onSaveNote: (itemId: string, note: string) => Promise<NoteSaveResult>
}) {
  const badge = dueBadge(item.due_date)
  const isLoading = toggling === item.id

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(item.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [createdMsg, setCreatedMsg] = useState<string | null>(null)

  async function save() {
    if (saving) return
    setSaving(true)
    setCreatedMsg(null)
    try {
      const result = await onSaveNote(item.id, draft.trim())
      if (result.created && result.task) {
        setCreatedMsg(result.task.title)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded border transition-all ${
        item.completed
          ? 'bg-[var(--surface-2)] border-[var(--border-color)] opacity-60'
          : 'bg-[var(--surface)] border-[var(--border-color)]'
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
            <path d="M1 4l3 3 5-6" stroke="#0D0D0D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {isLoading && <div className="w-2 h-2 rounded-full bg-[#C9A227] animate-pulse" />}
      </button>

      {/* Text + note expander */}
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
        {item.completed && item.completed_at && (
          <p className="text-[10px] text-[var(--text-4)] mt-0.5">
            Completed {new Date(item.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        )}

        {/* Note expander */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
              open || item.notes
                ? 'border-[#C9A227]/40 bg-[#C9A227]/10 text-[#C9A227]'
                : 'border-[var(--border-color)] text-[var(--text-2)] hover:border-[#C9A227]/50 hover:text-[#C9A227]'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
              <path d="M9.5 1.5l3 3L5 12l-3.5.5L2 9 9.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            {open ? 'Hide note' : (item.notes ? 'View / edit note' : 'Add note')}
          </button>

          {open && (
            <div className="mt-2 space-y-2">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={3}
                placeholder="Jot down a thought, update, or next step…"
                className="w-full text-xs rounded border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text)] p-2 resize-y focus:outline-none focus:border-[#C9A227]/50"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="text-xs bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] px-3 py-1.5 rounded hover:bg-[#C9A227]/15 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save note'}
                </button>
                <span className="text-[10px] text-[var(--text-4)]">Saving may add a follow-up task</span>
              </div>
              {createdMsg && (
                <p className="text-[11px] text-[#C9A227]">✨ Added a follow-up task: {createdMsg}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
