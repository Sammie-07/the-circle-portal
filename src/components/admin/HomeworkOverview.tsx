'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DateField from '@/components/shared/DateField'
import AutoGrowTextarea from '@/components/shared/AutoGrowTextarea'
import { toast } from '@/lib/toast'
import { taskSourceLabel, taskSourceBadgeClass, isAdminAssigned } from '@/lib/taskSource'

interface Task {
  id: string
  title: string
  description: string | null
  type: 'homework' | 'task'
  source: string | null
  completed: boolean
  due_date: string | null
  completed_at: string | null
  created_at: string
  notes: string | null
}

// Filter by ORIGIN: admin-assigned homework vs anything AI/automation added.
type TypeFilter = 'all' | 'admin' | 'ai'

interface MemberHW {
  id: string
  name: string
  cohort: string | null
  status: string
  tasks: Task[]
}

function stats(tasks: Task[]) {
  const total = tasks.length
  const done = tasks.filter((t) => t.completed).length
  const pct = total ? Math.round((done / total) * 100) : null
  return { total, done, pct }
}

function barColor(pct: number | null) {
  if (pct === null) return 'bg-[var(--border-color)]'
  if (pct >= 75) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d.length <= 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function TaskRow({
  task,
  onSave,
  onDelete,
}: {
  task: Task
  onSave: (id: string, patch: Record<string, unknown>) => Promise<boolean>
  onDelete: (id: string) => void
}) {
  const done = task.completed
  const needsDueDate = task.source === 'call' && !task.due_date && !done
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    due_date: task.due_date ?? '',
    type: task.type,
  })

  const openEdit = () => {
    setForm({ title: task.title, description: task.description ?? '', due_date: task.due_date ?? '', type: task.type })
    setEditing(true)
  }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const ok = await onSave(task.id, {
      title: form.title,
      description: form.description,
      due_date: form.due_date || null,
      type: form.type,
    })
    setSaving(false)
    if (ok) setEditing(false)
  }

  async function toggle() {
    setSaving(true)
    await onSave(task.id, { completed: !task.completed })
    setSaving(false)
  }

  if (editing) {
    return (
      <div className="px-4 py-3 border-b border-[var(--border-color)] last:border-b-0 bg-[var(--bg)] space-y-2">
        <div className="flex gap-2 items-start">
          <AutoGrowTextarea value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            className="flex-1 bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text)] text-sm rounded px-3 py-1.5 leading-relaxed focus:outline-none focus:border-[#C9A227]" />
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'homework' | 'task' })}
            className="bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text-2)] text-xs rounded px-2 py-1.5 focus:outline-none">
            <option value="homework">Homework</option>
            <option value="task">Task</option>
          </select>
        </div>
        <AutoGrowTextarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          placeholder="Description"
          className="w-full bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] text-sm rounded px-3 py-1.5 leading-relaxed focus:outline-none focus:border-[#C9A227]" />
        <div className="flex items-center gap-3">
          <div className="w-44">
            <DateField value={form.due_date} onChange={v => setForm({ ...form, due_date: v })}
              placeholder="No due date"
              className="w-full bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text-2)] text-xs rounded px-2 py-1.5 focus:outline-none" />
          </div>
          <button onClick={() => setEditing(false)} className="text-[var(--text-3)] text-xs hover:text-[var(--text-2)] ml-auto">Cancel</button>
          <button onClick={save} disabled={saving}
            className="bg-[#C9A227] text-[#0D0D0D] text-xs font-bold px-3 py-1.5 rounded disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`group flex items-start gap-3 px-4 py-3 border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--surface-2)] transition-colors ${
      needsDueDate ? 'bg-[#C9A227]/[0.07] shadow-[inset_3px_0_0_#C9A227]' : ''
    }`}>
      <button
        onClick={toggle}
        title={done ? 'Mark not done' : 'Mark done'}
        className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold transition-colors ${
          done ? 'bg-[#C9A227] text-[#0D0D0D]' : 'border border-[var(--text-4)] text-transparent hover:border-[#C9A227]/60'
        }`}
      >
        ✓
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${done ? 'line-through text-[var(--text-4)]' : 'text-[var(--text)]'}`}>{task.title}</span>
          <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${taskSourceBadgeClass(task.source)}`}>{taskSourceLabel(task.source)}</span>
          {needsDueDate && (
            <button onClick={openEdit} title="Came from a call, no due date yet. Click to add one."
              className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-[#C9A227]/50 text-[#C9A227] bg-[#C9A227]/10 hover:bg-[#C9A227]/20 transition-colors">
              ⚠ No due date, add one
            </button>
          )}
        </div>
        {task.description && <p className="text-[var(--text-3)] text-xs mt-0.5">{task.description}</p>}
        {/* Added · Due · Completed */}
        <div className="flex items-center gap-1.5 mt-0.5 text-[var(--text-4)] text-[10px] flex-wrap">
          <span>Added {fmtDate(task.created_at)}</span>
          <span>·</span>
          <span className={needsDueDate ? 'text-[#C9A227]' : ''}>Due {task.due_date ? fmtDate(task.due_date) : 'not set'}</span>
          <span>·</span>
          <span>Completed {task.completed_at ? fmtDate(task.completed_at) : '—'}</span>
        </div>
        {task.notes && (
          <div className="mt-2 bg-[var(--surface-2)] border-l-2 border-[#C9A227]/40 rounded-r px-2.5 py-1.5">
            <p className="text-[#C9A227] text-[9px] uppercase tracking-wider mb-0.5">Member note</p>
            <p className="text-[var(--text-2)] text-xs whitespace-pre-wrap">{task.notes}</p>
          </div>
        )}
      </div>
      {/* Actions — always visible */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={openEdit}
          className="text-[#C9A227] hover:bg-[#C9A227]/10 text-xs font-medium px-2 py-1 rounded border border-[#C9A227]/40 transition-colors">
          Edit
        </button>
        <button onClick={() => onDelete(task.id)}
          className="text-[var(--text-4)] hover:text-[#CC1F1F] text-xs px-1.5 py-1 rounded transition-colors">✕</button>
      </div>
    </div>
  )
}

