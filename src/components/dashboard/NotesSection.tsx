'use client'

import { useState, useCallback, useRef } from 'react'

interface Props {
  memberId: string
  initialContent: string
}

export default function NotesSection({ memberId, initialContent }: Props) {
  const [content, setContent] = useState(initialContent)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(async (value: string) => {
    setStatus('saving')
    await fetch('/api/member-notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, content: value }),
    })
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 2000)
  }, [memberId])

  function handleChange(value: string) {
    setContent(value)
    setStatus('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(value), 1200)
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[#C9A227] text-[10px] tracking-[0.25em] uppercase">My Notes</p>
        <div className="flex-1 h-px bg-[#1E1E1E]" />
        {status === 'saving' && <span className="text-[#555] text-[10px]">Saving…</span>}
        {status === 'saved' && <span className="text-green-500 text-[10px]">Saved ✓</span>}
      </div>
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded overflow-hidden focus-within:border-[#C9A227]/30 transition-colors">
        <textarea
          value={content}
          onChange={e => handleChange(e.target.value)}
          placeholder="Write anything here — ideas, wins, reminders, venting. This is just for you."
          rows={6}
          className="w-full bg-transparent text-[#888] placeholder-[#333] text-sm leading-relaxed p-4 resize-none focus:outline-none focus:text-white transition-colors"
        />
        <div className="px-4 py-2 border-t border-[#1E1E1E] flex items-center justify-between">
          <p className="text-[#333] text-[10px]">Auto-saves as you type · Only you can see this</p>
          <p className="text-[#333] text-[10px]">{content.length} chars</p>
        </div>
      </div>
    </div>
  )
}
