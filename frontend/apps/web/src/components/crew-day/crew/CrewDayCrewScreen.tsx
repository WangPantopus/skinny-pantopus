'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarX,
  Check,
  ChevronLeft,
  CircleAlert,
  Clock,
  CloudRain,
  Hourglass,
  LifeBuoy,
  Link2,
  Lock,
  Printer,
  QrCode,
  Tag,
  Users,
} from 'lucide-react';
import * as api from '@pantopus/api';
import type { CrewDayCrewView, CrewDayHome } from '@pantopus/types';
import { buildCrewDayPath } from '@pantopus/utils';
import QRCode from '@/components/ui/QRCode';
import { toast } from '@/components/ui/toast-store';
import { formatCrewDate, formatInstantDate, formatInstantRange, formatInstantTime, formatPrice, formatWindow } from '@/lib/crewDay';

// The crew's day on the web (screens 15, 16, 18 and 19; boards `CrewDayPrep`, `Route`, `DatesAnswers`, `AfterDay`):
// how many homes booked and what needs the crew (price checks, release asks), the homes ("Home 3 · Two stories" until
// 6 PM the evening before), ways to bring in more homes, the money, and "If plans change". On the day it reads the
// route; after rain, each home's answer and a route per date; afterwards, the money and "Offer a Crew Day here
// again". Team seats read; owners and editors act. GET /api/crew-days/:id/crew, GET /:id/route.

const CARD = 'flex flex-col gap-3 rounded-2xl border border-app bg-surface p-4';
const OVERLINE = 'text-xs font-semibold uppercase tracking-[0.07em] text-app-secondary';
const PRIMARY =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50';
const SECONDARY =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-app-strong bg-surface px-4 text-sm font-semibold text-app-strong hover:bg-surface-raised disabled:opacity-50';
const TONAL =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-surface-muted px-4 text-sm font-semibold text-app hover:bg-surface-raised';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className={OVERLINE}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const HOME_STATUS: Record<string, string> = {
  price_pending: 'Price to set',
  price_offered: 'Price sent',
  booked: 'Booked',
  new_dates: 'Picking a date',
  on_the_way: 'On the way',
  done: 'Done',
  paid: 'Paid',
  payment_failed: 'Card failed',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
  declined: "Couldn't take it",
};

function homeName(home: CrewDayHome): string {
  return home.address_visible && home.address ? home.address.line : home.label;
}

/** A route row's status line (spec 16): Done 9:48 AM · 2 photos / On the way · told 10–11 AM / Gate is ready / … */
function routeLine(home: CrewDayHome, tz: string): string {
  if (home.problem?.status === 'open') return 'Problem with Pantopus support';
  if (home.done_at) return `Done ${formatInstantTime(home.done_at, tz)}${home.photo_count ? ` · ${home.photo_count} ${home.photo_count === 1 ? 'photo' : 'photos'}` : ''}`;
  if (home.cant_get_in_at) return "Can't get in";
  if (home.gate_ready_at) return 'Gate is ready';
  if (home.status === 'on_the_way' && home.eta) return `On the way · told ${formatInstantRange(home.eta.start, home.eta.end, tz)}`;
  return 'Waiting';
}

