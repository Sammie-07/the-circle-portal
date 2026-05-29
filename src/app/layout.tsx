import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="en" className="h-full dark">
      <body className="min-h-full bg-[#0D0D0D] text-[#F5F5F5] antialiased">
        {children}
      </body>
    </html>
  )
}
