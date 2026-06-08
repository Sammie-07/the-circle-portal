'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProfilePhotoUploadProps {
  memberId: string
  hasPhoto: boolean
}

export default function ProfilePhotoUpload({ memberId, hasPhoto }: ProfilePhotoUploadProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')

    try {
      const fd = new FormData()
      fd.append('member_id', memberId)
      fd.append('doc_type', 'headshot')
      fd.append('title', 'Headshot')
      fd.append('file', file)

      const res = await fetch('/api/member-documents', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Upload failed')
        return
      }
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs text-[#C9A227] border border-[#C9A227]/40 rounded px-3 py-1.5 hover:bg-[#C9A227]/10 transition-colors disabled:opacity-40"
      >
        {uploading ? 'Uploading…' : hasPhoto ? 'Change photo' : 'Add photo'}
      </button>
      {error && <span className="text-[#CC1F1F] text-xs">{error}</span>}
    </div>
  )
}
