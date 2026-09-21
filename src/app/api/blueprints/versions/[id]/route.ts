import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/blueprints/versions/[id]
// Returns an archived blueprint version's HTML for an admin to view in a new tab.
// Admin-only (cookie-authenticated) — archived versions are internal history.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'tech', 'admin', 'manager'].includes(profile?.role ?? '')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { data: version } = await supabase
    .from('blueprint_versions')
    .select('html')
    .eq('id', id)
    .single()

  if (!version?.html) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(version.html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
