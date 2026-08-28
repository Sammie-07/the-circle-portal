import { createAdminClient } from '@/lib/supabase/admin'

// Editable app settings (the `app_settings` key/value table). Read server-side
// with the service-role client so it works from any route regardless of RLS.

export const DEFAULT_TEAM_AGENT_COUNT = '1660'

export async function getSetting(key: string): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle()
    return data?.value ?? null
  } catch {
    return null
  }
}

/** Current #teamgogo agent count, falling back to the default if unset. */
export async function getTeamAgentCount(): Promise<string> {
  return (await getSetting('teamgogo_agent_count')) || DEFAULT_TEAM_AGENT_COUNT
}

// Monthly-survey rollout gate. `survey_allowlist` = comma-separated emails.
// - unset / empty  → survey is live for EVERY active member (full launch)
// - non-empty      → survey only activates for those emails (limited testing)
// Return null to mean "no restriction" so callers can branch cleanly.
export async function getSurveyAllowlist(): Promise<string[] | null> {
  const raw = await getSetting('survey_allowlist')
  if (!raw) return null
  const emails = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return emails.length ? emails : null
}

/** True if this member's email may see the survey right now (respects the allowlist). */
export function isEmailInSurveyRollout(email: string | null | undefined, allowlist: string[] | null): boolean {
  if (!allowlist) return true // full launch
  if (!email) return false
  return allowlist.includes(email.trim().toLowerCase())
}
