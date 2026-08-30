import { createClient } from '@/lib/supabase/server'
import SurveyProgress from '@/components/admin/SurveyProgress'
import { baselineFromApplication } from '@/lib/survey'
import { getSurveyAllowlist, isEmailInSurveyRollout } from '@/lib/settings'
import type { SurveyAnswers } from '@/lib/survey-questions'

export const dynamic = 'force-dynamic'

interface RawResponse {
  period_month: string
  answers: SurveyAnswers
  status: string
  completed_at: string | null
}

export default async function AdminProgressPage() {
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('members')
    .select(`
      id, name, email, status, is_internal,
      survey_responses ( period_month, answers, status, completed_at )
    `)
    .order('name', { ascending: true })

  // Intake applications (keyed by email) → month-1 baselines.
  const { data: apps } = await supabase.from('applications').select('email, data')
  const appByEmail = new Map<string, Record<string, unknown>>(
    (apps ?? []).map((a) => [
      String(a.email).trim().toLowerCase(),
      (a.data as Record<string, unknown>) ?? {},
    ])
  )

  // Normally hide internal/test accounts — but while a limited-rollout allowlist
  // is active, show the allowlisted test accounts too (that's who we're testing
  // with). Once the allowlist is cleared for full launch, internal accounts hide.
  const allowlist = await getSurveyAllowlist()
  const isAllowlistedInternal = (email: string) =>
    allowlist !== null && isEmailInSurveyRollout(email, allowlist)
  const shaped = (members ?? [])
    .filter((m) => !m.is_internal || isAllowlistedInternal(m.email as string))
    .map((m) => {
      const responses = ((m.survey_responses ?? []) as RawResponse[])
        .filter((r) => r.status === 'complete')
        .slice()
        .sort((a, b) => a.period_month.localeCompare(b.period_month))
        .map((r) => ({
          periodMonth: r.period_month,
          answers: r.answers ?? {},
          completedAt: r.completed_at,
        }))
      const baseline = baselineFromApplication(appByEmail.get(String(m.email).trim().toLowerCase()))
      return {
        id: m.id as string,
        name: m.name as string,
        status: m.status as string,
        responses,
        baseline,
      }
    })

  return (
    <div className="p-4 sm:p-8 max-w-7xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">Progress</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          Monthly progress-check answers for every member, side by side over time.
          Indicators compare each month to the one before; the first month compares
          to intake where we have it.
        </p>
      </div>

      <SurveyProgress members={shaped} />
    </div>
  )
}
