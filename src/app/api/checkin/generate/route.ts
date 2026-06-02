import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

// POST — generate (or refresh) a check-in link for a member
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  // Verify member exists
  const { data: member } = await supabase.from('members').select('id, name').eq('id', memberId).single()
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const weekOf = getMondayOfCurrentWeek()
  const token = randomUUID()

  // Upsert: one checkin per member per week. Refreshing replaces the token.
  const { data: checkin, error } = await supabase
    .from('weekly_checkins')
    .upsert(
      { member_id: memberId, week_of: weekOf, token, submitted_at: null, comments: null },
      { onConflict: 'member_id,week_of', ignoreDuplicates: false }
    )
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'
  return NextResponse.json({ url: `${appUrl}/checkin/${checkin.token}` })
}

function getMondayOfCurrentWeek(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 1=Mon...6=Sat
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  return monday.toISOString().split('T')[0]
}
