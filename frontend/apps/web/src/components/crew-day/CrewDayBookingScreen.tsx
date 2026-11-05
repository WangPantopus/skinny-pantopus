'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CalendarX,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CloudRain,
  CreditCard,
  Hourglass,
  House,
  LifeBuoy,
  Lock,
  MapPin,
  MessageCircle,
  Pencil,
  Share,
  ShieldCheck,
  Tag,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import * as api from '@pantopus/api';
import type { CrewDayBookingPage } from '@pantopus/types';
import BottomSheet from '@/components/ui/BottomSheet';
import { confirmStore } from '@/components/ui/confirm-store';
import { toast } from '@/components/ui/toast-store';
import {
  formatCrewDate,
  formatInstantDate,
  formatInstantRange,
  formatInstantTime,
  formatPrice,
  formatWindow,
  includedItems,
} from '@/lib/crewDay';
import {
  CREW_DAY_PRIMARY_BUTTON,
  CREW_DAY_SECONDARY_BUTTON,
  CrewDayCard,
  CrewDaySectionTitle,
  CrewRow,
  ServiceTag,
  StreetMiniMap,
} from './CrewDayParts';

// Screen 5, Your Crew Day (board `CrewDay` and its `Cd*` states), and screen 8, Change or cancel (board `Cancel`):
// one page per booking. The state card says where the booking stands in honest words ("Requested" isn't "Booked",
// "Paused" isn't "Refunded"); every answer comes back as `{ booking }` and replaces the page.

type Tone = 'success' | 'warning' | 'info' | 'error' | 'neutral';

const TILE_TONE: Record<Tone, string> = {
  success: 'bg-app-home text-white dark:text-[#0b1220]',
  warning: 'bg-[#fde68a] text-[#9a4a08] dark:bg-[#5c4210] dark:text-[#fcd34d]',
  info: 'bg-app-info-bg text-app-info',
  error: 'bg-app-error-bg text-app-error',
  neutral: 'bg-app-surface-sunken text-app-text-strong',
};

const PROBLEM_LABEL: Record<string, string> = {
  missed: 'The crew missed something',
  damage: 'Something was damaged',
  no_show: "The crew didn't come",
  charge: 'A problem with the charge',
  other: 'Something else',
};

function card(b: CrewDayBookingPage): string {
  return b.card ? `${b.card.brand.charAt(0).toUpperCase()}${b.card.brand.slice(1)} ending ${b.card.last4}` : 'Your card';
}

/** The local hour now and the evening before, for "Tomorrow" and "Today". */
function dayPhase(b: CrewDayBookingPage): 'before' | 'evening' | 'today' {
  const tz = b.crew_day.timezone;
  const now = new Date();
  const start = new Date(b.window_starts_at);
  const today = formatInstantDate(now.toISOString(), tz);
  if (today === formatCrewDate(b.service_date)) return 'today';
  // From 6 PM the evening before.
  const eveningBefore = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
  return now >= eveningBefore && now < start && hour >= 18 ? 'evening' : 'before';
}

