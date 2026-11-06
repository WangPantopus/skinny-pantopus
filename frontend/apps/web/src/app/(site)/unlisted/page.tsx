// ============================================================
// /unlisted — the anonymous "get my address off the internet" surface.
// Public: renders outside the app chrome. Never indexed — someone
// arriving here may not want the visit discoverable, and the page
// persists nothing.
// ============================================================

import type { Metadata, Viewport } from 'next';
import UnlistedView from '@/components/place/unlisted/UnlistedView';

export const metadata: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: 'Get your address off the internet',
  description:
    'Your state’s address confidentiality program, plus a verified opt-out path for each of the people-search sites that republish county property records.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

export default function UnlistedPage() {
  return <UnlistedView />;
}
