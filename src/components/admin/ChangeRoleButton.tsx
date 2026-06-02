'use client'

import { useState } from 'react'

type TeamRole = 'admin' | 'manager' | 'support'

const ROLE_LABELS: Record<TeamRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  support: 'Support',
}

interface Props {
  profileId: string
  currentRole: TeamRole
  canChangeAdmins: boolean // only owner can change admin roles
}

export default function ChangeRoleButton({ profileId, currentRole, canChangeAdmins }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState<TeamRole>(currentRole)
  const [saved, setSaved] = useState(false)

  // Admins can only change manager/support roles
  if (currentRole === 'admin' && !canChangeAdmins) return null

  async function save(newRole: TeamRole) {
    if (newRole === role) { setOpen(false); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/team/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setRole(newRole)
        setSaved(true)
        setTimeout(() => { setSaved(false); window.location.reload() }, 1000)
      }
    } finally {
      setSaving(false)
      setOpen(false)
    }
  }

  if (saved) return <span className="text-green-400 text-xs">Saved ✓</span>

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        className="text-xs border border-[var(--border-color)] text-[var(--text-2)] px-2.5 py-1 rounded hover:border-[#C9A227] hover:text-[#C9A227] transition-all disabled:opacity-40 flex items-center gap-1.5"
      >
        {saving ? 'Saving…' : `${ROLE_LABELS[role]} ↕`}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--surface)] border border-[var(--border-color)] rounded shadow-xl min-w-[140px]">
            {(['admin', 'manager', 'support'] as TeamRole[])
              .filter(r => r !== 'admin' || canChangeAdmins)
              .map(r => (
                <button
                  key={r}
                  onClick={() => save(r)}
                  className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                    r === role
                      ? 'text-[#C9A227] bg-[#C9A227]/8'
                      : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {ROLE_LABELS[r]}
                  {r === role && ' ✓'}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
