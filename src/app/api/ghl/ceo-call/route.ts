import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractAnswers, extractContact, generateStatement } from '@/lib/problem-statement'

export const runtime = 'nodejs'
export const maxDuration = 120

// Webhook from the GHL "CEO Call Form" workflow. Secured by the same shared
// secret as /api/ghl/application (x-webhook-secret header or ?key=). Saves the
// submission, replies 200 right away so GHL doesn't retry, then writes Gogo's
// problem statement in the background.
export async function POST(request: Request) {
  const expected = process.env.GHL_WEBHOOK_SECRET
  const url = new URL(request.url)
  const provided = request.headers.get('x-webhook-secret') ?? url.searchParams.get('key')
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    const parsed = await request.json()
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>
  } catch {}

  const answers = extractAnswers(body)
  const contact = extractContact(body)
  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('problem_statements')
    .insert({
      contact_id: contact.contactId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      form_name: 'The CEO Call Form',
      answers,
      raw: body,
      // Nothing usable arrived: keep the raw payload so the field mapping can be fixed.
      status: Object.keys(answers).length ? 'pending' : 'error',
      error: Object.keys(answers).length ? null : 'No form answers found in the webhook payload',
    })
    .select('id, status')
    .single()
  if (error || !row) {
    console.error('CEO call insert failed:', error)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }

  if (row.status === 'pending') after(() => generateStatement(admin, row.id as string))
  return NextResponse.json({ ok: true, id: row.id })
}
