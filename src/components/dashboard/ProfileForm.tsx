'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'

interface Member {
  id: string
  name: string
  email: string
  phone: string | null
  city: string | null
  instagram: string | null
  website: string | null
  bio: string | null
  cohort: string | null
  join_date: string
}

interface ProfileFormProps {
  member: Member
  loginEmail: string
}

export default function ProfileForm({ member, loginEmail }: ProfileFormProps) {
  const [name, setName] = useState(member.name ?? '')
  const [phone, setPhone] = useState(member.phone ?? '')
  const [city, setCity] = useState(member.city ?? '')
  const [instagram, setInstagram] = useState(member.instagram ?? '')
  const [website, setWebsite] = useState(member.website ?? '')
  const [bio, setBio] = useState(member.bio ?? '')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, city, instagram, website, bio }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        toast(data.error ?? 'Could not save your profile', 'error')
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      toast('Profile saved')
    } catch {
      setError('Network error — please try again')
      toast('Network error — please try again', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227] transition-colors"
  const labelClass = "block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5"

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label className={labelClass}>Full Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your full name"
          className={inputClass}
        />
      </div>

      {/* Login email — read only */}
      <div>
        <label className={labelClass}>Login Email</label>
        <input
          value={loginEmail}
          readOnly
          className="w-full bg-[var(--input-bg)] border border-[var(--surface)] text-[var(--text-3)] rounded px-3 py-2.5 text-sm cursor-not-allowed"
        />
        <p className="text-[var(--text-4)] text-xs mt-1.5">To change your login email, contact your Circle admin.</p>
      </div>

      {/* Phone */}
      <div>
        <label className={labelClass}>Phone</label>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+1 (555) 000-0000"
          type="tel"
          className={inputClass}
        />
      </div>

      {/* City / Market */}
      <div>
        <label className={labelClass}>City / Market</label>
        <input
          value={city}
          onChange={e => setCity(e.target.value)}
          placeholder="e.g. Nashville, TN"
          className={inputClass}
        />
      </div>

      <div className="h-px bg-[var(--surface)]" />

      {/* Instagram */}
      <div>
        <label className={labelClass}>Instagram Handle</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-sm">@</span>
          <input
            value={instagram}
            onChange={e => setInstagram(e.target.value)}
            placeholder="yourusername"
            className={inputClass + ' pl-7'}
          />
        </div>
      </div>

      {/* Website */}
      <div>
        <label className={labelClass}>Website</label>
        <input
          value={website}
          onChange={e => setWebsite(e.target.value)}
          placeholder="https://yourwebsite.com"
          type="url"
          className={inputClass}
        />
      </div>

      <div className="h-px bg-[var(--surface)]" />

      {/* Bio */}
      <div>
        <label className={labelClass}>Short Bio</label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          rows={4}
          placeholder="A few sentences about you, your market, and what you do..."
          className={inputClass + ' resize-none'}
        />
        <p className="text-[var(--text-4)] text-xs mt-1.5">{bio.length} characters</p>
      </div>

      {error && (
        <p className="text-[#CC1F1F] text-sm">{error}</p>
      )}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-[#C9A227] text-[#0D0D0D] text-sm font-medium px-6 py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && (
          <span className="text-green-400 text-sm">Changes saved ✓</span>
        )}
      </div>
    </form>
  )
}
