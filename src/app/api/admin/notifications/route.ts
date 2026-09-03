import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

async function requireStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return STAFF.includes(profile?.role ?? '') ? user : null
}

// GET /api/admin/notifications — recent celebration/post feed + unread count.
export async function GET() {
  if (!(await requireStaff())) return NextResponse.json({ notifications: [], unread: 0 })
  const admin = createAdminClient()

  const [{ data }, { count }] = await Promise.all([
    admin
      .from('admin_notifications')
      .select('id, type, emoji, title, body, member_id, post_id, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(30),
    admin.from('admin_notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ])

  return NextResponse.json({ notifications: data ?? [], unread: count ?? 0 })
}

// POST /api/admin/notifications — mark read. Body: { all: true } or { ids: [...] }.
export async function POST(request: Request) {
  if (!(await requireStaff())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()

  let body: { all?: boolean; ids?: unknown } = {}
  try { body = await request.json() } catch { /* empty body = mark all */ body = { all: true } }

  const nowIso = new Date().toISOString()
  if (body.all || !Array.isArray(body.ids)) {
    await admin.from('admin_notifications').update({ read_at: nowIso }).is('read_at', null)
  } else {
    const ids = body.ids.filter((i): i is string => typeof i === 'string')
    if (ids.length) await admin.from('admin_notifications').update({ read_at: nowIso }).in('id', ids)
  }
  return NextResponse.json({ ok: true })
}