function Meter({ booked, capacity }: { booked: number; capacity: number }) {
  if (capacity > 20) {
    return (
      <div role="img" aria-label={`${booked} of ${capacity} spots taken`} className="h-2 overflow-hidden rounded bg-app-border">
        <i className="block h-full rounded bg-app-home" style={{ width: `${Math.min(100, (booked / capacity) * 100)}%` }} />
      </div>
    );
  }
  return (
    <div role="img" aria-label={`${booked} of ${capacity} spots taken`} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${capacity}, minmax(0, 1fr))` }}>
      {Array.from({ length: capacity }, (_, i) => (
        <i key={i} className={`h-2 rounded ${i < booked ? 'bg-app-home' : 'bg-app-border'}`} />
      ))}
    </div>
  );
}

function PriceCheck({ day, home, onDone }: { day: CrewDayCrewView; home: CrewDayHome; onDone: () => void }) {
  const [price, setPrice] = useState('');
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const addOnCents = home.line_items.filter((l) => l.kind === 'add_on').reduce((sum, l) => sum + (l.price_cents ?? 0), 0);
  const send = async (body: { price_cents: number } | { decline: true; note: string }) => {
    setBusy(true);
    try {
      await api.crewDays.priceHome(day.id, home.id, body);
      toast.success('price_cents' in body ? 'Price sent. The household approves it before anything is booked.' : 'We told the household.');
      onDone();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const dollars = Math.round(Number(price.replace(/[$,\s]/g, '')) * 100);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-amber-200 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
          <Tag className="h-[1.125rem] w-[1.125rem]" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-semibold text-app">{homeName(home)}</span>
          <span className="text-sm text-app-strong">
            {home.details} · asked {formatInstantDate(home.created_at, day.timezone)}
          </span>
          <span className="text-[0.8125rem] text-app-secondary">
            Look at the home, then set its price. The household approves it before anything is booked.
            {addOnCents > 0 ? ` Add-ons keep their price (+${formatPrice(addOnCents)}).` : ''}
          </span>
        </div>
      </div>
      {declining ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`cd-decline-${home.id}`} className="text-sm font-semibold text-app-strong">
            A note for the household
          </label>
          <textarea
            id={`cd-decline-${home.id}`}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="We can't safely reach this roof with our ladders."
            className="rounded-lg border border-app-strong bg-surface px-3 py-2 text-[0.9375rem] text-app focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !note.trim()} onClick={() => void send({ decline: true, note: note.trim() })} className={PRIMARY}>
              {busy ? 'Sending…' : "Tell them we can't take it"}
            </button>
            <button type="button" onClick={() => setDeclining(false)} className={SECONDARY}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-app-strong">Price for this home</span>
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="text-app-secondary">
                $
              </span>
              <input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="260"
                className="w-28 rounded-lg border border-app-strong bg-surface px-3 py-2 text-[0.9375rem] text-app focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </span>
          </label>
          <button type="button" disabled={busy || !(dollars > 0)} onClick={() => void send({ price_cents: dollars })} className={PRIMARY}>
            {busy ? 'Sending…' : 'Set price'}
          </button>
          <button type="button" disabled={busy} onClick={() => setDeclining(true)} className={SECONDARY}>
            Can&apos;t take it
          </button>
        </div>
      )}
    </div>
  );
}

function RouteSection({ day }: { day: CrewDayCrewView }) {
  const dates = day.dates?.length ? day.dates : [day.service_date];
  const [date, setDate] = useState<string | null>(null);
  const route = useQuery({
    queryKey: ['crew-day', 'route', day.id, date],
    queryFn: () => api.crewDays.getRoute(day.id, date ?? undefined),
    staleTime: 15_000,
  });
  const r = route.data;
  const tz = day.timezone;
  return (
    <Section id="cd-crew-route" title={r ? `Route · ${formatCrewDate(r.date)}` : 'Route'}>
      <div className={CARD}>
        {dates.length > 1 ? (
          <div role="group" aria-label="Pick a date" className="flex flex-wrap gap-2">
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={(r?.date ?? date) === d}
                onClick={() => setDate(d)}
                className={`min-h-9 rounded-full px-3 text-sm font-semibold ${
                  (r?.date ?? date) === d ? 'bg-violet-600 text-white' : 'border border-app-strong text-app-strong hover:bg-surface-raised'
                }`}
              >
                {formatCrewDate(d)}
              </button>
            ))}
          </div>
        ) : null}
        {route.isLoading ? <p className="text-sm text-app-secondary">Loading the route…</p> : null}
        {route.isError ? <p className="text-sm text-app-strong">We couldn&apos;t load the route. Try again in a moment.</p> : null}
        {r ? (
          <>
            <p className="text-sm text-app-strong [font-variant-numeric:tabular-nums]">
              {r.total} {r.total === 1 ? 'home' : 'homes'} · {formatWindow(r.window_start, r.window_end)} · {r.done} of {r.total} done
            </p>
            <ol className="flex flex-col divide-y divide-app overflow-hidden rounded-xl border border-app">
              {r.homes.map((home, index) => (
                <li key={home.id} className="flex items-start gap-3 px-3 py-3">
                  <span aria-hidden="true" className="grid h-7 w-7 flex-none place-items-center rounded-full bg-surface-muted text-sm font-semibold text-app-strong">
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold text-app">
                      {homeName(home)}
                      {home.first_name ? <span className="font-normal text-app-secondary"> · {home.first_name}</span> : null}
                    </span>
                    <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">{routeLine(home, tz)}</span>
                    <span className="text-sm text-app-strong">{home.details}</span>
                    {home.access_note ? <span className="text-sm text-app-secondary">{home.access_note.split('\n')[0]}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
            {!r.homes.some((h) => h.address_visible) ? (
              <p className="flex items-center gap-1.5 text-[0.8125rem] text-app-secondary">
                <Lock className="h-3.5 w-3.5 flex-none" aria-hidden="true" /> Addresses show at 6 PM the evening before.
              </p>
            ) : null}
            <p className="text-[0.8125rem] text-app-secondary">Work the route in the Pantopus app on your phone: On my way, photos and Mark done.</p>
          </>
        ) : null}
      </div>
    </Section>
  );
}

export default function CrewDayCrewScreen({ businessId, crewDayId }: { businessId: string; crewDayId: string }) {
  const queryClient = useQueryClient();
  const key = ['crew-day', 'crew', crewDayId];
  const query = useQuery({ queryKey: key, queryFn: () => api.crewDays.getCrewDay(crewDayId), staleTime: 15_000 });
  const day = query.data;
  const [qr, setQr] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ['crew-day', 'route', crewDayId] });
    void queryClient.invalidateQueries({ queryKey: ['crew-day', 'business', businessId] });
  };
  /** One crew action; false when it didn't go through (a toast says why). */
  const run = async (label: string, action: () => Promise<unknown>, done: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(label);
    try {
      await action();
      toast.success(done);
      refresh();
      return true;
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : "That didn't go through. Try again.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const base = `/app/businesses/${encodeURIComponent(businessId)}`;
  const dashboard = `${base}/dashboard?tab=crew-days`;
  if (query.isLoading) return <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-app-secondary">Loading the Crew Day…</div>;
  if (!day) {
    return (
      <div role="alert" className="mx-auto flex max-w-3xl flex-col items-start gap-3 px-4 py-8">
        <p className="text-sm text-app-strong">
          {(query.error as { statusCode?: number } | null)?.statusCode === 404
            ? "This Crew Day isn't one of your business's."
            : "We couldn't load this Crew Day. Check your connection and try again."}
        </p>
        <Link href={dashboard} className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">
          Back to Crew Days
        </Link>
      </div>
    );
  }

  const tz = day.timezone;
  const arrival = formatWindow(day.window_start, day.window_end);
  const proposal = day.proposed_dates;
  const all = [...day.bookings, ...day.ended];
  const live = day.bookings;
  const workedOn = live.filter((h) => ['done', 'paid', 'payment_failed', 'refunded'].includes(h.status));
  const finished = day.status === 'done' || (live.length > 0 && workedOn.length === live.length);
  const today = formatInstantDate(new Date().toISOString(), tz) === formatCrewDate(day.service_date) || day.status === 'in_progress';
  const open = ['open', 'in_progress'].includes(day.status);
  const rate = day.money.fee_rate;
  const problems = live.filter((h) => h.problem?.status === 'open');
  const scheduled = live.filter((h) => h.status === 'done' && h.problem?.status !== 'open');

  let chip = { label: 'Open', tone: 'bg-green-100 text-green-700' };
  if (day.status === 'draft') chip = { label: 'Draft', tone: 'bg-surface-muted text-app-strong' };
  else if (day.status === 'pending_review') chip = { label: 'Waiting for approval', tone: 'bg-amber-100 text-amber-800' };
  else if (day.status === 'declined') chip = { label: 'Not approved', tone: 'bg-red-100 text-red-700' };
  else if (day.status === 'cancelled') chip = { label: 'Cancelled', tone: 'bg-surface-muted text-app-strong' };
  else if (finished) chip = { label: 'Done', tone: 'bg-green-100 text-green-700' };
  else if (today) chip = { label: 'Today', tone: 'bg-blue-100 text-blue-700' };
  else if (day.is_full) chip = { label: 'Full', tone: 'bg-blue-100 text-blue-700' };
  else if (day.is_closed) chip = { label: 'Booking closed', tone: 'bg-surface-muted text-app-strong' };

  const shareUrl = day.share?.url ?? null;
  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied.');
    } catch {
      toast.error("Couldn't copy. Select the link and copy it yourself.");
    }
  };

  // Rain: each home's answer to the open proposal, and the homes on each new date.
  const answers = proposal
    ? all
        .filter((h) => h.status === 'new_dates' || h.new_date_choice?.proposal_id === proposal.id)
        .map((h) => ({
          home: h,
          answer:
            h.status === 'new_dates'
              ? null
              : h.new_date_choice?.date === 'cancel' || h.status === 'cancelled'
                ? 'cancel'
                : (h.new_date_choice?.date ?? null),
        }))
    : [];
  const picked = answers.filter((a) => a.answer && a.answer !== 'cancel').length;
  const cancelledAnswers = answers.filter((a) => a.answer === 'cancel').length;
  const waiting = answers.filter((a) => a.answer == null).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-16 pt-5 text-app">
      <div className="flex flex-col gap-1">
        <Link href={dashboard} className="inline-flex min-h-8 items-center gap-1 self-start text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Crew Days
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">{day.title}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-app-strong [font-variant-numeric:tabular-nums]">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${chip.tone}`}>{chip.label}</span>
              {formatCrewDate(day.service_date, 'long')}
              {arrival ? ` · ${arrival}` : ''} · {[day.street_label, day.city].filter(Boolean).join(', ')}
            </p>
          </div>
          {day.can_edit && ['draft', 'declined', 'pending_review', 'open'].includes(day.status) ? (
            <Link href={`${base}/crew-days/${encodeURIComponent(day.id)}/edit`} className={SECONDARY}>
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      {day.status === 'pending_review' ? (
        <div className={CARD}>
          <p className="flex items-center gap-2 text-base font-semibold">
            <Hourglass className="h-5 w-5 flex-none text-amber-700 dark:text-amber-400" aria-hidden="true" /> Waiting for Pantopus
          </p>
          <p className="text-sm text-app-strong">
            We&apos;ll tell you within a business day{day.submitted_at ? `. Sent ${formatInstantDate(day.submitted_at, tz)} at ${formatInstantTime(day.submitted_at, tz)}` : ''}.
            The invitation link works once it&apos;s approved.
          </p>
        </div>
      ) : null}
      {day.status === 'declined' ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
          <p className="flex items-center gap-2 text-base font-semibold">
            <CircleAlert className="h-5 w-5 flex-none text-red-700 dark:text-red-400" aria-hidden="true" /> Pantopus didn&apos;t approve this
          </p>
          {day.review_note ? <p className="text-sm text-app-strong">{day.review_note}</p> : null}
          {day.can_edit ? (
            <Link href={`${base}/crew-days/${encodeURIComponent(day.id)}/edit`} className={`${PRIMARY} self-start`}>
              Fix and send again
            </Link>
          ) : null}
        </div>
      ) : null}
      {day.status === 'draft' ? (
        <div className={CARD}>
          <p className="text-sm text-app-strong">This is a draft. Finish it and send it to Pantopus for approval.</p>
          {day.can_edit ? (
            <Link href={`${base}/crew-days/${encodeURIComponent(day.id)}/edit`} className={`${PRIMARY} self-start`}>
              Finish the draft
            </Link>
          ) : null}
        </div>
      ) : null}
      {day.status === 'cancelled' ? (
        <div className={CARD}>
          <p className="flex items-center gap-2 text-base font-semibold">
            <CalendarX className="h-5 w-5 flex-none text-app-secondary" aria-hidden="true" />
            {day.cancelled_by === 'operator' ? 'Pantopus cancelled this Crew Day' : 'You cancelled this Crew Day'}
          </p>
          <p className="text-sm text-app-strong">
            {day.cancel_reason ? `${day.cancel_reason} ` : ''}Nobody was charged for a home the crew hadn&apos;t worked on.
          </p>
        </div>
      ) : null}

      {open && !finished ? (
        <section aria-label="Bookings" className={CARD}>
          <p className="text-xl font-semibold tracking-[-0.012em] [font-variant-numeric:tabular-nums]">
            {day.booked_count} of {day.capacity} homes booked
          </p>
          <Meter booked={day.booked_count} capacity={day.capacity} />
          <p className="flex items-center gap-2 text-sm text-app-secondary">
            <Clock className="h-4 w-4 flex-none" aria-hidden="true" />
            {day.is_closed
              ? `Booking closed on ${formatInstantDate(day.booking_closes_at, tz)}`
              : `Booking closes ${formatInstantDate(day.booking_closes_at, tz)}, ${formatInstantTime(day.booking_closes_at, tz)}`}
          </p>
        </section>
      ) : null}

      {proposal && !finished ? (
        <Section id="cd-crew-dates" title="New dates">
          <div className={CARD}>
            <span className="text-xs font-semibold uppercase tracking-[0.07em] text-amber-800 dark:text-amber-400">
              {waiting > 0 ? 'Waiting for answers' : 'Everyone answered'}
            </span>
            <p className="flex items-center gap-2 text-lg font-semibold">
              <CloudRain className="h-5 w-5 flex-none text-amber-700 dark:text-amber-400" aria-hidden="true" /> Rain moved {formatCrewDate(day.service_date)}
            </p>
            <p className="text-sm text-app-strong">
              Answers due {formatInstantDate(proposal.deadline_at, tz)}, {formatInstantTime(proposal.deadline_at, tz)}
            </p>
            <p className="text-sm text-app-secondary">
              {picked} picked a date · {cancelledAnswers} cancelled · {waiting} no answer yet
            </p>
            <ul className="flex flex-col divide-y divide-app overflow-hidden rounded-xl border border-app">
              {answers.map(({ home, answer }) => (
                <li key={home.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="font-semibold text-app">{homeName(home)}</span>
                  <span className={answer == null ? 'text-amber-800 dark:text-amber-400' : 'text-app-strong'}>
                    {answer == null ? 'No answer yet' : answer === 'cancel' ? 'Cancelled' : formatCrewDate(answer)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-app-strong">Route for each date</h3>
              {proposal.dates.map((d) => {
                const homes = answers.filter((a) => a.answer === d.date).map((a) => homeName(a.home));
                return (
                  <p key={d.date} className="text-sm text-app-strong">
                    <span className="font-semibold">
                      {formatCrewDate(d.date)} · {formatWindow(d.window_start, d.window_end)}
                    </span>
                    {' — '}
                    {homes.length ? `${homes.length} ${homes.length === 1 ? 'home' : 'homes'}: ${homes.join(', ')}` : 'no homes yet'}
                  </p>
                );
              })}
            </div>
            {waiting > 0 ? (
              <p className="text-[0.8125rem] text-app-secondary">
                A home that doesn&apos;t answer by {formatInstantDate(proposal.deadline_at, tz)} at {formatInstantTime(proposal.deadline_at, tz)} is cancelled at no
                charge.
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {day.needs_you.price_checks.length || day.needs_you.release_asks.length ? (
        <Section id="cd-crew-needs" title="Needs you">
          {day.needs_you.price_checks.map((home) =>
            day.can_edit ? (
              <PriceCheck key={home.id} day={day} home={home} onDone={refresh} />
            ) : (
              <p key={home.id} className={`${CARD} text-sm`}>
                {homeName(home)} · {home.details} needs its price. An owner or editor sets it.
              </p>
            ),
          )}
          {day.needs_you.release_asks.map((home) => (
            <div key={home.id} className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-semibold">{homeName(home)} asks to cancel</span>
                <span className="text-sm text-app-strong">
                  {home.details}
                  {home.release_asked_at ? ` · asked ${formatInstantDate(home.release_asked_at, tz)} at ${formatInstantTime(home.release_asked_at, tz)}` : ''}
                </span>
                <span className="text-[0.8125rem] text-app-secondary">
                  It&apos;s less than 48 hours to go, so they can&apos;t cancel in the app. Releasing the home costs them nothing.
                </span>
              </div>
              {day.can_edit ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void run(`release-${home.id}`, () => api.crewDays.releaseHome(day.id, home.id), 'Released. Nothing was charged.')}
                  className={`${PRIMARY} self-start`}
                >
                  {busy === `release-${home.id}` ? 'Releasing…' : 'Release at no charge'}
                </button>
              ) : null}
            </div>
          ))}
        </Section>
      ) : null}

      {open && today && !finished ? <RouteSection day={day} /> : null}

      {finished ? (
        <div className={CARD}>
          <p className="flex items-center gap-2 text-xl font-semibold">
            <Check className="h-5 w-5 flex-none text-app-home" aria-hidden="true" />
            {workedOn.length < live.length
              ? `${workedOn.length} of ${live.length} homes done`
              : live.length === 1
                ? 'The home is done'
                : `All ${live.length} homes done`}
          </p>
          <p className="text-sm text-app-secondary">{(day.dates?.length ? day.dates : [day.service_date]).map((d) => formatCrewDate(d)).join(', ')}</p>
        </div>
      ) : null}

      {live.length || day.ended.length ? (
        <Section id="cd-crew-homes" title={open && !finished ? 'Homes booked' : 'Homes'}>
          <div className="flex flex-col rounded-2xl border border-app bg-surface px-4">
            <ul className="flex flex-col divide-y divide-app">
              {[...live, ...day.ended].map((home) => (
                <li key={home.id} className="flex min-h-12 items-start gap-3 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[0.9375rem]">
                      <b className="font-semibold">{homeName(home)}</b>
                      {home.first_name ? ` · ${home.first_name}` : ''} · {home.details}
                    </span>
                    <span className="text-xs font-medium text-app-secondary">
                      {home.problem?.status === 'open' ? 'Problem with Pantopus support' : (HOME_STATUS[home.status] ?? home.status)}
                    </span>
                  </span>
                  <span className="flex-none text-right text-[0.9375rem] font-semibold [font-variant-numeric:tabular-nums]">
                    {home.price_cents != null ? formatPrice(home.price_cents) : '—'}
                  </span>
                </li>
              ))}
            </ul>
            {open && !finished && !all.some((h) => h.address_visible) ? (
              <p className="flex items-center gap-1.5 pb-3 pt-1 text-[0.8125rem] text-app-secondary">
                <Lock className="h-3.5 w-3.5 flex-none" aria-hidden="true" /> Addresses show at 6 PM the evening before.
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {open && !finished && !day.is_closed && !day.is_full && day.share ? (
        <Section id="cd-crew-more" title="Bring in more homes">
          <div className={CARD}>
            <div className="flex items-center gap-2.5">
              <Link2 className="h-[1.125rem] w-[1.125rem] flex-none text-app-secondary" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm text-app-strong [overflow-wrap:anywhere]">{shareUrl?.replace(/^https?:\/\//, '')}</span>
              <button type="button" onClick={() => void copyLink()} className="min-h-10 px-1 text-sm font-semibold text-violet-700 dark:text-violet-300">
                Copy
              </button>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" aria-expanded={qr} onClick={() => setQr((v) => !v)} className={TONAL}>
                <QrCode className="h-4 w-4" aria-hidden="true" /> {qr ? 'Hide QR code' : 'QR code'}
              </button>
              <a href={`${buildCrewDayPath(day.share.code)}/flyer`} target="_blank" rel="noopener" className={TONAL}>
                <Printer className="h-4 w-4" aria-hidden="true" /> Printable flyer
              </a>
            </div>
            {qr && shareUrl ? (
              <div className="flex justify-center rounded-xl bg-white p-4">
                <QRCode value={shareUrl} size={200} label={`QR code for ${day.title}`} />
              </div>
            ) : null}
            {day.can_edit && day.past_customers > 0 ? (
              <>
                <div className="h-px bg-app-border" />
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    <Users className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[0.9375rem] font-semibold">
                      {day.past_customers} {day.past_customers === 1 ? 'home' : 'homes'} you served near here
                    </span>
                    <span className="text-[0.8125rem] text-app-secondary">Each gets one invitation with their price. We never send it twice.</span>
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    void run('invite', async () => {
                      const { invited } = await api.crewDays.invitePastCustomers(day.id);
                      if (!invited) throw Object.assign(new Error('Everyone near here was already invited.'), { code: 'NONE' });
                    }, 'Invitations sent.')
                  }
                  className={`${SECONDARY} self-start`}
                >
                  {busy === 'invite' ? 'Inviting…' : 'Invite past customers'}
                </button>
              </>
            ) : null}
          </div>
        </Section>
      ) : null}

      {open || finished ? (
        <Section id="cd-crew-money" title="Money">
          <div className={CARD}>
            {day.money.charged_cents > 0 || day.money.scheduled_cents > 0 || day.money.paused_cents > 0 ? (
              <ul className="flex flex-col gap-2">
                <li className="flex items-baseline justify-between gap-3">
                  <span className="flex flex-col">
                    <span className="font-semibold">Charged</span>
                    <span className="text-sm text-app-secondary">
                      {(() => {
                        const n = live.filter((h) => ['paid', 'refunded'].includes(h.status)).length;
                        return `${n} ${n === 1 ? 'home' : 'homes'}`;
                      })()}
                    </span>
                  </span>
                  <span className="text-lg font-semibold [font-variant-numeric:tabular-nums]">{formatPrice(day.money.charged_cents)}</span>
                </li>
                {day.money.scheduled_cents > 0 ? (
                  <li className="flex items-baseline justify-between gap-3">
                    <span className="flex flex-col">
                      <span className="font-semibold">Scheduled</span>
                      <span className="text-sm text-app-secondary">
                        {scheduled[0]?.charge_due_at
                          ? `Charges ${formatInstantDate(scheduled[0].charge_due_at, tz)} at ${formatInstantTime(scheduled[0].charge_due_at, tz)}`
                          : 'Charges a day after each home is done'}
                      </span>
                    </span>
                    <span className="text-lg font-semibold [font-variant-numeric:tabular-nums]">{formatPrice(day.money.scheduled_cents)}</span>
                  </li>
                ) : null}
                {day.money.paused_cents > 0 ? (
                  <li className="flex items-baseline justify-between gap-3">
                    <span className="flex flex-col">
                      <span className="font-semibold">Paused</span>
                      <span className="text-sm text-app-secondary">
                        {problems.length} {problems.length === 1 ? 'problem' : 'problems'} with Pantopus support
                      </span>
                    </span>
                    <span className="text-lg font-semibold [font-variant-numeric:tabular-nums]">{formatPrice(day.money.paused_cents)}</span>
                  </li>
                ) : null}
              </ul>
            ) : (
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-app-secondary">
                  {live.length === 1 ? 'If it’s done' : live.length === 2 ? 'If both are done' : `If all ${live.length} are done`}
                </span>
                <span className="text-xl font-bold [font-variant-numeric:tabular-nums]">{formatPrice(day.money.gross_cents)} charged</span>
                <span className="text-sm text-app-strong">
                  You receive {formatPrice(day.money.net_cents)} after the {rate}% fee.
                </span>
              </div>
            )}
            <p className="text-[0.8125rem] text-app-secondary">You receive {100 - rate}% of each charge, 48 hours after it.</p>
            <Link href={`${base}/dashboard?tab=invoices`} className="self-start text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">
              See invoices
            </Link>
          </div>
        </Section>
      ) : null}

      {problems.length ? (
        <Section id="cd-crew-problems" title="With Pantopus support">
          {problems.map((home) => (
            <div key={home.id} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
              <LifeBuoy className="mt-0.5 h-5 w-5 flex-none text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold">
                  {homeName(home)}
                  {home.problem?.note ? ` · ${home.problem.note}` : ''}
                </span>
                <span className="text-sm text-app-strong">Pantopus support is on it. This home&apos;s charge waits.</span>
              </span>
            </div>
          ))}
        </Section>
      ) : null}

      {day.can_edit && open && !finished ? (
        <Section id="cd-crew-change" title="If plans change">
          <div className="flex flex-col gap-2">
            {!proposal && live.some((h) => h.status === 'booked') ? (
              <Link href={`${base}/crew-days/${encodeURIComponent(day.id)}/new-dates`} className={SECONDARY}>
                <CloudRain className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" /> Propose new dates
              </Link>
            ) : null}
            {cancelling ? (
              <div className={CARD}>
                <label htmlFor="cd-crew-cancel" className="text-sm font-semibold text-app-strong">
                  Cancel for all {live.length} {live.length === 1 ? 'home' : 'homes'}? Nobody is charged. Tell them why.
                </label>
                <textarea
                  id="cd-crew-cancel"
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Our truck broke down."
                  className="rounded-lg border border-app-strong bg-surface px-3 py-2 text-[0.9375rem] text-app focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busy || !reason.trim()}
                    onClick={() => void run('cancel', () => api.crewDays.cancelCrewDay(day.id, reason.trim()), 'Cancelled. Nobody was charged.').then((ok) => ok && setCancelling(false))}
                    className="inline-flex min-h-10 items-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {busy === 'cancel' ? 'Cancelling…' : 'Cancel this Crew Day'}
                  </button>
                  <button type="button" onClick={() => setCancelling(false)} className={SECONDARY}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setCancelling(true)} className="min-h-11 text-base font-semibold text-red-700 hover:underline dark:text-red-400">
                Cancel this Crew Day
              </button>
            )}
          </div>
        </Section>
      ) : null}

      {finished && day.can_edit ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-app-secondary">Offering it again copies this day&apos;s street, prices and notes. You can invite the homes you served.</p>
          <Link href={`${base}/crew-days/new?repeat=${encodeURIComponent(day.id)}`} className={`${PRIMARY} self-start`}>
            Offer a Crew Day here again
          </Link>
        </div>
      ) : null}
    </div>
  );
}
