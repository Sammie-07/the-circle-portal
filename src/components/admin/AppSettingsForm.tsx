'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

export default function AppSettingsForm({ initialAgentCount }: { initialAgentCount: string }) {
  const router = useRouter()
  const [agentCount, setAgentCount] = useState(initialAgentCount)
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamgogo_agent_count: agentCount }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error ?? 'Could not save', 'error'); return }
      toast('Settings saved')
      router.refresh()
    } catch {
      toast('Network error — please try again', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-5 max-w-md">
      <label className="block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5">
        #teamgogo agent count
      </label>
      <input
        value={agentCount}
        onChange={(e) => setAgentCount(e.target.value)}
        inputMode="numeric"
        placeholder="1660"
        className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
      />
      <p className="text-[var(--text-4)] text-xs mt-1.5">
        Used by &ldquo;Ask Gogo&rdquo; in every chat. Update this whenever the team grows, no redeploy needed.
      </p>
      <button
        type="submit"
        disabled={saving}
        className="mt-4 bg-[#C9A227] text-[#090909] text-sm font-medium px-6 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  )
}
