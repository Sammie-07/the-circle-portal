'use client'

import { useState, useEffect } from 'react'

interface HomeworkItem {
  id: string
  title: string
  description: string | null
  due_date: string | null
  type: 'homework' | 'task'
  completed: boolean
  completed_at: string | null
  created_at: string
}

interface Props {
  memberId: string
}

const EMPTY_FORM = { title: '', description: '', due_date: '', type: 'homework' as 'homework' | 'task' }

function dueBadge(due: string | null) {
  if (!due) return null
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: 'text-[#CC1F1F] border-[#CC1F1F]/30 bg-[#CC1F1F]/5' }
  if (days === 0) return { label: 'Due today', cls: 'text-orange-400 border-orange-400/30 bg-orange-400/5' }
  if (days <= 3) return { label: `${days}d left`, cls: 'text-orange-400 border-orange-400/30 bg-orange-400/5' }
  if (days <= 7) return { label: `${days}d left`, cls: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5' }
  return { label: new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: 'text-[#555] border-[#2A2A2A]' }
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

  useEffect(() => {
    fetch(`/api/homework?member_id=${memberId}`)
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
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setItems(prev => [...prev, data.item])
    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
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
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setItems(prev => prev.map(i => i.id === id ? data.item : i))
    setEditId(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/homework/${id}`, { method: 'DELETE' })
  }

  const filtered = items.filter(i => filter === 'all' || i.type === filter)
  const pending = filtered.filter(i => !i.completed)
  const done = filtered.filter(i => i.completed)

  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#2A2A2A] flex items-center justify-between">
        <div>
          <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase mb-0.5">Assignments</p>
          <p className="text-white text-sm font-medium">Homework & Tasks</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Type filter tabs */}
          <div className="flex text-xs border border-[#2A2A2A] rounded overflow-hidden">
            {(['all', 'homework', 'task'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 transition-colors ${filter === f ? 'bg-[#C9A227]/10 text-[#C9A227]' : 'text-[#555] hover:text-[#888]'}`}>
                {f === 'all' ? 'All' : f === 'homework' ? 'Homework' : 'Tasks'}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setShowForm(true); setEditId(null) }}
            className="text-xs bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] px-3 py-1.5 rounded hover:bg-[#C9A227]/15 transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="px-5 py-4 bg-[#111] border-b border-[#2A2A2A]">
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-2">
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Title…"
                required
                className="flex-1 bg-[#0D0D0D] border border-[#2A2A2A] text-white placeholder-[#444] text-sm rounded px-3 py-2 focus:outline-none focus:border-[#C9A227]"
              />
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'homework' | 'task' }))}
                className="bg-[#0D0D0D] border border-[#2A2A2A] text-[#888] text-xs rounded px-2 py-2 focus:outline-none focus:border-[#C9A227]"
              >
                <option value="homework">Homework</option>
                <option value="task">Blueprint Task</option>
              </select>
            </div>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] text-white placeholder-[#444] text-sm rounded px-3 py-2 focus:outline-none focus:border-[#C9A227]"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-[#555] text-xs whitespace-nowrap">Due date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="flex-1 bg-[#0D0D0D] border border-[#2A2A2A] text-[#888] text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C9A227]"
                />
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-[#555] text-xs hover:text-[#888]">Cancel</button>
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
        <div className="px-5 py-8 text-center text-[#444] text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-8 text-center text-[#444] text-sm">No {filter === 'all' ? 'items' : filter} yet. Click + Add to create one.</div>
      ) : (
        <div>
          {/* Pending */}
          {pending.length > 0 && (
            <div className="divide-y divide-[#1E1E1E]">
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
              <div className="px-5 py-2 bg-[#111] border-y border-[#1E1E1E]">
                <p className="text-[#333] text-[10px] uppercase tracking-wider">Completed ({done.length})</p>
              </div>
              <div className="divide-y divide-[#1E1E1E] opacity-60">
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

  if (isEditing) {
    return (
      <div className="px-5 py-3 bg-[#0D0D0D] space-y-2">
        <div className="flex gap-2">
          <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })}
            className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#C9A227]" />
          <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as 'homework' | 'task' })}
            className="bg-[#1A1A1A] border border-[#2A2A2A] text-[#888] text-xs rounded px-2 py-1.5 focus:outline-none">
            <option value="homework">Homework</option>
            <option value="task">Task</option>
          </select>
        </div>
        <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
          placeholder="Description"
          className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white placeholder-[#444] text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#C9A227]" />
        <div className="flex items-center gap-3">
          <input type="date" value={editForm.due_date} onChange={e => setEditForm({ ...editForm, due_date: e.target.value })}
            className="bg-[#1A1A1A] border border-[#2A2A2A] text-[#888] text-xs rounded px-2 py-1.5 focus:outline-none" />
          <button onClick={() => setEditId(null)} className="text-[#555] text-xs hover:text-[#888] ml-auto">Cancel</button>
          <button onClick={() => onEditSave(item.id)} disabled={saving}
            className="bg-[#C9A227] text-[#0D0D0D] text-xs font-bold px-3 py-1.5 rounded disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 px-5 py-3 hover:bg-[#111] transition-colors group">
      {/* Checkbox */}
      <button onClick={() => onToggle(item)}
        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
          item.completed ? 'bg-[#C9A227] border-[#C9A227]' : 'border-[#444] hover:border-[#C9A227]/60'
        }`}>
        {item.completed && <span className="text-[#0D0D0D] text-[10px] font-bold leading-none">✓</span>}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${item.completed ? 'line-through text-[#444]' : 'text-white'}`}>{item.title}</span>
          <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
            item.type === 'task' ? 'text-[#888] border-[#333]' : 'text-[#555] border-[#222]'
          }`}>{item.type === 'task' ? 'Blueprint' : 'HW'}</span>
          {badge && !item.completed && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
          )}
        </div>
        {item.description && (
          <p className="text-[#555] text-xs mt-0.5 truncate">{item.description}</p>
        )}
        {item.completed_at && (
          <p className="text-[#333] text-[10px] mt-0.5">
            Done {new Date(item.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => { setEditId(item.id); setEditForm({ title: item.title, description: item.description ?? '', due_date: item.due_date ?? '', type: item.type }) }}
          className="text-[#444] hover:text-[#888] text-xs px-1.5 py-1 rounded transition-colors">
          Edit
        </button>
        <button onClick={() => onDelete(item.id)}
          className="text-[#444] hover:text-[#CC1F1F] text-xs px-1.5 py-1 rounded transition-colors">
          ✕
        </button>
      </div>
    </div>
  )
}
