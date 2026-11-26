import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchFathomTranscript } from '@/lib/fathom'
import { generateRoadmap } from '@/lib/ceo-roadmap'

// Staff: generate (or regenerate with changes) a 12-Month CEO Roadmap from the
// CEO Call transcript (Fathom share link or pasted). Runs in the background;
// the CEO Calls page polls until it is ready.
export const maxDuration = 300

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { fathom_link?: string; transcript?: string; feedback?: string }
  const { id } = await params
  const admin = createAdminClient()
  const { data: row } = await admin.from('problem_statements').select('id, roadmap_transcript, roadmap_status').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.roadmap_status === 'generating') return NextResponse.json({ error: 'A roadmap is already being generated.' }, { status: 409 })

  let transcript = typeof body.transcript === 'string' ? body.transcript.trim() : ''
  const fathomLink = typeof body.fathom_link === 'string' ? body.fathom_link.trim() : ''
  if (!transcript && fathomLink) {
    try {
      transcript = (await fetchFathomTranscript(fathomLink)).text
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read the Fathom link' }, { status: 400 })
    }
  }
  if (!transcript && !row.roadmap_transcript) {
    return NextResponse.json({ error: 'Add the Fathom link of the CEO Call, or paste the transcript.' }, { status: 400 })
  }

  await admin.from('problem_statements').update({
    ...(transcript ? { roadmap_transcript: transcript.slice(0, 150_000), roadmap_fathom_link: fathomLink || null } : {}),
    roadmap_status: 'generating',
    roadmap_error: null,
    roadmap_started_at: new Date().toISOString(),
  }).eq('id', id)

  const feedback = typeof body.feedback === 'string' ? body.feedback.trim().slice(0, 3000) : ''
  after(() => generateRoadmap(admin, id, feedback || undefined))
  return NextResponse.json({ ok: true })
}
