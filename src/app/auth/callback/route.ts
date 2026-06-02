import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const TEAM_ROLES = ['owner', 'tech', 'admin', 'manager', 'support']

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Use service role to read profile — bypasses RLS, always accurate
        const adminDb = createAdminClient()
        const { data: profile } = await adminDb
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        // Safety net: create profile if missing
        if (!profile) {
          await adminDb.from('profiles').insert({
            id: user.id,
            email: user.email,
            role: 'member',
            full_name: user.email,
          }).single()
          return NextResponse.redirect(`${origin}/dashboard`)
        }

        // Send team members to admin portal, everyone else to member portal
        if (TEAM_ROLES.includes(profile.role)) {
          return NextResponse.redirect(`${origin}/admin`)
        }
        return NextResponse.redirect(`${origin}/dashboard`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
