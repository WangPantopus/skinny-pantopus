// ============================================================
// /verify-residency — public third-party check for residency letters.
// Every issued letter prints "Enter this code at
// pantopus.com/verify-residency"; this is that page. Server component
// for SEO; the code form is the client child <VerifyResidency/>.
// ============================================================

import type { Metadata, Viewport } from 'next';
import VerifyResidency from '@/components/place/verify-residency/VerifyResidency';

const TITLE = 'Verify a Pantopus residency letter';
const DESCRIPTION =
  'Enter the verification code printed on a Pantopus residency letter to confirm it is genuine and still active.';

export const metadata: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/verify-residency' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: '/verify-residency',
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

export default function VerifyResidencyPage() {
  return <VerifyResidency />;
}
