'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MemberStatusButton({
  memberId,
  memberName,
  status,
}: {
  memberId: string
  memberName: string
  status: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isActive = (status ?? 'active') === 'active'
  const nextStatus = isActive ? 'inactive' : 'active'

  async function handleClick() {
    setError('')
    if (isActive && !confirm(`Deactivate ${memberName}? They will lose access to their portal until reactivated.`)) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="border border-[var(--border-color)] text-[var(--text-2)] text-sm px-4 py-2 rounded hover:border-[#C9A227] hover:text-[var(--text)] transition-colors disabled:opacity-40"
      >
        {loading ? 'Saving…' : isActive ? 'Deactivate' : 'Reactivate'}
      </button>
      {error && <p className="text-[#CC1F1F] text-xs">{error}</p>}
    </div>
  )
}
