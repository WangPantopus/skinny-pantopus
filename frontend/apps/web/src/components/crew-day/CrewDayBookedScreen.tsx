'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BellRing, Camera, Check, Hourglass, Truck, X, type LucideIcon } from 'lucide-react';
import * as api from '@pantopus/api';
import { buildCrewDayPath, buildCrewDayShareUrl } from '@pantopus/utils';
import AddToCalendar from '@/components/scheduling/AddToCalendar';
import BottomSheet from '@/components/ui/BottomSheet';
import { toast } from '@/components/ui/toast-store';
import { crewDayServiceLabel, formatCrewDate, formatInstantDate, formatPrice, formatWindow, type PublicCrewDay } from '@/lib/crewDay';
import { CREW_DAY_PRIMARY_BUTTON, CREW_DAY_SECONDARY_BUTTON, CrewDayCard, CrewDaySectionTitle } from './CrewDayParts';

// Screen 4, You're on the route (01-spec.md §3): what happens next, the crew's prep note, Add to calendar, Share
// with neighbors and See my Crew Day. A home that waits for the crew's price check says so instead.

/** "Tuesday, Nov 17, between 9 AM and 1 PM": the window in words. */
function windowWords(start: string, end: string): string {
  const range = formatWindow(start, end);
  const [from, to] = range.split('–');
  if (!from || !to) return range;
  // "10–11 AM" keeps one AM: "between 10 and 11 AM".
  return `between ${from} and ${to}`;
}

/** The share kit's drafted message (screen 12): the street and the date, never an address. */
function shareMessage(day: PublicCrewDay): string {
  const service = crewDayServiceLabel(day.service).toLowerCase();
  return `I'm booked for ${service} on ${formatCrewDate(day.service_date, 'long')}. The crew has room for nearby homes if you need yours done too.`;
}

