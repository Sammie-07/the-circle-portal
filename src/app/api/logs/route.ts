import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Weekly attendance logs, read and written through the server.
//
// The admin screens used to write straight from the browser with the Supabase
// client. When a long-open tab's auth session got stuck refreshing, those
// writes waited forever and "Saving…" never finished (nothing reached the
// database). Going through this route uses the request's cookies instead, and
// the same row-level security (is_admin) still decides who may write.

interface LogRow {
  member_id: string
  week_of: string
  showed_up: boolean
  homework_done?: boolean
  questions_asked?: number
  notes?: string | null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

async function authed() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// GET /api/logs?week=YYYY-MM-DD → that week's logs
export async function GET(request: Request) {
  const { supabase, user } = await authed()
  if (!user) return NextResponse.json({ error: 'Your session expired. Refresh the page and sign in again.' }, { status: 401 })
  const week = new URL(request.url).searchParams.get('week') ?? ''
  if (!DATE.test(week)) return NextResponse.json({ error: 'Pick a valid week' }, { status: 400 })
  const { data, error } = await supabase
    .from('weekly_logs')
    .select('member_id, showed_up, homework_done, questions_asked, notes')
    .eq('week_of', week)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}

// POST /api/logs { rows: LogRow[] } → upsert on (member_id, week_of)
export async function POST(request: Request) {
  const { supabase, user } = await authed()
  if (!user) return NextResponse.json({ error: 'Your session expired. Refresh the page and sign in again (your entries are kept).' }, { status: 401 })
  let body: { rows?: LogRow[] } = {}
  try { body = await request.json() } catch { /* handled below */ }
  const rows = Array.isArray(body.rows) ? body.rows : []
  if (!rows.length) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  if (rows.some((r) => !r.member_id || !DATE.test(r.week_of ?? ''))) {
    return NextResponse.json({ error: 'Some rows are missing a member or week' }, { status: 400 })
  }
  const clean = rows.map((r) => ({
    member_id: r.member_id,
    week_of: r.week_of,
    showed_up: !!r.showed_up,
    homework_done: !!r.homework_done,
    questions_asked: Math.max(0, Math.round(Number(r.questions_asked) || 0)),
    notes: typeof r.notes === 'string' && r.notes.trim() ? r.notes : null,
    logged_by: user.id,
  }))
  const { data, error } = await supabase
    .from('weekly_logs')
    .upsert(clean, { onConflict: 'member_id,week_of' })
    .select('id, member_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // RLS silently skips rows the user may not write; say so instead of "saved".
  if ((data?.length ?? 0) < clean.length) {
    return NextResponse.json({ error: 'Your account is not allowed to save attendance.' }, { status: 403 })
  }
  return NextResponse.json({ ok: true, saved: data?.length ?? 0 })
}

// DELETE /api/logs?id=<uuid>
export async function DELETE(request: Request) {
  const { supabase, user } = await authed()
  if (!user) return NextResponse.json({ error: 'Your session expired. Refresh the page and sign in again.' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { data, error } = await supabase.from('weekly_logs').delete().eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Could not delete that record' }, { status: 403 })
  return NextResponse.json({ ok: true })
}
