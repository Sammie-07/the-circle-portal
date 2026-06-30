import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ChatMonitor from '@/components/admin/ChatMonitor'

const STAFF_ROLES = ['owner', 'admin', 'manager', 'support', 'tech']

interface RawSession {
  id: string
  title: string
  created_at: string
  updated_at: string
  member: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null
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
  // Only member-owned sessions (staff test chats are excluded from monitoring).
  const admin = createAdminClient()
  const { data: raw } = await admin
    .from('chat_sessions')
    .select('id, title, created_at, updated_at, member:members(name, email), messages:chat_messages(count)')
    .not('member_id', 'is', null)
    .order('updated_at', { ascending: false })

  const sessions = ((raw ?? []) as RawSession[]).map((s) => {
    const m = Array.isArray(s.member) ? s.member[0] : s.member
    return {
      id: s.id,
      title: s.title,
      updatedAt: s.updated_at,
      memberName: m?.name ?? m?.email ?? 'Unknown member',
      messageCount: s.messages?.[0]?.count ?? 0,
    }
  })

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">Ask Gogo Chats</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          Every member conversation with Ask Gogo. Read-only, for monitoring the answers the Brain
          is giving and checking accuracy.
        </p>
      </div>

      <ChatMonitor sessions={sessions} />
    </div>
  )
}
