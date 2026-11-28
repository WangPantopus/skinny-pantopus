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
import { PublicCardsPage, PublicCardsTrouble, PublicShelvesPage } from '@/components/mailbox/cards/PublicCards';
import CardsGoal from '@/components/mailbox/cards/CardsGoal';
import { cardsStoreLink, fetchCardJourneyGoal, fetchPublicCardDesigns, getStoreDownloadCta, openThankYou, publicShelvesOn, shareRefFrom, storePlatform } from '@/lib/publicShare';
import type { PublicCardsStore } from '@/components/mailbox/cards/PublicCards';
import { cardListLd, cardsInPageOrder, cardsJsonLd } from './_lib/structuredData';

// Rendered on every request. A build or a first visit that met the server with
// cards off (or down) would otherwise be saved as a fixed "not found" page, and
// stay that way until the next web deploy (production, November 9).
export const dynamic = 'force-dynamic';

// TITLE and DESCRIPTION are the shared link's card; the page's own title and description say what people search for
// ("digital Christmas cards", "Christmas ecards", "send online") and count the cards from the list the page draws.
const TITLE = 'Christmas cards you can send on Pantopus';
const DESCRIPTION = 'Pick a card and send it to someone. It arrives with their morning mail, and they open it like real mail.';
const PAGE_TITLE = 'Digital Christmas cards and ecards to send online | Pantopus';
const IMAGE = { url: '/holiday-cards/share/christmas-2026-08-link.jpg', width: 1200, height: 630, alt: 'A Christmas card lying on its open envelope' };

export async function generateMetadata(): Promise<Metadata> {
  // The same answer the page draws, kept a minute (fetchPublicCardDesigns).
  const { data } = await fetchPublicCardDesigns();
  const cards = data?.designs?.length ?? 0;
  const collections = data && publicShelvesOn(data) ? (data.collections ?? []).length : 0;
  const description = cards
    ? `${cards} Christmas cards${collections > 1 ? ` in ${collections} collections` : ''} to send online. Pick one, write a few words and sign it.${
        data?.free_cards ? ` Your first ${data.free_cards} are free.` : ''
      } It arrives with their morning mail.`
    : DESCRIPTION;
  return {
    metadataBase: new URL(APP_WEB_URL),
    title: { absolute: PAGE_TITLE },
    description,
    alternates: { canonical: '/cards' },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', url: '/cards', siteName: 'Pantopus', title: TITLE, description: DESCRIPTION, images: [IMAGE] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [IMAGE.url] },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#171e2d' };

export default async function AllCardsPage({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const [{ data, status }, goal] = await Promise.all([fetchPublicCardDesigns(), fetchCardJourneyGoal()]);
  if (status === 404) notFound();
  if (!data) return <PublicCardsTrouble />;
  const inviteCode = shareRefFrom((await searchParams).ref);
  const store = await phoneStore('/app/mailbox/cards', inviteCode);
  // The shared goal (travelling card Part 8): only while the travelling card is on (404 otherwise), the server answers,
  // and at least one card is travelling (an empty map and "0 of 50 states" say nothing on the day it's switched on).
  const goalShown = goal.data && goal.data.travelling > 0 ? <CardsGoal goal={goal.data} /> : null;
  const shelves = publicShelvesOn(data);
  // Thank-you cards (Wave 5): while the server lists a thank-you collection as open, it is the last shelf, after every
  // Christmas collection, and its cards and page are linked from here. The Christmas catalog and its order are untouched.
  const thanks = openThankYou(data);
  const designs = [...data.designs, ...thanks.designs];
  const collections = [...(data.collections ?? []), ...thanks.collections];
  // For search engines, every card the page shows, in its order (data only; nothing drawn).
  const list = (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: cardsJsonLd(cardListLd({ name: TITLE, path: '/cards', designs: cardsInPageOrder(designs, collections, shelves) })),
      }}
    />
  );
  // The shelves (server key card_shelves, card shelves SPEC Part D); without them, today's page.
  if (shelves) {
    return (
      <>
        <PublicShelvesPage designs={designs} collections={collections} opening={data.opening ?? null} inviteCode={inviteCode} store={store}
          freeCards={data.free_cards ?? null} goal={goalShown} />
        {list}
      </>
    );
  }
  return (
    <>
      <PublicCardsPage designs={designs} collections={collections} inviteCode={inviteCode} store={store} freeCards={data.free_cards ?? null}
        goal={goalShown} />
      {list}
    </>
  );
}

/**
 * On a phone, the store button that carries the sending flow (`path`) through the install, or the join link of the
 * code in `ref` when it is a creator's code (`cardsStoreLink`); null anywhere else.
 */
async function phoneStore(path: string, ref: string | null): Promise<PublicCardsStore | null> {
  const userAgent = (await headers()).get('user-agent') || '';
  const platform = storePlatform(userAgent);
  if (!platform) return null;
  const carried = await cardsStoreLink(path, ref);
  const cta = getStoreDownloadCta(userAgent, carried.path);
  return cta ? { href: cta.href, copyPath: cta.copyPath ?? null, platform, ...(carried.joins ? { joins: true } : {}) } : null;
}
