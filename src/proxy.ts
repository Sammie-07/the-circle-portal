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

  // Public routes — blueprint share links need no auth
  if (pathname.startsWith('/b/')) {
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

  // NOTE: role-based gating for /admin is enforced in src/app/admin/layout.tsx
  // (which correctly allows owner/admin/manager/support). Previously this ran a
  // profiles query on EVERY request AND used a stricter 'admin'-only list than
  // the layout, which could bounce owner/manager/support between /admin and
  // /dashboard in a redirect loop. Defer to the layout to keep middleware fast.

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
