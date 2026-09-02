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
  { href: '/admin/progress', label: 'Progress', icon: '▲' },
  { href: '/admin/content', label: 'Content', icon: '✦' },
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
  { href: '/dashboard/homework', label: 'My Homework', icon: '◔' },
  { href: '/dashboard/blueprint', label: 'My Blueprint', icon: '◈' },
  { href: '/dashboard/reports', label: 'My Reports', icon: '◆' },
  { href: '/dashboard/calls', label: 'My Calls', icon: '▶' },
  { href: '/dashboard/documents', label: 'My Documents', icon: '◈' },
  { href: '/dashboard/notes', label: 'My Notes', icon: '◇' },
  { href: '/dashboard/profile', label: 'My Profile', icon: '◑' },
]

// The Circle network mark — a ring with four connection nodes.
function CircleMark({ size = 30 }: { size?: number }) {
  const s = { width: size, height: size }
  return (
    <div className="rounded-full flex-none relative" style={{ ...s, border: '1px solid var(--red)' }}>
      <span className="absolute rounded-full" style={{ width: 4, height: 4, background: 'var(--red)', top: 3, left: '50%', marginLeft: -2 }} />
      <span className="absolute rounded-full" style={{ width: 4, height: 4, background: 'var(--red)', bottom: 3, left: '50%', marginLeft: -2 }} />
      <span className="absolute rounded-full" style={{ width: 4, height: 4, background: 'var(--red)', left: 3, top: '50%', marginTop: -2 }} />
      <span className="absolute rounded-full" style={{ width: 4, height: 4, background: 'var(--red)', right: 3, top: '50%', marginTop: -2 }} />
    </div>
  )
}

function Logo({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <CircleMark size={30} />
      <div>
        <p className="text-[var(--text)] font-serif text-[17px] leading-none">The Circle</p>
        <p className="text-[var(--text-3)] text-[8.5px] tracking-[0.26em] uppercase mt-1">{subtitle}</p>
      </div>
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
  const displayName = memberName ?? 'The Circle'
  const initials = displayName.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'TC'

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navLinks = (
    <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
      {nav.map((item) => {
        const active = pathname === item.href || (item.href !== '/admin' && item.href !== '/dashboard' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] transition-colors ${
              active
                ? 'bg-[var(--gold-soft)] text-[var(--gold-text)]'
                : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
            }`}
          >
            <span className={`text-xs ${active ? 'text-[var(--gold)]' : 'text-[var(--text-3)]'}`}>{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  const userSection = (
    <div className="p-3">
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-none" style={{ background: '#F4A7B9', color: '#5A2233' }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[var(--text)] text-[12.5px] truncate">{displayName}</p>
            <p className="text-[var(--text-3)] text-[10px]">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={toggle}
          className="text-center py-1.5 rounded-md bg-[var(--surface-2)] text-[10.5px] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[var(--border-2)] text-[11.5px] font-medium text-[var(--text-2)] hover:border-[var(--red)] hover:text-[var(--red-text)] transition-colors"
        >
          Sign out →
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-[var(--sidebar-bg)] border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2.5">
          <CircleMark size={24} />
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
            <div className="px-5 py-5 border-b border-[var(--border-color)] flex items-start justify-between">
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

      {/* Desktop sidebar — pinned to the viewport so the footer stays in place. */}
      <aside className="hidden md:flex w-[250px] h-screen sticky top-0 self-start bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] flex-col">
        <div className="px-5 py-6">
          <Logo subtitle={subtitle} />
        </div>
        {navLinks}
        {userSection}
      </aside>
    </>
  )
}
