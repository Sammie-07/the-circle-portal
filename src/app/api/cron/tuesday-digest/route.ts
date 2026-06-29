import { createClient } from '@supabase/supabase-js'
import { buildWeeklyDigest } from '@/lib/weekly-digest'
import { sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

// Tuesday 9am ET — email Gogo + admins a narrative recap of every member's past
// week (completions, portal comments, attendance) ahead of office hours.
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: admins } = await supabase
    .from('profiles')
    .select('email')
    .in('role', ['owner', 'admin', 'manager'])

  const recipients = (admins ?? []).map((a) => a.email).filter(Boolean) as string[]
  if (recipients.length === 0) {
    return NextResponse.json({ success: true, sent: 0, note: 'no admin recipients' })
  }

  const { subject, html, memberCount } = await buildWeeklyDigest()

  await Promise.allSettled(
    recipients.map((email) =>
      sendEmail(email, subject, html).catch((err: unknown) => console.error(`Digest send failed for ${email}:`, err))
    )
  )

  return NextResponse.json({ success: true, sent: recipients.length, members: memberCount })
}
