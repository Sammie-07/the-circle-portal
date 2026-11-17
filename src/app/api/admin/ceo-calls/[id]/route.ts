import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateStatement } from '@/lib/problem-statement'

export const maxDuration = 120

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

// Staff: rewrite one CEO Call Form's problem statement.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()
  await admin.from('problem_statements').update({ status: 'pending', error: null }).eq('id', id)
  after(() => generateStatement(admin, id))
  return NextResponse.json({ ok: true })
}
