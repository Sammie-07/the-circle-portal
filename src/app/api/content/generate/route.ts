import { createClient } from '@/lib/supabase/server'
import { generateBatch, fillMissingCaptions } from '@/lib/content/generate-batch'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

// POST /api/content/generate — "Generate ideas now" on the Content tab. Runs a
// time-boxed strategist pass (transcripts included) and returns how many
// concept briefs were added.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Ideas from before captions existed get theirs first (quick, parallel).
  const captioned = await fillMissingCaptions(24).catch(() => 0)
  const made = await generateBatch({ cap: 6, force: true, includeTranscripts: true, budgetMs: 150_000 })
  return NextResponse.json({ ok: true, made, captioned })
}
