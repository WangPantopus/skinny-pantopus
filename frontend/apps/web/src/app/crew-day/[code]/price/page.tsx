import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { buildCrewDayPath } from '@pantopus/utils';
import { crewDayUnavailable, readCrewDayForPage } from '@/lib/crewDayServer';
import { CrewDayLoadFailed } from '@/components/crew-day/CrewDayParts';
import CrewDayPriceScreen from '@/components/crew-day/CrewDayPriceScreen';

// Screen 2, Your price, signed in or out. A day that can't be booked now, the crew's own members and a household
// that already booked go back to the invitation, which says why and has their button.
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code: rawCode } = await params;
  const { day } = await readCrewDayForPage(rawCode);
  return {
    title: day ? `Your price · ${day.title} | Pantopus` : 'Crew Day not available | Pantopus',
    robots: { index: false, follow: false },
  };
}

export default async function CrewDayPricePage({ params }: PageProps) {
  const { code: rawCode } = await params;
  const page = await readCrewDayForPage(rawCode);
  if (crewDayUnavailable(page) || !page.code) notFound();
  const { code, day } = page;
  if (!day) return <CrewDayLoadFailed code={code} retryHref={`${buildCrewDayPath(code)}/price`} />;
  if (day.availability !== 'open' || day.viewer?.role === 'crew' || day.viewer?.booking_id) redirect(buildCrewDayPath(code));
  return <CrewDayPriceScreen day={day} />;
}
