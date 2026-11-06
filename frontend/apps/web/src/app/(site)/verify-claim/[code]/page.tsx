// ============================================================
// /verify-claim/[code] — the deep link every shared residency claim
// carries. Renders the same client checker with the code pre-filled
// and auto-checked.
// ============================================================

import type { Metadata, Viewport } from 'next';
import VerifyClaim from '@/components/place/verify-claim/VerifyClaim';

export const metadata: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: 'Verify a Pantopus residency claim',
  description: 'Confirm a Pantopus residency claim is genuine and currently valid.',
  robots: { index: false, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

export default async function VerifyClaimCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <VerifyClaim initialCode={code} />;
}
