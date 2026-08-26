import { generateSigninOtpIfExists } from '@/lib/auth-links'
import { brandedEmail, sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// POST — public self-service login by CODE (alternative to the magic link).
// Emails a branded login code if an account exists. Codes survive email
// link-scanners that consume one-time magic links. Always returns success
// (no account enumeration; the portal is invitation-only).
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

  let code: string | null = null
  try {
    code = await generateSigninOtpIfExists(email, appUrl)
  } catch {
    // fall through — treated as "no account" below
  }

  if (code) {
    const codeHtml = `<div style="text-align:center;margin:8px 0 4px;">
      <span style="display:inline-block;font-family:'Courier New',monospace;font-size:34px;letter-spacing:10px;font-weight:700;color:#C9A227;background:rgba(201,162,39,0.08);border:1px solid rgba(201,162,39,0.3);border-radius:8px;padding:14px 22px;">${code}</span>
    </div>`
    const html = brandedEmail({
      eyebrow: 'Sign In',
      heading: 'Your login code',
      body: [
        `Enter this login code on the Circle login page to sign in.`,
      ],
      bodyHtml: codeHtml,
      note: 'This code expires after about an hour. If you didn\'t request it, you can ignore this email.',
    })
    await sendEmail(email, `Your Circle login code: ${code}`, html)
  }

  return NextResponse.json({ success: true })
}
