import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSigninLink } from '@/lib/auth-links'
import { NextResponse } from 'next/server'

// POST — return a member's activation/sign-in link (to copy/share) without sending
// an email. Clicking it verifies them (through the /auth/confirm interstitial) and
// lands them on the set-password page, already signed in — no code needed.
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['owner', 'admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://the-circle-portal.vercel.app'

  let link: string
  try {
    link = await generateSigninLink(email, appUrl, undefined, 'activate')
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not generate the link' }, { status: 500 })
  }

  // Granting access marks them invited (gates the Friday check-in cron).
  const adminDb = createAdminClient()
  await adminDb
    .from('members')
    .update({ invited_at: new Date().toISOString() })
    .eq('email', email)
    .is('invited_at', null)

  return NextResponse.json({ link })
}
