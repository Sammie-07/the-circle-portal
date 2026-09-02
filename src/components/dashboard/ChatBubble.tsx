'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const ChatOverlay = dynamic(() => import('./ChatOverlay'), { ssr: false })

export default function ChatBubble({ preview = false }: { preview?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {!open && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-2">
          {/* Floating label above the bubble */}
          <div className="bg-[var(--surface)] border border-[var(--border-color)] text-[var(--text)] text-xs px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
            Got a question? <span className="text-[#C9A227] font-semibold">Ask Gogo</span>
          </div>

          {/* Gold circle button */}
          <button
            onClick={() => setOpen(true)}
            title="Ask Gogo"
            className="w-14 h-14 bg-[#C9A227] rounded-full shadow-xl hover:shadow-[0_0_28px_rgba(201,162,39,0.45)] hover:bg-[#d4ac2d] transition-all duration-200 flex items-center justify-center"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 2C6.03 2 2 5.8 2 10.5c0 2.1.82 4.02 2.17 5.5L3 20l4.35-1.4A9.3 9.3 0 0 0 11 19c4.97 0 9-3.8 9-8.5S15.97 2 11 2Z" fill="#090909" fillOpacity="0.85"/>
              <circle cx="8" cy="10.5" r="1.2" fill="#C9A227"/>
              <circle cx="11" cy="10.5" r="1.2" fill="#C9A227"/>
              <circle cx="14" cy="10.5" r="1.2" fill="#C9A227"/>
            </svg>
          </button>
        </div>
      )}

      {open && <ChatOverlay preview={preview} onClose={() => setOpen(false)} />}
    </>
  )
}
