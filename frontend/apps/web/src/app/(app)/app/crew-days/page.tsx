'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Eye, House } from 'lucide-react';
import * as api from '@pantopus/api';
import type { CrewDayBookingCard, CrewDayRequestCard } from '@pantopus/types';
import { buildCrewDayPath } from '@pantopus/utils';
import { formatCrewDate, formatInstantDate, formatPrice } from '@/lib/crewDay';
import { CREW_DAY_PRIMARY_BUTTON, CREW_DAY_SECONDARY_BUTTON, CrewDaySectionTitle, ServiceGlyph } from '@/components/crew-day/CrewDayParts';
import { CHIP_CLASS, bookingChip, monthsText, requestChip, type ChipTone } from '@/components/crew-day/crewDayStatus';

// Screen 10, Your Crew Days (board `MyCrewDays`), from the sidebar's "Crew Days": coming up, asked for and done,
// then "Want a crew on your street?". GET /api/crew-days/mine.

const CARD = 'flex gap-3 rounded-[1.25rem] border border-app-border bg-app-surface p-[0.875rem]';

function Chip({ label, tone }: { label: string; tone: ChipTone }) {
  return (
    <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-medium leading-4 ${CHIP_CLASS[tone]}`}>{label}</span>
  );
}

function Tile({ service, tone }: { service: string; tone: 'home' | 'sunken' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-10 w-10 flex-none place-items-center rounded-xl ${tone === 'home' ? 'bg-app-home-bg text-app-home' : 'bg-app-surface-sunken text-app-text-strong'}`}
    >
      <ServiceGlyph service={service} className="h-5 w-5" />
    </span>
  );
}

function UpcomingCard({ card }: { card: CrewDayBookingCard }) {
  const chip = bookingChip(card);
  return (
    <Link href={`/app/crew-days/bookings/${encodeURIComponent(card.booking_id)}`} className={`${CARD} hover:bg-app-hover`}>
      <Tile service={card.service} tone="home" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-start justify-between gap-2">
          <span className="text-base font-semibold leading-[1.3125rem] text-app-text">{card.title}</span>
          <Chip {...chip} />
        </span>
        <span className="text-sm leading-5 text-app-text-strong [font-variant-numeric:tabular-nums]">
          {[formatCrewDate(card.service_date), card.crew?.name].filter(Boolean).join(' · ')}
        </span>
      </span>
    </Link>
  );
}

function pastLine(card: CrewDayBookingCard): string {
  const parts = [formatCrewDate(card.service_date)];
  if (card.status === 'paid' && card.price_cents != null) parts.push(`Paid ${formatPrice(card.price_cents)}`);
  else parts.push(bookingChip(card).label);
  if (card.photo_count > 0) parts.push(`${card.photo_count} ${card.photo_count === 1 ? 'photo' : 'photos'}`);
  return parts.join(' · ');
}

function PastCard({ card }: { card: CrewDayBookingCard }) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.25rem] border border-app-border bg-app-surface p-[0.875rem]">
      <Link href={`/app/crew-days/bookings/${encodeURIComponent(card.booking_id)}`} className="flex gap-3">
        <Tile service={card.service} tone="sunken" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold leading-[1.3125rem] text-app-text">{card.title}</span>
          <span className="text-sm leading-5 text-app-text-secondary [font-variant-numeric:tabular-nums]">{pastLine(card)}</span>
        </span>
      </Link>
      {card.book_again ? (
        <Link
          href={buildCrewDayPath(card.book_again.code)}
          className="flex min-h-10 items-center justify-center rounded-[0.625rem] bg-app-surface-sunken text-[0.9375rem] font-semibold text-app-text hover:bg-app-hover"
        >
          Book again
        </Link>
      ) : null}
    </div>
  );
}

