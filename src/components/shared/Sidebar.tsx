'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserRole } from '@/types'
import { useTheme } from './ThemeProvider'

interface SidebarProps {
  role: UserRole
  memberName?: string
}

const adminNav = [
  { href: '/admin', label: 'Members', icon: '◉' },
  { href: '/admin/homework', label: 'Homework', icon: '◔' },
  { href: '/admin/reports', label: 'Reports', icon: '◈' },
  { href: '/admin/bulk-reports', label: 'Bulk Reports', icon: '◇' },
  { href: '/admin/log', label: 'Log This Week', icon: '◆' },
  { href: '/admin/payments', label: 'Payments', icon: '$' },
  { href: '/admin/office-hours', label: 'Office Hours', icon: '▶' },
  { href: '/admin/chats', label: 'Ask Gogo Chats', icon: '◌' },
  { href: '/admin/team', label: 'Team', icon: '◑' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙' },
]

const memberNav = [
  { href: '/dashboard', label: 'My Dashboard', icon: '◉' },
  { href: '/dashboard/blueprint', label: 'My Blueprint', icon: '◈' },
  { href: '/dashboard/reports', label: 'My Reports', icon: '◆' },
  { href: '/dashboard/calls', label: 'My Calls', icon: '▶' },
  { href: '/dashboard/documents', label: 'My Documents', icon: '◈' },
  { href: '/dashboard/notes', label: 'My Notes', icon: '◇' },
  { href: '/dashboard/profile', label: 'My Profile', icon: '◑' },
]

function Logo({ subtitle }: { subtitle: string }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-7 h-7 rounded-full border border-[#CC1F1F] flex items-center justify-center flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F]" />
        </div>
        <span className="text-[var(--text)] font-serif text-base leading-none">The Circle</span>
      </div>
      <p className="text-[var(--text-3)] text-[10px] tracking-widest uppercase pl-10">{subtitle}</p>
    </div>
  )
}

export default function Sidebar({ role, memberName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggle } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = role === 'admin' ? adminNav : memberNav
  const subtitle = role === 'admin' ? 'Admin' : 'Member Portal'

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navLinks = (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {nav.map((item) => {
        const active = pathname === item.href || (item.href !== '/admin' && item.href !== '/dashboard' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all ${
              active
                ? 'bg-[#C9A227]/10 text-[#C9A227] border-l-2 border-[#C9A227]'
                : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
            }`}
          >
            <span className={`text-xs ${active ? 'text-[#C9A227]' : 'text-[var(--text-3)]'}`}>{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  const userSection = (
    <div className="px-4 py-4 border-t border-[var(--border-color)]">
      {memberName && (
        <p className="text-[var(--text-2)] text-xs mb-3 truncate">{memberName}</p>
      )}
      <button
        onClick={toggle}
        className="w-full text-left text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors mb-2"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
      </button>
      <button
        onClick={handleSignOut}
        className="w-full text-left text-xs text-[var(--text-3)] hover:text-[#CC1F1F] transition-colors"
      >
        Sign out →
      </button>
    </div>
  )

  return (
    <>
      {/* Mobile top bar (in normal flow, stacked above main content) */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-[var(--sidebar-bg)] border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full border border-[#CC1F1F] flex items-center justify-center flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F]" />
          </div>
          <span className="text-[var(--text)] font-serif text-base">The Circle</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-2 -mr-2 text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="19" y2="6" />
            <line x1="3" y1="11" x2="19" y2="11" />
            <line x1="3" y1="16" x2="19" y2="16" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer + backdrop */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[82%] bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] flex flex-col shadow-2xl">
            <div className="px-6 py-5 border-b border-[var(--border-color)] flex items-start justify-between">
              <Logo subtitle={subtitle} />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="text-[var(--text-3)] hover:text-[var(--text)] text-xl leading-none -mt-1"
              >
                ✕
              </button>
            </div>
            {navLinks}
            {userSection}
          </aside>
        </div>
      )}

      {/* Desktop sidebar — pinned to the viewport so the footer (user / theme /
          sign out) stays in place and doesn't drop to the bottom of long pages. */}
      <aside className="hidden md:flex w-56 h-screen sticky top-0 self-start bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] flex-col">
        <div className="px-6 py-7 border-b border-[var(--border-color)]">
          <Logo subtitle={subtitle} />
        </div>
        {navLinks}
        {userSection}
      </aside>
    </>
  )
}
