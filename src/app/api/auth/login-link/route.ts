import { generateSigninLinkIfExists } from '@/lib/auth-links'
import { brandedEmail, sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// POST — public self-service login. Sends a branded magic-link email if an
// account exists for the address. Always returns success (no account
// enumeration); the portal is invitation-only, so unknown emails simply get
// no email.
export async function POST(request: Request) {
  let email: string
  try {
    const body = await request.json()
    email = String(body.email ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin

  let link: string | null = null
  try {
    link = await generateSigninLinkIfExists(email, `${appUrl}/auth/callback`)
  } catch {
    // fall through — treated as "no account" below
  }

  if (link) {
    const html = brandedEmail({
      eyebrow: 'Sign In',
      heading: 'Your login link',
      body: [
        `Click below to sign in to your Circle member portal.`,
        `If you didn't request this, you can safely ignore this email, nothing will happen.`,
      ],
      cta: { text: 'Sign In →', url: link },
      note: 'For security this link expires after about an hour. You can request a new one any time from the login page.',
    })
    await sendEmail(email, 'Your Circle login link', html)
  }

  // Always report success so we don't reveal whether an account exists.
  return NextResponse.json({ success: true })
}
