'use client'

import { useState } from 'react'

interface Props {
  profileId: string
  email: string
  name: string
}

export default function RemoveTeamMemberButton({ profileId, email, name }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRemove() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin-invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, email }),
      })
      if (res.ok) window.location.reload()
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-3)] text-xs">Remove {name.split(' ')[0]}?</span>
        <button
          onClick={handleRemove}
          disabled={loading}
          className="text-[#CC1F1F] text-xs font-medium hover:underline disabled:opacity-40"
        >
          {loading ? 'Removing…' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[var(--text-3)] text-xs hover:text-[var(--text)]"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-[var(--text-4)] text-xs hover:text-[#CC1F1F] transition-colors"
      title="Remove from team"
    >
      Remove
    </button>
  )
}
