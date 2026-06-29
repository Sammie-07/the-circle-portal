import { createClient } from '@/lib/supabase/server'
import { buildWeeklyDigest } from '@/lib/weekly-digest'
import { sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST — send the weekly member digest to the requesting admin's own email,
// so they can preview it on demand (the real one auto-sends Tuesday 9am ET).
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { subject, html } = await buildWeeklyDigest()
  const res = await sendEmail(user.email, `[Preview] ${subject}`, html)
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return NextResponse.json({ error: `Email failed to send. ${detail}`.trim() }, { status: 500 })
  }

  return NextResponse.json({ success: true, sent_to: user.email })
}
