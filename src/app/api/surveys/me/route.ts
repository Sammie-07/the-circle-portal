import { createClient } from '@/lib/supabase/server'
import { NextResponse, after } from 'next/server'
import { SURVEY_QUESTIONS, isSurveyComplete, type SurveyAnswers } from '@/lib/survey-questions'
import { windowForMonth } from '@/lib/survey'
import { getSurveyAllowlist, isEmailInSurveyRollout } from '@/lib/settings'
import { generateBatch } from '@/lib/content/generate-batch'

export const runtime = 'nodejs'
export const maxDuration = 60

function monthLabel(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

// GET /api/surveys/me — the current month's survey for the logged-in member:
// whether it's open, the questions, and any saved (draft/complete) answers.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('members')
    .select('id, status')
    .eq('email', user.email)
    .maybeSingle()

  // No member record (e.g. staff) or inactive → nothing to prompt.
  if (!member || member.status !== 'active') return NextResponse.json({ due: false })

  // Rollout gate: during limited testing only allowlisted emails see the survey.
  const allowlist = await getSurveyAllowlist()
  if (!isEmailInSurveyRollout(user.email, allowlist)) return NextResponse.json({ due: false })

  const now = new Date()
  const win = windowForMonth(now)

  // The survey only activates once an admin has sent it for this month (manual
  // send from Admin → Settings). Auto-sending is off pending review.
  const { data: period } = await supabase
    .from('survey_periods')
    .select('sent_at')
    .eq('period_month', win.periodMonth)
    .maybeSingle()
  const open = !!period?.sent_at

  const { data: response } = await supabase
    .from('survey_responses')
    .select('answers, status, completed_at')
    .eq('member_id', member.id)
    .eq('period_month', win.periodMonth)
    .maybeSingle()

  const answers = (response?.answers as SurveyAnswers) ?? {}
  const status = response?.status ?? 'none'
  const due = open && status !== 'complete'

  return NextResponse.json({
    due,
    open,
    periodMonth: win.periodMonth,
    monthLabel: monthLabel(win.periodMonth),
    status,
    answers,
    questions: SURVEY_QUESTIONS,
  })
}

// PATCH /api/surveys/me — autosave a draft, or submit the completed survey.
// Body: { answers: {...}, submit?: boolean }
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('members')
    .select('id, status')
    .eq('email', user.email)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  let body: { answers?: unknown; submit?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const incoming = (body.answers && typeof body.answers === 'object' ? body.answers : {}) as SurveyAnswers
  // Keep only known question keys.
  const answers: SurveyAnswers = {}
  for (const q of SURVEY_QUESTIONS) {
    if (q.key in incoming) answers[q.key] = incoming[q.key]
  }

  const submit = body.submit === true
  if (submit && !isSurveyComplete(answers)) {
    return NextResponse.json({ error: 'Please answer every question before submitting.' }, { status: 422 })
  }

  const now = new Date()
  const win = windowForMonth(now)
  const nowIso = now.toISOString()

  const row = {
    member_id: member.id,
    period_month: win.periodMonth,
    answers,
    status: submit ? 'complete' : 'draft',
    completed_at: submit ? nowIso : null,
    updated_at: nowIso,
  }

  const { data, error } = await supabase
    .from('survey_responses')
    .upsert(row, { onConflict: 'member_id,period_month' })
    .select('answers, status, completed_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // A completed survey is fresh member activity — auto-generate content from it
  // in the background (never blocks the member's submit).
  if (submit && data.status === 'complete') {
    after(async () => {
      await generateBatch({ cap: 3, memberId: member.id, force: true }).catch(() => {})
    })
  }

  return NextResponse.json({ ok: true, status: data.status, answers: data.answers })
}
