import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSetting } from '@/lib/settings'
import { extractAnswers, extractContact, generateStatement } from '@/lib/problem-statement'

export const runtime = 'nodejs'
export const maxDuration = 120

// Webhook from the GHL "CEO Call Form" workflow. Secured by a shared secret
// (x-webhook-secret header or ?key=). Saves the
// submission, replies 200 right away so GHL doesn't retry, then writes Gogo's
// problem statement in the background.
export async function POST(request: Request) {
  // Either the shared GHL secret, or this form's own key (app_settings.ceo_call_webhook_key),
  // which lets the GHL action carry it in the URL instead of a header.
  const url = new URL(request.url)
  const provided = request.headers.get('x-webhook-secret') ?? url.searchParams.get('key')
  const accepted = [process.env.GHL_WEBHOOK_SECRET, await getSetting('ceo_call_webhook_key')].filter(Boolean)
  if (!provided || !accepted.includes(provided)) {
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
      // Always run the full process, even when no answers came through (tests,
      // or a GHL action that only sends contact fields): the statement then
      // says the form came in empty, and the raw payload is kept for debugging.
      status: 'pending',
    })
    .select('id, status')
    .single()
  if (error || !row) {
    console.error('CEO call insert failed:', error)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }

  after(() => generateStatement(admin, row.id as string))
  return NextResponse.json({ ok: true, id: row.id })
}
