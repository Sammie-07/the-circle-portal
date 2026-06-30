'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface SessionSummary {
  id: string
  memberId: string
  title: string
  updatedAt: string
  memberName: string
  messageCount: number
}

interface MemberGroup {
  memberId: string
  memberName: string
  sessions: SessionSummary[]
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function ChatMonitor({ sessions }: { sessions: SessionSummary[] }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const active = sessions.find((s) => s.id === activeId) ?? null

  const q = query.trim().toLowerCase()
  const filtered = q
    ? sessions.filter((s) => (s.memberName + ' ' + s.title).toLowerCase().includes(q))
    : sessions

  // Group sessions by member. `sessions` is already ordered by updated_at desc,
  // so each member's first session is their most recent; members are ordered by
  // whoever chatted most recently.
  const groups: MemberGroup[] = []
  const byId = new Map<string, MemberGroup>()
  for (const s of filtered) {
    let g = byId.get(s.memberId)
    if (!g) {
      g = { memberId: s.memberId, memberName: s.memberName, sessions: [] }
      byId.set(s.memberId, g)
      groups.push(g)
    }
    g.sessions.push(s)
  }

  function toggle(memberId: string) {
    setCollapsed((prev) => ({ ...prev, [memberId]: !prev[memberId] }))
  }

  async function openSession(id: string) {
    setActiveId(id)
    setLoading(true)
    setMessages([])
    const res = await fetch(`/api/admin/chats/${id}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages ?? [])
    }
    setLoading(false)
  }

  if (sessions.length === 0) {
    return (
      <div className="border border-[var(--border-color)] rounded-lg p-8 text-center">
        <p className="text-[var(--text-3)] text-sm">No member chats yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[20rem_1fr] gap-6">
      {/* Sessions list */}
      <div className="border border-[var(--border-color)] rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b border-[var(--border-color)]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search member or title…"
            className="w-full bg-[var(--surface)] border border-[var(--border-color)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-4)] focus:outline-none focus:border-[#C9A227]/60"
          />
        </div>
        <div className="overflow-y-auto max-h-[70vh]">
          {groups.map((g) => {
            const isCollapsed = collapsed[g.memberId]
            return (
              <div key={g.memberId} className="border-b border-[var(--border-color)] last:border-b-0">
                {/* Member header */}
                <button
                  onClick={() => toggle(g.memberId)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--surface)] transition-colors"
                >
                  <span className={`text-[var(--text-3)] text-[10px] transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                  <span className="text-[var(--text)] text-sm font-semibold truncate flex-1">{g.memberName}</span>
                  <span className="text-[var(--text-4)] text-[10px] flex-shrink-0">
                    {g.sessions.length} chat{g.sessions.length === 1 ? '' : 's'}
                  </span>
                </button>
                {/* Member's sessions */}
                {!isCollapsed && g.sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openSession(s.id)}
                    className={`w-full text-left pl-9 pr-4 py-2.5 transition-colors ${
                      activeId === s.id
                        ? 'bg-[#C9A227]/10 border-l-2 border-l-[#C9A227]'
                        : 'border-l-2 border-l-transparent hover:bg-[var(--surface)]'
                    }`}
                  >
                    <p className="text-[var(--text-2)] text-xs truncate">{s.title}</p>
                    <p className="text-[var(--text-4)] text-[10px] mt-0.5">
                      {fmtDate(s.updatedAt)} · {s.messageCount} message{s.messageCount === 1 ? '' : 's'}
                    </p>
                  </button>
                ))}
              </div>
            )
          })}
          {groups.length === 0 && (
            <p className="text-[var(--text-4)] text-xs px-4 py-6 text-center">No matches.</p>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div className="border border-[var(--border-color)] rounded-lg min-h-[50vh] flex flex-col">
        {!active ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-[var(--text-3)] text-sm">Select a conversation to read the transcript.</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-[var(--border-color)]">
              <p className="text-[var(--text)] text-sm font-medium">{active.memberName}</p>
              <p className="text-[var(--text-3)] text-xs mt-0.5">{active.title}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 max-h-[70vh]">
              {loading ? (
                <p className="text-[var(--text-3)] text-sm">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-[var(--text-3)] text-sm">No messages in this conversation.</p>
              ) : (
                messages.map((msg) => <MonitorBubble key={msg.id} message={msg} />)
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MonitorBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          <p className="text-[var(--text-4)] text-[10px] text-right mb-1">Member · {fmtDate(message.created_at)}</p>
          <div className="bg-[#C9A227]/15 border border-[#C9A227]/25 rounded-lg px-4 py-3 text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full border border-[#CC1F1F] flex-shrink-0 flex items-center justify-center mt-0.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[var(--text-4)] text-[10px] mb-1">Ask Gogo · {fmtDate(message.created_at)}</p>
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-sm text-[var(--text-2)]">
          <MarkdownContent content={message.content} />
        </div>
      </div>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-[var(--text)]">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="mb-3 space-y-1 list-none">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 space-y-1 list-none">{children}</ol>,
        li: ({ children }) => (
          <li className="flex gap-2 items-start">
            <span className="text-[#C9A227] mt-0.5 flex-shrink-0">·</span>
            <span>{children}</span>
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#C9A227] pl-3 my-3 text-[#aaa] italic">{children}</blockquote>
        ),
        h1: ({ children }) => <h1 className="text-[var(--text)] font-semibold text-base mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-[var(--text)] font-semibold text-sm mb-2 mt-3 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[#C9A227] font-semibold text-sm mb-1 mt-3 first:mt-0">{children}</h3>,
        code: ({ children }) => <code className="bg-[var(--bg)] text-[#C9A227] px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
        hr: () => <hr className="border-[var(--border-color)] my-3" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
