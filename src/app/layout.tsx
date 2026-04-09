import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Xindus OS — Cost Engine',
  description: 'End-to-end logistics cost computation platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
