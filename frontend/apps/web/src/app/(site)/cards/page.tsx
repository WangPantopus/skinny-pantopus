// ============================================================
// /cards — every Christmas card, where a shared picture's slip sends people
// ("Send one at pantopus.com/cards"). Public and indexable. Hidden unless
// Christmas cards are on (the server's /api/mailbox/cards/designs answers 404 otherwise). ?ref= is the invite
// code of whoever shared it, kept for sign-up.
// ============================================================

import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { APP_WEB_URL } from '@pantopus/utils';
import { PublicCardsPage, PublicCardsTrouble } from '@/components/mailbox/cards/PublicCards';
import { fetchPublicCardDesigns, getStoreDownloadCta, shareRefFrom, storePlatform } from '@/lib/publicShare';
import type { PublicCardsStore } from '@/components/mailbox/cards/PublicCards';

// Rendered on every request. A build or a first visit that met the server with
// cards off (or down) would otherwise be saved as a fixed "not found" page, and
// stay that way until the next web deploy (production, November 9).
export const dynamic = 'force-dynamic';

const TITLE = 'Christmas cards you can send on Pantopus';
const DESCRIPTION = 'Pick a card and send it to someone. It arrives with their morning mail, and they open it like real mail.';
const IMAGE = { url: '/holiday-cards/share/christmas-2026-08-link.jpg', width: 1200, height: 630, alt: 'A Christmas card lying on its open envelope' };

export const metadata: Metadata = {
  metadataBase: new URL(APP_WEB_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/cards' },
  robots: { index: true, follow: true },
  openGraph: { type: 'website', url: '/cards', siteName: 'Pantopus', title: TITLE, description: DESCRIPTION, images: [IMAGE] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [IMAGE.url] },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#171e2d' };

export default async function AllCardsPage({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const { data, status } = await fetchPublicCardDesigns();
  if (status === 404) notFound();
  if (!data) return <PublicCardsTrouble />;
  const store = await phoneStore('/app/mailbox/cards');
  return <PublicCardsPage designs={data.designs} collections={data.collections ?? []} inviteCode={shareRefFrom((await searchParams).ref)} store={store} />;
}

/** On a phone, the store button that carries the sending flow (`path`) through the install; null anywhere else. */
async function phoneStore(path: string): Promise<PublicCardsStore | null> {
  const userAgent = (await headers()).get('user-agent') || '';
  const platform = storePlatform(userAgent);
  const cta = platform ? getStoreDownloadCta(userAgent, path) : null;
  return platform && cta ? { href: cta.href, copyPath: cta.copyPath ?? null, platform } : null;
}
