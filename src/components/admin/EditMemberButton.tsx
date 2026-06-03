'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface EditableMember {
  id: string
  name: string
  email: string
  cohort: string | null
  status: string | null
  phone: string | null
  city: string | null
  instagram: string | null
  website: string | null
  bio: string | null
}

export default function EditMemberButton({ member }: { member: EditableMember }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(member.name ?? '')
  const [email, setEmail] = useState(member.email ?? '')
  const [cohort, setCohort] = useState(member.cohort ?? '')
  const [status, setStatus] = useState(member.status ?? 'active')
  const [phone, setPhone] = useState(member.phone ?? '')
  const [city, setCity] = useState(member.city ?? '')
  const [instagram, setInstagram] = useState(member.instagram ?? '')
  const [website, setWebsite] = useState(member.website ?? '')
  const [bio, setBio] = useState(member.bio ?? '')

  function reset() {
    setName(member.name ?? '')
    setEmail(member.email ?? '')
    setCohort(member.cohort ?? '')
    setStatus(member.status ?? 'active')
    setPhone(member.phone ?? '')
    setCity(member.city ?? '')
    setInstagram(member.instagram ?? '')
    setWebsite(member.website ?? '')
    setBio(member.bio ?? '')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Only send changed fields
    const next = { name, email, cohort, status, phone, city, instagram, website, bio }
    const original: Record<string, string> = {
      name: member.name ?? '',
      email: member.email ?? '',
      cohort: member.cohort ?? '',
      status: member.status ?? 'active',
      phone: member.phone ?? '',
      city: member.city ?? '',
      instagram: member.instagram ?? '',
      website: member.website ?? '',
      bio: member.bio ?? '',
    }
    const changed: Record<string, string> = {}
    for (const [key, value] of Object.entries(next)) {
      if (value !== original[key]) changed[key] = value
    }

    if (Object.keys(changed).length === 0) {
      setOpen(false)
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }

      setOpen(false)
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text)] placeholder-[var(--text-4)] rounded px-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A227]"
  const labelClass = "block text-xs text-[var(--text-2)] uppercase tracking-wider mb-1.5"

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border border-[var(--border-color)] text-[var(--text-2)] text-sm px-4 py-2 rounded hover:border-[#C9A227] hover:text-[var(--text)] transition-colors"
      >
        Edit Profile
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[var(--text)] font-serif text-xl">Edit Profile</h2>
              <button onClick={() => { setOpen(false); reset() }} className="text-[var(--text-3)] hover:text-[var(--text)] text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Cohort</label>
                <input value={cohort} onChange={e => setCohort(e.target.value)} placeholder="May 2026" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>City / Market</label>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Nashville, TN" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Instagram Handle</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-sm">@</span>
                  <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="yourusername" className={inputClass + ' pl-7'} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Website</label>
                <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourwebsite.com" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Short Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} placeholder="A few sentences about them..." className={inputClass + ' resize-none'} />
              </div>

              {error && <p className="text-[#CC1F1F] text-xs">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setOpen(false); reset() }}
                  className="flex-1 border border-[var(--border-color)] text-[var(--text-2)] text-sm py-2.5 rounded hover:border-[var(--border-hover)] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-[#C9A227] text-[#0D0D0D] text-sm font-medium py-2.5 rounded hover:bg-[#d4ac2d] transition-colors disabled:opacity-40">
                  {loading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
