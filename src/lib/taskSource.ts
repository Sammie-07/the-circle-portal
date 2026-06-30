// How a homework/task row entered the system. Drives the admin-facing label so
// admins can tell their own assignments apart from AI/automation-added tasks.
export type TaskSource = 'admin' | 'blueprint' | 'financial' | 'ai_followup' | 'followup'

// Display label for the admin task surfaces.
export function taskSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case 'blueprint':
      return 'AI · Blueprint'
    case 'financial':
      return 'AI · Finance'
    case 'ai_followup':
      return 'AI · Note'
    case 'followup':
      return 'Follow-up'
    case 'admin':
    default:
      return 'Homework'
  }
}

// True only when an admin deliberately assigned the task (vs AI/automation).
export function isAdminAssigned(source: string | null | undefined): boolean {
  return (source ?? 'admin') === 'admin'
}

// Badge styling: admin homework reads as the "real" assignment (gold), everything
// AI/auto-added is muted so it's visually distinct at a glance.
export function taskSourceBadgeClass(source: string | null | undefined): string {
  return isAdminAssigned(source)
    ? 'text-[#C9A227] border-[#C9A227]/40 bg-[#C9A227]/5'
    : 'text-[var(--text-3)] border-[var(--border-color)]'
}
