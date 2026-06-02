import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CheckinForm from './CheckinForm'

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Look up the check-in
  const { data: checkin } = await supabase
    .from('weekly_checkins')
    .select('id, member_id, week_of, submitted_at')
    .eq('token', token)
    .single()

  if (!checkin) notFound()

  // Get member name
  const { data: member } = await supabase
    .from('members')
    .select('name')
    .eq('id', checkin.member_id)
    .single()

  if (!member) notFound()

  // Get homework items due this week or overdue and not yet completed
  // Show: all incomplete items with due_date <= end of this week, plus already-completed items for this week
  const weekEnd = getWeekEnd(checkin.week_of)

  const { data: homework } = await supabase
    .from('homework')
    .select('id, title, description, completed, due_date')
    .eq('member_id', checkin.member_id)
    .or(`due_date.lte.${weekEnd},completed.eq.true`)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })

  const weekLabel = getWeekLabel(checkin.week_of)

  return (
    <CheckinForm
      token={token}
      memberName={member.name}
      weekLabel={weekLabel}
      homework={homework ?? []}
      alreadySubmitted={!!checkin.submitted_at}
    />
  )
}

function getWeekEnd(weekOf: string): string {
  // weekOf is Monday; end of week = Sunday
  const d = new Date(weekOf + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 6)
  return d.toISOString().split('T')[0]
}

function getWeekLabel(weekOf: string): string {
  const d = new Date(weekOf + 'T00:00:00Z')
  const friday = new Date(d)
  friday.setUTCDate(d.getUTCDate() + 4)
  return friday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
