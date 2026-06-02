import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (!profile) {
          await supabase.from('profiles').insert({
            id: user.id,
            role: 'member',
            full_name: user.email,
          })
        }

        if (['owner', 'tech', 'admin', 'manager', 'support'].includes(profile?.role ?? '')) {
          return NextResponse.redirect(`${origin}/admin`)
        }
        return NextResponse.redirect(`${origin}/dashboard`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
