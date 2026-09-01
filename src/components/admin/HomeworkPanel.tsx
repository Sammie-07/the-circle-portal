'use client'

import { useState, useEffect } from 'react'
import DateField from '@/components/shared/DateField'
import AutoGrowTextarea from '@/components/shared/AutoGrowTextarea'
import { toast } from '@/lib/toast'
import { taskSourceLabel, taskSourceBadgeClass } from '@/lib/taskSource'

interface HomeworkItem {
  id: string
  title: string
  description: string | null
  due_date: string | null
  type: 'homework' | 'task'
  source: string | null
  completed: boolean
  completed_at: string | null
  created_at: string
  notes: string | null
}

interface Props {
  memberId: string
}

const EMPTY_FORM = { title: '', description: '', due_date: '', type: 'homework' as 'homework' | 'task' }

// Format a date for the Added/Due/Completed line. `dateOnly` for plain date
// columns (due_date) so they aren't shifted by timezone; timestamps parse as-is.
function fmtDate(d: string | null | undefined, dateOnly = false): string {
  if (!d) return '—'
  const dt = dateOnly ? new Date(d + 'T00:00:00') : new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function dueBadge(due: string | null) {
  if (!due) return null
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: 'text-[#CC1F1F] border-[#CC1F1F]/30 bg-[#CC1F1F]/5' }
  if (days === 0) return { label: 'Due today', cls: 'text-orange-400 border-orange-400/30 bg-orange-400/5' }
  if (days <= 3) return { label: `${days}d left`, cls: 'text-orange-400 border-orange-400/30 bg-orange-400/5' }
  if (days <= 7) return { label: `${days}d left`, cls: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5' }
  return { label: new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: 'text-[var(--text-3)] border-[var(--border-color)]' }
}

export default function HomeworkPanel({ memberId }: Props) {
  const [items, setItems] = useState<HomeworkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [filter, setFilter] = useState<'all' | 'homework' | 'task'>('all')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState('')

  useEffect(() => {
    fetch(`/api/homework?member_id=${memberId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setItems(d.homework ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [memberId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/homework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, ...form }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); toast(data.error ?? 'Could not add item', 'error'); setSaving(false); return }
    setItems(prev => [...prev, data.item])
    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
    toast(data.item.type === 'task' ? 'Task added' : 'Homework added')
  }

  async function handleToggle(item: HomeworkItem) {
    const next = !item.completed
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: next, completed_at: next ? new Date().toISOString() : null } : i))
    await fetch(`/api/homework/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: next }),
    })
  }

  async function handleEditSave(id: string) {
    setSaving(true)
    const res = await fetch(`/api/homework/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); toast(data.error ?? 'Could not save', 'error'); setSaving(false); return }
    setItems(prev => prev.map(i => i.id === id ? data.item : i))
    setEditId(null)
    setSaving(false)
    toast('Changes saved')
  }

  async function handleGenerateFromBlueprint() {
    if (items.length > 0) {
      if (!confirm(`This will add tasks generated from the blueprint alongside the ${items.length} existing item(s). Continue?`)) return
    }
    setGenerating(true)
    setGenerateMsg('')
    setError('')
    const res = await fetch('/api/homework/generate-from-blueprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Generation failed'); setGenerating(false); return }
    setItems(prev => [...prev, ...(data.tasks ?? [])])
    setGenerateMsg(`✓ ${data.count} tasks generated from blueprint`)
    setGenerating(false)
    setTimeout(() => setGenerateMsg(''), 4000)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/homework/${id}`, { method: 'DELETE' })
    toast('Item deleted')
  }

  // Sort by the date each task was sent (created_at), newest first, so recent
  // homework is up top and long-waiting old items are at the bottom.
  const bySentDesc = (a: HomeworkItem, b: HomeworkItem) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.id.localeCompare(a.id)
  const filtered = items.filter(i => filter === 'all' || i.type === filter)
  const pending = filtered.filter(i => !i.completed).sort(bySentDesc)
  const done = filtered.filter(i => i.completed).sort(bySentDesc)

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <div>
          <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase mb-0.5">Assignments</p>
          <p className="text-[var(--text)] text-sm font-medium">Homework & Tasks</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Type filter tabs */}
          <div className="flex text-xs border border-[var(--border-color)] rounded overflow-hidden">
            {(['all', 'homework', 'task'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 transition-colors ${filter === f ? 'bg-[#C9A227]/10 text-[#C9A227]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
                {f === 'all' ? 'All' : f === 'homework' ? 'Homework' : 'Tasks'}
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerateFromBlueprint}
            disabled={generating}
            title="Auto-generate tasks from this member's blueprint using AI"
            className="text-xs border border-[var(--border-color)] text-[var(--text-3)] px-3 py-1.5 rounded hover:text-[#C9A227] hover:border-[#C9A227]/30 transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            {generating ? (
              <><span className="inline-block w-3 h-3 border border-[#555] border-t-[#C9A227] rounded-full animate-spin" /> Generating…</>
            ) : '✦ From Blueprint'}
          </button>
          <button
            onClick={() => { setShowForm(true); setEditId(null) }}
            className="text-xs bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] px-3 py-1.5 rounded hover:bg-[#C9A227]/15 transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Generate / error messages */}
      {generateMsg && (
        <div className="px-5 py-2.5 bg-green-500/5 border-b border-green-500/20">
          <p className="text-green-400 text-xs">{generateMsg}</p>
        </div>
      )}
      {error && (
        <div className="px-5 py-2.5 bg-[#CC1F1F]/5 border-b border-[#CC1F1F]/20">
          <p className="text-[#CC1F1F] text-xs">{error}</p>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="px-5 py-4 bg-[var(--surface-2)] border-b border-[var(--border-color)]">
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-2 items-start">
              <AutoGrowTextarea
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Title…"
                required
                className="flex-1 bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] text-sm rounded px-3 py-2 leading-relaxed focus:outline-none focus:border-[#C9A227]"
              />
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'homework' | 'task' }))}
                className="bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-2)] text-xs rounded px-2 py-2 focus:outline-none focus:border-[#C9A227]"
              >
                <option value="homework">Homework</option>
                <option value="task">Blueprint Task</option>
              </select>
            </div>
            <AutoGrowTextarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] text-sm rounded px-3 py-2 leading-relaxed focus:outline-none focus:border-[#C9A227]"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <label className="text-[var(--text-3)] text-xs whitespace-nowrap">Due date <span className="text-[var(--text-4)]">(optional)</span></label>
                <div className="flex-1 min-w-0">
                  <DateField
                    value={form.due_date}
                    onChange={v => setForm(f => ({ ...f, due_date: v }))}
                    placeholder="No due date"
                    className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-2)] text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C9A227]"
                  />
                </div>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-[var(--text-3)] text-xs hover:text-[var(--text-2)]">Cancel</button>
              <button type="submit" disabled={saving} className="bg-[#C9A227] text-[#0D0D0D] text-xs font-bold px-4 py-1.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40">
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
            {error && <p className="text-[#CC1F1F] text-xs">{error}</p>}
          </form>
        </div>
      )}

      {/* Items */}
      {loading ? (
        <div className="px-5 py-8 text-center text-[var(--text-4)] text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-8 text-center text-[var(--text-4)] text-sm">No {filter === 'all' ? 'items' : filter} yet. Click + Add to create one.</div>
      ) : (
        <div>
          {/* Pending */}
          {pending.length > 0 && (
            <div className="divide-y divide-[var(--border-color)]">
              {pending.map(item => (
                <ItemRow key={item.id} item={item} editId={editId} editForm={editForm}
                  setEditId={setEditId} setEditForm={setEditForm}
                  onToggle={handleToggle} onEditSave={handleEditSave} onDelete={handleDelete} saving={saving} />
              ))}
            </div>
          )}

          {/* Done */}
          {done.length > 0 && (
            <div>
              <div className="px-5 py-2 bg-[var(--surface-2)] border-y border-[var(--border-color)]">
                <p className="text-[var(--text-4)] text-[10px] uppercase tracking-wider">Completed ({done.length})</p>
              </div>
              <div className="divide-y divide-[var(--border-color)] opacity-60">
                {done.map(item => (
                  <ItemRow key={item.id} item={item} editId={editId} editForm={editForm}
                    setEditId={setEditId} setEditForm={setEditForm}
                    onToggle={handleToggle} onEditSave={handleEditSave} onDelete={handleDelete} saving={saving} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, editId, editForm, setEditId, setEditForm, onToggle, onEditSave, onDelete, saving }: {
  item: HomeworkItem
  editId: string | null
  editForm: typeof EMPTY_FORM
  setEditId: (id: string | null) => void
  setEditForm: (f: typeof EMPTY_FORM) => void
  onToggle: (item: HomeworkItem) => void
  onEditSave: (id: string) => void
  onDelete: (id: string) => void
  saving: boolean
}) {
  const badge = dueBadge(item.due_date)
  const isEditing = editId === item.id
  // Tasks the AI pulled from a call come in with no due date. Flag them so the
  // admin notices and sets one; the flag clears the moment a due date is added.
  const needsDueDate = item.source === 'call' && !item.due_date && !item.completed
  const openEdit = () => { setEditId(item.id); setEditForm({ title: item.title, description: item.description ?? '', due_date: item.due_date ?? '', type: item.type }) }

  if (isEditing) {
    return (
      <div className="px-5 py-3 bg-[var(--bg)] space-y-2">
        <div className="flex gap-2 items-start">
          <AutoGrowTextarea value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })}
            className="flex-1 bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text)] text-sm rounded px-3 py-1.5 leading-relaxed focus:outline-none focus:border-[#C9A227]" />
          <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as 'homework' | 'task' })}
            className="bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text-2)] text-xs rounded px-2 py-1.5 focus:outline-none">
            <option value="homework">Homework</option>
            <option value="task">Task</option>
          </select>
        </div>
        <AutoGrowTextarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
          placeholder="Description"
          className="w-full bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] text-sm rounded px-3 py-1.5 leading-relaxed focus:outline-none focus:border-[#C9A227]" />
        <div className="flex items-center gap-3">
          <div className="w-44">
            <DateField value={editForm.due_date} onChange={v => setEditForm({ ...editForm, due_date: v })}
              placeholder="No due date"
              className="w-full bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text-2)] text-xs rounded px-2 py-1.5 focus:outline-none" />
          </div>
          <button onClick={() => setEditId(null)} className="text-[var(--text-3)] text-xs hover:text-[var(--text-2)] ml-auto">Cancel</button>
          <button onClick={() => onEditSave(item.id)} disabled={saving}
            className="bg-[#C9A227] text-[#0D0D0D] text-xs font-bold px-3 py-1.5 rounded disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors group ${
      needsDueDate ? 'bg-[#C9A227]/[0.07] shadow-[inset_3px_0_0_#C9A227]' : ''
    }`}>
      {/* Checkbox */}
      <button onClick={() => onToggle(item)}
        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
          item.completed ? 'bg-[#C9A227] border-[#C9A227]' : 'border-[var(--text-4)] hover:border-[#C9A227]/60'
        }`}>
        {item.completed && <span className="text-[#0D0D0D] text-[10px] font-bold leading-none">✓</span>}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${item.completed ? 'line-through text-[var(--text-4)]' : 'text-[var(--text)]'}`}>{item.title}</span>
          <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${taskSourceBadgeClass(item.source)}`}>{taskSourceLabel(item.source)}</span>
          {badge && !item.completed && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
          )}
          {needsDueDate && (
            <button
              onClick={openEdit}
              title="This task came from a call and has no due date yet. Click to add one."
              className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-[#C9A227]/50 text-[#C9A227] bg-[#C9A227]/10 hover:bg-[#C9A227]/20 transition-colors"
            >
              ⚠ No due date, add one
            </button>
          )}
        </div>
        {item.description && (
          <p className="text-[var(--text-3)] text-xs mt-0.5 truncate">{item.description}</p>
        )}
        {/* All three dates, always shown */}
        <div className="flex items-center gap-1.5 mt-1 text-[var(--text-4)] text-[10px] flex-wrap">
          <span>Added {fmtDate(item.created_at)}</span>
          <span>·</span>
          <span className={needsDueDate ? 'text-[#C9A227]' : ''}>Due {item.due_date ? fmtDate(item.due_date, true) : 'not set'}</span>
          <span>·</span>
          <span>Completed {item.completed_at ? fmtDate(item.completed_at) : '—'}</span>
        </div>
        {item.notes && (
          <div className="mt-2 bg-[var(--surface-2)] border-l-2 border-[#C9A227]/40 rounded-r px-2.5 py-1.5">
            <p className="text-[#C9A227] text-[9px] uppercase tracking-wider mb-0.5">Member note</p>
            <p className="text-[var(--text-2)] text-xs whitespace-pre-wrap">{item.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => { setEditId(item.id); setEditForm({ title: item.title, description: item.description ?? '', due_date: item.due_date ?? '', type: item.type }) }}
          className="text-[var(--text-4)] hover:text-[var(--text-2)] text-xs px-1.5 py-1 rounded transition-colors">
          Edit
        </button>
        <button onClick={() => onDelete(item.id)}
          className="text-[var(--text-4)] hover:text-[#CC1F1F] text-xs px-1.5 py-1 rounded transition-colors">
          ✕
        </button>
      </div>
    </div>
  )
}
