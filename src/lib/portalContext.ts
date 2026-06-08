import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

const STAFF_ROLES = ['owner', 'admin', 'manager', 'support', 'tech']
export const VIEW_AS_COOKIE = 'view_as_member'

export interface PortalContext {
  user: User | null
  isStaff: boolean
  impersonating: boolean
  viewAsName: string | null
  db: SupabaseClient
  // The resolved member record. Shape varies by caller's select(); typed loosely.
  member: Record<string, unknown> | null
}

/** Read just the impersonation cookie value (or null). */
export async function getViewAsCookie(): Promise<string | null> {
  const store = await cookies()
  return store.get(VIEW_AS_COOKIE)?.value || null
}

/**
 * Resolve who the portal should render for.
 *
 * Normal member: db = cookie client (RLS enforced), member = own record by email.
 * Staff (no cookie): isStaff true, member = null (layout redirects to /admin).
 * Staff + cookie: impersonating — db = admin client, member = target by id.
 */
export async function resolvePortalContext(): Promise<PortalContext> {
  const cookieClient = await createClient()
  const {
    data: { user },
  } = await cookieClient.auth.getUser()

  if (!user) {
    return {
      user: null,
      isStaff: false,
      impersonating: false,
      viewAsName: null,
      db: cookieClient,
      member: null,
    }
  }

  const { data: profile } = await cookieClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isStaff = STAFF_ROLES.includes(profile?.role ?? '')
  const viewAs = await getViewAsCookie()

  if (isStaff && viewAs) {
    const admin = createAdminClient()
    const { data: member } = await admin
      .from('members')
      .select('*')
      .eq('id', viewAs)
      .single()

    if (member) {
      return {
        user,
        isStaff: true,
        impersonating: true,
        viewAsName: (member.name as string) ?? null,
        db: admin,
        member,
      }
    }
    // Cookie points at a missing member — fall through to normal path.
  }

  // Normal path: cookie client + RLS, own member by email (may be null for staff).
  const { data: member } = await cookieClient
    .from('members')
    .select('*')
    .eq('email', user.email)
    .maybeSingle()

  return {
    user,
    isStaff,
    impersonating: false,
    viewAsName: null,
    db: cookieClient,
    member,
  }
}
