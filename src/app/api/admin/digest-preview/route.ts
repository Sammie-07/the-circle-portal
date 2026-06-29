import { createClient } from '@/lib/supabase/server'
import { buildWeeklyDigest } from '@/lib/weekly-digest'
import { sendEmail } from '@/lib/email'
import { NextResponse, after } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST — send the weekly member digest to the requesting admin's own email,
// so they can preview it on demand (the real one auto-sends Tuesday 9am ET).
// The digest involves an AI narrative pass (~30–60s), so we acknowledge
// immediately and build + send it in the background via after().
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const email = user.email
  after(async () => {
    try {
      const { subject, html } = await buildWeeklyDigest()
      await sendEmail(email, `[Preview] ${subject}`, html)
    } catch (err) {
      console.error('digest preview failed:', err)
    }
  })

  return NextResponse.json({ success: true, sent_to: email, queued: true })
}
