// ============================================================
// /start — the public Place preview landing (the sidewalk QR target).
// pantopus.com/start serves this. Server component so it can export
// SEO metadata + OG tags; the interactive funnel is the client child
// <StartFunnel/>. The shell is static (no cookies/headers read) and
// the preview endpoint persists nothing, so this is edge/CDN cacheable.
// ============================================================

import type { Metadata, Viewport } from 'next';
import StartFunnel from '@/components/place/StartFunnel';

const TITLE = "See what's true about your address";
const DESCRIPTION =
  "Public records, local risks, and who's verified nearby — free, no account. Look up any U.S. address, then save your place to get daily updates.";

export const metadata: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/start' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: '/start',
    siteName: 'Pantopus',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

export default function StartPage() {
  return <StartFunnel />;
}
