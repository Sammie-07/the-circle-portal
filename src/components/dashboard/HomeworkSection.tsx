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
    cls: 'text-[#555] border-[#2A2A2A]'
  }
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

  if (homework.length === 0 && tasks.length === 0) return null

  return (
    <div className="space-y-6 mt-6">

      {/* Homework */}
      {homework.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase">This Week&apos;s Homework</p>
            <div className="flex-1 h-px bg-[#1E1E1E]" />
            <span className="text-[#555] text-xs">
              {homework.filter(i => i.completed).length}/{homework.length} done
            </span>
          </div>
          <div className="space-y-2">
            {homework.map(item => <CheckItem key={item.id} item={item} onToggle={handleToggle} toggling={toggling} />)}
          </div>
        </div>
      )}

      {/* Blueprint Tasks */}
      {tasks.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase">Blueprint Tasks</p>
            <div className="flex-1 h-px bg-[#1E1E1E]" />
            <span className="text-[#555] text-xs">
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
              .map(item => <CheckItem key={item.id} item={item} onToggle={handleToggle} toggling={toggling} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function CheckItem({ item, onToggle, toggling }: {
  item: HomeworkItem
  onToggle: (item: HomeworkItem) => void
  toggling: string | null
}) {
  const badge = dueBadge(item.due_date)
  const isLoading = toggling === item.id

  return (
    <button
      onClick={() => onToggle(item)}
      disabled={!!toggling}
      className={`w-full flex items-start gap-3 p-4 rounded border text-left transition-all ${
        item.completed
          ? 'bg-[#111] border-[#1E1E1E] opacity-60'
          : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#C9A227]/20 hover:bg-[#1E1A10]'
      } disabled:cursor-default`}
    >
      {/* Circle checkbox */}
      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        isLoading ? 'border-[#C9A227]/40 bg-[#C9A227]/10' :
        item.completed ? 'border-[#C9A227] bg-[#C9A227]' : 'border-[#333] group-hover:border-[#555]'
      }`}>
        {item.completed && !isLoading && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="#0D0D0D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {isLoading && <div className="w-2 h-2 rounded-full bg-[#C9A227] animate-pulse" />}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${item.completed ? 'line-through text-[#444]' : 'text-white'}`}>
            {item.title}
          </span>
          {badge && !item.completed && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
          )}
        </div>
        {item.description && (
          <p className={`text-xs mt-0.5 ${item.completed ? 'text-[#333]' : 'text-[#555]'}`}>{item.description}</p>
        )}
        {item.completed && item.completed_at && (
          <p className="text-[10px] text-[#333] mt-0.5">
            Completed {new Date(item.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>
    </button>
  )
}
