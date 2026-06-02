'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserRole } from '@/types'

interface SidebarProps {
  role: UserRole
  memberName?: string
}

const adminNav = [
  { href: '/admin', label: 'Members', icon: '◉' },
  { href: '/admin/reports', label: 'Reports', icon: '◈' },
  { href: '/admin/bulk-reports', label: 'Bulk Reports', icon: '◇' },
  { href: '/admin/log', label: 'Log This Week', icon: '◆' },
  { href: '/admin/team', label: 'Team', icon: '◑' },
]

const memberNav = [
  { href: '/dashboard', label: 'My Dashboard', icon: '◉' },
  { href: '/dashboard/blueprint', label: 'My Blueprint', icon: '◈' },
  { href: '/dashboard/reports', label: 'My Reports', icon: '◆' },
  { href: '/dashboard/notes', label: 'My Notes', icon: '◇' },
  { href: '/dashboard/profile', label: 'My Profile', icon: '◑' },
]

export default function Sidebar({ role, memberName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const nav = role === 'admin' ? adminNav : memberNav

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 min-h-screen bg-[#111111] border-r border-[#2A2A2A] flex flex-col">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-7 h-7 rounded-full border border-[#CC1F1F] flex items-center justify-center flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F]" />
          </div>
          <span className="text-white font-serif text-base leading-none">The Circle</span>
        </div>
        <p className="text-[#555] text-[10px] tracking-widest uppercase pl-10">
          {role === 'admin' ? 'Admin' : 'Member Portal'}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all ${
                active
                  ? 'bg-[#C9A227]/10 text-[#C9A227] border-l-2 border-[#C9A227]'
                  : 'text-[#888] hover:text-white hover:bg-[#1A1A1A]'
              }`}
            >
              <span className={`text-xs ${active ? 'text-[#C9A227]' : 'text-[#555]'}`}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-[#2A2A2A]">
        {memberName && (
          <p className="text-[#888] text-xs mb-3 truncate">{memberName}</p>
        )}
        <button
          onClick={handleSignOut}
          className="w-full text-left text-xs text-[#555] hover:text-[#CC1F1F] transition-colors"
        >
          Sign out →
        </button>
      </div>
    </aside>
  )
}
