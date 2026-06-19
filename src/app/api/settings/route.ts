import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const EDITOR_ROLES = ['owner', 'admin', 'manager']

// GET — return the editable settings (any staff member).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin.from('app_settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of data ?? []) settings[row.key] = row.value ?? ''
  return NextResponse.json({ settings })
}

// PUT — update one or more settings (owner/admin/manager).
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!EDITOR_ROLES.includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const body = await request.json()

  const admin = createAdminClient()

  // teamgogo_agent_count — store digits only (accepts "1,660" or "1660").
  if ('teamgogo_agent_count' in body) {
    const raw = String(body.teamgogo_agent_count ?? '').replace(/[^\d]/g, '')
    if (!raw) return NextResponse.json({ error: 'Agent count must be a number' }, { status: 400 })

    const { error } = await admin
      .from('app_settings')
      .upsert({ key: 'teamgogo_agent_count', value: raw, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // office_hours_zoom_link — the global Zoom join link for Tuesday office hours.
  if ('office_hours_zoom_link' in body) {
    const link = String(body.office_hours_zoom_link ?? '').trim()
    if (link && !/^https?:\/\//i.test(link)) {
      return NextResponse.json({ error: 'Zoom link must start with http(s)://' }, { status: 400 })
    }
    const { error } = await admin
      .from('app_settings')
      .upsert({ key: 'office_hours_zoom_link', value: link, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
