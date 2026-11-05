'use client';

import { Fragment, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, RefreshCw, ShieldAlert } from 'lucide-react';
import * as api from '@pantopus/api';
import type { AdminCrewDayBooking, AdminCrewDayDetail } from '@pantopus/types';
import { toast } from '@/components/ui/toast-store';
import { formatCrewDate, formatInstantDate, formatInstantRange, formatInstantTime, formatPrice, formatWindow } from '@/lib/crewDay';
import { monthsText } from '../crewDayStatus';
import { ADMIN_FIELD, ADMIN_QUIET, CrewStanding, Pill, ProblemCard, RefundForm, moneyText, shortName } from './AdminCrewDayParts';

// Screen 21, one Crew Day for the operator (board `AdminDay`): everything about the day and its bookings
// (addresses, households, prices, status, where each charge stands), Cancel this Crew Day, a Refund (all or part) on
// each done, charged or card-failed booking, the open problems with their answers, and the timeline in words.
// Opening it records the operator's visit on the day's timeline. GET /api/admin/crew-days/:id.

// Bookings support can refund without an open problem (a household that called in); one with a problem is refunded
// from its problem card.
const REFUNDABLE = ['done', 'payment_failed', 'paid'];

type OfferDetail = Extract<AdminCrewDayDetail, { kind: 'offer' }>;

