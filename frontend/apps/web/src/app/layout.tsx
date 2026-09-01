import type { Metadata } from 'next';
import QueryProvider from '@/lib/query-provider';
import ToastContainer from '@/components/ui/ToastContainer';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata: Metadata = {
  title: 'Pantopus - Your real-world network',
  description:
    'Connect, earn, and manage real-world life with Pantopus - the all-in-one network for people, homes, local work, and Beacons.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased bg-app text-app selection:bg-primary-200/70 selection:text-app-text dark:selection:text-gray-950">
        <QueryProvider>{children}</QueryProvider>
        <ToastContainer />
        <ConfirmDialog />
      </body>
    </html>
  );
}
