'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'

interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface ChatOverlayProps {
  onClose: () => void
}

export default function ChatOverlay({ onClose }: ChatOverlayProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Scroll to bottom whenever messages or streaming text change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  // Focus input when session changes
  useEffect(() => {
    if (activeSessionId) inputRef.current?.focus()
  }, [activeSessionId])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function loadSessions() {
    const res = await fetch('/api/chat/sessions')
    if (!res.ok) return
    const data = await res.json()
    setSessions(data.sessions ?? [])

    // Auto-open the most recent session if exists
    if (data.sessions?.length > 0 && !activeSessionId) {
      await openSession(data.sessions[0].id)
    }
  }

  async function deleteSession(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation()
    await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (activeSessionId === sessionId) {
      setActiveSessionId(null)
      setMessages([])
    }
  }

  async function openSession(sessionId: string) {
    setActiveSessionId(sessionId)
    setLoadingMessages(true)
    setMessages([])
    setStreamingText('')
    const res = await fetch(`/api/chat/${sessionId}/messages`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages ?? [])
    }
    setLoadingMessages(false)
  }

  async function newChat() {
    const res = await fetch('/api/chat/sessions', { method: 'POST' })
    if (!res.ok) return
    const data = await res.json()
    const session = data.session
    setSessions(prev => [session, ...prev])
    setActiveSessionId(session.id)
    setMessages([])
    setStreamingText('')
    inputRef.current?.focus()
  }

  function updateSessionTitle(sessionId: string, title: string) {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s))
  }

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming || !activeSessionId) return

    // If no session, create one first
    let sessionId = activeSessionId

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])
    setInput('')
    setIsStreaming(true)
    setStreamingText('')

    // Update session title if it's the first message
    const currentSession = sessions.find(s => s.id === sessionId)
    if (currentSession?.title === 'New Chat') {
      const autoTitle = trimmed.slice(0, 52) + (trimmed.length > 52 ? '…' : '')
      updateSessionTitle(sessionId, autoTitle)
    }

    abortRef.current = new AbortController()

    try {
      const res = await fetch(`/api/chat/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error('Request failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        full += chunk
        setStreamingText(full)
      }

      // Commit the streamed message
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: full,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
      setStreamingText('')

      // Bump session to top
      setSessions(prev => {
        const idx = prev.findIndex(s => s.id === sessionId)
        if (idx <= 0) return prev
        const updated = [...prev]
        const [s] = updated.splice(idx, 1)
        return [{ ...s, updated_at: new Date().toISOString() }, ...updated]
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          created_at: new Date().toISOString(),
        }])
      }
      setStreamingText('')
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, activeSessionId, sessions])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    if (diff < 604800000) return d.toLocaleDateString('en-US', { weekday: 'short' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-[#0D0D0D]">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 transition-all duration-200 overflow-hidden border-r border-[#2A2A2A] flex flex-col bg-[#111111]`}>
        {/* Sidebar header */}
        <div className="px-4 py-5 border-b border-[#2A2A2A] flex-shrink-0">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-5 h-5 rounded-full border border-[#CC1F1F] flex items-center justify-center flex-shrink-0">
              <div className="w-1 h-1 rounded-full bg-[#CC1F1F]" />
            </div>
            <span className="text-white font-serif text-sm">Ask Gogo</span>
          </div>
          <button
            onClick={newChat}
            className="w-full bg-[#C9A227] text-[#0D0D0D] text-xs font-medium py-2 rounded hover:bg-[#d4ac2d] transition-colors"
          >
            + New Chat
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <p className="text-[#444] text-xs px-4 py-3">No chats yet</p>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                onClick={() => openSession(session.id)}
                className={`w-full text-left px-4 py-3 transition-all group cursor-pointer flex items-start justify-between gap-2 ${
                  activeSessionId === session.id
                    ? 'bg-[#C9A227]/10 border-l-2 border-[#C9A227]'
                    : 'border-l-2 border-transparent hover:bg-[#1A1A1A] hover:border-[#333]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-xs truncate leading-snug ${
                    activeSessionId === session.id ? 'text-[#C9A227]' : 'text-[#888] group-hover:text-white'
                  }`}>
                    {session.title}
                  </p>
                  <p className="text-[#444] text-[10px] mt-0.5">{formatDate(session.updated_at)}</p>
                </div>
                <button
                  onClick={(e) => deleteSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 text-[#444] hover:text-[#CC1F1F] transition-all flex-shrink-0 text-xs leading-none p-0.5"
                  title="Delete chat"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A] flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="text-[#555] hover:text-white transition-colors p-1"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                <rect y="0" width="16" height="2" rx="1" />
                <rect y="6" width="10" height="2" rx="1" />
                <rect y="12" width="16" height="2" rx="1" />
              </svg>
            </button>
            <div>
              <p className="text-white text-sm font-medium">Ask Gogo</p>
              <p className="text-[#555] text-[10px]">Answers from Gogo's knowledge base</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-white transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-[#1A1A1A]"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {!activeSessionId ? (
            /* Empty state — no session selected */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full border border-[#CC1F1F] flex items-center justify-center mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-[#CC1F1F]" />
              </div>
              <h2 className="text-white font-serif text-2xl mb-2">Got a question?</h2>
              <p className="text-[#555] text-sm mb-6 leading-relaxed">
                Ask anything about Gogo's frameworks, strategies, and teachings. Every answer comes directly from her knowledge base.
              </p>
              <button
                onClick={newChat}
                className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-6 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors"
              >
                Start a chat
              </button>
            </div>
          ) : loadingMessages ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-[#555] text-sm">Loading…</div>
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            /* Empty session */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
              <p className="text-[#C9A227] text-xs tracking-[0.2em] uppercase mb-3">New Chat</p>
              <h3 className="text-white font-serif text-xl mb-2">What would you like to know?</h3>
              <p className="text-[#555] text-sm mb-6">Ask about revenue share, team building, content strategy, mindset — anything Gogo teaches.</p>
              <div className="grid gap-2 w-full">
                {[
                  'How do I build a revenue share downline?',
                  'What does Gogo say about hiring?',
                  'How do I structure my team?',
                  'What is Gogo\'s content strategy?',
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus() }}
                    className="text-left text-xs text-[#888] bg-[#1A1A1A] border border-[#2A2A2A] rounded px-4 py-2.5 hover:border-[#C9A227]/40 hover:text-white transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Streaming message */}
              {isStreaming && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full border border-[#CC1F1F] flex-shrink-0 flex items-center justify-center mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F]" />
                  </div>
                  <div className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-sm text-[#E0E0E0]">
                    {streamingText ? (
                      <MarkdownContent content={streamingText} />
                    ) : (
                      <span className="flex items-center gap-1.5 text-[#555]">
                        <span className="inline-block w-1.5 h-1.5 bg-[#C9A227] rounded-full animate-pulse" />
                        <span className="inline-block w-1.5 h-1.5 bg-[#C9A227] rounded-full animate-pulse [animation-delay:150ms]" />
                        <span className="inline-block w-1.5 h-1.5 bg-[#C9A227] rounded-full animate-pulse [animation-delay:300ms]" />
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        {activeSessionId && (
          <div className="px-6 py-4 border-t border-[#2A2A2A] flex-shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3 items-end bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 focus-within:border-[#C9A227]/60 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Ask Gogo anything…"
                  disabled={isStreaming}
                  className="flex-1 bg-transparent text-white placeholder-[#444] text-sm resize-none focus:outline-none leading-relaxed max-h-32 overflow-y-auto disabled:opacity-50"
                  style={{ height: 'auto' }}
                  onInput={e => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = el.scrollHeight + 'px'
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  className="flex-shrink-0 w-8 h-8 bg-[#C9A227] text-[#0D0D0D] rounded flex items-center justify-center hover:bg-[#d4ac2d] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Send (Enter)"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 13L13 7L1 1V5.5L9 7L1 8.5V13Z" fill="currentColor" />
                  </svg>
                </button>
              </div>
              <p className="text-[#333] text-[10px] mt-2 text-center">
                Answers drawn exclusively from Gogo's knowledge base · Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="mb-3 space-y-1 list-none">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 space-y-1 list-none counter-reset-[item]">{children}</ol>,
        li: ({ children }) => (
          <li className="flex gap-2 items-start">
            <span className="text-[#C9A227] mt-0.5 flex-shrink-0">·</span>
            <span>{children}</span>
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#C9A227] pl-3 my-3 text-[#aaa] italic">
            {children}
          </blockquote>
        ),
        h1: ({ children }) => <h1 className="text-white font-semibold text-base mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-white font-semibold text-sm mb-2 mt-3 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[#C9A227] font-semibold text-sm mb-1 mt-3 first:mt-0">{children}</h3>,
        code: ({ children }) => <code className="bg-[#0D0D0D] text-[#C9A227] px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
        hr: () => <hr className="border-[#2A2A2A] my-3" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] bg-[#C9A227]/15 border border-[#C9A227]/25 rounded-lg px-4 py-3 text-sm text-white leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full border border-[#CC1F1F] flex-shrink-0 flex items-center justify-center mt-0.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F]" />
      </div>
      <div className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-sm text-[#E0E0E0]">
        <MarkdownContent content={message.content} />
      </div>
    </div>
  )
}
