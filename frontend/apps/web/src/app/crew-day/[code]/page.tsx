import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, CloudRain, CreditCard, House, Lock, type LucideIcon } from 'lucide-react';
import { buildCrewDayAppUrl, buildCrewDayPath } from '@pantopus/utils';
import { buildShareMetadata, crewDayShareCode, fetchPublicCrewDay, getStoreDownloadCta } from '@/lib/publicShare';
import { launchFeatures } from '@/lib/featureFlags';
import {
  bookedLine,
  formatCrewDate,
  formatInstantDate,
  formatPrice,
  formatWindow,
  includedItems,
  streetInCity,
  type PublicCrewDay,
} from '@/lib/crewDay';
import {
  CREW_DAY_PRIMARY_BUTTON,
  CREW_DAY_SECONDARY_BUTTON,
  CrewDayCard,
  CrewDaySectionTitle,
  CrewDayTopBar,
  CrewRow,
  OutsideOnlyLine,
  ServiceTag,
  StreetMiniMap,
} from '@/components/crew-day/CrewDayParts';

// A Crew Day's invitation (design boards `Main` and `InvitationDark`), signed in or out: the street, the date, the
// crew and its prices, with counts only (never which homes or who). Unknown codes, days Pantopus hasn't approved
// and the whole page while `crew_day` is off say "This Crew Day isn't available" (../not-found.tsx).
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ code: string }> };

async function readCrewDay(rawCode: string) {
  const code = crewDayShareCode(rawCode);
  if (!launchFeatures.crewDay || !code) return { code: null, day: null, status: 404 };
  const access = (await cookies()).get('pantopus_access')?.value ?? null;
  const result = await fetchPublicCrewDay(code, access);
  return { code, day: result.data, status: result.status };
}

function whenLine(day: PublicCrewDay): string {
  const window = formatWindow(day.window_start, day.window_end);
  return [formatCrewDate(day.service_date, 'long'), window ? `Arriving ${window}` : null].filter(Boolean).join(' · ');
}

/** The line above the card. */
function introText(day: PublicCrewDay): string {
  if (day.viewer?.role === 'crew') return 'This is your Crew Day.';
  if (day.availability === 'done') return `A local crew came to ${streetInCity(day)}.`;
  if (day.availability === 'cancelled') return `A local crew planned a Crew Day on ${streetInCity(day)}.`;
  return `A local crew is coming to ${streetInCity(day)}.`;
}

/** The card's last line: the counts while it's open, otherwise why it can't be booked. */
function statusLine(day: PublicCrewDay): { text: string; strong: boolean } {
  switch (day.availability) {
    case 'full':
      return { text: `All ${day.capacity} spots are taken.`, strong: true };
    case 'closed':
      return { text: `Booking closed on ${formatInstantDate(day.booking_closes_at, day.timezone)}.`, strong: true };
    case 'cancelled':
      return { text: 'This Crew Day was cancelled. Nobody was charged.', strong: true };
    case 'done':
      return { text: 'This Crew Day is done.', strong: true };
    default:
      return { text: bookedLine(day.booked_count, day.spots_left, day.capacity), strong: false };
  }
}

const HOW_IT_WORKS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: House, title: 'Your home, your own price', body: "It's set by your home's size, never by how many neighbors join." },
  {
    icon: CreditCard,
    title: "Pay once it's done",
    body: "Your card is saved when you book and charged the day after the crew finishes your home, unless you tell us something's wrong.",
  },
  {
    icon: CloudRain,
    title: 'Rain never changes your price',
    body: 'If the day moves, you pick a new date or cancel at no charge. Cancelling is free until 48 hours before.',
  },
  {
    icon: Lock,
    title: 'Your address stays private',
    body: 'Only the crew and Pantopus see it. Neighbors see how many homes booked, never which ones.',
  },
];

function Action({ day, code }: { day: PublicCrewDay; code: string }): ReactNode {
  const bookingId = day.viewer?.role === 'household' ? day.viewer.booking_id : null;
  if (day.viewer?.role === 'crew') {
    return (
      <Link href={`/app/businesses/${encodeURIComponent(day.crew.business_user_id)}/crew-days/${encodeURIComponent(day.id)}`} className={CREW_DAY_PRIMARY_BUTTON}>
        Open the dashboard
      </Link>
    );
  }
  if (bookingId) {
    return (
      <Link href={`/app/crew-days/bookings/${encodeURIComponent(bookingId)}`} className={CREW_DAY_PRIMARY_BUTTON}>
        Open my Crew Day
      </Link>
    );
  }
  if (day.availability === 'open') {
    return (
      <div className="flex flex-col gap-2">
        <Link href={`${buildCrewDayPath(code)}/price`} className={CREW_DAY_PRIMARY_BUTTON}>
          See my price
        </Link>
        <p className="text-center text-xs leading-4 text-app-text-secondary">
          No account needed to see your price. Booking closes {formatInstantDate(day.booking_closes_at, day.timezone, 'long')}.
        </p>
      </div>
    );
  }
  if (day.availability === 'full') {
    return (
      <Link href="/app/crew-days/ask" className={CREW_DAY_PRIMARY_BUTTON}>
        Ask for the next one
      </Link>
    );
  }
  return (
    <Link href="/app/crew-days/ask" className={CREW_DAY_SECONDARY_BUTTON}>
      Ask for one on your street
    </Link>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code: rawCode } = await params;
  const { code, day } = await readCrewDay(rawCode);
  const base = { robots: { index: false, follow: false } };
  if (!code || !day) {
    return { ...base, title: 'Crew Day not available | Pantopus', description: "This Crew Day isn't available." };
  }
  // The preview shows the street and the date, never an address. Booking happens on this page, so Safari's app
  // banner (which drops the link through an install) stays off; "Open app" carries it.
  const price = day.price_from_cents != null ? `From ${formatPrice(day.price_from_cents)} a home` : null;
  return {
    ...base,
    ...buildShareMetadata({
      title: day.title,
      description: `${[whenLine(day), price].filter(Boolean).join(' · ')}. A local crew is coming to ${streetInCity(day)}.`,
      path: buildCrewDayPath(code),
      appArgument: buildCrewDayAppUrl(code),
      smartBanner: false,
    }),
  };
}

