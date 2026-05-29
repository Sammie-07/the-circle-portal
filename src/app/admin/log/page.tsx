import { createClient } from '@/lib/supabase/server'
import BulkLogForm from '@/components/admin/BulkLogForm'

export default async function AdminLogPage() {
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('members')
    .select('id, name, email, cohort')
    .eq('status', 'active')
    .order('name', { ascending: true })

  // Default week_of to the most recent Tuesday
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun, 2=Tue
  const daysBack = (dayOfWeek + 7 - 2) % 7 // days since last Tuesday
  const lastTuesday = new Date(today)
  lastTuesday.setDate(today.getDate() - daysBack)
  const defaultWeekOf = lastTuesday.toISOString().split('T')[0]

  // Fetch existing logs for that week
  const { data: existingLogs } = await supabase
    .from('weekly_logs')
    .select('member_id, showed_up, homework_done, questions_asked, notes')
    .eq('week_of', defaultWeekOf)

  const logsByMember: Record<string, {
    showed_up: boolean
    homework_done: boolean
    questions_asked: number
    notes: string
  }> = {}
  for (const log of existingLogs ?? []) {
    logsByMember[log.member_id] = {
      showed_up: log.showed_up,
      homework_done: log.homework_done,
      questions_asked: log.questions_asked,
      notes: log.notes ?? '',
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
        <h1 className="text-white font-serif text-3xl">Log This Week</h1>
        <p className="text-[#555] text-sm mt-1">
          Mark attendance and homework for all active members in one go.
        </p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      <BulkLogForm
        members={members ?? []}
        defaultWeekOf={defaultWeekOf}
        existingLogs={logsByMember}
      />
    </div>
  )
}
