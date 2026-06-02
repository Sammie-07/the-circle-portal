'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const ChatOverlay = dynamic(() => import('./ChatOverlay'), { ssr: false })

export default function ChatBubble() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Ask Gogo"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-3 bg-[#C9A227] rounded-full shadow-xl hover:shadow-[0_0_28px_rgba(201,162,39,0.45)] hover:bg-[#d4ac2d] transition-all duration-200 pl-4 pr-5 py-3"
        >
          {/* Icon */}
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 2C6.03 2 2 5.8 2 10.5c0 2.1.82 4.02 2.17 5.5L3 20l4.35-1.4A9.3 9.3 0 0 0 11 19c4.97 0 9-3.8 9-8.5S15.97 2 11 2Z" fill="#0D0D0D" fillOpacity="0.85"/>
              <circle cx="8" cy="10.5" r="1.2" fill="#C9A227"/>
              <circle cx="11" cy="10.5" r="1.2" fill="#C9A227"/>
              <circle cx="14" cy="10.5" r="1.2" fill="#C9A227"/>
            </svg>
          </div>
          {/* Label */}
          <div className="flex flex-col leading-tight">
            <span className="text-[#0D0D0D] text-[10px] font-medium opacity-70">Got a question?</span>
            <span className="text-[#0D0D0D] text-sm font-bold">Ask Gogo</span>
          </div>
        </button>
      )}

      {open && <ChatOverlay onClose={() => setOpen(false)} />}
    </>
  )
}
