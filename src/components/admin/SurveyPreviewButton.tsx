'use client'

import { useState } from 'react'
import SurveyGate from '@/components/dashboard/SurveyGate'

// Staff-only affordance: opens the exact member survey popup in preview mode
// (fetches nothing, saves nothing, dismissible) so the team can see what members
// fill out without disturbing any real data.
export default function SurveyPreviewButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-[var(--border-color)] text-[var(--text-2)] text-sm px-4 py-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Preview member survey
      </button>
      {open && <SurveyGate preview onClose={() => setOpen(false)} />}
    </>
  )
}