export default async function CrewDayInvitationPage({ params }: PageProps) {
  const { code: rawCode } = await params;
  const { code, day, status } = await readCrewDay(rawCode);
  // 404: no such code, or not approved yet; 403: Crew Day is off on the server.
  if (!code || status === 404 || status === 403) notFound();

  const userAgent = (await headers()).get('user-agent') || '';
  const storeCta = getStoreDownloadCta(userAgent, buildCrewDayPath(code));

  if (!day) {
    return (
      <main className="min-h-screen bg-app text-app-text">
        <div className="mx-auto w-full max-w-md">
          <CrewDayTopBar code={code} fallbackUrl={storeCta?.href ?? null} copyPath={storeCta?.copyPath ?? null} />
          <div className="flex flex-col gap-4 px-4 pt-10 text-center">
            <h1 className="text-xl font-semibold leading-[1.625rem]">Couldn&apos;t load this Crew Day</h1>
            <p className="text-sm leading-5 text-app-text-secondary">Something went wrong on our side. Try again in a moment.</p>
            <a href={buildCrewDayPath(code)} className={CREW_DAY_PRIMARY_BUTTON}>
              Try again
            </a>
          </div>
        </div>
      </main>
    );
  }

  const line = statusLine(day);
  const included = includedItems(day);
  return (
    <main className="min-h-screen bg-app text-app-text">
      <div className="mx-auto w-full max-w-md pb-10">
        <CrewDayTopBar code={code} fallbackUrl={storeCta?.href ?? null} copyPath={storeCta?.copyPath ?? null} />
        <div className="flex flex-col gap-4 px-4 pt-[1.125rem]">
          <p className="text-sm leading-5 text-app-text-secondary">{introText(day)}</p>

          <section
            aria-labelledby="crew-day-title"
            className="overflow-hidden rounded-[1.25rem] border border-app-border bg-app-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <StreetMiniMap street={day.street_label} />
            <div className="flex flex-col gap-2 px-4 pb-4 pt-[0.875rem]">
              <ServiceTag service={day.service} />
              <h1 id="crew-day-title" className="text-xl font-semibold leading-[1.625rem] tracking-[-0.012em]">
                {day.title}
              </h1>
              <p className="text-sm leading-5 text-app-text-strong [font-variant-numeric:tabular-nums]">{whenLine(day)}</p>
              <p className="text-sm leading-5 text-app-text-strong [font-variant-numeric:tabular-nums]">
                {day.price_from_cents != null ? (
                  <>
                    <span className="font-semibold text-app-text">From {formatPrice(day.price_from_cents)}</span> a home,
                    including tax
                  </>
                ) : (
                  "The crew confirms each home's price after a look"
                )}
              </p>
              <CrewRow crew={day.crew} />
              <p className={`text-sm leading-5 ${line.strong ? 'font-semibold text-app-text-strong' : 'text-app-text-secondary'}`}>
                {line.text}
              </p>
            </div>
          </section>

          <Action day={day} code={code} />

          <section aria-labelledby="how-it-works" className="flex flex-col gap-2 pt-2">
            <CrewDaySectionTitle id="how-it-works">How it works for you</CrewDaySectionTitle>
            <CrewDayCard className="flex flex-col gap-4 p-4">
              {HOW_IT_WORKS.map(({ icon: RowIcon, title, body }) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-[0.5625rem] bg-app-surface-sunken text-app-text-strong" aria-hidden="true">
                    <RowIcon className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="text-[0.9375rem] font-semibold leading-5 text-app-text">{title}</h3>
                    <p className="text-sm leading-5 text-app-text-secondary">{body}</p>
                  </div>
                </div>
              ))}
            </CrewDayCard>
          </section>

          {included.length > 0 || day.outside_only ? (
            <section aria-labelledby="what-the-crew-does" className="flex flex-col gap-2 pt-2">
              <CrewDaySectionTitle id="what-the-crew-does">What the crew does</CrewDaySectionTitle>
              <CrewDayCard className="flex flex-col gap-[0.875rem] p-4">
                {included.length > 0 ? (
                  <ul className="flex flex-col gap-[0.625rem]">
                    {included.map((item) => (
                      <li key={item} className="flex items-start gap-[0.625rem] text-sm leading-5 text-app-text-strong">
                        <Check className="mt-0.5 h-4 w-4 flex-none text-app-home" strokeWidth={2.4} aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {included.length > 0 && day.outside_only ? <div className="h-px bg-app-border" /> : null}
                {day.outside_only ? <OutsideOnlyLine /> : null}
              </CrewDayCard>
            </section>
          ) : null}

          <footer className="flex flex-col gap-1.5 pt-2 text-center">
            <p className="text-xs leading-4 text-app-text-secondary">
              Pantopus organizes this Crew Day. {day.crew.name || 'The crew'} does the work.
            </p>
            <p className="text-xs leading-4 text-app-text-secondary">
              <Link href="/crew-day/how-it-works" className="font-semibold text-app-link">
                How Crew Day works
              </Link>
              {' · '}
              <Link href="/crew-day/who-sees-what" className="font-semibold text-app-link">
                Who sees what
              </Link>
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