function RequestCard({ request }: { request: CrewDayRequestCard }) {
  const chip = requestChip(request);
  const body = (
    <>
      <span aria-hidden="true" className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-app-surface-sunken text-app-text-strong">
        <Eye className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-start justify-between gap-2">
          <span className="text-base font-semibold leading-[1.3125rem] text-app-text">
            {request.service_label} on {request.street_label}
          </span>
          <Chip {...chip} />
        </span>
        <span className="text-sm leading-5 text-app-text-secondary">
          Asked {formatInstantDate(request.created_at, 'America/Los_Angeles').replace(/^\w+, /, '')} · {monthsText(request.months)}
        </span>
        {request.status === 'no_crew' && request.answer_note ? (
          <span className="text-sm leading-5 text-app-text-strong">{request.answer_note}</span>
        ) : null}
      </span>
    </>
  );
  return request.offer ? (
    <Link href={buildCrewDayPath(request.offer.code)} className={`${CARD} hover:bg-app-hover`}>
      {body}
    </Link>
  ) : (
    <div className={CARD}>{body}</div>
  );
}

export default function YourCrewDaysPage() {
  const mine = useQuery({ queryKey: ['crew-day', 'mine'], queryFn: () => api.crewDays.getMine(), staleTime: 30_000 });
  const data = mine.data;
  const empty = data && !data.upcoming.length && !data.requests.length && !data.past.length;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-16 pt-5 text-app-text">
      <h1 className="text-[1.375rem] font-bold leading-7 tracking-[-0.01em]">Your Crew Days</h1>

      {mine.isLoading ? <p className="text-sm text-app-text-secondary">Loading your Crew Days…</p> : null}
      {mine.isError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-[1.25rem] border border-app-border bg-app-surface p-4">
          <p className="text-sm leading-5 text-app-text-strong">We couldn&apos;t load your Crew Days. Check your connection and try again.</p>
          <button type="button" onClick={() => void mine.refetch()} className={CREW_DAY_SECONDARY_BUTTON}>
            Try again
          </button>
        </div>
      ) : null}

      {empty ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-2xl bg-app-home-bg text-app-home">
            <House className="h-7 w-7" />
          </span>
          <h2 className="text-xl font-semibold leading-[1.625rem]">No Crew Days yet</h2>
          <p className="max-w-[18.75rem] text-base leading-6 text-app-text-secondary">
            When a local crew comes to your street, you&apos;ll book it here.
          </p>
          <Link href="/app/crew-days/ask" className={`${CREW_DAY_PRIMARY_BUTTON} mt-2`}>
            Ask for a Crew Day
          </Link>
        </div>
      ) : null}

      {data && !empty ? (
        <>
          {data.upcoming.length > 0 ? (
            <section aria-labelledby="cd-upcoming" className="flex flex-col gap-2">
              <CrewDaySectionTitle id="cd-upcoming">Coming up</CrewDaySectionTitle>
              {data.upcoming.map((card) => (
                <UpcomingCard key={card.booking_id} card={card} />
              ))}
            </section>
          ) : null}
          {data.requests.length > 0 ? (
            <section aria-labelledby="cd-requests" className="flex flex-col gap-2">
              <CrewDaySectionTitle id="cd-requests">Asked for</CrewDaySectionTitle>
              {data.requests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </section>
          ) : null}
          {data.past.length > 0 ? (
            <section aria-labelledby="cd-done" className="flex flex-col gap-2">
              <CrewDaySectionTitle id="cd-done">Done</CrewDaySectionTitle>
              {data.past.map((card) => (
                <PastCard key={card.booking_id} card={card} />
              ))}
            </section>
          ) : null}
          <section aria-labelledby="cd-ask" className="flex flex-col gap-3 rounded-[1.25rem] border border-dashed border-app-border-strong p-4">
            <div className="flex flex-col gap-0.5">
              <h2 id="cd-ask" className="text-base font-semibold leading-[1.3125rem]">
                Want a crew on your street?
              </h2>
              <p className="text-sm leading-5 text-app-text-secondary">Tell us the service. We look for a local crew.</p>
            </div>
            <Link href="/app/crew-days/ask" className={`${CREW_DAY_SECONDARY_BUTTON} min-h-11`}>
              Ask for a Crew Day
            </Link>
          </section>
        </>
      ) : null}
    </div>
  );
}
