import { redirect } from 'next/navigation'
import Link from 'next/link'
import MemberDocumentUpload from '@/components/dashboard/MemberDocumentUpload'
import { resolvePortalContext } from '@/lib/portalContext'

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

// Short file-kind label for the icon box (PDF / IMG / DOC / etc.).
function kindLabel(doc: MemberDocument): string {
  const mime = doc.mime_type ?? ''
  if (isImage(doc)) return 'IMG'
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('word') || mime.includes('document')) return 'DOC'
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return 'XLS'
  const ext = (doc.file_name ?? '').split('.').pop() ?? ''
  return ext ? ext.slice(0, 4).toUpperCase() : 'FILE'
}

export default async function MemberDocumentsPage() {
  const ctx = await resolvePortalContext()
  if (!ctx.user) redirect('/login')
  if (!ctx.member) redirect('/dashboard')
  const member = ctx.member as { id: string }

  // The resolved member's documents (RLS on the normal path).
  const { data: docs } = await ctx.db
    .from('member_documents')
    .select('id, doc_type, title, file_name, mime_type, uploaded_at')
    .eq('member_id', member.id)
    .order('doc_type', { ascending: true })
    .order('uploaded_at', { ascending: false })

  const documents = (docs ?? []) as MemberDocument[]

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="p-4 sm:p-8 max-w-5xl tc-rise">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">Your Files</p>
          <h1 className="text-[var(--text)] font-serif text-[38px]">My Documents</h1>
          <p className="text-[var(--text-3)] text-sm mt-1">
            Your contract, DISC, application and onboarding files. Upload your own or download what your team adds.
          </p>
        </div>
        <MemberDocumentUpload memberId={member.id} />
      </div>

      {documents.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-[18px] p-10 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ border: '1px solid var(--gold-line)', background: 'var(--gold-soft)' }}
          >
            <span className="text-[var(--gold)] text-2xl">◈</span>
          </div>
          <h2 className="text-[var(--text)] font-serif text-xl mb-3">No Documents Yet</h2>
          <p className="text-[var(--text-3)] text-sm leading-relaxed max-w-sm mx-auto">
            Upload your contract, DISC, application or headshot using the button above — or they&apos;ll appear here once your team adds them.
          </p>
        </div>
      ) : (
        <div className="border border-[var(--border-color)] rounded-[18px] bg-[var(--surface)] overflow-hidden">
          {documents.map((doc) => (
            <a
              key={doc.id}
              href={`/api/member-documents/${doc.id}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-[18px] px-[26px] py-[18px] border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--gold-soft)] transition-colors"
            >
              {isImage(doc) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/member-documents/${doc.id}/download`}
                  alt={doc.title}
                  className="w-[34px] h-[42px] rounded-[5px] object-cover border border-[var(--border-2)] flex-none"
                />
              ) : (
                <div
                  className="w-[34px] h-[42px] rounded-[5px] border flex items-end justify-center pb-[5px] flex-none"
                  style={{ borderColor: 'var(--border-2)', background: 'var(--surface-2)' }}
                >
                  <span className="text-[8px] tracking-[0.06em] text-[var(--text-3)]">{kindLabel(doc)}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-[var(--text)] truncate">{doc.title}</p>
                <p className="text-[12px] text-[var(--text-3)] mt-[3px] truncate">
                  {TYPE_LABEL[doc.doc_type] ?? doc.doc_type} · Uploaded {fmtDate(doc.uploaded_at)}
                </p>
              </div>
              <span className="text-[12px] text-[var(--gold-text)] flex-none group-hover:text-[var(--gold)] transition-colors">Download ↓</span>
            </a>
          ))}
        </div>
      )}

      <div className="mt-10">
        <Link href="/dashboard" className="text-xs text-[var(--text-3)] hover:text-[#C9A227] transition-colors">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}
