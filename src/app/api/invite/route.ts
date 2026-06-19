import { createClient } from '@/lib/supabase/server'
import { generateSigninLink } from '@/lib/auth-links'
import { brandedEmail, sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// POST — send a branded portal sign-in link to an existing member
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'admin', 'manager'].includes(profile?.role ?? '')) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const { data: member } = await supabase.from('members').select('id, name, invited_at').eq('email', email).single()
  if (!member) return NextResponse.json({ error: 'No member found with this email' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  let link: string
  try {
    link = await generateSigninLink(email, appUrl, member.name)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not generate sign-in link' }, { status: 500 })
  }

  const firstName = (member.name || '').split(' ')[0] || 'there'
  const html = brandedEmail({
    eyebrow: 'Your Portal Access',
    heading: `Welcome to The Circle, ${firstName}.`,
    body: [
      `Your member portal is ready. It's where you'll find your 12-month blueprint, weekly check-ins, homework, your coaching call replays, and your progress reports.`,
      `You can also ask me anything, any time, right inside the portal.`,
      `Click below to sign in. This link is just for you, so please don't forward it.`,
    ],
    cta: { text: 'Open My Portal →', url: link },
    note: 'For security this sign-in link expires after about an hour. If it stops working, ask your coach to send a fresh one.',
  })

  const sendRes = await sendEmail(email, 'Your access to The Circle is ready', html)
  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => '')
    return NextResponse.json({ error: `Email failed to send. ${detail}`.trim() }, { status: 500 })
  }

  // Mark the member as invited (first time only) so the Friday check-in cron
  // starts including them. Best-effort — the invite already went out.
  if (!member.invited_at) {
    await supabase
      .from('members')
      .update({ invited_at: new Date().toISOString() })
      .eq('id', member.id)
  }

  return NextResponse.json({ success: true, sent_to: email })
}
