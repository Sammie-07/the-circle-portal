import { createAdminClient } from '@/lib/supabase/admin'

// We send our own branded emails, so we mint magic links with the admin API and
// route them through /auth/confirm (the Supabase SSR "token hash" verify flow).
// This works without a client-side PKCE verifier — unlike the /auth/callback
// `?code` exchange, which only works for client-initiated signInWithOtp.
function confirmUrl(appUrl: string, tokenHash: string, ctx?: string): string {
  const c = ctx ? `&ctx=${encodeURIComponent(ctx)}` : ''
  return `${appUrl.replace(/\/$/, '')}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink${c}`
}

// Generate a branded magic sign-in link. Creates the auth user first if they
// don't have an account yet, so invites work for brand-new members. Clicking it
// (through the /auth/confirm interstitial) verifies them and drops them on
// /set-password already signed in — no code needed. `ctx` steers the copy there.
export async function generateSigninLink(
  email: string,
  appUrl: string,
  fullName?: string,
  ctx?: string,
  opts: { allowCreate?: boolean } = {}
): Promise<string> {
  const { allowCreate = true } = opts
  const admin = createAdminClient()
  const redirectTo = `${appUrl.replace(/\/$/, '')}/auth/callback`

  async function gen() {
    return admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
  }

  let { data, error } = await gen()

  // Callers that must NOT mint a new account (password resets) stop here. Without
  // this, a mistyped or alternate address silently created a brand-new login that
  // matched no member record, and the person landed on "your profile is being set
  // up" forever. Fail loudly instead so the admin sees the wrong address.
  if ((error || !data?.properties?.hashed_token) && !allowCreate) {
    throw new Error(`No account exists for ${email}. Check the address, it must match the one on their profile.`)
  }

  // No account yet → create one (confirmed, so no separate confirmation email)
  // and retry. Tolerate "already registered" in case of a race.
  if (error || !data?.properties?.hashed_token) {
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    })
    if (createErr && !/already|registered|exists/i.test(createErr.message)) {
      throw createErr
    }
    ;({ data, error } = await gen())
  }

  if (error || !data?.properties?.hashed_token) {
    throw error ?? new Error('Could not generate sign-in link')
  }
  return confirmUrl(appUrl, data.properties.hashed_token, ctx)
}

// Generate the 6-digit email OTP that pairs with a magic link, WITHOUT creating
// an account if one doesn't exist. Returns null for unknown emails (portal stays
// invitation-only). Codes are immune to email link-scanners (Outlook SafeLinks
// etc.) that "pre-click" and burn one-time magic links.
export async function generateSigninOtpIfExists(email: string, appUrl: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl.replace(/\/$/, '')}/auth/callback` },
  })
  if (error || !data?.properties?.email_otp) return null
  return data.properties.email_otp
}
