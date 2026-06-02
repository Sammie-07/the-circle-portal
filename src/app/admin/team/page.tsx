import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InviteAdminButton from '@/components/admin/InviteAdminButton'
import RemoveTeamMemberButton from '@/components/admin/RemoveTeamMemberButton'
import ChangeRoleButton from '@/components/admin/ChangeRoleButton'

const ROLE_META: Record<string, { label: string; color: string; description: string }> = {
  owner:   { label: 'Owner',   color: 'text-[#CC1F1F]',   description: 'Full control. Cannot be removed.' },
  admin:   { label: 'Admin',   color: 'text-[#C9A227]',   description: 'Full access — members, blueprints, reports, team.' },
  manager: { label: 'Manager', color: 'text-blue-400',    description: 'Logs, homework, reports. No team or blueprint access.' },
  support: { label: 'Support', color: 'text-[var(--text-2)]', description: 'View-only access to member profiles and logs.' },
}

export default async function AdminTeamPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!['owner', 'admin', 'manager', 'support'].includes(currentProfile?.role ?? '')) {
    redirect('/dashboard')
  }

  const canManageTeam = ['owner', 'admin'].includes(currentProfile?.role ?? '')
  const isOwner = currentProfile?.role === 'owner'

  // All team members (everyone except regular members)
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, email, role, full_name, created_at')
    .in('role', ['owner', 'admin', 'manager', 'support'])
    .order('created_at', { ascending: true })

  // Pending invites not yet accepted
  const { data: pendingInvites } = await supabase
    .from('admin_invites')
    .select('email, intended_role, created_at')
    .order('created_at', { ascending: false })

  const team = teamMembers ?? []
  const teamEmails = new Set(team.map(m => m.email))
  const pending = (pendingInvites ?? []).filter(inv => !teamEmails.has(inv.email))

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
            <h1 className="text-[var(--text)] font-serif text-3xl">Team</h1>
            <p className="text-[var(--text-3)] text-sm mt-1">{team.length} team member{team.length !== 1 ? 's' : ''} with portal access.</p>
          </div>
          {canManageTeam && <InviteAdminButton />}
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {/* Access level legend */}
      <div className="grid grid-cols-2 gap-2 mb-8">
        {Object.entries(ROLE_META).map(([key, meta]) => (
          <div key={key} className="bg-[var(--surface)] border border-[var(--border-color)] rounded px-4 py-3">
            <p className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${meta.color}`}>{meta.label}</p>
            <p className="text-[var(--text-3)] text-xs leading-snug">{meta.description}</p>
          </div>
        ))}
      </div>

      {/* Active team */}
      <div className="mb-8">
        <h2 className="text-[var(--text)] font-serif text-lg mb-3">Active Members</h2>
        <div className="space-y-2">
          {team.map((member) => {
            const meta = ROLE_META[member.role] ?? ROLE_META.support
            const isYou = member.id === user.id
            // Admins are protected — only owner can remove or change admin roles
            const canRemove = canManageTeam && !isYou && member.role !== 'owner' && (member.role !== 'admin' || isOwner)
            const canEditRole = canManageTeam && !isYou && member.role !== 'owner' && (member.role !== 'admin' || isOwner)
            return (
              <div
                key={member.id}
                className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border-color)] rounded px-5 py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[var(--text)] text-sm">{member.full_name || member.email}</p>
                    {isYou && <span className="text-[#C9A227] text-[10px] uppercase tracking-wider">you</span>}
                  </div>
                  {member.full_name && (
                    <p className="text-[var(--text-3)] text-xs mt-0.5">{member.email}</p>
                  )}
                  <p className="text-[var(--text-4)] text-[10px] mt-0.5">
                    Since {new Date(member.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${meta.color}`}>
                    {meta.label}
                  </span>
                  {canEditRole && (
                    <ChangeRoleButton
                      profileId={member.id}
                      currentRole={member.role as 'admin' | 'manager' | 'support'}
                      canChangeAdmins={isOwner}
                    />
                  )}
                  {canRemove && (
                    <RemoveTeamMemberButton profileId={member.id} email={member.email} name={member.full_name || member.email} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pending invites */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-[var(--text)] font-serif text-lg mb-3">Pending Invites</h2>
          <p className="text-[var(--text-3)] text-xs mb-3">Login link sent — waiting for them to accept.</p>
          <div className="space-y-2">
            {pending.map((inv) => {
              const meta = ROLE_META[inv.intended_role ?? 'admin'] ?? ROLE_META.admin
              return (
                <div
                  key={inv.email}
                  className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border-color)] rounded px-5 py-3.5 opacity-60"
                >
                  <div>
                    <p className="text-[var(--text)] text-sm">{inv.email}</p>
                    <p className="text-[var(--text-3)] text-xs mt-0.5">
                      Invited {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${meta.color}`}>
                    {meta.label} · Pending
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
