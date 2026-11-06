// ============================================================
// /verify-claim — public third-party check for residency CLAIMS.
// Every shared claim links to /verify-claim/[code]; this bare page is
// the type-the-code fallback. Server component for SEO; the code form
// is the client child <VerifyClaim/>.
// ============================================================

import type { Metadata, Viewport } from 'next';
import VerifyClaim from '@/components/place/verify-claim/VerifyClaim';

const TITLE = 'Verify a Pantopus residency claim';
const DESCRIPTION =
  'Enter the code on a Pantopus residency claim to confirm it is genuine — checked live against the holder’s current address verification.';

export const metadata: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/verify-claim' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: '/verify-claim',
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

export default function VerifyClaimPage() {
  return <VerifyClaim />;
}
