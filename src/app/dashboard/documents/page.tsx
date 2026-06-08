import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const metadata = { title: 'My Documents · The Circle' }

const TYPE_LABEL: Record<string, string> = {
  contract: 'Contract',
  disc: 'DISC Assessment',
  application: 'Application',
  headshot: 'Headshot',
  other: 'Other',
}

interface MemberDocument {
  id: string
  doc_type: string
  title: string
  file_name: string | null
  mime_type: string | null
  uploaded_at: string
}

function isImage(doc: MemberDocument): boolean {
  if (doc.doc_type === 'headshot') return true
  return (doc.mime_type ?? '').startsWith('image/')
}

export default async function MemberDocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!member) redirect('/dashboard')

  // RLS allows members to SELECT their own documents.
  const { data: docs } = await supabase
    .from('member_documents')
    .select('id, doc_type, title, file_name, mime_type, uploaded_at')
    .eq('member_id', member.id)
    .order('doc_type', { ascending: true })
    .order('uploaded_at', { ascending: false })

  const documents = (docs ?? []) as MemberDocument[]

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Your Files</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">My Documents</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          Your contract, DISC, application and onboarding files.
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {documents.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded p-10 text-center">
          <div className="w-14 h-14 rounded-full border border-[#C9A227]/30 bg-[#C9A227]/5 flex items-center justify-center mx-auto mb-5">
            <span className="text-[#C9A227] text-2xl">◈</span>
          </div>
          <h2 className="text-[var(--text)] font-serif text-xl mb-3">No Documents Yet</h2>
          <p className="text-[var(--text-3)] text-sm leading-relaxed max-w-sm mx-auto">
            Your documents will appear here once your team adds them.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-start justify-between gap-4 bg-[var(--surface)] border border-[var(--border-color)] rounded px-4 py-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                {isImage(doc) && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/member-documents/${doc.id}/download`}
                    alt={doc.title}
                    className="w-12 h-12 rounded object-cover border border-[var(--border-color)] flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-[#C9A227] border border-[#C9A227]/30 rounded px-1.5 py-0.5">
                      {TYPE_LABEL[doc.doc_type] ?? doc.doc_type}
                    </span>
                    <p className="text-[var(--text)] font-medium text-sm truncate">{doc.title}</p>
                  </div>
                  {doc.file_name && (
                    <p className="text-[var(--text-3)] text-xs mt-1 truncate">{doc.file_name}</p>
                  )}
                  <p className="text-[var(--text-3)] text-xs mt-0.5">Uploaded {fmtDate(doc.uploaded_at)}</p>
                </div>
              </div>
              <a
                href={`/api/member-documents/${doc.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-[var(--border-color)] text-[var(--text-2)] text-xs px-3 py-1.5 rounded hover:border-[#C9A227] hover:text-[var(--text)] transition-colors flex-shrink-0"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <Link href="/dashboard" className="text-xs text-[var(--text-3)] hover:text-[#C9A227] transition-colors">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}
