'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check, Clock, Flag, X } from 'lucide-react';
import * as api from '@pantopus/api';
import type { AdminCrewDayBooking, AdminCrewDayCrew, CrewDayPhoto } from '@pantopus/types';
import { toast } from '@/components/ui/toast-store';
import { formatCrewDate, formatInstantDate, formatInstantTime, formatPrice } from '@/lib/crewDay';

// The pieces the operator's Crew Day pages share (boards `AdminList`, `AdminDay`, `AdminProblems`,
// `AdminRequests`), in the existing admin pages' style: small upper-case pills, bordered cards, violet actions.

export const ADMIN_CARD = 'flex flex-col gap-3.5 rounded-xl border border-app-border bg-app-surface p-4';
export const ADMIN_PRIMARY =
  'rounded-lg bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50';
export const ADMIN_SECONDARY =
  'rounded-lg border border-app-border bg-app-surface px-3.5 py-1.5 text-sm font-medium text-app-text transition hover:bg-app-hover disabled:opacity-50';
export const ADMIN_QUIET = 'rounded-lg px-3.5 py-1.5 text-sm font-medium text-app-text-secondary transition hover:bg-app-hover disabled:opacity-50';
export const ADMIN_FIELD =
  'w-full rounded-lg border border-app-border-strong bg-app-surface px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-violet-500';

const PILL: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  sky: 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
};

export function Pill({ tone = 'slate', children }: { tone?: keyof typeof PILL; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[0.625rem] font-semibold uppercase leading-3 tracking-[0.02em] ${PILL[tone]}`}>
      {children}
    </span>
  );
}

/** "Alex R.": a household's first name and last initial, as the operator's lists show them. */
export function shortName(person: { first_name?: string | null; last_name?: string | null; name?: string | null } | null | undefined): string {
  if (!person) return 'A household';
  const first = person.first_name || person.name?.split(' ')[0] || '';
  const last = person.last_name ? ` ${person.last_name.charAt(0)}.` : '';
  return `${first}${last}`.trim() || 'A household';
}

export function moneyText(cents: number | null | undefined): string {
  return cents == null ? '—' : formatPrice(cents);
}

/** The crew's standing beside a day (board `AdminList`): published, payouts, documents, past days and problems. */
export function CrewStanding({ crew, feeRate }: { crew: AdminCrewDayCrew; feeRate?: number }) {
  const checks: Array<[boolean, string, string]> = [
    [crew.published, 'Page published', 'Page not published'],
    [crew.payouts_enabled, 'Payouts on', 'Payouts off'],
    [crew.verified, 'Documents verified', 'Documents not verified'],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-lg bg-app-surface-sunken p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-full bg-violet-100 text-[0.8125rem] font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          {(crew.name || '?').charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-app-text">{crew.name}</span>
          <span className="text-xs text-app-text-secondary">
            {crew.founding ? 'Founding business' : 'Business'}
            {feeRate != null ? ` · ${feeRate}% fee` : ''}
          </span>
        </span>
      </div>
      <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[0.8125rem] text-app-text-strong">
        {checks.map(([ok, yes, no]) => (
          <li key={yes} className="flex items-center gap-1.5">
            {ok ? <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" strokeWidth={2.6} aria-hidden="true" /> : <X className="h-3.5 w-3.5 text-red-700 dark:text-red-400" strokeWidth={2.6} aria-hidden="true" />}
            {ok ? yes : no}
          </li>
        ))}
        {crew.past_days != null ? (
          <li>
            {crew.past_days} past {crew.past_days === 1 ? 'day' : 'days'} · {crew.problems ?? 0} {crew.problems === 1 ? 'problem' : 'problems'}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function PhotoRow({ title, photos }: { title: string; photos: CrewDayPhoto[] }) {
  if (!photos.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.04em] text-app-text-secondary">{title}</span>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <a key={photo.path} href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${title.toLowerCase()} ${index + 1} of ${photos.length}`} className="block h-[4.5rem] w-[4.5rem] overflow-hidden rounded-[0.625rem] bg-app-surface-sunken">
            {/* Signed, short-lived URLs from the private bucket: a plain img, never the image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Refund all or part (boards `AdminDay`, `AdminProblems`) through the existing refund machinery: a charged Crew Day is
 * refunded in full; before the charge, all of it stops the charge and part off charges the rest now. A booking with
 * no open problem can be refunded too (a household that called support).
 */
export function RefundForm({
  booking,
  onDone,
  onCancel,
}: {
  booking: Pick<AdminCrewDayBooking, 'id' | 'status' | 'price_cents'>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [part, setPart] = useState(true);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const price = booking.price_cents ?? 0;
  const charged = booking.status === 'paid';
  const refundCents = part && !charged ? Math.round(Number(amount.replace(/[$,\s]/g, '')) * 100) : price;

  const refund = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.adminCrewDays.problemAction(booking.id, { action: 'refund', amount_cents: refundCents, ...(note.trim() ? { note: note.trim() } : {}) });
      toast.success('Refunded.');
      onDone();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void refund();
      }}
      className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface-sunken p-3.5"
    >
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold text-app-text">Refund</legend>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
          {!charged ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-app-text">
              <input type="radio" name={`refund-${booking.id}`} checked={part} onChange={() => setPart(true)} className="h-4 w-4 accent-violet-600" />
              Part:
              <span className="flex h-9 w-24 items-center overflow-hidden rounded-lg border border-app-border-strong bg-app-surface">
                <span aria-hidden="true" className="pl-2.5 pr-1 text-app-text-secondary">
                  $
                </span>
                <input
                  aria-label="Refund amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={() => setPart(true)}
                  className="h-full min-w-0 flex-1 bg-transparent pr-2 text-sm text-app-text focus:outline-none"
                />
              </span>
              of {moneyText(price)}
            </label>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-app-text">
            <input type="radio" name={`refund-${booking.id}`} checked={!part || charged} onChange={() => setPart(false)} className="h-4 w-4 accent-violet-600" />
            All {moneyText(price)}
          </label>
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`refund-note-${booking.id}`} className="text-[0.8125rem] font-medium text-app-text-strong">
          Note to the household and the crew
        </label>
        <textarea id={`refund-note-${booking.id}`} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={ADMIN_FIELD} />
        <span className="text-xs text-app-text-secondary">
          {charged ? 'A charged Crew Day is refunded in full. The crew can invoice the rest.' : 'Before a charge runs, a refund stops it instead. Part off charges the rest now.'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !(refundCents > 0 && refundCents <= price)} className={ADMIN_PRIMARY}>
          {busy ? 'Sending…' : `Refund ${moneyText(refundCents > 0 ? refundCents : price)}`}
        </button>
        <button type="button" onClick={onCancel} className={ADMIN_QUIET}>
          Not now
        </button>
      </div>
    </form>
  );
}

