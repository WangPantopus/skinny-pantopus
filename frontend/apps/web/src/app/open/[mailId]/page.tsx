// ============================================================
// /open/[mailId]?token=… — a letter for someone who isn't on Pantopus
// yet. The letter's email (or text) links here. Never indexed or
// cached, and sent with no referrer (next.config.js): the link carries
// the claim token. Hidden unless both mail_extras and mailbox are on
// (launch cuts #8 and #10, src/lib/featureFlags.ts).
// ============================================================

import type { Metadata, Viewport } from 'next';
import OpenLetterView from '@/components/mailbox/OpenLetterView';

export const metadata: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: 'A letter for you',
  description: 'Someone sent you a letter on Pantopus.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

export default async function OpenLetterPage({
  params,
  searchParams,
}: {
  params: Promise<{ mailId: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { mailId } = await params;
  const { token } = await searchParams;
  return <OpenLetterView mailId={mailId} token={typeof token === 'string' ? token : ''} />;
}