const STATUS: Record<string, { label: string; tone: 'slate' | 'amber' | 'red' | 'green' | 'sky' }> = {
  price_pending: { label: 'Price check', tone: 'amber' },
  price_offered: { label: 'Price offered', tone: 'amber' },
  booked: { label: 'Booked', tone: 'sky' },
  new_dates: { label: 'Picking a date', tone: 'amber' },
  on_the_way: { label: 'On the way', tone: 'sky' },
  done: { label: 'Done', tone: 'sky' },
  paid: { label: 'Paid', tone: 'green' },
  payment_failed: { label: 'Card failed', tone: 'red' },
  refunded: { label: 'Refunded', tone: 'slate' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
  declined: { label: "Crew couldn't take it", tone: 'slate' },
};

function chargeLine(b: AdminCrewDayBooking, tz: string): string {
  const at = (iso: string | null) => (iso ? `${formatInstantDate(iso, tz)}, ${formatInstantTime(iso, tz)}` : '');
  switch (b.charge_state) {
    case 'charged':
      return b.paid_at ? `Charged ${at(b.paid_at)}` : 'Charged';
    case 'scheduled':
      return b.charge_due_at ? `Scheduled ${at(b.charge_due_at)}` : 'Scheduled';
    case 'paused':
      return 'Paused';
    case 'partially_refunded':
      return `${formatPrice(b.refunded_cents)} refunded, the rest charged`;
    case 'refunded':
      return `Refunded ${formatPrice(b.refunded_cents || b.price_cents || 0)}`;
    case 'failed':
      return `Card failed${b.charge_failure ? ` (${b.charge_failure.replace(/_/g, ' ')})` : ''}`;
    case 'not_yet':
      return 'Not yet';
    default:
      return b.status === 'cancelled' ? (b.cancelled_by === 'crew' ? 'Released by the crew, not charged' : 'Not charged') : '—';
  }
}

/** The day's timeline in words (board `AdminDay`), naming homes by address and households by first name. */
function eventText(e: OfferDetail['events'][number], detail: OfferDetail): string | null {
  const booking = e.booking_id ? detail.bookings.find((b) => b.id === e.booking_id) : undefined;
  const home = booking?.address.line ?? 'A home';
  const who = booking ? shortName(booking.household) : 'The household';
  const crew = detail.day.crew.name || 'The crew';
  const data = (e.data ?? {}) as Record<string, unknown>;
  const cents = (key: string) => (typeof data[key] === 'number' ? formatPrice(data[key] as number) : '');
  const note = typeof data.note === 'string' && data.note.trim() ? data.note.trim() : '';
  const tz = detail.day.timezone;
  switch (e.kind) {
    case 'day_created':
      return `${crew} made the day`;
    case 'day_edited':
      return `${crew} edited the day`;
    case 'day_submitted':
      return `${crew} sent it for approval`;
    case 'day_approved':
      return `Pantopus approved it${note ? `: ${note}` : ''}`;
    case 'day_declined':
      return `Pantopus didn't approve it${note ? `: ${note}` : ''}`;
    case 'day_cancelled':
      return `${e.actor_role === 'operator' ? 'Pantopus' : crew} cancelled the day${typeof data.reason === 'string' ? `: ${data.reason}` : ''}`;
    case 'day_started':
      return 'The day started';
    case 'day_done':
      return 'The day is done';
    case 'dates_proposed':
      return `${crew} proposed new dates`;
    case 'invited_past':
      return `${crew} invited ${typeof data.invited === 'number' ? data.invited : 'its'} past customers`;
    case 'price_requested':
      return `${home} asked for a price after a look`;
    case 'price_offered':
      return `The crew priced ${home} at ${cents('price_cents') || 'its price'}`;
    case 'price_approved':
      return `${who} approved ${cents('price_cents') || 'the price'}`;
    case 'price_declined':
      return `${who} declined the price`;
    case 'booked':
      return `${who} booked ${home}`;
    case 'booking_changed':
      return `${who} changed the booking`;
    case 'booking_cancelled':
      return `${who} cancelled ${home}`;
    case 'release_asked':
      return `${home} asked to cancel`;
    case 'released':
      return `The crew released ${home} at no charge`;
    case 'access_note_changed':
      return `${who} changed the note for the crew`;
    case 'gate_ready':
      return `${home}: the gate is ready`;
    case 'on_the_way':
    case 'eta_changed': {
      const eta = typeof data.eta_start === 'string' && typeof data.eta_end === 'string' ? `, expected ${formatInstantRange(data.eta_start, data.eta_end, tz)}` : '';
      return e.kind === 'on_the_way' ? `The crew told ${home} it was on the way${eta}` : `The crew gave ${home} a new time${eta}`;
    }
    case 'cant_get_in':
      return `The crew couldn't get in at ${home}${note ? `: ${note}` : ''}`;
    case 'done':
      return `${home} marked done${typeof data.photos === 'number' ? ` with ${data.photos} ${data.photos === 1 ? 'photo' : 'photos'}` : ''}`;
    case 'household_confirmed':
      return `${who} said everything looks good`;
    case 'charged':
      return `Charged ${cents('amount_cents') || home}`;
    case 'charge_failed':
      return `${home}: the card didn't go through`;
    case 'paid_by_household':
      return `${who} paid in Pantopus`;
    case 'problem_opened':
      return `${who} reported a problem; the charge paused`;
    case 'problem_note':
      return `${who} added to the problem${note ? `: ${note}` : ''}`;
    case 'operator_note':
      return `Pantopus: ${note}`;
    case 'problem_resolved':
      return `Pantopus closed the problem (${String(data.resolution || 'resolved').replace(/_/g, ' ')})${note ? `: ${note}` : ''}`;
    case 'refunded':
      return `Refunded ${cents('amount_cents')}${data.before_charge ? ' before the charge' : ''}${note ? `: ${note}` : ''}`;
    case 'date_answered':
      return data.choice === 'cancel' || data.date === 'cancel' ? `${who} cancelled instead of a new date` : `${who} picked a new date`;
    case 'operator_viewed':
      return 'Pantopus opened this day';
    default:
      return null;
  }
}

export default function AdminCrewDayScreen({ crewDayId }: { crewDayId: string }) {
  const queryClient = useQueryClient();
  const key = ['crew-day', 'admin', 'day', crewDayId];
  const query = useQuery({ queryKey: key, queryFn: () => api.adminCrewDays.getDay(crewDayId), retry: false });
  const detail = query.data;
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [refunding, setRefunding] = useState<string | null>(null);
  const denied = (query.error as { statusCode?: number } | null)?.statusCode === 403;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['crew-day', 'admin'] });

  const header = (title: string, pill?: ReactNode) => (
    <div className="flex flex-wrap items-center gap-3 border-b border-app-border bg-app-surface px-4 py-3">
      <Link href="/app/admin/crew-days" className="rounded-lg p-1.5 transition hover:bg-app-hover" aria-label="Back to Crew Days">
        <ArrowLeft className="h-5 w-5 text-app-text" />
      </Link>
      <h1 className="text-xl font-bold text-app-text">{title}</h1>
      {pill}
      <span className="flex-1" />
      <button type="button" onClick={refresh} className="rounded-lg p-1.5 transition hover:bg-app-hover" aria-label="Refresh">
        <RefreshCw className={`h-[1.125rem] w-[1.125rem] text-app-text-secondary ${query.isFetching ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );

  if (denied) {
    return (
      <div className="min-h-screen bg-app-surface">
        {header('Crew Day')}
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ShieldAlert className="mb-4 h-14 w-14 text-app-text-muted" />
          <p className="text-lg font-semibold text-app-text">Admins only</p>
          <p className="mt-1 text-sm text-app-text-secondary">You do not have admin access.</p>
        </div>
      </div>
    );
  }
  if (query.isLoading) return <div className="min-h-screen bg-app-surface">{header('Crew Day')}</div>;
  if (!detail) {
    return (
      <div className="min-h-screen bg-app-surface">
        {header('Crew Day')}
        <div role="alert" className="mx-auto max-w-3xl p-4 text-sm text-app-text-strong">
          {(query.error as { statusCode?: number } | null)?.statusCode === 404 ? "There's no Crew Day here." : "We couldn't load this Crew Day. Try again."}
        </div>
      </div>
    );
  }

  if (detail.kind === 'request') {
    const r = detail.request;
    return (
      <div className="min-h-screen bg-app-surface">
        {header(r.title, <Pill tone={r.status === 'requested' ? 'amber' : r.status === 'offer_ready' ? 'green' : 'slate'}>{r.status === 'requested' ? 'Needs an answer' : r.status === 'offer_ready' ? 'Offer ready' : 'No crew yet'}</Pill>)}
        <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 text-sm text-app-text">
          <p>
            {r.service_label} · {[r.street_label, r.city, r.state].filter(Boolean).join(', ')} · {monthsText(r.months)} · asked by {r.asked_by.first_name || 'a household'}{' '}
            {formatInstantDate(r.created_at, 'America/Los_Angeles')}
          </p>
          {r.note ? <p className="whitespace-pre-wrap rounded-lg bg-app-surface-sunken px-3 py-2">{r.note}</p> : null}
          {r.answer_note ? <p className="text-app-text-secondary">Your answer: {r.answer_note}</p> : null}
          <Link href="/app/admin/crew-days?tab=requests" className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
            Answer it in Street requests
          </Link>
        </div>
      </div>
    );
  }

  const { day, money, bookings, events } = detail;
  const tz = day.timezone;
  const active = bookings.filter((b) => !['cancelled', 'declined', 'refunded'].includes(b.status));
  const problems = bookings.filter((b) => b.problem?.status === 'open');
  const statusPill =
    day.status === 'cancelled'
      ? { label: 'Cancelled', tone: 'slate' as const }
      : day.status === 'done'
        ? { label: 'Done', tone: 'green' as const }
        : day.status === 'in_progress'
          ? { label: 'In progress', tone: 'sky' as const }
          : day.status === 'pending_review'
            ? { label: 'Waiting for approval', tone: 'amber' as const }
            : day.status === 'declined'
              ? { label: 'Not approved', tone: 'red' as const }
              : day.status === 'draft'
                ? { label: 'Draft', tone: 'slate' as const }
                : { label: 'Open', tone: 'green' as const };
  const cancel = async () => {
    if (busy || !reason.trim()) return;
    setBusy(true);
    try {
      await api.adminCrewDays.cancel(day.id, reason.trim());
      toast.success('Cancelled. Nobody was charged for a home not yet worked on.');
      setCancelling(false);
      refresh();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-surface">
      {header(day.title, <Pill tone={statusPill.tone}>{statusPill.label}</Pill>)}
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 [&>section]:min-w-0">
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-app-text-secondary">
          <Eye className="h-3.5 w-3.5 flex-none" aria-hidden="true" /> Your visit to this page is recorded in its timeline.
        </p>

        <section aria-label="The day" className="flex flex-col gap-3.5 rounded-xl border border-app-border p-4">
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(12.5rem,100%),1fr))] gap-x-5 gap-y-3.5">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-app-text-secondary">When</dt>
              <dd className="text-sm text-app-text [font-variant-numeric:tabular-nums]">
                {(day.dates?.length ? day.dates : [day.service_date]).map((d) => formatCrewDate(d)).join(', ')} · {formatWindow(day.window_start, day.window_end)}
                <br />
                <span className="text-app-text-secondary">
                  Booking {day.is_closed ? 'closed' : 'closes'} {formatInstantDate(day.booking_closes_at, tz)}, {formatInstantTime(day.booking_closes_at, tz)}
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-app-text-secondary">Where</dt>
              <dd className="text-sm text-app-text">
                {[day.street_label, day.city, day.state].filter(Boolean).join(', ')}
                <br />
                <span className="text-app-text-secondary">About {day.radius_m} m around the street</span>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-app-text-secondary">Homes</dt>
              <dd className="text-sm text-app-text [font-variant-numeric:tabular-nums]">
                {day.booked_count} of {day.capacity} booked
                <br />
                <span className="text-app-text-secondary">
                  {day.done_count} done · {day.price_checks} to price
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-app-text-secondary">Money</dt>
              <dd className="text-sm text-app-text [font-variant-numeric:tabular-nums]">
                {formatPrice(money.gross_cents)} across {active.length} {active.length === 1 ? 'home' : 'homes'}
                <br />
                <span className="text-app-text-secondary">
                  {formatPrice(money.charged_cents)} charged · {formatPrice(money.scheduled_cents)} scheduled · {formatPrice(money.paused_cents)} paused · {money.fee_rate}% fee
                </span>
              </dd>
            </div>
          </dl>
          <CrewStanding crew={day.crew} feeRate={money.fee_rate} />
          {day.status === 'cancelled' ? (
            <p className="text-sm text-app-text-strong">
              {day.cancelled_by === 'operator' ? 'Pantopus' : 'The crew'} cancelled this day{day.cancel_reason ? `: ${day.cancel_reason}` : '.'}
            </p>
          ) : ['open', 'in_progress', 'pending_review'].includes(day.status) ? (
            cancelling ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="admin-cancel-reason" className="text-[0.8125rem] font-medium text-app-text-strong">
                  Why? The crew and every household get this. Nobody is charged for a home not yet worked on.
                </label>
                <textarea id="admin-cancel-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={ADMIN_FIELD} />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() => void cancel()}
                    className="rounded-lg bg-red-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {busy ? 'Cancelling…' : `Cancel for ${active.length} ${active.length === 1 ? 'home' : 'homes'}`}
                  </button>
                  <button type="button" onClick={() => setCancelling(false)} className={ADMIN_QUIET}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setCancelling(true)}
                  className="rounded-lg border border-red-200 bg-app-surface px-3.5 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  Cancel this Crew Day
                </button>
              </div>
            )
          ) : null}
        </section>

        <section aria-labelledby="admin-bookings" className="flex flex-col gap-2">
          <h2 id="admin-bookings" className="text-base font-semibold text-app-text">
            Bookings
          </h2>
          {bookings.length ? (
            <div className="relative overflow-x-auto rounded-xl border border-app-border">
              <table className="w-full min-w-[53.75rem] border-collapse text-sm">
                <thead>
                  <tr className="bg-app-surface-sunken text-left">
                    {['Home', 'Household', 'Job', 'Price', 'Status', 'Charge'].map((h) => (
                      <th key={h} scope="col" className={`border-b border-app-border px-3.5 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-app-text-secondary ${h === 'Price' ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                    <th scope="col" className="border-b border-app-border px-3.5 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const pill = b.problem?.status === 'open' ? { label: 'Problem open', tone: 'amber' as const } : (STATUS[b.status] ?? { label: b.status, tone: 'slate' as const });
                    const refundable = b.problem?.status !== 'open' && REFUNDABLE.includes(b.status);
                    const open = refunding === b.id && refundable;
                    return (
                      <Fragment key={b.id}>
                        <tr className={`border-app-border ${open ? '' : 'border-b last:border-b-0'} ${b.problem?.status === 'open' ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                          <td className="px-3.5 py-3 align-top font-semibold text-app-text">
                            {b.address.line}
                            <div className="text-xs font-normal text-app-text-secondary">{formatCrewDate(b.service_date)}</div>
                          </td>
                          <td className="px-3.5 py-3 align-top text-app-text-strong">
                            {b.household.name || shortName(b.household)}
                            {b.household.email ? <div className="text-xs text-app-text-secondary">{b.household.email}</div> : null}
                          </td>
                          <td className="px-3.5 py-3 align-top text-app-text-strong">{b.line_items.map((l) => l.label).join(', ') || '—'}</td>
                          <td className="px-3.5 py-3 text-right align-top [font-variant-numeric:tabular-nums]">{moneyText(b.price_cents)}</td>
                          <td className="px-3.5 py-3 align-top">
                            <Pill tone={pill.tone}>{pill.label}</Pill>
                          </td>
                          <td className="px-3.5 py-3 align-top text-app-text-strong">{chargeLine(b, tz)}</td>
                          <td className="px-3.5 py-3 text-right align-top">
                            {b.problem?.status === 'open' ? (
                              <a href={`#problem-${b.id}`} className="text-[0.8125rem] font-semibold text-violet-700 hover:underline dark:text-violet-300">
                                Open problem
                              </a>
                            ) : (
                              <span className="inline-flex flex-col items-end gap-1.5">
                                {refundable ? (
                                  <button
                                    type="button"
                                    aria-expanded={open}
                                    onClick={() => setRefunding(open ? null : b.id)}
                                    className="text-[0.8125rem] font-semibold text-violet-700 hover:underline dark:text-violet-300"
                                  >
                                    Refund
                                  </button>
                                ) : null}
                                {b.invoice_id ? (
                                  <Link href={`/app/invoice/${encodeURIComponent(b.invoice_id)}`} className="text-[0.8125rem] font-semibold text-violet-700 hover:underline dark:text-violet-300">
                                    Invoice
                                  </Link>
                                ) : null}
                              </span>
                            )}
                          </td>
                        </tr>
                        {open ? (
                          <tr className="border-b border-app-border last:border-b-0">
                            <td colSpan={7} className="px-3.5 pb-3.5">
                              {/* Stays in view while the wide table scrolls sideways on a narrow screen. */}
                              <div className="sticky left-3.5 max-w-[min(36rem,calc(100vw-3rem))]">
                                <RefundForm
                                  booking={b}
                                  onDone={() => {
                                    setRefunding(null);
                                    refresh();
                                  }}
                                  onCancel={() => setRefunding(null)}
                                />
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-app-text-secondary">No bookings yet.</p>
          )}
        </section>

        {problems.length ? (
          <section aria-labelledby="admin-day-problems" className="flex flex-col gap-2">
            <h2 id="admin-day-problems" className="text-base font-semibold text-app-text">
              Open problems
            </h2>
            <ul className="flex flex-col gap-3">
              {problems.map((b) => (
                <ProblemCard
                  key={b.id}
                  id={`problem-${b.id}`}
                  booking={{ ...b, crew_day: { id: day.id, title: day.title, timezone: tz, business_user_id: day.business_user_id }, crew: day.crew }}
                  onChanged={refresh}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="admin-timeline" className="flex flex-col gap-2">
          <h2 id="admin-timeline" className="text-base font-semibold text-app-text">
            Timeline
          </h2>
          <ol className="flex flex-col rounded-xl border border-app-border px-4 py-1">
            {events
              .map((e) => ({ e, text: eventText(e, detail) }))
              .filter((x) => x.text)
              .map(({ e, text }) => (
                <li key={e.id} className="flex flex-wrap gap-x-4 gap-y-1 border-b border-app-border py-2.5 text-sm last:border-b-0">
                  <span className="w-44 max-w-full flex-none text-app-text-secondary [font-variant-numeric:tabular-nums]">
                    {formatInstantDate(e.created_at, tz)} · {formatInstantTime(e.created_at, tz)}
                  </span>
                  <span className="min-w-[min(15rem,100%)] flex-1 text-app-text">{text}</span>
                </li>
              ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
