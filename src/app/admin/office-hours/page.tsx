import OfficeHoursPanel from '@/components/admin/OfficeHoursPanel'

export const metadata = { title: 'Office Hours · The Circle' }

export default function AdminOfficeHoursPage() {
  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-8">
        <p className="text-[var(--gold-text)] text-[10px] tracking-[0.28em] uppercase mb-2">Admin</p>
        <h1 className="text-[var(--text)] font-serif text-[38px]">Office Hours</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">Global weekly recordings shown to every member.</p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      <OfficeHoursPanel />
    </div>
  )
}
