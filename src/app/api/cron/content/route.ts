import { NextResponse } from 'next/server'
import { generateBatch, fillMissingCaptions } from '@/lib/content/generate-batch'

export const runtime = 'nodejs'
export const maxDuration = 300

// Daily run of the content strategist: scans new call transcripts for Gogo
// Pearls, member stories, testimonials and coaching topics, and banks concept
// briefs. Time-boxed so it finishes inside the function limit; the bank keeps
// filling day over day.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const captioned = await fillMissingCaptions(8).catch(() => 0)
  const generated = await generateBatch({ cap: 8, force: true, includeTranscripts: true, budgetMs: 190_000 }).catch(() => 0)
  return NextResponse.json({ ok: true, generated, captioned })
}
