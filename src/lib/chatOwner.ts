import type { SupabaseClient, User } from '@supabase/supabase-js'

const STAFF_ROLES = ['owner', 'admin', 'manager', 'support', 'tech']

/**
 * Who owns an "Ask Gogo" chat session. A session belongs to EITHER a member
 * (matched by email, the historical case) OR a staff profile (Gogo/admins,
 * keyed by auth uid). Staff are checked first, so an internal account that also
 * happens to have a member row is always treated as staff here.
 *
 * `ownerCol` is the chat_sessions column to filter/insert on, so callers can
 * stay agnostic: `.eq(owner.ownerCol, owner.ownerId)`.
 */
export type ChatOwner =
  | { user: User; kind: 'member'; ownerCol: 'member_id'; ownerId: string }
  | { user: User; kind: 'staff'; ownerCol: 'staff_id'; ownerId: string }

export async function resolveChatOwner(
  supabase: SupabaseClient
): Promise<ChatOwner | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (STAFF_ROLES.includes(profile?.role ?? '')) {
    return { user, kind: 'staff', ownerCol: 'staff_id', ownerId: user.id }
  }

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('email', user.email)
    .single()

  if (member) {
    return { user, kind: 'member', ownerCol: 'member_id', ownerId: member.id }
  }

  return null
}
