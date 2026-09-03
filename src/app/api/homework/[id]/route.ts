import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectForMember, reconcileAchievementPostNotifications } from '@/lib/achievements'
import { generateBatch } from '@/lib/content/generate-batch'
import { NextResponse, after } from 'next/server'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/homework/[id] — toggle complete (member or admin) or full edit (admin only)
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = ['owner', 'admin', 'manager'].includes(profile?.role ?? '')

  const body = await request.json()

  let patch: Record<string, unknown>

  if (isAdmin) {
    // Admins can update any field
    patch = {}
    if ('completed' in body) {
      patch.completed = body.completed
      patch.completed_at = body.completed ? new Date().toISOString() : null
    }
    if ('title' in body) patch.title = body.title.trim()
    if ('description' in body) patch.description = body.description?.trim() || null
    if ('due_date' in body) patch.due_date = body.due_date || null
    if ('type' in body) patch.type = body.type
    if ('sort_order' in body) patch.sort_order = body.sort_order
    if ('notes' in body) {
      const n = typeof body.notes === 'string' ? body.notes : null
      patch.notes = n
      patch.notes_at = n && n.trim() ? new Date().toISOString() : null
    }
  } else {
    // Members can toggle completed and set notes on their own item (RLS restricts to own rows)
    if (!('completed' in body) && !('notes' in body)) {
      return NextResponse.json({ error: 'Only completed toggle or notes allowed' }, { status: 403 })
    }
    patch = {}
    if ('completed' in body) {
      patch.completed = body.completed
      patch.completed_at = body.completed ? new Date().toISOString() : null
    }
    if ('notes' in body) {
      const n = typeof body.notes === 'string' ? body.notes : null
      patch.notes = n
      patch.notes_at = n && n.trim() ? new Date().toISOString() : null
    }
  }

  const { data, error } = await supabase
    .from('homework')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Completing an assignment is fresh activity — check for newly earned
  // achievements in the background (rules only for speed; milestone emails on).
  // Never blocks the toggle; failures are swallowed.
  if (patch.completed === true && data?.member_id) {
    const memberId = data.member_id as string
    after(async () => {
      const admin = createAdminClient()
      const awarded = await detectForMember(admin, memberId, { includeAi: false, email: true }).catch(() => [])
      // A milestone is postable — draft content for it (achievements now feed the
      // content machine as member_win signals), then log the "post drafted" admin
      // notification. Background, capped, never blocks.
      if (awarded.some((a) => a.tier === 'milestone')) {
        await generateBatch({ memberId, force: true, cap: 2 }).catch(() => {})
        await reconcileAchievementPostNotifications(admin).catch(() => {})
      }
    })
  }

  return NextResponse.json({ item: data })
}

// DELETE /api/homework/[id] — admin only
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'admin', 'manager'].includes(profile?.role ?? '')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const { error } = await supabase.from('homework').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
