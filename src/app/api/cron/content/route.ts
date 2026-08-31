import { NextResponse } from 'next/server'
import { generateBatch } from '@/lib/content/generate-batch'

export const runtime = 'nodejs'
export const maxDuration = 60

// Daily safety-net: generate content for any member activity the live event
// triggers (survey submit, Content-tab load) didn't already cover. Small cap so
// it stays within the function budget; the bank keeps filling day over day.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const generated = await generateBatch({ cap: 4, force: true }).catch(() => 0)
  return NextResponse.json({ ok: true, generated })
}
