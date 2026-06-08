'use client'

export default function TeamError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-8 max-w-3xl">
      <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
      <h1 className="text-[var(--text)] font-serif text-2xl mb-3">Team</h1>
      <div className="bg-[var(--surface)] border border-[#CC1F1F]/40 rounded p-5">
        <p className="text-[var(--text)] text-sm mb-2">
          Something went wrong loading the team panel.
        </p>
        <p className="text-[var(--text-3)] text-xs font-mono break-words mb-4">
          {error?.message || 'Unknown error'}
          {error?.digest ? ` (ref: ${error.digest})` : ''}
        </p>
        <button
          onClick={reset}
          className="text-xs uppercase tracking-wider border border-[var(--border-color)] hover:border-[#C9A227] rounded px-3 py-1.5 text-[var(--text-2)] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
