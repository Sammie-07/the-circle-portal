import { createAdminClient } from '@/lib/supabase/admin'
import { getSetting } from '@/lib/settings'

export const DEFAULT_ZOOM_LINK = 'https://us02web.zoom.us/j/7344760289?omn=82664283854&jst=2'
const TZ = 'America/New_York'

function pad(n: number) { return String(n).padStart(2, '0') }

// Resolve "this week" relative to the Eastern-time calendar (office hours are
// Tuesday 12 noon ET). Returns the week's Tuesday date (YYYY-MM-DD) and whether
// today is that Tuesday in ET. Mon and Tue both resolve to the same Tuesday.
export function thisWeekTuesday(now: Date = new Date()): { tuesdayISO: string; isTuesdayET: boolean } {
  const etDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now) // YYYY-MM-DD
  const etWeekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(now)
  const [y, m, d] = etDate.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const dow = base.getUTCDay() // 0=Sun..6=Sat
  const offsetToMonday = (dow + 6) % 7
  const tuesday = new Date(base)
  tuesday.setUTCDate(base.getUTCDate() - offsetToMonday + 1)
  const tuesdayISO = `${tuesday.getUTCFullYear()}-${pad(tuesday.getUTCMonth() + 1)}-${pad(tuesday.getUTCDate())}`
  return { tuesdayISO, isTuesdayET: etWeekday === 'Tuesday' }
}

export interface OfficeHoursStatus {
  tuesdayISO: string
  isTuesdayET: boolean
  hasMeeting: boolean      // default true unless the admin marked the week off
  isSet: boolean           // whether the admin has explicitly set this week
  note: string | null
  zoomLink: string
}

export async function getOfficeHoursStatus(now: Date = new Date()): Promise<OfficeHoursStatus> {
  const { tuesdayISO, isTuesdayET } = thisWeekTuesday(now)

  let hasMeeting = true
  let isSet = false
  let note: string | null = null
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('office_hours_weeks')
      .select('has_meeting, note')
      .eq('week_of', tuesdayISO)
      .maybeSingle()
    if (data) {
      hasMeeting = data.has_meeting
      note = data.note ?? null
      isSet = true
    }
  } catch {
    // fall back to defaults
  }

  const zoomLink = (await getSetting('office_hours_zoom_link')) || DEFAULT_ZOOM_LINK

  return { tuesdayISO, isTuesdayET, hasMeeting, isSet, note, zoomLink }
}
