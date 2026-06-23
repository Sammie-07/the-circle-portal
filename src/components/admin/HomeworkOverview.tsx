'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Task {
  id: string
  title: string
  description: string | null
  type: 'homework' | 'task'
  completed: boolean
  due_date: string | null
  completed_at: string | null
}

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

function TaskRow({ task }: { task: Task }) {
  const done = task.completed
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border-color)] last:border-b-0">
      <span
        className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold ${
          done ? 'bg-[#C9A227] text-[#0D0D0D]' : 'border border-[var(--text-4)] text-transparent'
        }`}
      >
        ✓
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${done ? 'line-through text-[var(--text-4)]' : 'text-[var(--text)]'}`}>{task.title}</span>
          <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
            task.type === 'task' ? 'text-[var(--text-2)] border-[var(--border-hover)]' : 'text-[var(--text-3)] border-[var(--border-color)]'
          }`}>{task.type === 'task' ? 'Blueprint' : 'HW'}</span>
        </div>
        {task.description && <p className="text-[var(--text-3)] text-xs mt-0.5">{task.description}</p>}
        <p className="text-[var(--text-4)] text-[10px] mt-0.5">
          {done
            ? task.completed_at ? `Completed ${fmtDate(task.completed_at)}` : 'Completed'
            : task.due_date ? `Due ${fmtDate(task.due_date)}` : 'No due date'}
        </p>
      </div>
    </div>
  )
}

export default function HomeworkOverview({ members }: { members: MemberHW[] }) {
  const [activeId, setActiveId] = useState<string | null>(members[0]?.id ?? null)

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

  const todo = [...active.tasks]
    .filter((t) => !t.completed)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  const completed = [...active.tasks]
    .filter((t) => t.completed)
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
  const s = stats(active.tasks)

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

        {/* Progress summary */}
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0">
              <h2 className="text-[var(--text)] font-serif text-xl truncate">{active.name}</h2>
              <p className="text-[var(--text-3)] text-xs">{active.cohort ? `${active.cohort} cohort` : 'The Circle'}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[var(--text)] font-serif text-2xl">{s.pct !== null ? `${s.pct}%` : '—'}</p>
              <p className="text-[var(--text-3)] text-xs">{s.done} of {s.total} done</p>
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
              {todo.map((t) => <TaskRow key={t.id} task={t} />)}
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
              {completed.map((t) => <TaskRow key={t.id} task={t} />)}
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
