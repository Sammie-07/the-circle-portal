'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface SessionSummary {
  id: string
  title: string
  updatedAt: string
  memberName: string
  messageCount: number
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

  const active = sessions.find((s) => s.id === activeId) ?? null

  const filtered = query.trim()
    ? sessions.filter((s) =>
        (s.memberName + ' ' + s.title).toLowerCase().includes(query.trim().toLowerCase())
      )
    : sessions

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
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => openSession(s.id)}
              className={`w-full text-left px-4 py-3 border-b border-[var(--border-color)] last:border-b-0 transition-colors ${
                activeId === s.id
                  ? 'bg-[#C9A227]/10 border-l-2 border-l-[#C9A227]'
                  : 'border-l-2 border-l-transparent hover:bg-[var(--surface)]'
              }`}
            >
              <p className="text-[var(--text)] text-sm font-medium truncate">{s.memberName}</p>
              <p className="text-[var(--text-3)] text-xs truncate mt-0.5">{s.title}</p>
              <p className="text-[var(--text-4)] text-[10px] mt-1">
                {fmtDate(s.updatedAt)} · {s.messageCount} message{s.messageCount === 1 ? '' : 's'}
              </p>
            </button>
          ))}
          {filtered.length === 0 && (
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
