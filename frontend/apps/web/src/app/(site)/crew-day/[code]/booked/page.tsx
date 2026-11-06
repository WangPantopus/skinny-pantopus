import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { buildCrewDayPath } from '@pantopus/utils';
import { crewDayUnavailable, readCrewDayForPage } from '@/lib/crewDayServer';
import { CrewDayLoadFailed } from '@/components/crew-day/CrewDayParts';
import CrewDayBookedScreen from '@/components/crew-day/CrewDayBookedScreen';

// Screen 4, You're on the route: right after booking. Signed out, the invitation.
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ code: string }> };

export const metadata: Metadata = { title: "You're on the route | Pantopus", robots: { index: false, follow: false } };

export default async function CrewDayBookedPage({ params }: PageProps) {
  const { code: rawCode } = await params;
  const page = await readCrewDayForPage(rawCode);
  if (crewDayUnavailable(page) || !page.code) notFound();
  const { code, day } = page;
  if (!day) return <CrewDayLoadFailed code={code} retryHref={`${buildCrewDayPath(code)}/booked`} />;
  if ((await cookies()).get('pantopus_session')?.value !== '1' || day.viewer?.role === 'crew') redirect(buildCrewDayPath(code));
  return <CrewDayBookedScreen day={day} />;
}
