import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { thisWeekTuesday } from '@/lib/office-hours'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const EDITOR_ROLES = new Set(['owner', 'admin', 'manager'])
const STATUSES = new Set(['meeting', 'no_meeting', 'rescheduled'])

// GET — this week's office-hours status (for the admin settings panel).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tuesdayISO } = thisWeekTuesday()
  const admin = createAdminClient()
  const { data } = await admin
    .from('office_hours_weeks')
    .select('status, has_meeting, rescheduled_date, rescheduled_time, note')
    .eq('week_of', tuesdayISO)
    .maybeSingle()

  const status = data?.status ?? (data ? (data.has_meeting ? 'meeting' : 'no_meeting') : 'meeting')

  return NextResponse.json({
    week_of: tuesdayISO,
    status,
    has_meeting: status !== 'no_meeting',
    rescheduled_date: data?.rescheduled_date ?? '',
    rescheduled_time: data?.rescheduled_time ?? '',
    note: data?.note ?? '',
    is_set: !!data,
  })
}

// PUT — set this week's office-hours (owner/admin/manager).
// Body: { status: 'meeting'|'no_meeting'|'rescheduled', note?, rescheduled_date?, rescheduled_time? }
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.has(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const body = await request.json()

  // Back-compat: older callers send { has_meeting } instead of { status }.
  let status: string = typeof body.status === 'string' ? body.status : (body.has_meeting === false ? 'no_meeting' : 'meeting')
  if (!STATUSES.has(status)) status = 'meeting'

  const note = typeof body.note === 'string' ? body.note.trim() || null : null

  let rescheduled_date: string | null = null
  let rescheduled_time: string | null = null
  if (status === 'rescheduled') {
    rescheduled_date = typeof body.rescheduled_date === 'string' && body.rescheduled_date ? body.rescheduled_date : null
    rescheduled_time = typeof body.rescheduled_time === 'string' && body.rescheduled_time ? body.rescheduled_time.trim() : null
    if (!rescheduled_date || !/^\d{4}-\d{2}-\d{2}$/.test(rescheduled_date)) {
      return NextResponse.json({ error: 'Pick the new day for the rescheduled call.' }, { status: 400 })
    }
    if (!rescheduled_time) {
      return NextResponse.json({ error: 'Pick the new time for the rescheduled call.' }, { status: 400 })
    }
  }

  const { tuesdayISO } = thisWeekTuesday()
  const admin = createAdminClient()
  const { error } = await admin
    .from('office_hours_weeks')
    .upsert(
      {
        week_of: tuesdayISO,
        status,
        has_meeting: status !== 'no_meeting',
        rescheduled_date,
        rescheduled_time,
        note,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'week_of' }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, week_of: tuesdayISO, status })
}
