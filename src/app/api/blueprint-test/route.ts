import { NextRequest, NextResponse, after } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { ALL_QUESTIONS, cleanAnswers, isAnswered } from '@/lib/blueprint-test/questions'
import { analyze } from '@/lib/blueprint-test/score'
import { generateAndStore } from '@/lib/blueprint-test/results'

// Public: takes a finished Blueprint Test, scores and routes it, saves the lead,
// and writes the results in the background. The visitor gets a private link.
export const maxDuration = 300

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  // Honeypot: real people never see or fill this field.
  if (typeof body.website === 'string' && body.website.trim()) return NextResponse.json({ token: 'ok' })

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : ''
  if (name.length < 2) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 })

  const answers = cleanAnswers(body.answers)
  const missing = ALL_QUESTIONS.filter((q) => !isAnswered(q, answers[q.key]))
  if (missing.length) return NextResponse.json({ error: `Please answer: ${missing[0].label}` }, { status: 400 })

  const admin = createAdminClient()

  // A double submit (or a quick retake) returns the test they just took.
  const since = new Date(Date.now() - 2 * 60_000).toISOString()
  const { data: recent } = await admin
    .from('blueprint_tests')
    .select('token')
    .ilike('email', email)
    .gte('created_at', since)
    .limit(1)
    .maybeSingle()
  if (recent) return NextResponse.json({ token: recent.token })

  const analysis = analyze(answers)
  const src = (body.source && typeof body.source === 'object') ? body.source as Record<string, unknown> : {}
  const source = Object.fromEntries(
    Object.entries(src).filter(([k, v]) => /^(utm_\w+|ref|fbclid|gclid)$/.test(k) && typeof v === 'string').map(([k, v]) => [k, (v as string).slice(0, 200)]),
  )

  const token = randomBytes(18).toString('base64url')
  const { data: row, error } = await admin
    .from('blueprint_tests')
    .insert({
      token, name, email, phone: phone || null, answers,
      scores: analysis.scores,
      bottleneck: analysis.bottleneck,
      route: analysis.route,
      second_route: analysis.secondRoute,
      flags: analysis.flags,
      source: { ...source, reasons: analysis.reasons },
    })
    .select('id')
    .single()
  if (error || !row) {
    console.error('Blueprint test insert failed:', error)
    return NextResponse.json({ error: 'Could not save your answers. Please try again.' }, { status: 500 })
  }

  after(() => generateAndStore(admin, row.id as string))
  return NextResponse.json({ token })
}
