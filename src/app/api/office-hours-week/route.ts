import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { thisWeekTuesday } from '@/lib/office-hours'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const EDITOR_ROLES = new Set(['owner', 'admin', 'manager'])

// GET — this week's office-hours status (for the admin settings panel).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tuesdayISO } = thisWeekTuesday()
  const admin = createAdminClient()
  const { data } = await admin
    .from('office_hours_weeks')
    .select('has_meeting, note')
    .eq('week_of', tuesdayISO)
    .maybeSingle()

  return NextResponse.json({
    week_of: tuesdayISO,
    has_meeting: data ? data.has_meeting : true,
    note: data?.note ?? '',
    is_set: !!data,
  })
}

// PUT — set whether there's a meeting this week (owner/admin/manager).
// Body: { has_meeting: boolean, note?: string }
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const body = await request.json()
  const has_meeting = body.has_meeting !== false
  const note = typeof body.note === 'string' ? body.note.trim() || null : null

  const { tuesdayISO } = thisWeekTuesday()
  const admin = createAdminClient()
  const { error } = await admin
    .from('office_hours_weeks')
    .upsert(
      { week_of: tuesdayISO, has_meeting, note, updated_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'week_of' }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, week_of: tuesdayISO, has_meeting })
}
