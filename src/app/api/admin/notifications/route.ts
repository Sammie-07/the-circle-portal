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
// Celebration items are enriched with whether the achievement can be turned into
// a post (small tier, not already drafted) so the bell can show a "Make post"
// button — milestones auto-post, small ones are opt-in.
export async function GET() {
  if (!(await requireStaff())) return NextResponse.json({ notifications: [], unread: 0 })
  const admin = createAdminClient()

  const [{ data }, { count }] = await Promise.all([
    admin
      .from('admin_notifications')
      .select('id, type, emoji, title, body, member_id, achievement_id, post_id, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(30),
    admin.from('admin_notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ])

  const notifications = data ?? []

  // Enrich celebration rows: attach tier + whether a post already exists.
  const achIds = notifications.filter((n) => n.type === 'celebration' && n.achievement_id).map((n) => n.achievement_id)
  const tierById = new Map<string, string>()
  const postedKeys = new Set<string>()
  if (achIds.length) {
    const { data: achs } = await admin
      .from('achievements')
      .select('id, tier, member_id, achievement_key')
      .in('id', achIds)
    const keys: string[] = []
    for (const a of achs ?? []) {
      tierById.set(a.id, a.tier)
      keys.push(`achv:${a.member_id}:${a.achievement_key}`)
    }
    if (keys.length) {
      const { data: posts } = await admin.from('content_posts').select('dedupe_key').in('dedupe_key', keys)
      for (const p of posts ?? []) if (p.dedupe_key) postedKeys.add(p.dedupe_key as string)
    }
    // second pass to compute posted per achievement
    for (const a of achs ?? []) {
      if (postedKeys.has(`achv:${a.member_id}:${a.achievement_key}`)) tierById.set(`posted:${a.id}`, '1')
    }
  }

  const enriched = notifications.map((n) => {
    if (n.type !== 'celebration' || !n.achievement_id) return { ...n, tier: null, canMakePost: false, posted: false }
    const tier = tierById.get(n.achievement_id) ?? null
    const posted = tierById.get(`posted:${n.achievement_id}`) === '1'
    return { ...n, tier, posted, canMakePost: tier === 'small' && !posted }
  })

  return NextResponse.json({ notifications: enriched, unread: count ?? 0 })
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
