import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { VIEW_AS_COOKIE } from '@/lib/portalContext'

const STAFF_ROLES = ['owner', 'admin', 'manager', 'support', 'tech']

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const exit = url.searchParams.get('exit')
  const memberId = url.searchParams.get('member')

  // Exit impersonation — clear the cookie and return to admin.
  if (exit) {
    const res = NextResponse.redirect(new URL('/admin', req.url))
    res.cookies.set(VIEW_AS_COOKIE, '', { path: '/', maxAge: 0 })
    return res
  }

  // Authenticate and require a staff user.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!STAFF_ROLES.includes(profile?.role ?? '')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!memberId) {
    return new NextResponse('Missing member', { status: 400 })
  }

  // Verify the target member exists (service role).
  const admin = createAdminClient()
  const { data: member } = await admin
    .from('members')
    .select('id')
    .eq('id', memberId)
    .single()

  if (!member) {
    return new NextResponse('Member not found', { status: 404 })
  }

  const res = NextResponse.redirect(new URL('/dashboard', req.url))
  res.cookies.set(VIEW_AS_COOKIE, memberId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2 hours
  })
  return res
}
