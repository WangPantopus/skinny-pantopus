import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AppWindow,
  ChevronLeft,
  Droplets,
  House,
  Leaf,
  Lightbulb,
  ShieldCheck,
  SprayCan,
  Trees,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { buildCrewDayAppUrl, buildCrewDayShareUrl } from '@pantopus/utils';
import OpenInAppButton from '@/components/public-share/OpenInAppButton';
import { absoluteMediaUrl } from '@/lib/publicShare';
import { crewDayServiceLabel, type CrewDayCrew } from '@/lib/crewDay';

// The pieces every Crew Day screen shares, drawn from the Crew Day designs (board `Main`): the service tag on a
// home-green tile, the illustrated street map, the crew's row, the 56px top bar and the buttons. Text and spacing
// are in rem, so larger browser text (200%) scales the screen instead of clipping it.

const SERVICE_GLYPH: Record<string, LucideIcon> = {
  gutter_cleaning: Droplets,
  leaf_cleanup: Leaf,
  roof_moss: Trees,
  holiday_lights: Lightbulb,
  window_washing: AppWindow,
  pressure_washing: SprayCan,
  other: Wrench,
};

export function ServiceGlyph({ service, className = 'h-4 w-4' }: { service: string; className?: string }) {
  const Glyph = SERVICE_GLYPH[service] ?? Wrench;
  return <Glyph className={`flex-none ${className}`} strokeWidth={2.2} aria-hidden="true" />;
}

/** "Gutter cleaning" on a home-green pill, with the service's glyph on a solid tile. */
export function ServiceTag({ service }: { service: string }) {
  return (
    <span className="inline-flex min-h-[1.875rem] items-center gap-[0.4375rem] self-start rounded-full bg-app-home-bg py-1 pl-1 pr-3 text-[0.8125rem] font-semibold leading-[1.125rem] text-app-text">
      <span className="grid h-[1.375rem] w-[1.375rem] flex-none place-items-center rounded-[0.4375rem] bg-app-home text-white dark:text-[#0b1220]">
        <ServiceGlyph service={service} className="h-[0.8125rem] w-[0.8125rem]" />
      </span>
      {crewDayServiceLabel(service)}
    </span>
  );
}

/**
 * The board's illustrated mini-map: blocks, a park and roads, with the Crew Day's street highlighted and labeled.
 * Never houses or pins: it doesn't say which homes booked, and it isn't a real map of the area.
 */
export function StreetMiniMap({ street, className = 'h-[150px]' }: { street: string; className?: string }) {
  const block = 'absolute rounded-[4px] bg-[#e8e5de] dark:bg-[#252a30]';
  const road = 'absolute bg-white shadow-[0_0_0_1px_#dcd8cf] dark:bg-[#384049] dark:shadow-[0_0_0_1px_#2a3038]';
  return (
    <div className={`relative overflow-hidden bg-[#f2f0eb] dark:bg-[#1d2126] ${className}`} aria-hidden="true">
      <i className="absolute left-[4%] top-[8%] h-[35%] w-[23%] rounded-[22px] bg-[#d5eac7] dark:bg-[#1e3527]" />
      <i className={`${block} left-[33%] top-[9%] h-[25%] w-[20%]`} />
      <i className={`${block} left-[57%] top-[9%] h-[25%] w-[15%]`} />
      <i className={`${block} left-[80%] top-[9%] h-[25%] w-[17%]`} />
      <i className={`${block} left-[6%] top-[69%] h-[21%] w-[20%]`} />
      <i className={`${block} left-[33%] top-[69%] h-[21%] w-[20%]`} />
      <i className={`${block} left-[57%] top-[69%] h-[21%] w-[15%]`} />
      <i className={`${block} left-[80%] top-[69%] h-[21%] w-[17%]`} />
      <i className="absolute left-[8%] right-[6%] top-[42%] h-[23%] rounded-full bg-[rgba(22,163,74,0.20)] dark:bg-[rgba(74,222,128,0.18)]" />
      <i className={`${road} left-[-5%] top-[50.5%] h-[8px] w-[110%]`} />
      <i className={`${road} left-[29%] top-[-7%] h-[114%] w-[6px]`} />
      <i className={`${road} left-[75.5%] top-[-7%] h-[114%] w-[5px]`} />
      <span className="absolute left-1/2 top-[54%] flex max-w-[60%] -translate-x-1/2 -translate-y-1/2 items-center truncate rounded-full bg-white px-[0.5625rem] py-[0.1875rem] text-[0.6875rem] font-semibold leading-4 text-app-text-strong shadow-[0_1px_3px_rgba(0,0,0,0.14)] dark:bg-[#0f172a]">
        {street}
      </span>
    </div>
  );
}

