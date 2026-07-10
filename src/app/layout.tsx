import type { Metadata, Viewport } from 'next'
import './globals.css'
import AuthGuard from '@/components/AuthGuard'
import InstallPromptGate from '@/components/InstallPromptGate'
import PwaBootstrap from '@/components/PwaBootstrap'
import ToastProvider from '@/components/ToastProvider'

export const metadata: Metadata = {
  title: 'ห่านทองคำ',
  description: 'ระบบดูแลการลงทุนรับจำนำทอง',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ห่านทองคำ',
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#080808',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <AuthGuard>
          <ToastProvider>
            <PwaBootstrap />
            <InstallPromptGate />
            {children}
          </ToastProvider>
        </AuthGuard>
      </body>
    </html>
  )
}
