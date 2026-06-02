import type { Metadata } from 'next'
import './globals.css'
import ThemeProvider from '@/components/shared/ThemeProvider'

export const metadata: Metadata = {
  title: 'The Circle · Member Portal',
  description: 'Gogo Bethke — The Circle Coaching Program',
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
        </ThemeProvider>
      </body>
    </html>
  )
}
