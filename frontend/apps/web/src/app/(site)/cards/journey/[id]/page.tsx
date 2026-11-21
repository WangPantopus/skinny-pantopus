// ============================================================
// /cards/journey/[id] — a travelling card's journey (docs/product/travelling-card-2026-11-21, Part 5). Public, no
// sign-in, and not indexed: the id is random and long, and in this address only. Towns and dates only. Hidden unless
// the travelling card is on (the server's /api/mailbox/cards/journeys/:id answers 404 otherwise).
// ============================================================

import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { APP_WEB_URL } from '@pantopus/utils';
import JourneyPage, { JourneyTrouble } from '@/components/mailbox/cards/JourneyPage';
import { fetchCardJourney } from '@/lib/publicShare';

export const dynamic = 'force-dynamic';

type JourneyPageProps = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: JourneyPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data } = UUID.test(id) ? await fetchCardJourney(id) : { data: null };
  const title = 'This card’s journey';
  if (!data) return { metadataBase: new URL(APP_WEB_URL), title, robots: { index: false, follow: false } };
  const description = `${data.miles.toLocaleString('en-US')} miles, ${data.towns} ${data.towns === 1 ? 'town' : 'towns'}, ${data.states} of ${data.states_of} states. A Christmas card passed from home to home on Pantopus.`;
  const url = `/cards/journey/${id}`;
  const image = { url: `/api/og/journey?id=${id}`, width: 1200, height: 630, alt: 'A map of the United States with a Christmas card’s route' };
  return {
    metadataBase: new URL(APP_WEB_URL),
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { type: 'website', url, siteName: 'Pantopus', title, description, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#17110c' };

export default async function CardJourneyRoute({ params }: JourneyPageProps) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data, status } = await fetchCardJourney(id);
  if (!data) {
    if (status === 404) notFound();
    return <JourneyTrouble />;
  }
  return <JourneyPage journey={data} />;
}
