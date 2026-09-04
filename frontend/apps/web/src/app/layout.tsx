import type { Metadata } from 'next';
import QueryProvider from '@/lib/query-provider';
import ToastContainer from '@/components/ui/ToastContainer';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata: Metadata = {
  // Mirrors the wedge copy on /start, which is the canonical promise. This
  // is only the inherited default — /start and the other routes that carry
  // their own generateMetadata still win.
  title: "Pantopus - See what's true about your address",
  description:
    "Public records, local risks, and who's verified nearby - free, no account. Look up any U.S. address, then save your place to get daily updates.",
  // public/favicon.ico is the fallback for clients that probe the document
  // root and ignore the SVG; it needs no entry here. The Apple touch icon
  // DOES — iOS Safari would otherwise find it only by root-probing, which
  // is a convention, not a declaration.
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
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
