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