export default function CrewDayBookedScreen({ day }: { day: PublicCrewDay }) {
  const code = day.code;
  const invitationPath = buildCrewDayPath(code);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // The booking: the server's read of the invitation names it; an expired session reads it again here.
  const viewer = useQuery({
    queryKey: ['crew-day', 'public', code],
    queryFn: () => api.crewDays.getPublicCrewDay(code),
    initialData: day.viewer?.booking_id ? day : undefined,
    staleTime: 60_000,
  });
  const bookingId = viewer.data?.viewer?.booking_id ?? null;
  const booking = useQuery({
    queryKey: ['crew-day', 'booking', bookingId],
    queryFn: () => api.crewDays.getBooking(bookingId as string),
    enabled: Boolean(bookingId),
  });

  const crew = day.crew.name || 'The crew';
  const pending = booking.data?.status === 'price_pending';
  const serviceDate = booking.data?.service_date || day.service_date;
  const start = booking.data?.window_start || day.window_start;
  const end = booking.data?.window_end || day.window_end;
  const prepNote = booking.data?.prep_note ?? null;
  const price = booking.data?.price_cents ?? null;
  const bookingPath = bookingId ? `/app/crew-days/bookings/${encodeURIComponent(bookingId)}` : '/app/crew-days';

  const share = async () => {
    const url = buildCrewDayShareUrl(code);
    const text = shareMessage(day);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: day.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.success('Link copied. Paste it in a text or your street group.');
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      toast.error("Couldn't share the link. Copy it from the address bar instead.");
    }
  };

  const nextSteps: Array<{ icon: LucideIcon; title: string; body: string }> = [
    { icon: BellRing, title: 'The evening before', body: 'We remind you what to do, and when the crew comes.' },
    { icon: Truck, title: 'On the day', body: `${crew} tells you when it's on the way.` },
    {
      icon: Camera,
      title: "When it's done",
      body: price != null
        ? `You see photos of the work. We charge ${formatPrice(price)} the next day, unless you tell us something needs attention.`
        : 'You see photos of the work. We charge your card the next day, unless you tell us something needs attention.',
    },
  ];

  if (!bookingId && !viewer.isLoading) {
    return (
      <main className="min-h-screen bg-app text-app-text">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-10 text-center">
          <h1 className="text-xl font-semibold leading-[1.625rem]">We couldn&apos;t find your booking</h1>
          <p className="text-sm leading-5 text-app-text-secondary">Your Crew Days lists every booking you made.</p>
          <Link href="/app/crew-days" className={CREW_DAY_PRIMARY_BUTTON}>
            Open Your Crew Days
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-app text-app-text">
      <div className="mx-auto w-full max-w-md pb-10">
        <div className="flex min-h-14 items-center justify-end px-3">
          <Link
            href={invitationPath}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full bg-app-surface-sunken text-app-text hover:bg-app-hover"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
        <div className="flex flex-col gap-5 px-4 pt-2">
          <div className="flex flex-col gap-3">
            <span
              className={`grid h-14 w-14 place-items-center rounded-[1rem] ${pending ? 'bg-app-surface-sunken text-app-text-strong' : 'bg-app-home text-white dark:text-[#0b1220]'}`}
              aria-hidden="true"
            >
              {pending ? <Hourglass className="h-7 w-7" /> : <Check className="h-7 w-7" strokeWidth={2.6} />}
            </span>
            {pending ? (
              <>
                <h1 className="text-2xl font-bold leading-[1.875rem] tracking-[-0.015em]">We asked {crew} for your price</h1>
                <p className="text-[0.9375rem] leading-[1.375rem] text-app-text-strong">
                  You&apos;ll hear by {formatInstantDate(day.booking_closes_at, day.timezone)}. Nothing is booked or charged until you
                  approve it.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold leading-[1.875rem] tracking-[-0.015em]">You&apos;re on the route</h1>
                <p className="text-[0.9375rem] leading-[1.375rem] text-app-text-strong">
                  {crew} comes {formatCrewDate(serviceDate, 'long')}, {windowWords(start, end)}.
                  {day.outside_only ? " You don't need to be home." : ''}
                </p>
              </>
            )}
          </div>

          {!pending && prepNote ? (
            <section aria-labelledby="crew-day-prep" className="flex flex-col gap-2">
              <CrewDaySectionTitle id="crew-day-prep">One thing to do</CrewDaySectionTitle>
              <CrewDayCard className="p-4">
                <p className="text-[0.9375rem] leading-[1.375rem] text-app-text">{prepNote}</p>
              </CrewDayCard>
            </section>
          ) : null}

          {!pending ? (
            <section aria-labelledby="crew-day-next" className="flex flex-col gap-2">
              <CrewDaySectionTitle id="crew-day-next">What happens next</CrewDaySectionTitle>
              <CrewDayCard className="flex flex-col gap-4 p-4">
                {nextSteps.map(({ icon: StepIcon, title, body }) => (
                  <div key={title} className="flex items-start gap-3">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-[0.5625rem] bg-app-surface-sunken text-app-text-strong" aria-hidden="true">
                      <StepIcon className="h-4 w-4" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <h3 className="text-[0.9375rem] font-semibold leading-5">{title}</h3>
                      <p className="text-sm leading-5 text-app-text-secondary">{body}</p>
                    </div>
                  </div>
                ))}
              </CrewDayCard>
            </section>
          ) : null}

          <div className="flex flex-col gap-3">
            {!pending ? (
              <button type="button" onClick={() => setCalendarOpen(true)} className={CREW_DAY_SECONDARY_BUTTON}>
                Add to calendar
              </button>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => void share()} className={CREW_DAY_SECONDARY_BUTTON}>
                Share with neighbors
              </button>
              <p className="text-center text-xs leading-4 text-app-text-secondary">
                The preview shows {day.street_label} and the date, never your address.
              </p>
            </div>
            <Link href={bookingPath} className={CREW_DAY_PRIMARY_BUTTON}>
              See my Crew Day
            </Link>
          </div>
        </div>
      </div>

      <BottomSheet open={calendarOpen} onClose={() => setCalendarOpen(false)} title="Add to calendar">
        <AddToCalendar
          event={{
            title: `${day.title} · ${crew}`,
            start: day.window_starts_at,
            end: day.window_ends_at,
            description: [prepNote, `Booked through Pantopus: ${buildCrewDayShareUrl(code)}`].filter(Boolean).join('\n\n'),
          }}
        />
      </BottomSheet>
    </main>
  );
}
