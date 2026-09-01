// ============================================================
// /verify-residency/[code] — the deep link printed on every residency
// letter. Renders the same client checker with the code pre-filled and
// auto-checked.
// ============================================================

import type { Metadata, Viewport } from 'next';
import VerifyResidency from '@/components/place/verify-residency/VerifyResidency';

export const metadata: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: 'Verify a Pantopus residency letter',
  description:
    'Confirm a Pantopus residency letter is genuine and still active.',
  robots: { index: false, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

export default async function VerifyResidencyCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <VerifyResidency initialCode={code} />;
}
