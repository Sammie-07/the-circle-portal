'use client'

import { useEffect, useState } from 'react'

export default function BlueprintOpener({ blueprintUrl }: { blueprintUrl: string }) {
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    window.open(blueprintUrl, '_blank', 'noopener,noreferrer')
    setOpened(true)
  }, [blueprintUrl])

  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-10 text-center">
      <div className="w-14 h-14 rounded-full border border-[#C9A227]/30 bg-[#C9A227]/5 flex items-center justify-center mx-auto mb-5">
        <span className="text-[#C9A227] text-2xl">◈</span>
      </div>
      <h2 className="text-white font-serif text-xl mb-3">
        {opened ? 'Blueprint Opened ✓' : 'Opening Your Blueprint…'}
      </h2>
      <p className="text-[#555] text-sm leading-relaxed max-w-sm mx-auto mb-8">
        {opened
          ? 'Your blueprint opened in a new tab. If it didn\'t appear, click the button below.'
          : 'Loading your 12-month plan…'}
      </p>
      <a
        href={blueprintUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block bg-[#C9A227] text-[#0D0D0D] font-bold text-sm px-8 py-3 rounded hover:bg-[#d4ac2d] transition-colors"
      >
        Open Blueprint ↗
      </a>
      <p className="text-[#333] text-xs mt-4">Opens in a new tab</p>
    </div>
  )
}
