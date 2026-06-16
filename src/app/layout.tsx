import type { Metadata } from 'next'
import './globals.css'
import ThemeProvider from '@/components/shared/ThemeProvider'
import Toaster from '@/components/shared/Toaster'

export const metadata: Metadata = {
  title: 'The Circle · Member Portal',
  description: 'Gogo Bethke — The Circle Coaching Program',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⭕</text></svg>',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full dark" suppressHydrationWarning>
      <body className="min-h-full bg-[var(--bg)] text-[var(--text)] antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
