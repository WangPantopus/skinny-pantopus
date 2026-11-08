// ============================================================
// /cards/[slug] — one Christmas card on its table, with "Send this card to
// someone". What a shared card's link opens. Public and indexable, with the
// picture's Link preview. Never a person's name or note. Hidden unless the
// launch key card_table is on (src/lib/featureFlags.ts). ?ref= is the invite
// code of whoever shared it, kept for sign-up.
// ============================================================

import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { APP_WEB_URL } from '@pantopus/utils';
import { tableEdge } from '@/components/mailbox/cards/cardArt';
import { PublicCardPage, PublicCardsTrouble } from '@/components/mailbox/cards/PublicCards';
import { fetchPublicCardDesigns, shareRefFrom } from '@/lib/publicShare';

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
  return <PublicCardPage design={design} year={year} inviteCode={shareRefFrom((await searchParams).ref)} />;
}