const KIND_LABEL: Record<string, string> = {
  missed: 'The crew missed something',
  damage: 'Something was damaged',
  no_show: "The crew didn't come",
  charge: 'A problem with the charge',
  other: 'Something else',
};

/**
 * One open problem (board `AdminProblems`): what the household said, both sides' photos, the charge, the reply-by
 * time, and the operator's four answers. The photos come from the day's detail (the list doesn't carry them).
 */
export function ProblemCard({ booking, onChanged, id }: { booking: AdminCrewDayBooking; onChanged: () => void; id?: string }) {
  const tz = booking.crew_day?.timezone ?? 'America/Los_Angeles';
  const day = useQuery({
    queryKey: ['crew-day', 'admin', 'day', booking.crew_day_id],
    queryFn: () => api.adminCrewDays.getDay(booking.crew_day_id),
    staleTime: 60_000,
  });
  const detail = day.data && day.data.kind === 'offer' ? day.data.bookings.find((b) => b.id === booking.id) : undefined;
  const [mode, setMode] = useState<'refund' | 'resolve' | 'note' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const charged = booking.status === 'paid';

  const act = async (body: { action: 'note' | 'release' | 'resolve'; note?: string }, done: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.adminCrewDays.problemAction(booking.id, body);
      toast.success(done);
      setMode(null);
      setNote('');
      onChanged();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li id={id} className={ADMIN_CARD}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="red">
          <Flag className="h-3 w-3" aria-hidden="true" />
          {KIND_LABEL[booking.problem?.kind ?? 'other'] ?? 'Something else'}
        </Pill>
        <Pill tone="amber">{charged ? 'Charged' : 'Charge paused'}</Pill>
        {booking.problem?.due_at ? (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Reply by {formatInstantDate(booking.problem.due_at, tz)}, {formatInstantTime(booking.problem.due_at, tz)}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-app-text">
          {booking.address.line} · {shortName(booking.household)}
        </h2>
        <p className="text-sm text-app-text-strong">
          <Link href={`/app/admin/crew-days/${encodeURIComponent(booking.crew_day_id)}`} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
            {booking.crew_day?.title ?? 'The Crew Day'}
          </Link>
          {' · '}
          {formatCrewDate(booking.service_date)}
          {booking.crew?.name ? ` · ${booking.crew.name}` : ''}
        </p>
      </div>
      <div className="flex flex-col gap-1 rounded-lg bg-app-surface-sunken px-3 py-2.5">
        <p className="whitespace-pre-wrap text-sm text-app-text">{booking.problem?.note || 'No note.'}</p>
        {booking.problem?.opened_at ? (
          <span className="text-xs text-app-text-secondary">
            Reported {formatInstantDate(booking.problem.opened_at, tz)}, {formatInstantTime(booking.problem.opened_at, tz)} · {booking.crew?.name ?? 'The crew'} was told
            and sees this note
          </span>
        ) : null}
      </div>
      {detail ? (
        <div className="flex flex-wrap gap-5">
          <PhotoRow title="Household's photos" photos={detail.problem_photos ?? []} />
          <PhotoRow title={detail.done_at ? `Crew's photos at ${formatInstantTime(detail.done_at, tz)}` : "Crew's photos"} photos={detail.photos ?? []} />
        </div>
      ) : null}
      <p className="text-sm text-app-text-strong [font-variant-numeric:tabular-nums]">
        <b className="font-semibold text-app-text">{moneyText(booking.price_cents)}</b>
        {charged
          ? booking.paid_at
            ? ` · charged ${formatInstantDate(booking.paid_at, tz)}, ${formatInstantTime(booking.paid_at, tz)}`
            : ' · charged'
          : booking.charge_due_at
            ? ` · paused · would have charged ${formatInstantDate(booking.charge_due_at, tz)}, ${formatInstantTime(booking.charge_due_at, tz)}`
            : ' · paused'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {!charged ? (
          <button type="button" disabled={busy} onClick={() => void act({ action: 'release' }, 'Charge released.')} className={ADMIN_PRIMARY}>
            Release the charge
          </button>
        ) : null}
        <button type="button" aria-expanded={mode === 'refund'} onClick={() => setMode(mode === 'refund' ? null : 'refund')} className={ADMIN_SECONDARY}>
          Refund
        </button>
        <button type="button" aria-expanded={mode === 'resolve'} onClick={() => setMode(mode === 'resolve' ? null : 'resolve')} className={ADMIN_SECONDARY}>
          Mark resolved
        </button>
        <button type="button" aria-expanded={mode === 'note'} onClick={() => setMode(mode === 'note' ? null : 'note')} className={ADMIN_QUIET}>
          Add a note
        </button>
      </div>
      {mode === 'refund' ? (
        <RefundForm
          booking={booking}
          onDone={() => {
            setMode(null);
            onChanged();
          }}
          onCancel={() => setMode(null)}
        />
      ) : mode ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'resolve') void act({ action: 'resolve', note: note.trim() }, 'Marked resolved.');
            else void act({ action: 'note', note: note.trim() }, 'Note sent to the household.');
          }}
          className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface-sunken p-3.5"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`note-${booking.id}`} className="text-[0.8125rem] font-medium text-app-text-strong">
              {mode === 'note' ? 'Note to the household' : 'Note to the household and the crew (required)'}
            </label>
            <textarea id={`note-${booking.id}`} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={ADMIN_FIELD} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !note.trim()} className={ADMIN_PRIMARY}>
              {busy ? 'Sending…' : mode === 'resolve' ? 'Mark resolved' : 'Send note'}
            </button>
            <button type="button" onClick={() => setMode(null)} className={ADMIN_QUIET}>
              Not now
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