function StateCard({ tone, icon: Icon, title, children }: { tone: Tone; icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <section aria-labelledby="cd-state" className="flex flex-col gap-3 rounded-[1.25rem] border border-app-border bg-app-surface p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`grid h-10 w-10 flex-none place-items-center rounded-xl ${TILE_TONE[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <h2 id="cd-state" className="pt-1.5 text-lg font-semibold leading-6 tracking-[-0.01em]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <p className="text-[0.9375rem] leading-[1.375rem] text-app-text-strong">{children}</p>;
}

function Photos({ photos }: { photos: CrewDayBookingPage['photos'] }) {
  if (!photos.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo, index) => (
        <a key={photo.path} href={photo.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl bg-app-surface-sunken">
          {/* Signed, short-lived URLs from the private bucket: a plain img, never the image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={`Photo ${index + 1} of the finished work`} className="aspect-square w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

function Steps({ steps }: { steps: CrewDayBookingPage['steps'] }) {
  return (
    <ol aria-label="Where your booking is" className="flex flex-wrap gap-x-1 gap-y-2">
      {steps.map((step, index) => (
        <li key={step.key} className="flex min-w-[min(5rem,100%)] flex-1 items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`grid h-5 w-5 flex-none place-items-center rounded-full ${step.state === 'done' ? 'bg-app-home text-white dark:text-[#0b1220]' : step.state === 'current' ? 'border-2 border-app-home' : 'border border-app-border-strong'}`}
          >
            {step.state === 'done' ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
          </span>
          <span className={`text-[0.8125rem] leading-[1.125rem] ${step.state === 'todo' ? 'text-app-text-secondary' : 'font-semibold text-app-text'}`}>
            {step.label}
            <span className="sr-only">{step.state === 'done' ? ', done' : step.state === 'current' ? ', now' : ''}</span>
          </span>
          {index < steps.length - 1 ? <span aria-hidden="true" className="h-px flex-1 bg-app-border" /> : null}
        </li>
      ))}
    </ol>
  );
}

function ActionRow({ icon: Icon, label, onClick, href }: { icon: LucideIcon; label: string; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      <Icon className="h-5 w-5 flex-none text-app-text-strong" aria-hidden="true" />
      <span className="flex-1 text-left text-base leading-[1.3125rem]">{label}</span>
      <ChevronRight className="h-4 w-4 flex-none text-app-text-secondary" aria-hidden="true" />
    </>
  );
  const cls = 'flex min-h-14 w-full items-center gap-3 px-4 hover:bg-app-hover';
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export default function CrewDayBookingScreen({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = useMemo(() => ['crew-day', 'booking', bookingId], [bookingId]);
  const query = useQuery({ queryKey: key, queryFn: () => api.crewDays.getBooking(bookingId), staleTime: 15_000 });
  const b = query.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState('');
  const [dateChoice, setDateChoice] = useState<string | null>(null);

  const apply = async (label: string, run: () => Promise<{ booking: CrewDayBookingPage }>, done?: string) => {
    if (busy) return;
    setBusy(label);
    try {
      const { booking } = await run();
      queryClient.setQueryData(key, booking);
      void queryClient.invalidateQueries({ queryKey: ['crew-day', 'mine'] });
      if (done) toast.success(done);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      toast.error(e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : "That didn't go through. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const messageCrew = async () => {
    if (!b) return;
    try {
      await api.chat.createDirectChat(b.crew_day.crew.business_user_id);
      router.push(`/app/chat/conversation/${encodeURIComponent(b.crew_day.crew.business_user_id)}`);
    } catch {
      toast.error("Couldn't open the conversation with the crew. Try again.");
    }
  };

  if (query.isLoading) {
    return <div className="mx-auto max-w-xl px-4 pt-8 text-sm text-app-text-secondary">Loading your Crew Day…</div>;
  }
  if (!b) {
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col gap-3 px-4 pt-8">
        <p className="text-base leading-6 text-app-text-strong">
          {(query.error as { statusCode?: number } | null)?.statusCode === 404
            ? "This booking isn't yours, or it's gone."
            : "We couldn't load this Crew Day. Check your connection and try again."}
        </p>
        <button type="button" onClick={() => void query.refetch()} className={CREW_DAY_SECONDARY_BUTTON}>
          Try again
        </button>
      </div>
    );
  }

  const crew = b.crew_day.crew.name || 'The crew';
  const tz = b.crew_day.timezone;
  const arrival = formatWindow(b.window_start, b.window_end);
  const price = b.price_cents != null ? formatPrice(b.price_cents) : null;
  const phase = dayPhase(b);
  const problemOpen = b.problem?.status === 'open';
  const ended = ['cancelled', 'declined', 'refunded'].includes(b.status);
  const proposal = b.status === 'new_dates' ? b.proposal : null;
  const chosenDate = proposal?.dates.find((d) => d.date === dateChoice) ?? null;

  let state: ReactNode;
  if (problemOpen && b.problem) {
    state = (
      <StateCard tone="warning" icon={LifeBuoy} title="Pantopus support has this">
        <div className="flex flex-col gap-1 rounded-xl bg-app-surface-sunken p-3">
          <span className="text-xs font-semibold uppercase tracking-[0.07em] text-app-text-secondary">You said</span>
          <span className="text-[0.9375rem] leading-[1.375rem]">{b.problem.note || PROBLEM_LABEL[b.problem.kind]}</span>
        </div>
        <Body>
          {price ? `Your ${price} charge is paused while we sort it out.` : 'Your charge is paused while we sort it out.'}
          {b.problem.due_at ? ` We'll reply by ${formatInstantTime(b.problem.due_at, tz)} ${formatInstantDate(b.problem.due_at, tz)}.` : ''}
        </Body>
        <Link href={`/app/crew-days/bookings/${encodeURIComponent(b.id)}/problem`} className={CREW_DAY_SECONDARY_BUTTON}>
          Add a note or photo
        </Link>
      </StateCard>
    );
  } else if (b.problem?.status === 'resolved' && b.problem.resolution) {
    const r = b.problem;
    const total = b.price_cents ?? 0;
    const title =
      r.resolution === 'released'
        ? `Charge released: ${formatPrice(total)} paid`
        : r.resolution === 'refunded'
          ? `Refunded ${formatPrice(r.refunded_cents || total)} to ${card(b)}`
          : r.resolution === 'partial_refund'
            ? `Refunded ${formatPrice(r.refunded_cents)} of ${formatPrice(total)}`
            : 'Pantopus support resolved this';
    state = (
      <StateCard tone="success" icon={ShieldCheck} title={title}>
        {r.resolved_at ? <Body>Pantopus support closed this case on {formatInstantDate(r.resolved_at, tz)}.</Body> : null}
        {b.invoice_id ? (
          <Link href={`/app/invoice/${encodeURIComponent(b.invoice_id)}`} className="text-[0.9375rem] font-semibold text-app-link">
            See receipt
          </Link>
        ) : null}
      </StateCard>
    );
  } else if (b.status === 'price_pending') {
    state = (
      <StateCard tone="warning" icon={Hourglass} title="The crew is checking your price">
        <Body>
          {crew} looks at your home before confirming the price.
          {b.cancel_cutoff_at ? ` You'll hear by ${formatInstantDate(b.cancel_cutoff_at, tz)}.` : ''} Nothing is booked or charged yet.
        </Body>
      </StateCard>
    );
  } else if (b.status === 'price_offered') {
    state = (
      <StateCard tone="warning" icon={Tag} title={price ? `Your price: ${price}` : 'Your price is ready'}>
        <Body>{crew} looked at your home.</Body>
        <div className="flex flex-col gap-2.5">
          <button type="button" disabled={!!busy} onClick={() => void apply('approve', () => api.crewDays.answerPrice(b.id, true), "You're on the route.")} className={CREW_DAY_PRIMARY_BUTTON}>
            {busy === 'approve' ? 'Approving…' : price ? `Approve ${price}` : 'Approve'}
          </button>
          <button type="button" disabled={!!busy} onClick={() => void apply('decline', () => api.crewDays.answerPrice(b.id, false), 'Declined. Nothing was charged.')} className={CREW_DAY_SECONDARY_BUTTON}>
            Decline
          </button>
        </div>
        <p className="text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">Declining is free. Nothing is booked until you approve.</p>
      </StateCard>
    );
  } else if (b.status === 'new_dates' && proposal) {
    state = (
      <StateCard tone="warning" icon={CloudRain} title="Rain changed the plan">
        <Body>
          {crew} can come on one of these dates.{price ? ` Your price stays ${price}.` : ''} No payment has been taken.
        </Body>
        <fieldset className="flex flex-col overflow-hidden rounded-xl border border-app-border">
          <legend className="sr-only">Pick a new date</legend>
          {proposal.dates.map((d) => (
            <label key={d.date} className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-app-border px-[0.875rem] py-3 last:border-b-0 hover:bg-app-hover">
              <input
                type="radio"
                name="cd-new-date"
                checked={dateChoice === d.date}
                onChange={() => setDateChoice(d.date)}
                className="h-[1.375rem] w-[1.375rem] flex-none accent-[rgb(var(--accent-primary-fill))]"
              />
              <span className="flex flex-col">
                <span className="text-base font-medium leading-[1.3125rem]">{formatCrewDate(d.date, 'long')}</span>
                <span className="text-sm leading-5 text-app-text-secondary">{formatWindow(d.window_start, d.window_end)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={!chosenDate || !!busy}
            onClick={() => chosenDate && void apply('date', () => api.crewDays.answerNewDate(b.id, proposal.id, chosenDate.date), "You're on the route for the new date.")}
            className={CREW_DAY_PRIMARY_BUTTON}
          >
            {chosenDate ? `Book ${new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${chosenDate.date}T12:00:00Z`))}` : 'Pick a date'}
          </button>
          <button type="button" disabled={!!busy} onClick={() => void apply('date-cancel', () => api.crewDays.answerNewDate(b.id, proposal.id, 'cancel'), 'Cancelled. Nothing was charged.')} className={CREW_DAY_SECONDARY_BUTTON}>
            Cancel at no charge
          </button>
        </div>
        <p className="text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
          If you don&apos;t answer by {formatInstantDate(proposal.deadline_at, tz)} at {formatInstantTime(proposal.deadline_at, tz)}, we won&apos;t book a new date for you.
        </p>
      </StateCard>
    );
  } else if (b.status === 'on_the_way') {
    const eta = b.eta ? formatInstantRange(b.eta.start, b.eta.end, tz) : arrival;
    state = (
      <StateCard tone="info" icon={Truck} title={`On the way · expected ${eta}`}>
        {b.eta?.updated_at ? <Body>Updated by {crew} at {formatInstantTime(b.eta.updated_at, tz)}</Body> : null}
        {b.gate_ready_at ? (
          <p className="flex items-center gap-2 text-[0.9375rem] leading-[1.375rem] text-app-success">
            <Check className="h-4 w-4 flex-none" aria-hidden="true" /> We told the crew the gate is ready.
          </p>
        ) : (
          <button type="button" disabled={!!busy} onClick={() => void apply('gate', () => api.crewDays.gateReady(b.id), 'We told the crew the gate is ready.')} className={CREW_DAY_PRIMARY_BUTTON}>
            {busy === 'gate' ? 'Telling the crew…' : 'Gate is ready'}
          </button>
        )}
        <button type="button" onClick={() => void messageCrew()} className={CREW_DAY_SECONDARY_BUTTON}>
          Message the crew
        </button>
      </StateCard>
    );
  } else if (b.status === 'done') {
    const due = b.charge.due_at;
    state = (
      <StateCard tone="success" icon={Check} title={`Done · reported by the crew${b.done_at ? ` at ${formatInstantTime(b.done_at, tz)}` : ''}`}>
        <Photos photos={b.photos} />
        {b.done_note ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.07em] text-app-text-secondary">Note from {crew}</span>
            <p className="text-[0.9375rem] leading-[1.375rem]">{b.done_note}</p>
          </div>
        ) : null}
        {price && due ? (
          <Body>
            We&apos;ll charge {price} {formatInstantDate(due, tz) === formatInstantDate(new Date().toISOString(), tz) ? 'today' : 'tomorrow'} at {formatInstantTime(due, tz)} unless you tell us something needs attention.
          </Body>
        ) : null}
        <div className="flex flex-col gap-2.5">
          <button type="button" disabled={!!busy} onClick={() => void apply('confirm', () => api.crewDays.confirmDone(b.id))} className={CREW_DAY_PRIMARY_BUTTON}>
            {busy === 'confirm' ? 'Paying…' : 'Everything looks good'}
          </button>
          <Link href={`/app/crew-days/bookings/${encodeURIComponent(b.id)}/problem`} className={CREW_DAY_SECONDARY_BUTTON}>
            Something needs attention
          </Link>
        </div>
      </StateCard>
    );
  } else if (b.status === 'paid') {
    state = (
      <StateCard tone="success" icon={CreditCard} title={`Paid ${price ?? ''}${b.charge.paid_at ? ` · ${formatInstantDate(b.charge.paid_at, tz)}` : ''}`.trim()}>
        <p className="text-[0.9375rem] leading-[1.375rem] text-app-text-strong">
          {card(b)}
          {b.invoice_id ? (
            <>
              {' · '}
              <Link href={`/app/invoice/${encodeURIComponent(b.invoice_id)}`} className="font-semibold text-app-link">
                See receipt
              </Link>
            </>
          ) : null}
        </p>
        <Photos photos={b.photos} />
        <Body>Want this again next fall? We&apos;ll ask you first.</Body>
        {b.remind_next_season ? (
          <p className="flex items-center gap-2 text-[0.9375rem] text-app-success">
            <Check className="h-4 w-4" aria-hidden="true" /> We&apos;ll ask you next fall.
          </p>
        ) : (
          <button type="button" disabled={!!busy} onClick={() => void apply('remind', () => api.crewDays.updateBooking(b.id, { remind_next_season: true }), "We'll ask you next fall.")} className={CREW_DAY_SECONDARY_BUTTON}>
            Remind me next fall
          </button>
        )}
      </StateCard>
    );
  } else if (b.status === 'payment_failed') {
    state = (
      <StateCard tone="error" icon={CircleAlert} title="Your card didn't go through">
        <Body>{price ? `Pay ${price} to ${crew} in Pantopus.` : `Pay ${crew} in Pantopus.`}</Body>
        {b.invoice_id ? (
          <Link href={`/app/invoice/${encodeURIComponent(b.invoice_id)}`} className={CREW_DAY_PRIMARY_BUTTON}>
            Pay now
          </Link>
        ) : null}
      </StateCard>
    );
  } else if (b.status === 'refunded') {
    state = <StateCard tone="neutral" icon={CreditCard} title={`Refunded ${formatPrice(b.charge.refunded_cents || b.price_cents || 0)} to ${card(b)}`} />;
  } else if (ended) {
    const who =
      b.status === 'declined'
        ? `${crew} can't take your home this time. Nothing was charged.`
        : b.cancelled_by === 'household'
          ? 'You cancelled. Nothing was charged.'
          : b.cancelled_by === 'crew'
            ? `${crew} cancelled. Nothing was charged.`
            : b.cancelled_by === 'operator'
              ? 'Pantopus cancelled this Crew Day. Nothing was charged.'
              : 'No new date was picked, so this booking was cancelled. Nothing was charged.';
    state = (
      <StateCard tone="neutral" icon={CalendarX} title={who}>
        <div className="flex flex-col gap-2.5">
          <Link href="/app/crew-days" className={CREW_DAY_SECONDARY_BUTTON}>
            Find another Crew Day
          </Link>
          <Link href="/app/crew-days/ask" className={CREW_DAY_SECONDARY_BUTTON}>
            Ask for one on your street
          </Link>
        </div>
      </StateCard>
    );
  } else if (phase === 'evening' || phase === 'today') {
    state = (
      <StateCard tone="success" icon={CalendarDays} title={`${phase === 'today' ? 'Today' : 'Tomorrow'}, ${arrival}`}>
        {b.prep_note ? <Body>{b.prep_note}</Body> : null}
        {b.crew_day.outside_only ? <Body>You don&apos;t need to be home.</Body> : null}
        <button type="button" onClick={() => setEditingNote(true)} className={CREW_DAY_SECONDARY_BUTTON}>
          Edit access note
        </button>
      </StateCard>
    );
  } else {
    const evening = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(
      new Date(new Date(`${b.service_date}T12:00:00Z`).getTime() - 24 * 60 * 60 * 1000),
    );
    state = (
      <StateCard tone="success" icon={Check} title="You're on the route">
        <Body>
          We&apos;ll remind you {evening} evening.{b.crew_day.outside_only ? " You don't need to be home." : ''}
        </Body>
        {b.prep_note ? (
          <div className="flex flex-col gap-1 rounded-xl bg-app-surface-sunken p-3">
            <span className="text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">From {crew}</span>
            <span className="text-[0.9375rem] leading-[1.375rem]">{b.prep_note}</span>
          </div>
        ) : null}
      </StateCard>
    );
  }

  const cardSub =
    b.status === 'price_pending' || b.status === 'price_offered'
      ? 'Saved. Nothing is charged yet.'
      : b.status === 'new_dates'
        ? 'Saved. No payment has been taken.'
        : problemOpen
          ? 'Charge paused'
          : b.status === 'done' && b.charge.due_at
            ? `Charges ${formatInstantDate(b.charge.due_at, tz)} at ${formatInstantTime(b.charge.due_at, tz)}`
            : b.status === 'paid' && b.charge.paid_at
              ? `Charged ${formatInstantDate(b.charge.paid_at, tz)}`
              : b.status === 'payment_failed'
                ? "Didn't go through"
                : 'Saved. Charged only after the work.';
  const showNote = !ended && b.status !== 'paid';
  const cutoffLine = b.can_cancel && b.cancel_cutoff_at
    ? `Free cancellation until ${formatInstantDate(b.cancel_cutoff_at, tz)}, ${formatInstantTime(b.cancel_cutoff_at, tz)}`
    : null;
  const included = includedItems(b.crew_day);

  const saveNote = () =>
    void apply('note', () => api.crewDays.updateBooking(b.id, { access_note: note.trim() }), 'Note saved.').then(() => setEditingNote(false));

  const cancel = async () => {
    setSheet(false);
    const yes = await confirmStore.open({
      title: `Cancel your ${b.crew_day.title.replace(/ on .*/, '')} booking?`,
      description: 'Nothing has been charged.',
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep it',
      variant: 'destructive',
    });
    if (yes) await apply('cancel', () => api.crewDays.cancelBooking(b.id), 'Cancelled. Nothing was charged.');
  };

  const askRelease = async () => {
    setSheet(false);
    await apply('release', () => api.crewDays.askRelease(b.id), `We asked ${crew} to release your home.`);
    void messageCrew();
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-16 pt-4 text-app-text">
      <div className="overflow-hidden rounded-[1.25rem] border border-app-border">
        <div className="relative">
          <StreetMiniMap street={b.crew_day.street_label} className="h-[120px]" />
          <Link href="/app/crew-days" aria-label="Back to Your Crew Days" className="absolute left-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-app-surface/90 text-app-text shadow-sm">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
        <div className="flex flex-col gap-2 bg-app-surface p-4">
          <ServiceTag service={b.crew_day.service} />
          <h1 className="text-[1.375rem] font-semibold leading-7 tracking-[-0.012em]">{b.crew_day.title}</h1>
          <p className="flex items-start gap-2 text-sm leading-5 text-app-text-strong [font-variant-numeric:tabular-nums]">
            <CalendarDays className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            {formatCrewDate(b.service_date, 'long')}
            {arrival ? ` · ${arrival}` : ''}
          </p>
          <CrewRow crew={b.crew_day.crew} />
        </div>
      </div>

      {!ended ? <Steps steps={b.steps} /> : null}

      {state}

      <section aria-labelledby="cd-yours" className="flex flex-col gap-2">
        <CrewDaySectionTitle id="cd-yours">Your booking</CrewDaySectionTitle>
        <CrewDayCard className="flex flex-col divide-y divide-app-border">
          <div className="flex items-start gap-3 p-[0.875rem]">
            <MapPin className="mt-0.5 h-5 w-5 flex-none text-app-text-strong" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-semibold leading-[1.3125rem]">{b.address.line}</span>
              <span className="text-sm leading-5 text-app-text-secondary">{[b.address.city, [b.address.state, b.address.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
              <span className="flex items-center gap-1.5 text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
                <Lock className="h-[0.8125rem] w-[0.8125rem]" aria-hidden="true" /> Visible to your crew and Pantopus.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-[0.875rem]">
            <House className="mt-0.5 h-5 w-5 flex-none text-app-text-strong" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className="text-base leading-[1.3125rem]">
                {[b.option.label, ...b.add_ons.map((a) => a.label)].filter(Boolean).join(' · ') || b.crew_day.service_label}
              </span>
              {included.length ? <span className="text-sm leading-5 text-app-text-secondary">{included.join(' · ')}</span> : null}
            </div>
          </div>
          <div className="flex items-start gap-3 p-[0.875rem]">
            <Tag className="mt-0.5 h-5 w-5 flex-none text-app-text-strong" aria-hidden="true" />
            <span className="text-base leading-[1.3125rem]">{price ? `${price} · including tax` : 'After a look'}</span>
          </div>
          <div className="flex items-start gap-3 p-[0.875rem]">
            <CreditCard className="mt-0.5 h-5 w-5 flex-none text-app-text-strong" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="text-base leading-[1.3125rem]">{card(b)}</span>
              <span className="text-sm leading-5 text-app-text-secondary">{cardSub}</span>
            </div>
          </div>
          {cutoffLine ? (
            <div className="flex items-start gap-3 p-[0.875rem]">
              <CalendarX className="mt-0.5 h-5 w-5 flex-none text-app-text-strong" aria-hidden="true" />
              <span className="text-base leading-[1.3125rem]">{cutoffLine}</span>
            </div>
          ) : null}
        </CrewDayCard>
      </section>

      {showNote ? (
        <section aria-labelledby="cd-note" className="flex flex-col gap-2">
          <CrewDaySectionTitle id="cd-note">For the crew</CrewDaySectionTitle>
          <CrewDayCard className="flex flex-col gap-2 p-[0.875rem]">
            {editingNote ? (
              <>
                <label htmlFor="cd-note-field" className="sr-only">
                  Note for the crew
                </label>
                <textarea
                  id="cd-note-field"
                  value={note}
                  maxLength={500}
                  rows={3}
                  autoFocus
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Gate, pets, parking…"
                  className="w-full rounded-[0.875rem] border border-app-border-strong bg-app-surface px-[0.875rem] py-3 text-base leading-[1.375rem] focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={busy === 'note'} onClick={saveNote} className={CREW_DAY_PRIMARY_BUTTON}>
                    {busy === 'note' ? 'Saving…' : 'Save note'}
                  </button>
                  <button type="button" onClick={() => setEditingNote(false)} className={CREW_DAY_SECONDARY_BUTTON}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-[min(12rem,100%)] flex-1 text-[0.9375rem] leading-[1.375rem]">
                  {b.access_note || <span className="text-app-text-secondary">No note yet.</span>}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNote(b.access_note || '');
                    setEditingNote(true);
                  }}
                  className="min-h-11 flex-none px-1 text-[0.9375rem] font-semibold text-app-link"
                >
                  Edit
                </button>
              </div>
            )}
            <p className="flex items-center gap-1.5 text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
              <Lock className="h-[0.8125rem] w-[0.8125rem]" aria-hidden="true" /> The crew sees this on the day only.
            </p>
          </CrewDayCard>
        </section>
      ) : null}

      <nav aria-label="More for this booking" className="flex flex-col divide-y divide-app-border overflow-hidden rounded-[1.25rem] border border-app-border bg-app-surface">
        <ActionRow icon={MessageCircle} label="Message the crew" onClick={() => void messageCrew()} />
        {b.can_change || b.can_cancel || b.can_ask_release ? <ActionRow icon={Pencil} label="Change or cancel" onClick={() => setSheet(true)} /> : null}
        {b.share && !ended ? (
          <ActionRow
            icon={Share}
            label="Share with neighbors"
            onClick={async () => {
              const share = b.share!;
              try {
                if (typeof navigator.share === 'function') await navigator.share({ title: b.crew_day.title, text: share.message.replace(share.url, '').trim(), url: share.url });
                else {
                  await navigator.clipboard.writeText(share.message);
                  toast.success('Link copied. Paste it in a text or your street group.');
                }
              } catch (err) {
                if ((err as { name?: string })?.name !== 'AbortError') toast.error("Couldn't share the link. Try again.");
              }
            }}
          />
        ) : null}
        <ActionRow icon={ShieldCheck} label="Who sees what" href="/crew-day/who-sees-what" />
      </nav>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Change or cancel">
        <ul className="flex flex-col divide-y divide-app-border">
          {b.can_change ? (
            <li>
              <Link href={`/crew-day/${encodeURIComponent(b.crew_day.code)}/price`} className="flex items-start gap-3 py-3">
                <SheetIcon icon={House} />
                <SheetText title="Change my home details" body="Stories and add-ons. You approve any new price first." />
              </Link>
            </li>
          ) : null}
          <li>
            <button
              type="button"
              onClick={() => {
                setSheet(false);
                setNote(b.access_note || '');
                setEditingNote(true);
              }}
              className="flex w-full items-start gap-3 py-3 text-left"
            >
              <SheetIcon icon={Pencil} />
              <SheetText title="Edit the note for the crew" body="The crew sees it on the day only." />
            </button>
          </li>
          {b.can_cancel ? (
            <li>
              <button type="button" onClick={() => void cancel()} className="flex w-full items-start gap-3 py-3 text-left">
                <SheetIcon icon={CalendarX} danger />
                <SheetText
                  title="Cancel my booking"
                  danger
                  body={b.cancel_cutoff_at ? `Free until ${formatInstantDate(b.cancel_cutoff_at, tz)} at ${formatInstantTime(b.cancel_cutoff_at, tz)}. Nothing has been charged.` : 'Nothing has been charged.'}
                />
              </button>
            </li>
          ) : null}
          {!b.can_cancel && (b.can_ask_release || b.release_asked_at) ? (
            <li>
              <button type="button" disabled={!b.can_ask_release} onClick={() => void askRelease()} className="flex w-full items-start gap-3 py-3 text-left disabled:opacity-70">
                <SheetIcon icon={MessageCircle} />
                <SheetText
                  title={b.release_asked_at ? 'You asked the crew to cancel' : 'Ask the crew to cancel'}
                  body={`It's less than 48 hours to go. ${crew} can release your home at no charge.`}
                />
              </button>
            </li>
          ) : null}
        </ul>
      </BottomSheet>
    </div>
  );
}

function SheetIcon({ icon: Icon, danger = false }: { icon: LucideIcon; danger?: boolean }) {
  return (
    <span aria-hidden="true" className={`grid h-9 w-9 flex-none place-items-center rounded-[0.625rem] ${danger ? 'bg-app-error-bg text-app-error' : 'bg-app-surface-sunken text-app-text-strong'}`}>
      <Icon className="h-[1.125rem] w-[1.125rem]" />
    </span>
  );
}

function SheetText({ title, body, danger = false }: { title: string; body: string; danger?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={`text-base font-semibold leading-[1.3125rem] ${danger ? 'text-app-error' : 'text-app-text'}`}>{title}</span>
      <span className="text-sm leading-5 text-app-text-secondary">{body}</span>
    </span>
  );
}
