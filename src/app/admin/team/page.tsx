import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminTeamPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // Get all admin profiles
  const { data: admins } = await supabase
    .from('profiles')
    .select('id, email, role, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })

  // Get pending admin invites
  const { data: pendingInvites } = await supabase
    .from('admin_invites')
    .select('email, invited_by, created_at')
    .order('created_at', { ascending: false })

  const allAdmins = admins ?? []
  const pending = pendingInvites ?? []

  // Filter out invites for emails that already have an admin profile
  const adminEmails = new Set(allAdmins.map(a => a.email))
  const trulyPending = pending.filter(inv => !adminEmails.has(inv.email))

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
        <h1 className="text-white font-serif text-3xl">Team & Profiles</h1>
        <p className="text-[#555] text-sm mt-1">People with admin access to The Circle portal.</p>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#C9A227]/40 to-transparent mb-8" />

      {/* Active Admins */}
      <div className="mb-8">
        <h2 className="text-white font-serif text-lg mb-4">Active Admins</h2>
        <div className="space-y-2">
          {allAdmins.length === 0 && (
            <p className="text-[#555] text-sm">No admins found.</p>
          )}
          {allAdmins.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center justify-between bg-[#1A1A1A] border border-[#2A2A2A] rounded px-5 py-3.5"
            >
              <div>
                <p className="text-white text-sm">{admin.email}</p>
                <p className="text-[#555] text-xs mt-0.5">
                  Admin since {new Date(admin.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {admin.id === user.id && (
                    <span className="ml-2 text-[#C9A227]">· You</span>
                  )}
                </p>
              </div>
              <span className="text-[#C9A227] text-xs tracking-wider uppercase">◆ Admin</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invites */}
      {trulyPending.length > 0 && (
        <div>
          <h2 className="text-white font-serif text-lg mb-4">Pending Invites</h2>
          <p className="text-[#555] text-xs mb-3">
            These emails have been sent a login link but haven't logged in yet.
          </p>
          <div className="space-y-2">
            {trulyPending.map((inv) => (
              <div
                key={inv.email}
                className="flex items-center justify-between bg-[#1A1A1A] border border-[#2A2A2A] rounded px-5 py-3.5 opacity-70"
              >
                <div>
                  <p className="text-white text-sm">{inv.email}</p>
                  <p className="text-[#555] text-xs mt-0.5">
                    Invited {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <span className="text-[#555] text-xs tracking-wider uppercase">◇ Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {trulyPending.length === 0 && allAdmins.length > 0 && (
        <p className="text-[#333] text-xs">
          To add a new admin, use the + Add Member button on the Members page and select Admin Access.
        </p>
      )}
    </div>
  )
}
