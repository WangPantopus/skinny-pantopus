'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, CircleAlert, CloudRain, TriangleAlert } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { formatCrewDate, formatInstantDate, formatInstantTime, formatWindow } from '@/lib/crewDay';

// Screen 18, Propose new dates on the web (board `ProposeDates`): rain, or the crew can't make it. Two or three of
// the next 14 days, each with its arrival window; every booked home picks one or cancels at no charge, and nobody is
// moved without saying yes. A preview shows the notice households get. POST /api/crew-days/:id/propose-dates.

function addDays(date: string, days: number): string {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

function todayIn(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function clockOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "Thu, Nov 19 or Sat, Nov 21", "Thu, Nov 19, Sat, Nov 21 or Mon, Nov 23". */
function orList(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

export default function CrewDayProposeDatesScreen({ businessId, crewDayId }: { businessId: string; crewDayId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['crew-day', 'crew', crewDayId], queryFn: () => api.crewDays.getCrewDay(crewDayId) });
  const day = query.data;
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tz = day?.timezone ?? 'America/Los_Angeles';
  const length = day ? Math.max(60, minutesOf(day.window_end) - minutesOf(day.window_start)) : 240;
  const days = useMemo(() => {
    const today = todayIn(tz);
    return Array.from({ length: 14 }, (_, i) => addDays(today, i + 1));
  }, [tz]);
  // Windows as long as the day's own, starting each hour from 6 AM while they end by 8 PM.
  const windows = useMemo(() => {
    const starts: string[] = [];
    for (let m = 6 * 60; m + length <= 20 * 60; m += 60) starts.push(clockOf(m));
    if (day && !starts.includes(day.window_start.slice(0, 5))) starts.push(day.window_start.slice(0, 5));
    return starts.sort();
  }, [day, length]);

  const base = `/app/businesses/${encodeURIComponent(businessId)}`;
  const back = `${base}/crew-days/${encodeURIComponent(crewDayId)}`;
  if (query.isLoading) return <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-app-secondary">Loading…</div>;
  if (!day) {
    return (
      <div role="alert" className="mx-auto flex max-w-2xl flex-col items-start gap-3 px-4 py-8">
        <p className="text-sm text-app-strong">We couldn&apos;t load this Crew Day. Check your connection and try again.</p>
        <Link href={back} className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">
          Back
        </Link>
      </div>
    );
  }

  const homes = day.bookings.filter((h) => h.status === 'booked' || h.status === 'new_dates').length;
  const chosen = Object.keys(picked).sort();
  const toggle = (date: string) =>
    setPicked((current) => {
      const next = { ...current };
      if (next[date]) delete next[date];
      else if (Object.keys(next).length < 3) next[date] = day.window_start.slice(0, 5);
      return next;
    });
  const earliest = chosen[0] ? new Date(`${chosen[0]}T${picked[chosen[0]]}:00`) : null;
  const deadline = earliest ? new Date(earliest.getTime() - 24 * 3600 * 1000).toISOString() : null;
  const crewName = day.crew?.name || 'Your crew';
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${day.service_date}T12:00:00Z`));

  const send = async () => {
    if (chosen.length < 2 || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.crewDays.proposeDates(day.id, {
        dates: chosen.map((date) => ({ date, window_start: picked[date], window_end: clockOf(minutesOf(picked[date]) + length) })),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      void queryClient.invalidateQueries({ queryKey: ['crew-day'] });
      toast.success(`Sent to ${homes} ${homes === 1 ? 'home' : 'homes'}.`);
      router.push(back);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : "We couldn't send the new dates. Check your connection and try again.");
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-16 pt-5 text-app">
      <div className="flex flex-col gap-1">
        <Link href={back} className="inline-flex min-h-8 items-center gap-1 self-start text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {day.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">Propose new dates</h1>
        <p className="text-base text-app-strong">Rain? Offer 2 or 3 dates. Each household picks one or cancels at no charge. Nobody is moved without saying yes.</p>
      </div>

      <section aria-labelledby="cd-dates-days" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="cd-dates-days" className="text-xs font-semibold uppercase tracking-[0.07em] text-app-secondary">
            Next 14 days
          </h2>
          <span className="text-[0.8125rem] text-app-secondary">{chosen.length} of 3 picked</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5">
          {days.map((date) => {
            const on = Boolean(picked[date]);
            const at = new Date(`${date}T12:00:00Z`);
            return (
              <button
                key={date}
                type="button"
                aria-pressed={on}
                aria-label={formatCrewDate(date, 'long')}
                disabled={!on && chosen.length >= 3}
                onClick={() => toggle(date)}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border disabled:opacity-40 ${
                  on ? 'border-violet-600 bg-violet-600 text-white' : 'border-app bg-surface text-app hover:bg-surface-raised'
                }`}
              >
                <span className={`text-[0.6875rem] font-semibold ${on ? 'text-violet-100' : 'text-app-secondary'}`}>
                  {new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(at)}
                </span>
                <span className="text-[1.0625rem] font-semibold [font-variant-numeric:tabular-nums]">{at.getUTCDate()}</span>
              </button>
            );
          })}
        </div>
      </section>

      {chosen.length ? (
        <section aria-labelledby="cd-dates-windows" className="flex flex-col gap-2">
          <h2 id="cd-dates-windows" className="text-xs font-semibold uppercase tracking-[0.07em] text-app-secondary">
            Arrival windows
          </h2>
          <div className="flex flex-col divide-y divide-app rounded-2xl border border-app bg-surface px-4">
            {chosen.map((date) => (
              <div key={date} className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-2">
                <label htmlFor={`cd-win-${date}`} className="text-base font-semibold">
                  {formatCrewDate(date)}
                </label>
                <select
                  id={`cd-win-${date}`}
                  value={picked[date]}
                  onChange={(e) => setPicked((current) => ({ ...current, [date]: e.target.value }))}
                  className="min-h-10 rounded-lg border border-app-strong bg-surface px-2.5 text-[0.9375rem] text-app"
                >
                  {windows.map((start) => (
                    <option key={start} value={start}>
                      {formatWindow(start, clockOf(minutesOf(start) + length))}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cd-dates-note" className="text-xs font-semibold uppercase tracking-[0.07em] text-app-secondary">
          A note for households (optional)
        </label>
        <textarea
          id="cd-dates-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Heavy rain is forecast all day Tuesday."
          className="rounded-xl border border-app-strong bg-surface px-3 py-2 text-[0.9375rem] text-app focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <section aria-labelledby="cd-dates-preview" className="flex flex-col gap-2">
        <h2 id="cd-dates-preview" className="text-xs font-semibold uppercase tracking-[0.07em] text-app-secondary">
          What each household gets
        </h2>
        <div className="flex items-start gap-3 rounded-2xl border border-app bg-surface p-4">
          <span aria-hidden="true" className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-amber-200 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
            <CloudRain className="h-[1.125rem] w-[1.125rem]" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[0.9375rem] font-semibold">Rain changed the plan</span>
            <span className="text-sm text-app-strong">
              {chosen.length >= 2
                ? `${crewName} can come ${orList(chosen.map((d) => formatCrewDate(d)))} at the same price. No payment has been taken.${
                    deadline ? ` If you don't answer by ${formatInstantDate(deadline, tz)} at ${formatInstantTime(deadline, tz)}, we won't book a new date.` : ''
                  }`
                : 'Pick 2 or 3 dates to see the message.'}
            </span>
          </span>
        </div>
      </section>

      <p className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-app dark:border-amber-900/50 dark:bg-amber-950/30">
        <TriangleAlert className="mt-0.5 h-4 w-4 flex-none text-amber-700 dark:text-amber-400" aria-hidden="true" />
        Goes to {homes} {homes === 1 ? 'home' : 'homes'}. Your {weekday} visit is called off for everyone when you send.
      </p>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={chosen.length < 2 || sending || homes === 0 || !day.can_edit}
        onClick={() => void send()}
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-600 px-5 text-base font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {sending ? 'Sending…' : `Send to ${homes} ${homes === 1 ? 'home' : 'homes'}`}
      </button>
    </div>
  );
}
