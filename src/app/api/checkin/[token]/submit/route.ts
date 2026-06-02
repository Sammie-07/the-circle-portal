import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// POST — submit a weekly check-in (public, authenticated by token only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: checkin } = await supabase
    .from('weekly_checkins')
    .select('id, member_id, submitted_at')
    .eq('token', token)
    .single()

  if (!checkin) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (checkin.submitted_at) return NextResponse.json({ error: 'Already submitted' }, { status: 400 })

  const body = await request.json() as { completedIds: string[]; shownIds: string[]; comments: string }
  const { completedIds = [], shownIds = [], comments = '' } = body

  // For every task shown in the survey, update completion status based on what was checked
  if (shownIds.length > 0) {
    const completedSet = new Set(completedIds)

    // Set checked items as completed
    if (completedIds.length > 0) {
      await supabase
        .from('homework')
        .update({ completed: true })
        .in('id', completedIds)
        .eq('member_id', checkin.member_id)
    }

    // Set unchecked items as not completed
    const uncheckedIds = shownIds.filter(id => !completedSet.has(id))
    if (uncheckedIds.length > 0) {
      await supabase
        .from('homework')
        .update({ completed: false })
        .in('id', uncheckedIds)
        .eq('member_id', checkin.member_id)
    }
  }

  // Mark checkin submitted
  await supabase
    .from('weekly_checkins')
    .update({ submitted_at: new Date().toISOString(), comments: comments || null })
    .eq('id', checkin.id)

  return NextResponse.json({ success: true })
}
