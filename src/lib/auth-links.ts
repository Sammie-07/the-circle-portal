import { createAdminClient } from '@/lib/supabase/admin'

// We send our own branded emails, so we mint magic links with the admin API and
// route them through /auth/confirm (the Supabase SSR "token hash" verify flow).
// This works without a client-side PKCE verifier — unlike the /auth/callback
// `?code` exchange, which only works for client-initiated signInWithOtp.
function confirmUrl(appUrl: string, tokenHash: string): string {
  return `${appUrl.replace(/\/$/, '')}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`
}

// Generate a branded magic sign-in link. Creates the auth user first if they
// don't have an account yet, so invites work for brand-new members.
export async function generateSigninLink(email: string, appUrl: string, fullName?: string): Promise<string> {
  const admin = createAdminClient()
  const redirectTo = `${appUrl.replace(/\/$/, '')}/auth/callback`

  async function gen() {
    return admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
  }

  let { data, error } = await gen()

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
  return confirmUrl(appUrl, data.properties.hashed_token)
}

// Like generateSigninLink, but does NOT create an account if one doesn't exist.
// Returns null for unknown emails — used by self-service login so the portal
// stays invitation-only (you must be invited before you can sign yourself in).
export async function generateSigninLinkIfExists(email: string, appUrl: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl.replace(/\/$/, '')}/auth/callback` },
  })
  if (error || !data?.properties?.hashed_token) return null
  return confirmUrl(appUrl, data.properties.hashed_token)
}
