import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LedeWire Producer',
  description: 'Merchant admin for the LedeWire content platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased" suppressHydrationWarning>{children}</body>
    </html>
  )
}
