// ============================================================
// /cards/[slug] — one Christmas card on its table, with "Send this card to
// someone". What a shared card's link opens. Public and indexable, with the
// picture's Link preview. Never a person's name or note. Hidden unless
// Christmas cards are on (the server's /api/mailbox/cards/designs answers 404 otherwise). ?ref= is the invite
// code of whoever shared it, kept for sign-up.
// ============================================================

import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { APP_WEB_URL } from '@pantopus/utils';
import { tableEdge } from '@/components/mailbox/cards/cardArt';
import { PublicCardPage, PublicCardsTrouble } from '@/components/mailbox/cards/PublicCards';
import { cardsStoreLink, fetchPublicCardDesigns, getStoreDownloadCta, openThankYou, publicShelvesOn, shareRefFrom, storePlatform } from '@/lib/publicShare';
import type { PublicCardsStore } from '@/components/mailbox/cards/PublicCards';
import { cardDescription, cardLd, cardTrailLd, cardsJsonLd, collectionOf, hasTwin } from '../_lib/structuredData';

// Rendered on every request. A build or a first visit that met the server with
// cards off (or down) would otherwise be saved as a fixed "not found" page, and
// stay that way until the next web deploy (production, November 9).
export const dynamic = 'force-dynamic';

type CardPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string | string[] }>;
};

async function designFor(slug: string) {
  const { data, status } = await fetchPublicCardDesigns();
  // A thank-you card's page (Wave 5) exists only while the server lists its collection as open.
  const thanks = openThankYou(data);
  const design = data?.designs.find((candidate) => candidate.slug === slug) ?? thanks.designs.find((candidate) => candidate.slug === slug) ?? null;
  const thanked = design?.kind === 'thank_you';
  const collection = data && design ? collectionOf(design, thanked ? thanks.collections : data.collections ?? []) : null;
  const twin = data && design && !thanked ? hasTwin(design, data.designs) : false;
  // A thank-you collection has its own page whenever it is open (no shelves switch).
  const shelves = thanked ? true : data ? publicShelvesOn(data) : false;
  return { design, collection, twin, shelves, year: data?.year ?? new Date().getFullYear(), status };
}

export async function generateMetadata({ params }: CardPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { design, collection, twin } = await designFor(slug);
  if (!design) return { metadataBase: new URL(APP_WEB_URL), title: 'Christmas cards on Pantopus', robots: { index: false, follow: true } };
  // A caption ends with a full stop, or a question mark; the First Christmas ones end with their verse's reference.
  const sentence = /[.!?]$/.test(design.caption) ? design.caption : `${design.caption}.`;
  const kind = design.kind === 'thank_you' ? 'thank-you card' : 'Christmas card';
  const title = `${sentence} A ${kind} on Pantopus${twin ? ` (card ${design.number})` : ''}`;
  const description = cardDescription(design, collection, twin);
  const url = `/cards/${design.slug}`;
  const image = { url: `/holiday-cards/share/${design.id}-link.jpg`, width: 1200, height: 630, alt: `A ${kind}: ${design.caption}` };
  return {
    metadataBase: new URL(APP_WEB_URL),
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', url, siteName: 'Pantopus', title, description, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export async function generateViewport({ params }: CardPageProps): Promise<Viewport> {
  const { slug } = await params;
  const { design } = await designFor(slug);
  return { width: 'device-width', initialScale: 1, themeColor: tableEdge(design?.table) };
}

export default async function OneCardPage({ params, searchParams }: CardPageProps) {
  const { slug } = await params;
  const { design, collection, twin, shelves, year, status } = await designFor(slug);
  if (!design) {
    // Not one of the cards, or the feature is off (the server says 404). Anything else: the server didn't answer.
    if (status === 200 || status === 404) notFound();
    return <PublicCardsTrouble />;
  }
  const inviteCode = shareRefFrom((await searchParams).ref);
  const store = await phoneStore(`/app/mailbox/cards?design=${encodeURIComponent(design.id)}`, inviteCode);
  return (
    <>
      <PublicCardPage design={design} year={year} inviteCode={inviteCode} store={store} />
      {/* For search engines, what this card is (data only; nothing drawn). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: cardsJsonLd(cardLd({ design, collection, shelves, twin })) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: cardsJsonLd(
            cardTrailLd([
              ...(shelves && collection?.slug ? [{ name: collection.name, path: `/cards/collection/${collection.slug}` }] : []),
              { name: design.caption, path: `/cards/${design.slug}` },
            ], design.kind === 'thank_you' ? 'Cards' : undefined),
          ),
        }}
      />
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
