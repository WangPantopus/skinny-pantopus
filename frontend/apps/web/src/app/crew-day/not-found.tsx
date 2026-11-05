import Link from 'next/link';
import { CREW_DAY_SECONDARY_BUTTON, CrewDayTopBar } from '@/components/crew-day/CrewDayParts';

// A Crew Day link that doesn't open: a mistyped or incomplete code, a day Pantopus hasn't approved yet, or Crew Day
// switched off (launch cut #13).
export default function CrewDayNotFound() {
  return (
    <main className="min-h-screen bg-app text-app-text">
      <div className="mx-auto w-full max-w-md">
        <CrewDayTopBar />
        <div className="flex flex-col gap-4 px-4 pt-10">
          <h1 className="text-xl font-semibold leading-[1.625rem]">This Crew Day isn&apos;t available</h1>
          <p className="text-sm leading-5 text-app-text-secondary">
            The link may be incomplete, or this Crew Day isn&apos;t open for booking. Check the link you were sent.
          </p>
          <Link href="/" className={CREW_DAY_SECONDARY_BUTTON}>
            Go to Pantopus
          </Link>
        </div>
      </div>
    </main>
  );
}
