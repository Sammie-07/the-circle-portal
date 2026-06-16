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
  attachmentName?: string | null
}

interface ChatOverlayProps {
  onClose: () => void
  preview?: boolean
}

export default function ChatOverlay({ onClose, preview = false }: ChatOverlayProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [loadingMessages, setLoadingMessages] = useState(false)
  // Sessions sidebar: open by default on desktop, closed on mobile (it overlays
  // the chat there). This component is loaded client-only, so window is available.
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  )
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Scroll to bottom whenever messages or streaming text change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // Load sessions on mount. In preview, persist nothing and load nothing —
  // just set a sentinel session so the input + empty state render.
  useEffect(() => {
    if (preview) {
      // Mount-time init of the preview sentinel session (intentional).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSessionId('preview')
      setMessages([])
      return
    }
    // loadSessions is a hoisted function declaration below — safe to call here.
    // eslint-disable-next-line react-hooks/immutability
    loadSessions()
    // Run once on mount (or when preview flips). loadSessions is intentionally
    // excluded so it doesn't refire as activeSessionId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview])

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
    if (preview) {
      setMessages([])
      setStreamingText('')
      inputRef.current?.focus()
      return
    }
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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return

    setAttachError(null)
    setAttaching(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/chat/extract', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAttachError(data?.error || 'Could not attach that file.')
        return
      }
      setAttachment({ name: data.name, text: data.text })
    } catch {
      setAttachError('Could not attach that file.')
    } finally {
      setAttaching(false)
    }
  }

  function removeAttachment() {
    setAttachment(null)
    setAttachError(null)
  }

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if ((!trimmed && !attachment) || isStreaming || !activeSessionId) return

    // If no session, create one first
    const sessionId = activeSessionId
    const sentAttachment = attachment

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed || '(see attached file)',
      created_at: new Date().toISOString(),
      attachmentName: sentAttachment?.name ?? null,
    }
    setMessages(prev => [...prev, tempUserMsg])
    setInput('')
    setAttachment(null)
    setAttachError(null)
    setIsStreaming(true)
    setStreamingText('')

    // Update session title if it's the first message (not in preview — no sessions)
    if (!preview) {
      const currentSession = sessions.find(s => s.id === sessionId)
      if (currentSession?.title === 'New Chat') {
        const titleSource = trimmed || sentAttachment?.name || 'New Chat'
        const autoTitle = titleSource.slice(0, 52) + (titleSource.length > 52 ? '…' : '')
        updateSessionTitle(sessionId, autoTitle)
      }
    }

    abortRef.current = new AbortController()

    try {
      const res = preview
        ? await fetch('/api/chat/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: trimmed,
              history: messages.map(m => ({ role: m.role, content: m.content })),
              attachmentName: sentAttachment?.name ?? null,
              attachmentText: sentAttachment?.text ?? null,
            }),
            signal: abortRef.current.signal,
          })
        : await fetch(`/api/chat/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          attachmentName: sentAttachment?.name ?? null,
          attachmentText: sentAttachment?.text ?? null,
        }),
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

      // Bump session to top (no-op in preview — no session list)
      if (!preview) setSessions(prev => {
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
  }, [input, isStreaming, activeSessionId, sessions, attachment, messages, preview])

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
    <div className="fixed inset-0 z-50 flex bg-[var(--bg)]">
      {/* Mobile backdrop when the sessions list is open */}
      {!preview && sidebarOpen && (
        <div
          className="md:hidden absolute inset-0 bg-black/50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden in preview (ephemeral chat, no saved sessions).
          On mobile it overlays the chat (absolute, slides in); on desktop it
          pushes the chat (in-flow, width animates between 0 and 16rem). */}
      {!preview && (
      <div className={`
        absolute inset-y-0 left-0 z-30 w-64 md:relative md:z-auto
        ${sidebarOpen ? 'translate-x-0 md:w-64' : '-translate-x-full md:translate-x-0 md:w-0'}
        flex-shrink-0 transition-all duration-200 overflow-hidden border-r border-[var(--border-color)] flex flex-col bg-[var(--surface-2)]`}>
        {/* Sidebar header */}
        <div className="px-4 py-5 border-b border-[var(--border-color)] flex-shrink-0">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-5 h-5 rounded-full border border-[#CC1F1F] flex items-center justify-center flex-shrink-0">
              <div className="w-1 h-1 rounded-full bg-[#CC1F1F]" />
            </div>
            <span className="text-[var(--text)] font-serif text-sm">Ask Gogo</span>
          </div>
          <button
            onClick={() => { newChat(); if (window.innerWidth < 768) setSidebarOpen(false) }}
            className="w-full bg-[#C9A227] text-[#0D0D0D] text-xs font-medium py-2 rounded hover:bg-[#d4ac2d] transition-colors"
          >
            + New Chat
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <p className="text-[var(--text-4)] text-xs px-4 py-3">No chats yet</p>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                onClick={() => { openSession(session.id); if (window.innerWidth < 768) setSidebarOpen(false) }}
                className={`w-full text-left px-4 py-3 transition-all group cursor-pointer flex items-start justify-between gap-2 ${
                  activeSessionId === session.id
                    ? 'bg-[#C9A227]/10 border-l-2 border-[#C9A227]'
                    : 'border-l-2 border-transparent hover:bg-[var(--surface)] hover:border-[var(--border-hover)]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-xs truncate leading-snug ${
                    activeSessionId === session.id ? 'text-[#C9A227]' : 'text-[var(--text-2)] group-hover:text-[var(--text)]'
                  }`}>
                    {session.title}
                  </p>
                  <p className="text-[var(--text-4)] text-[10px] mt-0.5">{formatDate(session.updated_at)}</p>
                </div>
                <button
                  onClick={(e) => deleteSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--text-4)] hover:text-[#CC1F1F] transition-all flex-shrink-0 text-xs leading-none p-0.5"
                  title="Delete chat"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border-color)] flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle — hidden in preview (no sidebar) */}
            {!preview && (
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors p-1"
                title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect y="0" width="16" height="2" rx="1" />
                  <rect y="6" width="10" height="2" rx="1" />
                  <rect y="12" width="16" height="2" rx="1" />
                </svg>
              </button>
            )}
            <div>
              <p className="text-[var(--text)] text-sm font-medium">Ask Gogo</p>
              <p className="text-[var(--text-3)] text-[10px]">
                {preview
                  ? "Preview chat — answers from Gogo's Brain, not saved."
                  : "Answers from Gogo's knowledge base"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--surface)]"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          {!activeSessionId ? (
            /* Empty state — no session selected */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full border border-[#CC1F1F] flex items-center justify-center mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-[#CC1F1F]" />
              </div>
              <h2 className="text-[var(--text)] font-serif text-2xl mb-2">Got a question?</h2>
              <p className="text-[var(--text-3)] text-sm mb-6 leading-relaxed">
                Ask anything about Gogo&apos;s frameworks, strategies, and teachings. Every answer comes directly from her knowledge base.
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
              <div className="text-[var(--text-3)] text-sm">Loading…</div>
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            /* Empty session */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
              <p className="text-[#C9A227] text-xs tracking-[0.2em] uppercase mb-3">New Chat</p>
              <h3 className="text-[var(--text)] font-serif text-xl mb-2">What would you like to know?</h3>
              <p className="text-[var(--text-3)] text-sm mb-6">Ask about revenue share, team building, content strategy, mindset — anything Gogo teaches.</p>
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
                    className="text-left text-xs text-[var(--text-2)] bg-[var(--surface)] border border-[var(--border-color)] rounded px-4 py-2.5 hover:border-[#C9A227]/40 hover:text-[var(--text)] transition-all"
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
                  <div className="flex-1 bg-[var(--surface)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-sm text-[var(--text-2)]">
                    {streamingText ? (
                      <MarkdownContent content={streamingText} />
                    ) : (
                      <span className="flex items-center gap-1.5 text-[var(--text-3)]">
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
          <div className="px-4 sm:px-6 py-4 border-t border-[var(--border-color)] flex-shrink-0">
            <div className="max-w-3xl mx-auto">
              {/* Attachment chip / state */}
              {(attachment || attaching || attachError) && (
                <div className="mb-2 flex items-center gap-2">
                  {attaching ? (
                    <span className="text-[var(--text-3)] text-xs">Attaching…</span>
                  ) : attachment ? (
                    <span className="inline-flex items-center gap-2 bg-[#C9A227]/10 border border-[#C9A227]/30 text-[var(--text-2)] text-xs rounded px-2.5 py-1">
                      <span className="truncate max-w-[260px]">📎 {attachment.name}</span>
                      <button
                        onClick={removeAttachment}
                        className="text-[var(--text-4)] hover:text-[#CC1F1F] transition-colors leading-none"
                        title="Remove attachment"
                      >
                        ✕
                      </button>
                    </span>
                  ) : null}
                  {attachError && (
                    <span className="text-[#CC1F1F] text-xs">{attachError}</span>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv,application/pdf,text/plain"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex gap-3 items-end bg-[var(--surface)] border border-[var(--border-color)] rounded-lg px-4 py-3 focus-within:border-[#C9A227]/60 transition-colors">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || attaching}
                  className="flex-shrink-0 w-8 h-8 text-[var(--text-3)] hover:text-[#C9A227] rounded flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Attach a file (PDF or text)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Ask Gogo anything…"
                  disabled={isStreaming}
                  className="flex-1 bg-transparent text-[var(--text)] placeholder-[var(--text-4)] text-sm resize-none focus:outline-none leading-relaxed max-h-32 overflow-y-auto disabled:opacity-50"
                  style={{ height: 'auto' }}
                  onInput={e => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = el.scrollHeight + 'px'
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !attachment) || isStreaming}
                  className="flex-shrink-0 w-8 h-8 bg-[#C9A227] text-[#0D0D0D] rounded flex items-center justify-center hover:bg-[#d4ac2d] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Send (Enter)"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 13L13 7L1 1V5.5L9 7L1 8.5V13Z" fill="currentColor" />
                  </svg>
                </button>
              </div>
              <p className="text-[var(--text-4)] text-[10px] mt-2 text-center">
                Answers drawn exclusively from Gogo&apos;s knowledge base · Enter to send · Shift+Enter for new line
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
        strong: ({ children }) => <strong className="font-semibold text-[var(--text)]">{children}</strong>,
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

function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] bg-[#C9A227]/15 border border-[#C9A227]/25 rounded-lg px-4 py-3 text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
          {message.content}
          {message.attachmentName && (
            <div className="mt-2 text-xs text-[var(--text-3)]">📎 {message.attachmentName}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full border border-[#CC1F1F] flex-shrink-0 flex items-center justify-center mt-0.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F]" />
      </div>
      <div className="flex-1 bg-[var(--surface)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-sm text-[var(--text-2)]">
        <MarkdownContent content={message.content} />
      </div>
    </div>
  )
}
