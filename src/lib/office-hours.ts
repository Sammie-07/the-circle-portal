import { createAdminClient } from '@/lib/supabase/admin'
import { getSetting } from '@/lib/settings'

export const DEFAULT_ZOOM_LINK = 'https://us02web.zoom.us/j/7344760289?omn=82664283854&jst=2'
const TZ = 'America/New_York'

function pad(n: number) { return String(n).padStart(2, '0') }

// Resolve "this week" relative to the Eastern-time calendar (office hours are
// Tuesday 12 noon ET). Returns the week's Tuesday date (YYYY-MM-DD) and whether
// today is that Tuesday in ET. Mon and Tue both resolve to the same Tuesday.
export function thisWeekTuesday(now: Date = new Date()): { tuesdayISO: string; isTuesdayET: boolean; todayISO: string } {
  const etDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now) // YYYY-MM-DD
  const etWeekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(now)
  const [y, m, d] = etDate.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const dow = base.getUTCDay() // 0=Sun..6=Sat
  const offsetToMonday = (dow + 6) % 7
  const tuesday = new Date(base)
  tuesday.setUTCDate(base.getUTCDate() - offsetToMonday + 1)
  const tuesdayISO = `${tuesday.getUTCFullYear()}-${pad(tuesday.getUTCMonth() + 1)}-${pad(tuesday.getUTCDate())}`
  return { tuesdayISO, isTuesdayET: etWeekday === 'Tuesday', todayISO: etDate }
}

export type OfficeHoursWeekStatus = 'meeting' | 'no_meeting' | 'rescheduled'

export interface OfficeHoursStatus {
  tuesdayISO: string
  isTuesdayET: boolean
  status: OfficeHoursWeekStatus
  hasMeeting: boolean          // true unless status === 'no_meeting' (legacy convenience)
  isMeetingDayET: boolean      // is today the day the call actually happens this week
  rescheduledDate: string | null // YYYY-MM-DD when status === 'rescheduled'
  rescheduledTime: string | null // HH:MM (ET) when status === 'rescheduled'
  isSet: boolean               // whether the admin has explicitly set this week
  note: string | null
  zoomLink: string
}

export async function getOfficeHoursStatus(now: Date = new Date()): Promise<OfficeHoursStatus> {
  const { tuesdayISO, isTuesdayET, todayISO } = thisWeekTuesday(now)

  let status: OfficeHoursWeekStatus = 'meeting'
  let isSet = false
  let note: string | null = null
  let rescheduledDate: string | null = null
  let rescheduledTime: string | null = null
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('office_hours_weeks')
      .select('status, has_meeting, rescheduled_date, rescheduled_time, note')
      .eq('week_of', tuesdayISO)
      .maybeSingle()
    if (data) {
      // Prefer the new status column; fall back to has_meeting for any old row.
      status = (data.status as OfficeHoursWeekStatus) ?? (data.has_meeting ? 'meeting' : 'no_meeting')
      note = data.note ?? null
      rescheduledDate = data.rescheduled_date ?? null
      rescheduledTime = data.rescheduled_time ?? null
      isSet = true
    }
  } catch {
    // fall back to defaults
  }

  const hasMeeting = status !== 'no_meeting'
  const isMeetingDayET =
    status === 'rescheduled' ? todayISO === rescheduledDate : status === 'meeting' && isTuesdayET

  const zoomLink = (await getSetting('office_hours_zoom_link')) || DEFAULT_ZOOM_LINK

  return {
    tuesdayISO,
    isTuesdayET,
    status,
    hasMeeting,
    isMeetingDayET,
    rescheduledDate,
    rescheduledTime,
    isSet,
    note,
    zoomLink,
  }
}
