'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

// Lazy-load the heavy overlay only when opened
const ChatOverlay = dynamic(() => import('./ChatOverlay'), { ssr: false })

export default function ChatBubble() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-[#C9A227] text-[#0D0D0D] text-sm font-semibold px-4 py-3 rounded-full shadow-lg hover:bg-[#d4ac2d] transition-all group"
        >
          <div className="w-5 h-5 rounded-full border border-[#0D0D0D]/40 flex-shrink-0 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-[#0D0D0D]" />
          </div>
          <span>Got a question? Ask Gogo</span>
          <span className="text-lg leading-none group-hover:translate-x-0.5 transition-transform">↗</span>
        </button>
      )}

      {/* Full-screen overlay */}
      {open && <ChatOverlay onClose={() => setOpen(false)} />}
    </>
  )
}
