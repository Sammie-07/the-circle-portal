import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAchievementTester, achievementsLive } from '@/lib/achievements'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// GET /api/achievements/me — achievements for the logged-in member.
//   default        → UNSEEN only (drives the auto-popup confetti gate)
//   ?scope=all     → the member's full history (drives the notification bell)
// Always returns `unread` (unexperienced = seen_at null) for the bell badge and
// `isTester` (reveals the tester-only Replay button + returns all on default).
// Real members get nothing until the feature is flipped live.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ achievements: [], isTester: false, unread: 0 })

  const { data: member } = await supabase
    .from('members')
    .select('id, status')
    .eq('email', user.email)
    .maybeSingle()
  if (!member || member.status !== 'active') return NextResponse.json({ achievements: [], isTester: false, unread: 0 })

  const isTester = isAchievementTester(user.email)
  if (!isTester) {
    const live = await achievementsLive(createAdminClient())
    if (!live) return NextResponse.json({ achievements: [], isTester: false, unread: 0 })
  }

  const scopeAll = new URL(request.url).searchParams.get('scope') === 'all'

  const { count: unread } = await supabase
    .from('achievements')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', member.id)
    .is('seen_at', null)

  let q = supabase
    .from('achievements')
    .select('id, achievement_key, title, body, emoji, tier, badge_key, created_at, seen_at')
    .eq('member_id', member.id)
    .order('created_at', { ascending: true })

  // Full history for the bell (and for testers, who replay the whole set);
  // just the unseen ones for the auto-popup.
  q = (isTester || scopeAll) ? q.limit(60) : q.is('seen_at', null).is('dismissed_at', null).limit(6)

  const { data } = await q
  const achievements = (data ?? []).map((a) => ({
    id: a.id,
    key: a.achievement_key,
    title: a.title,
    body: a.body,
    emoji: a.emoji,
    tier: a.tier,
    badgeKey: a.badge_key,
    seen: !!a.seen_at,
  }))
  return NextResponse.json({ achievements, isTester, unread: unread ?? 0 })
}

// POST /api/achievements/me — mark achievements seen after the member views the
// celebration. Body: { ids: string[] }. Scoped to the member's own rows.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  let ids: unknown = []
  try {
    ids = (await request.json())?.ids
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ ok: true })

  // Admin client to stamp seen_at, but scoped to this member's own rows only.
  const admin = createAdminClient()
  await admin
    .from('achievements')
    .update({ seen_at: new Date().toISOString() })
    .eq('member_id', member.id)
    .in('id', ids.filter((i): i is string => typeof i === 'string'))

  return NextResponse.json({ ok: true })
}