export default function HomeworkOverview({ members }: { members: MemberHW[] }) {
  const [activeId, setActiveId] = useState<string | null>(members[0]?.id ?? null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sentFrom, setSentFrom] = useState('')
  const [sentTo, setSentTo] = useState('')
  const router = useRouter()

  // Edit / delete tasks inline, reusing the same admin homework API as the member
  // panel, then refresh server data so the change (and the glow) reflects at once.
  async function saveTask(id: string, patch: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/homework/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast(d.error ?? 'Could not save the task', 'error')
      return false
    }
    toast('Saved')
    router.refresh()
    return true
  }

  async function deleteTask(id: string) {
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    const res = await fetch(`/api/homework/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast('Could not delete the task', 'error')
      return
    }
    toast('Task deleted')
    router.refresh()
  }

  if (members.length === 0) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-10 text-center">
        <p className="text-[var(--text-3)] text-sm">No members yet.</p>
      </div>
    )
  }

  const active = members.find((m) => m.id === activeId) ?? members[0]
  const idx = members.findIndex((m) => m.id === active.id)
  const go = (delta: number) => setActiveId(members[(idx + delta + members.length) % members.length].id)

  // Apply the origin + sent-date (created_at) filters to the detail view.
  const visible = active.tasks.filter((t) => {
    if (typeFilter === 'admin' && !isAdminAssigned(t.source)) return false
    if (typeFilter === 'ai' && isAdminAssigned(t.source)) return false
    const sentDay = (t.created_at ?? '').slice(0, 10)
    if (sentFrom && sentDay < sentFrom) return false
    if (sentTo && sentDay > sentTo) return false
    return true
  })
  const filtersActive = typeFilter !== 'all' || !!sentFrom || !!sentTo

  // Sort by the date each task was sent (created_at), newest first — so last
  // week's homework sits at the top and long-waiting old items sink to the bottom.
  // Tie-break on id for a stable order when created_at ties (e.g. batch inserts).
  const bySentDesc = (a: Task, b: Task) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.id.localeCompare(a.id)
  const todo = [...visible].filter((t) => !t.completed).sort(bySentDesc)
  const completed = [...visible].filter((t) => t.completed).sort(bySentDesc)
  const s = stats(visible)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Member list (desktop) */}
      <aside className="hidden lg:block lg:col-span-1 space-y-1.5">
        {members.map((m) => {
          const ms = stats(m.tasks)
          const isActive = m.id === active.id
          return (
            <button
              key={m.id}
              onClick={() => setActiveId(m.id)}
              className={`w-full text-left px-3.5 py-3 rounded border transition-all ${
                isActive
                  ? 'bg-[#C9A227]/10 border-[#C9A227]/40'
                  : 'bg-[var(--surface)] border-[var(--border-color)] hover:border-[#C9A227]/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-medium truncate ${isActive ? 'text-[var(--text)]' : 'text-[var(--text-2)]'}`}>{m.name}</span>
                <span className="text-[var(--text-3)] text-xs flex-shrink-0">{ms.done}/{ms.total}</span>
              </div>
              <div className="mt-2 h-1 bg-[var(--border-color)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor(ms.pct)}`} style={{ width: `${ms.pct ?? 0}%` }} />
              </div>
            </button>
          )
        })}
      </aside>

      {/* Detail */}
      <div className="lg:col-span-2">
        {/* Switcher */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => go(-1)}
            aria-label="Previous member"
            className="w-9 h-9 flex-shrink-0 rounded border border-[var(--border-color)] text-[var(--text-2)] hover:border-[#C9A227] hover:text-[var(--text)] transition-colors"
          >‹</button>
          <select
            value={active.id}
            onChange={(e) => setActiveId(e.target.value)}
            className="flex-1 bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#C9A227]"
          >
            {members.map((m) => {
              const ms = stats(m.tasks)
              return <option key={m.id} value={m.id}>{m.name} — {ms.done}/{ms.total} done</option>
            })}
          </select>
          <button
            onClick={() => go(1)}
            aria-label="Next member"
            className="w-9 h-9 flex-shrink-0 rounded border border-[var(--border-color)] text-[var(--text-2)] hover:border-[#C9A227] hover:text-[var(--text)] transition-colors"
          >›</button>
        </div>

        {/* Filters */}
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-3 mb-4 flex flex-wrap items-center gap-3">
          {/* Origin */}
          <div className="flex text-xs border border-[var(--border-color)] rounded overflow-hidden">
            {([
              { k: 'all', label: 'All' },
              { k: 'admin', label: 'Homework' },
              { k: 'ai', label: 'AI-added' },
            ] as const).map((opt) => (
              <button
                key={opt.k}
                onClick={() => setTypeFilter(opt.k)}
                className={`px-3 py-1.5 transition-colors ${typeFilter === opt.k ? 'bg-[#C9A227]/10 text-[#C9A227]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sent date range */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-3)] text-xs whitespace-nowrap">Sent</span>
            <div className="w-36">
              <DateField value={sentFrom} onChange={setSentFrom} placeholder="From"
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-2)] text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C9A227]" />
            </div>
            <span className="text-[var(--text-4)] text-xs">→</span>
            <div className="w-36">
              <DateField value={sentTo} onChange={setSentTo} placeholder="To"
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-2)] text-xs rounded px-2 py-1.5 focus:outline-none focus:border-[#C9A227]" />
            </div>
          </div>

          {filtersActive && (
            <button
              onClick={() => { setTypeFilter('all'); setSentFrom(''); setSentTo('') }}
              className="text-[var(--text-3)] text-xs hover:text-[#CC1F1F] ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Progress summary */}
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0">
              <h2 className="text-[var(--text)] font-serif text-xl truncate">{active.name}</h2>
              <p className="text-[var(--text-3)] text-xs">{active.cohort ? `${active.cohort} cohort` : 'The Circle'}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[var(--text)] font-serif text-2xl">{s.pct !== null ? `${s.pct}%` : '—'}</p>
              <p className="text-[var(--text-3)] text-xs">{s.done} of {s.total} done{filtersActive ? ' (filtered)' : ''}</p>
            </div>
          </div>
          <div className="h-1.5 bg-[var(--border-color)] rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor(s.pct)}`} style={{ width: `${s.pct ?? 0}%` }} />
          </div>
        </div>

        {/* To do */}
        <div className="mb-5">
          <h3 className="text-[var(--text-2)] text-xs uppercase tracking-wider mb-2">To do ({todo.length})</h3>
          {todo.length === 0 ? (
            <p className="text-[var(--text-3)] text-sm bg-[var(--surface)] border border-[var(--border-color)] rounded px-4 py-3">All caught up 🎉</p>
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded">
              {todo.map((t) => <TaskRow key={t.id} task={t} onSave={saveTask} onDelete={deleteTask} />)}
            </div>
          )}
        </div>

        {/* Completed */}
        <div className="mb-5">
          <h3 className="text-[var(--text-2)] text-xs uppercase tracking-wider mb-2">Completed ({completed.length})</h3>
          {completed.length === 0 ? (
            <p className="text-[var(--text-3)] text-sm bg-[var(--surface)] border border-[var(--border-color)] rounded px-4 py-3">Nothing completed yet.</p>
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded opacity-80">
              {completed.map((t) => <TaskRow key={t.id} task={t} onSave={saveTask} onDelete={deleteTask} />)}
            </div>
          )}
        </div>

        <Link href={`/admin/member/${active.id}`} className="text-[#C9A227] text-sm hover:underline">
          Open {active.name.split(' ')[0]}&apos;s full profile to edit →
        </Link>
      </div>
    </div>
  )
}
