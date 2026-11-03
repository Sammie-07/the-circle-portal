import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { destinationFor, type TestResult } from '@/lib/blueprint-test/results'
import type { Route, Scores } from '@/lib/blueprint-test/score'
import type { FreedomKey } from '@/lib/blueprint-test/questions'
import ResultView from './ResultView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your Blueprint Results · Gogo Bethke', robots: { index: false } }

export default async function BlueprintResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound()

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('blueprint_tests')
    .select('name, scores, bottleneck, route, second_route, result, result_status')
    .eq('token', token)
    .maybeSingle()
  if (!row) notFound()

  const [primary, secondary] = await Promise.all([
    destinationFor(row.route as Route),
    destinationFor(row.second_route as Route | null),
  ])

  return (
    <ResultView
      token={token}
      firstName={(row.name as string).trim().split(/\s+/)[0]}
      scores={row.scores as Scores}
      bottleneck={row.bottleneck as FreedomKey}
      primary={primary!}
      secondary={secondary}
      initialStatus={row.result_status as 'pending' | 'ready' | 'error'}
      initialResult={(row.result as TestResult | null) ?? null}
    />
  )
}
