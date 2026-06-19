import { createAdminClient } from '@/lib/supabase/admin'

// Generate a magic sign-in link for an email WITHOUT triggering Supabase's
// built-in (plain) auth email — so we can send our own branded email instead.
// Creates the auth user first if they don't have an account yet, so invites
// work for brand-new members.
export async function generateSigninLink(email: string, redirectTo: string, fullName?: string): Promise<string> {
  const admin = createAdminClient()

  async function gen() {
    return admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })
  }

  let { data, error } = await gen()

  // No account yet → create one (confirmed, so no separate confirmation email)
  // and retry. Tolerate "already registered" in case of a race.
  if (error || !data?.properties?.action_link) {
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

  if (error || !data?.properties?.action_link) {
    throw error ?? new Error('Could not generate sign-in link')
  }
  return data.properties.action_link
}

// Like generateSigninLink, but does NOT create an account if one doesn't exist.
// Returns null for unknown emails — used by self-service login so the portal
// stays invitation-only (you must be invited before you can sign yourself in).
export async function generateSigninLinkIfExists(email: string, redirectTo: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })
  if (error || !data?.properties?.action_link) return null
  return data.properties.action_link
}
