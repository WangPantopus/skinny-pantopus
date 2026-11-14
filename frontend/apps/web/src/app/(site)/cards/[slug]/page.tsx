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
import { fetchPublicCardDesigns, getStoreDownloadCta, shareRefFrom, storePlatform } from '@/lib/publicShare';
import type { PublicCardsStore } from '@/components/mailbox/cards/PublicCards';

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
  return { design: data?.designs.find((candidate) => candidate.slug === slug) ?? null, year: data?.year ?? new Date().getFullYear(), status };
}

export async function generateMetadata({ params }: CardPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { design } = await designFor(slug);
  if (!design) return { metadataBase: new URL(APP_WEB_URL), title: 'Christmas cards on Pantopus', robots: { index: false, follow: true } };
  // A caption ends with a full stop, or a question mark; the First Christmas ones end with their verse's reference.
  const sentence = /[.!?]$/.test(design.caption) ? design.caption : `${design.caption}.`;
  const title = `${sentence} A Christmas card on Pantopus`;
  const description = 'A Christmas card you can send on Pantopus. It arrives with their morning mail, and they open it like real mail.';
  const url = `/cards/${design.slug}`;
  const image = { url: `/holiday-cards/share/${design.id}-link.jpg`, width: 1200, height: 630, alt: `A Christmas card: ${design.caption}` };
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
  const { design, year, status } = await designFor(slug);
  if (!design) {
    // Not one of the cards, or the feature is off (the server says 404). Anything else: the server didn't answer.
    if (status === 200 || status === 404) notFound();
    return <PublicCardsTrouble />;
  }
  const store = await phoneStore(`/app/mailbox/cards?design=${encodeURIComponent(design.id)}`);
  return <PublicCardPage design={design} year={year} inviteCode={shareRefFrom((await searchParams).ref)} store={store} />;
}

/** On a phone, the store button that carries the sending flow (`path`) through the install; null anywhere else. */
async function phoneStore(path: string): Promise<PublicCardsStore | null> {
  const userAgent = (await headers()).get('user-agent') || '';
  const platform = storePlatform(userAgent);
  const cta = platform ? getStoreDownloadCta(userAgent, path) : null;
  return platform && cta ? { href: cta.href, copyPath: cta.copyPath ?? null, platform } : null;
}
