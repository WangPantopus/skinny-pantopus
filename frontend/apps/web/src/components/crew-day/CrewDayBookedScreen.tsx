'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BellRing, CalendarPlus, Camera, Check, ClipboardList, Eye, Hourglass, Share, Tag, Truck, X, type LucideIcon } from 'lucide-react';
import * as api from '@pantopus/api';
import { buildCrewDayPath, buildCrewDayShareUrl } from '@pantopus/utils';
import AddToCalendar from '@/components/scheduling/AddToCalendar';
import BottomSheet from '@/components/ui/BottomSheet';
import { toast } from '@/components/ui/toast-store';
import { crewDayServiceLabel, formatCrewDate, formatInstantDate, formatPrice, formatWindow, type PublicCrewDay } from '@/lib/crewDay';
import {
  CREW_DAY_PRIMARY_BUTTON,
  CREW_DAY_SECONDARY_BUTTON,
  CrewDayIconTile,
  CrewDaySectionTitle,
  CrewDayStepBar,
} from './CrewDayParts';
import CrewDayFooterBar from './CrewDayFooterBar';

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

/** "Monday evening": the evening before the visit, by its weekday. */
function eveningBefore(serviceDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(serviceDate || '');
  if (!match) return 'The evening before';
  const before = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) - 1, 12));
  return `${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(before)} evening`;
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
    // The server drafts the message with the link at its end (the share kit's text); the link also rides as `url`.
    const url = booking.data?.share?.url || buildCrewDayShareUrl(code);
    const drafted = booking.data?.share?.message;
    const text = drafted ? drafted.replace(url, '').trim() : shareMessage(day);
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

  const reviewBy = formatInstantDate(day.booking_closes_at, day.timezone);
  const nextSteps: Array<{ icon: LucideIcon; title: string; body: string }> = pending
    ? [
        { icon: Eye, title: 'The crew looks at your home', body: `From outside, before ${reviewBy}. You don't need to be home.` },
        { icon: Tag, title: 'You approve your price', body: "We tell you as soon as it's set. Declining is free." },
        { icon: Check, title: "Then you're on the route", body: 'Nothing is charged until the work is done.' },
      ]
    : [
        { icon: BellRing, title: eveningBefore(serviceDate), body: "A reminder with your arrival window and the crew's note." },
        { icon: Truck, title: 'On the day', body: "The crew tells you when it's on the way. Tap when your gate is ready." },
        {
          icon: Camera,
          title: "When it's done",
          body:
            price != null
              ? `Photos of the work. We charge ${formatPrice(price)} the next day, unless you tell us something needs attention.`
              : 'Photos of the work. We charge your card the next day, unless you tell us something needs attention.',
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
    <main className="flex min-h-screen flex-col bg-app text-app-text">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <CrewDayStepBar
          leading={
            <Link
              href={invitationPath}
              aria-label="Close"
              className="grid h-11 w-11 place-items-center rounded-full bg-app-surface-sunken text-app-text hover:bg-app-hover"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Link>
          }
        />
        <div className="flex flex-1 flex-col gap-6 px-4 pb-6 pt-2">
          <div className="flex flex-col gap-3">
            <span
              className={`grid h-14 w-14 place-items-center rounded-2xl ${pending ? 'bg-[#fde68a] text-[#9a4a08] dark:bg-[#5c4210] dark:text-[#fcd34d]' : 'bg-app-home text-white dark:text-[#0b1220]'}`}
              aria-hidden="true"
            >
              {pending ? <Hourglass className="h-7 w-7" /> : <Check className="h-7 w-7" strokeWidth={2.6} />}
            </span>
            <h1 className="mt-1 text-[1.875rem] font-bold leading-9 tracking-[-0.02em]">
              {pending ? `We asked ${crew} for your price` : "You're on the route"}
            </h1>
            <p className="text-base leading-6 text-app-text-strong">
              {pending
                ? `You'll hear by ${reviewBy}. Nothing is booked or charged until you approve it.`
                : `${crew} comes ${formatCrewDate(serviceDate, 'long')}, ${windowWords(start, end)}.${day.outside_only ? " You don't need to be home." : ''}`}
            </p>
          </div>

          {!pending && prepNote ? (
            <section aria-labelledby="crew-day-prep" className="flex flex-col gap-2.5 rounded-[1.25rem] border border-app-border bg-app-surface p-4">
              <div className="flex items-center gap-2.5">
                <CrewDayIconTile tone="home">
                  <ClipboardList className="h-4 w-4" />
                </CrewDayIconTile>
                <h2 id="crew-day-prep" className="text-[0.9375rem] font-semibold leading-5">
                  One thing to do
                </h2>
              </div>
              <p className="text-base leading-[1.375rem]">{prepNote}</p>
              <p className="text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">From {crew}</p>
            </section>
          ) : null}

          <section aria-labelledby="crew-day-next" className="flex flex-col gap-3">
            <CrewDaySectionTitle id="crew-day-next">What happens next</CrewDaySectionTitle>
            <ol className="flex flex-col gap-4">
              {nextSteps.map(({ icon: StepIcon, title, body }) => (
                <li key={title} className="flex items-start gap-3">
                  <CrewDayIconTile>
                    <StepIcon className="h-4 w-4" />
                  </CrewDayIconTile>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[0.9375rem] font-semibold leading-5">{title}</span>
                    <span className="text-sm leading-5 text-app-text-secondary">{body}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {!pending ? (
            <div className="flex flex-col gap-2.5">
              <button type="button" onClick={() => setCalendarOpen(true)} className={`${CREW_DAY_SECONDARY_BUTTON} gap-2`}>
                <CalendarPlus className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                Add to calendar
              </button>
              <button type="button" onClick={() => void share()} className={`${CREW_DAY_SECONDARY_BUTTON} gap-2`}>
                <Share className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                Share with neighbors
              </button>
              <p className="text-center text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
                The preview shows {day.street_label} and the date, never your address.
              </p>
            </div>
          ) : null}
        </div>

        <CrewDayFooterBar>
          <Link href={bookingPath} className={CREW_DAY_PRIMARY_BUTTON}>
            See my Crew Day
          </Link>
        </CrewDayFooterBar>
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