/** The crew: its avatar (or initial in business violet), name, "Insured and registered" when verified, and its reviews. */
export function CrewRow({ crew }: { crew: CrewDayCrew }) {
  const name = crew.name || 'The crew';
  const src = absoluteMediaUrl(crew.avatar_url);
  const reviews = crew.rating && crew.rating.count > 0 ? crew.rating : null;
  return (
    <div className="flex items-center gap-[0.625rem] pt-1">
      {src ? (
        // Native img keeps public avatars working across storage hosts without Next image config churn.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-9 w-9 flex-none rounded-full object-cover" />
      ) : (
        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-full bg-app-business-bg text-sm font-bold text-app-business"
          aria-hidden="true"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-x-2 text-sm leading-5">
          <span className="font-semibold text-app-text">{name}</span>
          {crew.verified ? (
            <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold leading-[1.125rem] text-app-success">
              <ShieldCheck className="h-[0.875rem] w-[0.875rem] flex-none" aria-hidden="true" />
              Insured and registered
            </span>
          ) : null}
        </span>
        {reviews ? (
          <span className="text-[0.8125rem] leading-[1.125rem] text-app-text-secondary [font-variant-numeric:tabular-nums]">
            {reviews.average.toFixed(1)} · {reviews.count} {reviews.count === 1 ? 'review from a home' : 'reviews from homes'} it
            served
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The public pages' 56px bar: "Pantopus" home on the left, "Open app" on the right (the invitation in the apps). */
export function CrewDayTopBar({
  code,
  fallbackUrl = null,
  copyPath = null,
}: {
  code?: string | null;
  fallbackUrl?: string | null;
  copyPath?: string | null;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-app-border bg-app-surface px-4">
      <Link href="/" className="text-[1.1875rem] font-bold leading-[1.375rem] tracking-[-0.02em] text-app-text">
        Pantopus
      </Link>
      {code ? (
        <OpenInAppButton
          appUrl={buildCrewDayAppUrl(code)}
          linkHref={buildCrewDayShareUrl(code)}
          fallbackUrl={fallbackUrl}
          copyPath={copyPath}
          className="text-sm font-semibold text-app-link"
        >
          Open app
        </OpenInAppButton>
      ) : null}
    </div>
  );
}

/**
 * A booking step's bar (boards `Price`, `Review`): a 44px round back button, the step's title in the middle and
 * "1 of 2" on the right, on the page's own background (like the apps' Plans bar). `leading` replaces the back
 * button (Booked's Close).
 */
export function CrewDayStepBar({
  title,
  backHref,
  backLabel = 'Back',
  step,
  leading,
}: {
  title?: string;
  backHref?: string | null;
  backLabel?: string;
  step?: string | null;
  leading?: ReactNode;
}) {
  return (
    <div className="flex min-h-[3.25rem] items-center gap-2 px-3 py-1">
      <div className="flex min-w-11 flex-none justify-start">
        {leading ??
          (backHref ? (
            <Link
              href={backHref}
              aria-label={backLabel}
              className="grid h-11 w-11 place-items-center rounded-full bg-app-surface-sunken text-app-text hover:bg-app-hover"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
          ) : null)}
      </div>
      {title ? (
        <h1 className="min-w-0 flex-1 text-center text-[1.0625rem] font-semibold leading-[1.375rem] tracking-[-0.01em] text-app-text">
          {title}
        </h1>
      ) : (
        <span className="flex-1" />
      )}
      <span className="min-w-11 flex-none text-right text-[0.8125rem] font-semibold leading-[1.125rem] text-app-text-secondary">
        {step ?? ''}
      </span>
    </div>
  );
}

/** A booking step's bottom bar (boards `Price`, `Review`, `Booked`): the total and the step's button stay in reach. */
export function CrewDayFooterBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-2.5 border-t border-app-border bg-app-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      {children}
    </div>
  );
}

/** A 32px tile with a glyph, on the sunken fill (or home green), for list rows. */
export function CrewDayIconTile({ children, tone = 'sunken' }: { children: ReactNode; tone?: 'sunken' | 'home' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-8 w-8 flex-none place-items-center rounded-[0.5625rem] ${tone === 'home' ? 'bg-app-home-bg text-app-home' : 'bg-app-surface-sunken text-app-text-strong'}`}
    >
      {children}
    </span>
  );
}

export const CREW_DAY_PRIMARY_BUTTON =
  'flex min-h-[3.125rem] w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-center text-base font-semibold text-white shadow-[0_6px_16px_rgba(2,132,199,0.18)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none';

export const CREW_DAY_SECONDARY_BUTTON =
  'flex min-h-[3.125rem] w-full items-center justify-center rounded-xl border border-app-border-strong bg-app-surface px-4 py-2 text-center text-base font-semibold text-app-text hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-50';

/** A Crew Day page whose read failed for a reason other than "no such day": a retry, never a dead end. */
export function CrewDayLoadFailed({ code, retryHref }: { code: string; retryHref: string }) {
  return (
    <main className="min-h-screen bg-app text-app-text">
      <div className="mx-auto w-full max-w-md">
        <CrewDayTopBar code={code} />
        <div className="flex flex-col gap-4 px-4 pt-10 text-center">
          <h1 className="text-xl font-semibold leading-[1.625rem]">Couldn&apos;t load this Crew Day</h1>
          <p className="text-sm leading-5 text-app-text-secondary">Something went wrong on our side. Try again in a moment.</p>
          <a href={retryHref} className={CREW_DAY_PRIMARY_BUTTON}>
            Try again
          </a>
        </div>
      </div>
    </main>
  );
}

/** The overline over a card: 12px, upper case, spaced (the invitation's are 11px: `small`). */
export const CREW_DAY_OVERLINE = 'text-xs font-semibold uppercase leading-4 tracking-[0.07em] text-app-text-secondary';

export function CrewDaySectionTitle({ id, children, small = false }: { id?: string; children: ReactNode; small?: boolean }) {
  return (
    <h2
      id={id}
      className={
        small
          ? 'text-[0.6875rem] font-semibold uppercase leading-4 tracking-[0.06em] text-app-text-secondary'
          : CREW_DAY_OVERLINE
      }
    >
      {children}
    </h2>
  );
}

/** The white card every Crew Day section sits in. */
export function CrewDayCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[1.25rem] border border-app-border bg-app-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}>
      {children}
    </div>
  );
}

/** "Outside only. You don't need to be home.", with the house glyph. */
export function OutsideOnlyLine() {
  return (
    <p className="flex items-start gap-[0.625rem] text-sm leading-5 text-app-text-strong">
      <House className="mt-0.5 h-4 w-4 flex-none text-app-text-secondary" aria-hidden="true" />
      Outside only. You don&apos;t need to be home.
    </p>
  );
}
