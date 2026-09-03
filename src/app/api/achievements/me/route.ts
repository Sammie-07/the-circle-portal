import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// GET /api/achievements/me — unseen achievements for the logged-in member, to
// pop the confetti gate. Returns oldest-first so the celebration order matches
// the order they were earned.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ achievements: [] })

  const { data: member } = await supabase
    .from('members')
    .select('id, status')
    .eq('email', user.email)
    .maybeSingle()
  if (!member || member.status !== 'active') return NextResponse.json({ achievements: [] })

  const { data } = await supabase
    .from('achievements')
    .select('id, achievement_key, title, body, emoji, tier, badge_key, created_at')
    .eq('member_id', member.id)
    .is('seen_at', null)
    .is('dismissed_at', null)
    .order('created_at', { ascending: true })
    .limit(6)

  const achievements = (data ?? []).map((a) => ({
    id: a.id,
    key: a.achievement_key,
    title: a.title,
    body: a.body,
    emoji: a.emoji,
    tier: a.tier,
    badgeKey: a.badge_key,
  }))
  return NextResponse.json({ achievements })
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
