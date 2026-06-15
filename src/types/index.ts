export type UserRole = 'admin' | 'member'

export interface Member {
  id: string
  user_id: string | null
  name: string
  email: string
  join_date: string
  cohort: string | null
  status: 'active' | 'inactive' | 'graduated'
  phone?: string | null
  city?: string | null
  instagram?: string | null
  website?: string | null
  bio?: string | null
  blueprint_data: BlueprintData | null
  // Set when the member is invited to the portal (sent a login link).
  // NULL = created but no access yet — excluded from the Friday check-in.
  invited_at?: string | null
  created_at: string
}

export interface BlueprintData {
  tagline: string
  market: string
  current_revenue: string
  target_revenue: string
  strengths: string[]
  challenges: string[]
  quarters: QuarterPlan[]
}

export interface QuarterPlan {
  quarter: number
  title: string
  focus: string
  tasks: string[]
}

export interface WeeklyLog {
  id: string
  member_id: string
  week_of: string
  showed_up: boolean
  homework_done: boolean
  questions_asked: number
  notes: string | null
  logged_by: string | null
  created_at: string
}

export interface Report {
  id: string
  member_id: string
  period_type: 'monthly' | 'quarterly' | 'yearly'
  period_label: string
  content_html: string
  generated_at: string
  sent_at: string | null
  sent_by: string | null
}

export interface MemberWithStats extends Member {
  attendance_rate: number
  homework_rate: number
  calls_attended: number
  calls_total: number
  reports_count: number
  last_active: string | null
}
