'use client'

import { useEffect, useState } from 'react'
import type { ToastDetail } from '@/lib/toast'

// Mounted once in the root layout. Listens for `circle-toast` window events
// (dispatched by toast() in src/lib/toast.ts) and renders auto-dismissing
// confirmation toasts. Bottom-center so it never collides with the chat bubble.
export default function Toaster() {
  const [toasts, setToasts] = useState<ToastDetail[]>([])

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail
      if (!detail) return
      setToasts((prev) => [...prev, detail])
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== detail.id))
      }, 3200)
    }
    window.addEventListener('circle-toast', onToast)
    return () => window.removeEventListener('circle-toast', onToast)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 px-4 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm shadow-xl border w-full ${
            t.type === 'error'
              ? 'bg-[#0E0E0E] border-[#CC1F1F]/40 text-[#ff8080]'
              : 'bg-[#0E0E0E] border-[#C9A227]/40 text-white'
          }`}
        >
          <span
            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              t.type === 'error' ? 'bg-[#CC1F1F]/20 text-[#CC1F1F]' : 'bg-green-500/20 text-green-400'
            }`}
          >
            {t.type === 'error' ? '✕' : '✓'}
          </span>
          <span className="leading-snug">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
