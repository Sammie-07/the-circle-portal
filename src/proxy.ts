import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public + machine-to-machine routes that authenticate themselves (share
  // token or shared secret) — skip the login redirect entirely.
  //  - /b/, /r/, /checkin/        : public token-rendered pages
  //  - /api/ghl/                  : GHL webhook (shared-secret gated)
  //  - /api/cron/                 : Vercel cron (Bearer-secret gated)
  //  - /api/checkin/              : token-gated check-in submit
  if (
    pathname.startsWith('/b/') ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/checkin/') ||
    pathname.startsWith('/api/ghl/') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/checkin/')
  ) {
    return supabaseResponse
  }

  if (pathname === '/login' || pathname === '/auth/callback') {
    if (user) {
      // Redirect logged-in users away from login
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // Protected routes
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Admin-only routes — allow ALL staff roles (owner/admin/manager/support/tech),
  // matching the admin layout. Gating to only 'admin' would bounce an owner/
  // manager/support between /admin and /dashboard in a redirect loop.
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const STAFF_ROLES = ['owner', 'admin', 'manager', 'support', 'tech']
    if (!STAFF_ROLES.includes(profile?.role ?? '')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
