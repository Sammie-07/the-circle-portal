import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, brandedEmail } from '@/lib/email'

// Staff: email the person the link to their 12-Month CEO Roadmap (after the
// team has previewed it). The address defaults to the one from their CEO Call
// Form and can be changed before sending.
const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { email?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })

  const { id } = await params
  const admin = createAdminClient()
  const { data: row } = await admin.from('problem_statements').select('name, roadmap_html, roadmap_token').eq('id', id).maybeSingle()
  if (!row?.roadmap_html || !row.roadmap_token) return NextResponse.json({ error: 'Generate the roadmap first.' }, { status: 400 })

  const first = String(row.name ?? '').trim().split(/\s+/)[0] || 'there'
  const res = await sendEmail(email, 'Your 12-Month CEO Roadmap from Gogo', brandedEmail({
    eyebrow: 'Your CEO Call with Gogo',
    heading: `${first}, your 12-Month CEO Roadmap is ready`,
    body: [
      'Here is everything we talked about on our CEO Call, turned into a month-by-month plan: where you are today, the real problem holding you back, and exactly what to do over the next 12 months.',
      'Open it on any device, and save it as a PDF from the top of the page.',
    ],
    cta: { text: 'Open your roadmap', url: `${APP_URL}/roadmap/${row.roadmap_token}` },
    footer: 'Gogo Bethke · CEO Call · gogobethke.com',
  }))
  if (!res.ok) return NextResponse.json({ error: `Email failed to send (${res.status}).` }, { status: 502 })

  await admin.from('problem_statements').update({ roadmap_email: email, roadmap_sent_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ ok: true, sent_to: email })
}
