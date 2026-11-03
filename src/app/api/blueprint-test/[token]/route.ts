import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndStore } from '@/lib/blueprint-test/results'

// Public, token-gated: the results page polls this until the write-up is ready.
// Only what the visitor needs to see; never their contact details.
export const maxDuration = 300

async function load(token: string) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('blueprint_tests')
    .select('id, name, scores, bottleneck, route, second_route, result, result_status, created_at')
    .eq('token', token)
    .maybeSingle()
  return data ? { admin, row: data } : null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const found = await load((await params).token)
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { row } = found
  return NextResponse.json({ status: row.result_status, result: row.result_status === 'ready' ? row.result : null })
}

// Retry a write-up that failed.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const found = await load((await params).token)
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { admin, row } = found
  if (row.result_status !== 'error') return NextResponse.json({ status: row.result_status })
  await admin.from('blueprint_tests').update({ result_status: 'pending' }).eq('id', row.id)
  after(() => generateAndStore(admin, row.id as string))
  return NextResponse.json({ status: 'pending' })
}
