import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ChatMonitor from '@/components/admin/ChatMonitor'

const STAFF_ROLES = ['owner', 'admin', 'manager', 'support', 'tech']

interface RawSession {
  id: string
  member_id: string | null
  title: string
  created_at: string
  updated_at: string
  member:
    | { name: string | null; email: string | null; is_internal: boolean | null }
    | { name: string | null; email: string | null; is_internal: boolean | null }[]
    | null
  messages: { count: number }[] | null
}

export default async function AdminChatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!STAFF_ROLES.includes(profile?.role ?? '')) redirect('/dashboard')

  // Chat tables are owner-only under RLS (no admin policy), so read via service role.
  // Only member-owned sessions; staff/internal/test accounts are excluded so the
  // monitor shows real members only (mirrors the Tuesday digest's is_internal filter).
  const admin = createAdminClient()
  const { data: raw } = await admin
    .from('chat_sessions')
    .select('id, member_id, title, created_at, updated_at, member:members(name, email, is_internal), messages:chat_messages(count)')
    .not('member_id', 'is', null)
    .order('updated_at', { ascending: false })

  const sessions = ((raw ?? []) as RawSession[])
    .map((s) => {
      const m = Array.isArray(s.member) ? s.member[0] : s.member
      if (!m || m.is_internal) return null // drop staff/internal/test accounts
      return {
        id: s.id,
        memberId: s.member_id ?? 'unknown',
        title: s.title,
        updatedAt: s.updated_at,
        memberName: m.name ?? m.email ?? 'Unknown member',
        messageCount: s.messages?.[0]?.count ?? 0,
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="mb-8">
        <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">Admin</p>
        <h1 className="text-[var(--text)] font-serif text-[38px]">Ask Gogo Chats</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          Every member conversation with Ask Gogo. Read-only, for monitoring the answers the Brain
          is giving and checking accuracy.
        </p>
      </div>

      <ChatMonitor sessions={sessions} />
    </div>
  )
}
