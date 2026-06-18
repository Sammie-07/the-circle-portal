import AppSettingsForm from '@/components/admin/AppSettingsForm'
import { getTeamAgentCount } from '@/lib/settings'

export default async function AdminSettingsPage() {
  const agentCount = await getTeamAgentCount()

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">Settings</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">Editable values used across the portal.</p>
      </div>

      <AppSettingsForm initialAgentCount={agentCount} />
    </div>
  )
}
