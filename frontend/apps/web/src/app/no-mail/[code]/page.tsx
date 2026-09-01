// ============================================================
// /no-mail/[code] — the invite recipient's kill switch. Printed on
// every Block Founders postcard. The opt-out itself is a POST behind
// a confirm button so link prefetchers can't opt an address out.
// Never indexed.
// ============================================================

import type { Metadata, Viewport } from 'next';
import NoMailView from '@/components/place/no-mail/NoMailView';

export const metadata: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: 'Stop mail to this address',
  description: 'Permanently stop Pantopus neighbor invitations to your address.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

export default async function NoMailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <NoMailView code={code} />;
}
