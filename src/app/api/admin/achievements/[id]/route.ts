import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { explainAchievement } from '@/lib/achievement-explain'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

// GET /api/admin/achievements/[id] — what an achievement means and exactly what
// the member did to earn it (for the admin notification bell).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const explanation = await explainAchievement(createAdminClient(), id)
  if (!explanation) return NextResponse.json({ error: 'That achievement no longer exists' }, { status: 404 })
  return NextResponse.json(explanation)
}
