import type {Metadata} from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'ECP Connect',
  description: 'Sistem Komunikasi Internal ECP Connect dengan enkripsi, notifikasi desktop, dan kunci layar.',
  openGraph: {
    title: 'ECP Connect',
    description: 'Sistem Komunikasi Internal ECP Connect dengan enkripsi, notifikasi desktop, dan kunci layar.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900" suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
