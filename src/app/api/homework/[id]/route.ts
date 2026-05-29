import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/homework/[id] — toggle complete (member or admin) or full edit (admin only)
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

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
  } else {
    // Members can only toggle completed
    if (!('completed' in body)) return NextResponse.json({ error: 'Only completed toggle allowed' }, { status: 403 })
    patch = {
      completed: body.completed,
      completed_at: body.completed ? new Date().toISOString() : null,
    }
  }

  const { data, error } = await supabase
    .from('homework')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// DELETE /api/homework/[id] — admin only
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { error } = await supabase.from('homework').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
