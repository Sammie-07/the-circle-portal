import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendMonthlySurvey } from '@/lib/survey-send'

export const runtime = 'nodejs'
export const maxDuration = 60

const STAFF = ['owner', 'admin', 'manager']

// POST /api/surveys/send — admin action: send this month's progress check now
// (emails eligible members + activates the in-portal popup). Body: { force? }.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { force?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body is fine */
  }
  const force = body.force === true

  const result = await sendMonthlySurvey(new Date(), { force })

  if (result.alreadySent && !force) {
    return NextResponse.json({ alreadySent: true, month: result.month, monthName: result.monthName })
  }
  return NextResponse.json({ ok: true, ...result })
}
