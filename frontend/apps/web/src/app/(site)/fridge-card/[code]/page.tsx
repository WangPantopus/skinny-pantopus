// ============================================================
// /fridge-card/[code] — the public 911-ready household card. The link
// every issued fridge card carries (and its printout's URL). Never
// indexed: it exists only for whoever the household handed it to.
// ============================================================

import type { Metadata, Viewport } from 'next';
import FridgeCardView from '@/components/place/fridge-card/FridgeCardView';

export const metadata: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: 'Household emergency card',
  description: 'The 911-ready household card prepared by the verified residents of this address.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

export default async function FridgeCardPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <FridgeCardView code={code} />;
}
