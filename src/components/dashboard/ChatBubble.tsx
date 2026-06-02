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
          className="fixed bottom-6 right-6 z-40 group flex items-center gap-0 bg-[#C9A227] rounded-full shadow-xl hover:shadow-[0_0_24px_rgba(201,162,39,0.4)] transition-all duration-300 overflow-hidden w-14 h-14 hover:w-52"
        >
          {/* Icon */}
          <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 2C6.03 2 2 5.8 2 10.5c0 2.1.82 4.02 2.17 5.5L3 20l4.35-1.4A9.3 9.3 0 0 0 11 19c4.97 0 9-3.8 9-8.5S15.97 2 11 2Z" fill="#0D0D0D" fillOpacity="0.85"/>
              <circle cx="8" cy="10.5" r="1.2" fill="#C9A227"/>
              <circle cx="11" cy="10.5" r="1.2" fill="#C9A227"/>
              <circle cx="14" cy="10.5" r="1.2" fill="#C9A227"/>
            </svg>
          </div>
          {/* Expanding label */}
          <span className="text-[#0D0D0D] text-sm font-semibold whitespace-nowrap pr-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -ml-1">
            Ask Gogo
          </span>
        </button>
      )}

      {open && <ChatOverlay onClose={() => setOpen(false)} />}
    </>
  )
}
