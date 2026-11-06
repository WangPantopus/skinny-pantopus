import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { buildCrewDayPath } from '@pantopus/utils';
import { crewDayUnavailable, readCrewDayForPage } from '@/lib/crewDayServer';
import { CrewDayLoadFailed } from '@/components/crew-day/CrewDayParts';
import CrewDayReviewScreen from '@/components/crew-day/CrewDayReviewScreen';

// Screen 3, Review and book. Booking needs an account: signed out, sign in (or sign up) and come straight back.
// A household that already booked opens its booking; a day that can't be booked now goes back to the invitation.
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code: rawCode } = await params;
  const { day } = await readCrewDayForPage(rawCode);
  return {
    title: day ? `Review and book · ${day.title} | Pantopus` : 'Crew Day not available | Pantopus',
    robots: { index: false, follow: false },
  };
}

export default async function CrewDayBookPage({ params }: PageProps) {
  const { code: rawCode } = await params;
  const page = await readCrewDayForPage(rawCode);
  if (crewDayUnavailable(page) || !page.code) notFound();
  const { code, day } = page;
  const bookPath = `${buildCrewDayPath(code)}/book`;
  if (!day) return <CrewDayLoadFailed code={code} retryHref={bookPath} />;
  // The 30-day session flag, not the 1-hour access cookie: an expired access cookie is refreshed by the page's
  // first request, as on every app page.
  if ((await cookies()).get('pantopus_session')?.value !== '1') redirect(`/login?redirectTo=${encodeURIComponent(bookPath)}`);
  if (day.viewer?.booking_id) redirect(`/app/crew-days/bookings/${encodeURIComponent(day.viewer.booking_id)}`);
  if (day.availability !== 'open' || day.viewer?.role === 'crew') redirect(buildCrewDayPath(code));
  return <CrewDayReviewScreen day={day} />;
}
