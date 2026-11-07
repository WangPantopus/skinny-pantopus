// ============================================================
// /open/[mailId]?token=… — a letter for someone who isn't on Pantopus
// yet. The letter's email (or text) links here. Never indexed or
// cached, and sent with no referrer (next.config.js): the link carries
// the claim token. Hidden unless both mail_extras and mailbox are on
// (launch cuts #8 and #10, src/lib/featureFlags.ts). With card_table on, a
// Christmas card's link previews as the fixed sealed envelope, never the
// card, whoever it's for and whoever sent it.
// ============================================================

import { cache } from 'react';
import type { Metadata, Viewport } from 'next';
import { API_BASE_URL, APP_WEB_URL } from '@pantopus/utils';
import OpenLetterView from '@/components/mailbox/OpenLetterView';
import { launchFeatures } from '@/lib/featureFlags';

const LETTER: Metadata = {
  metadataBase: new URL('https://pantopus.com'),
  title: 'A letter for you',
  description: 'Someone sent you a letter on Pantopus.',
  robots: { index: false, follow: false },
};

const CARD_TITLE = 'A Christmas card for you';
const CARD_LINE = 'Someone sent you a Christmas card on Pantopus.';
const CARD: Metadata = {
  metadataBase: new URL(APP_WEB_URL),
  title: CARD_TITLE,
  description: CARD_LINE,
  robots: { index: false, follow: false },
  openGraph: {
    title: CARD_TITLE,
    description: CARD_LINE,
    type: 'website',
    images: [{ url: '/holiday-cards/share/sealed-link.jpg', width: 1200, height: 630, alt: 'A sealed red envelope with a gold wax seal' }],
  },
  twitter: { card: 'summary_large_image', title: CARD_TITLE, description: CARD_LINE, images: ['/holiday-cards/share/sealed-link.jpg'] },
};

/** Whether this link is a Christmas card's. Only the server knows, and it tells only that. Shared by the page and its metadata. */
const isCardLink = cache(async (mailId: string, token: string): Promise<boolean> => {
  if (!launchFeatures.cardTable || !token) return false;
  try {
    const response = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}/api/mailbox/claim/${encodeURIComponent(mailId)}?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const answer = await response.json() as { mail?: { card?: unknown }; card?: unknown };
    return Boolean(answer.mail?.card || answer.card);
  } catch {
    return false;
  }
});

type OpenLetterParams = {
  params: Promise<{ mailId: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: OpenLetterParams): Promise<Metadata> {
  const { mailId } = await params;
  const { token } = await searchParams;
  return (await isCardLink(mailId, typeof token === 'string' ? token : '')) ? CARD : LETTER;
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f7f9',
};

export default async function OpenLetterPage({ params, searchParams }: OpenLetterParams) {
  const { mailId } = await params;
  const { token } = await searchParams;
  const claimToken = typeof token === 'string' ? token : '';
  return <OpenLetterView mailId={mailId} token={claimToken} isCard={await isCardLink(mailId, claimToken)} />;
}
