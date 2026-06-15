import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST — generate a magic sign-in link for a member without sending an email
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
  const adminDb = createAdminClient()

  const { data, error } = await adminDb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl}/auth/callback` },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Generating a sign-in link grants the member access, so mark them invited
  // (only if not already) — this is what gates the Friday check-in cron.
  await adminDb
    .from('members')
    .update({ invited_at: new Date().toISOString() })
    .eq('email', email)
    .is('invited_at', null)

  return NextResponse.json({ link: data.properties.action_link })
}
