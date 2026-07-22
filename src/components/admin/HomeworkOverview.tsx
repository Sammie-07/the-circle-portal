'use client'

import { useState } from 'react'
import Link from 'next/link'
import DateField from '@/components/shared/DateField'
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
          <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${taskSourceBadgeClass(task.source)}`}>{taskSourceLabel(task.source)}</span>
        </div>
        {task.description && <p className="text-[var(--text-3)] text-xs mt-0.5">{task.description}</p>}
        <p className="text-[var(--text-4)] text-[10px] mt-0.5">
          {done
            ? task.completed_at ? `Completed ${fmtDate(task.completed_at)}` : 'Completed'
            : task.due_date ? `Due ${fmtDate(task.due_date)}` : 'No due date'}
        </p>
        {task.notes && (
          <div className="mt-2 bg-[var(--surface-2)] border-l-2 border-[#C9A227]/40 rounded-r px-2.5 py-1.5">
            <p className="text-[#C9A227] text-[9px] uppercase tracking-wider mb-0.5">Member note</p>
            <p className="text-[var(--text-2)] text-xs whitespace-pre-wrap">{task.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function HomeworkOverview({ members }: { members: MemberHW[] }) {
  const [activeId, setActiveId] = useState<string | null>(members[0]?.id ?? null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sentFrom, setSentFrom] = useState('')
  const [sentTo, setSentTo] = useState('')

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
