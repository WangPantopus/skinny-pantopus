'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Check, CloudRain, CreditCard, House, LifeBuoy, Lock, MapPin, Plus, type LucideIcon } from 'lucide-react';
import * as api from '@pantopus/api';
import { buildCrewDayPath } from '@pantopus/utils';
import StripeProvider from '@/components/payments/StripeProvider';
import PaymentMethodForm from '@/components/payments/PaymentMethodForm';
import {
  formatCrewDate,
  formatInstantDate,
  formatInstantTime,
  formatPrice,
  formatWindow,
  type PublicCrewDay,
} from '@/lib/crewDay';
import { clearCrewDayDraft, readCrewDayDraft, saveCrewDayDraft, type CrewDayDraft } from '@/lib/crewDayDraft';
import {
  CREW_DAY_OVERLINE,
  CREW_DAY_PRIMARY_BUTTON,
  CrewDayCard,
  CrewDayFooterBar,
  CrewDayIconTile,
  CrewDaySectionTitle,
  CrewDayStepBar,
  CrewRow,
  ServiceTag,
} from './CrewDayParts';

// Screen 3, Review and book (01-spec.md §3): the day, the home, a note for the crew, the card that's saved now and
// charged only after the work, what happens if plans change, and the approval. POST /api/crew-days/:id/bookings,
// once per tap (the request id rides in the draft, so a retry after a lost answer books once).

type SavedCard = { id: string; stripeId: string; brand: string; last4: string; isDefault: boolean };

const CARD_QUERY_KEY = ['crew-day', 'saved-cards'] as const;

const ADD_CARD_BUTTON =
  'flex min-h-[3.125rem] w-full items-center justify-center gap-2 rounded-xl bg-app-surface-sunken px-4 text-base font-semibold text-app-text hover:bg-app-hover';

/** Saved cards from GET /api/payments/methods (bank accounts can't pay a Crew Day). */
function savedCards(rows: Array<Record<string, unknown>>): SavedCard[] {
  return rows
    .filter((raw) => String(raw.payment_method_type || raw.type || 'card') === 'card')
    .filter((raw) => String(raw.stripe_payment_method_id || '').startsWith('pm_'))
    .map((raw) => {
      const nested = (raw.card && typeof raw.card === 'object' ? raw.card : raw) as Record<string, unknown>;
      return {
        id: String(raw.id),
        stripeId: String(raw.stripe_payment_method_id),
        brand: String(nested.brand || nested.card_brand || raw.card_brand || 'card'),
        last4: String(nested.last4 || nested.card_last4 || raw.card_last4 || ''),
        isDefault: Boolean(raw.is_default ?? raw.isDefault),
      };
    });
}

function brandName(brand: string): string {
  const names: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover' };
  return names[brand.toLowerCase()] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

/** What a refused booking says, from the server's code: what failed and what to do. */
function bookingErrorText(error: unknown, day: PublicCrewDay): { text: string; final: boolean } {
  const err = error as { code?: string; statusCode?: number; message?: string } | null;
  switch (err?.code) {
    case 'DAY_FULL':
      return { text: 'This Crew Day filled up while you were booking.', final: true };
    case 'BOOKING_CLOSED':
      return { text: `Booking closed on ${formatInstantDate(day.booking_closes_at, day.timezone)}.`, final: true };
    case 'DAY_NOT_OPEN':
      return { text: "This Crew Day isn't taking bookings now.", final: true };
    case 'PAYMENT_METHOD_INVALID':
      return { text: "Your card couldn't be saved. Try another card.", final: true };
    case 'OUT_OF_AREA':
      return { text: 'This address is outside the Crew Day.', final: true };
    case 'ALREADY_BOOKED':
      return { text: 'You already booked this Crew Day. Open it from Your Crew Days.', final: true };
    case 'OWN_CREW':
      return { text: "This is your own crew's Crew Day, so you can't book it.", final: true };
    default:
      break;
  }
  if (err?.statusCode === 422) return { text: "We couldn't book this Crew Day for you.", final: true };
  if (typeof err?.statusCode === 'number' && err.statusCode < 500) {
    return { text: err.message || "We couldn't book this. Check your choices and try again.", final: true };
  }
  return { text: "We couldn't reach Pantopus to book. Check your connection and try again.", final: false };
}

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export default function CrewDayReviewScreen({ day }: { day: PublicCrewDay }) {
  const router = useRouter();
  const code = day.code;
  const invitationPath = buildCrewDayPath(code);
  const pricePath = `${invitationPath}/price`;

  const [draft, setDraft] = useState<CrewDayDraft | null>(null);
  useEffect(() => {
    const kept = readCrewDayDraft(code);
    if (!kept) router.replace(pricePath);
    else setDraft(kept);
  }, [code, pricePath, router]);

  const cards = useQuery({
    queryKey: CARD_QUERY_KEY,
    queryFn: async () => savedCards(((await api.payments.getPaymentMethods()).paymentMethods || []) as Array<Record<string, unknown>>),
    staleTime: 0,
  });
  const [cardId, setCardId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [adding, setAdding] = useState(false);
  const knownCards = useRef<Set<string>>(new Set());
  useEffect(() => {
    const list = cards.data;
    if (!list) return;
    const fresh = list.find((c) => knownCards.current.size > 0 && !knownCards.current.has(c.id));
    knownCards.current = new Set(list.map((c) => c.id));
    setCardId((current) => {
      if (fresh) return fresh.id;
      if (current && list.some((c) => c.id === current)) return current;
      return (list.find((c) => c.isDefault) ?? list[0])?.id ?? null;
    });
    if (list.length === 0) setAdding(true);
  }, [cards.data]);
  const card = cards.data?.find((c) => c.id === cardId) ?? null;

  const [note, setNote] = useState('');
  useEffect(() => {
    if (draft?.access_note) setNote(draft.access_note);
  }, [draft?.access_note]);
  const [approved, setApproved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const option = useMemo(() => day.price_options.find((o) => o.id === draft?.option_id) ?? null, [day.price_options, draft?.option_id]);
  const addOns = useMemo(() => day.add_ons.filter((a) => draft?.add_on_ids.includes(a.id)), [day.add_ons, draft?.add_on_ids]);
  const needsLook = Boolean(draft?.needs_look || option?.needs_look);
  const total = needsLook ? null : (draft?.price_cents ?? null);
  const cutoff = new Date(new Date(day.window_starts_at).getTime() - 48 * 60 * 60 * 1000).toISOString();
  const cutoffText = `${formatInstantDate(cutoff, day.timezone)}, ${formatInstantTime(cutoff, day.timezone)}`;

  const book = useCallback(async () => {
    if (!draft || !option || !card || !approved || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    const requestId = draft.client_request_id ?? newRequestId();
    const kept = { ...draft, access_note: note, client_request_id: requestId };
    saveCrewDayDraft(code, kept);
    try {
      await api.crewDays.createBooking(day.id, {
        client_request_id: requestId,
        ...(draft.home_id ? { home_id: draft.home_id } : {}),
        address: draft.address,
        option_id: option.id,
        add_on_ids: addOns.map((a) => a.id),
        ...(note.trim() ? { access_note: note.trim() } : {}),
        payment_method_id: card.stripeId,
        approve_terms: true,
      });
      clearCrewDayDraft(code);
      router.replace(`${invitationPath}/booked`);
    } catch (err) {
      const { text, final } = bookingErrorText(err, day);
      setError(text);
      // A refusal is an answer: the next try is a new request. A lost answer may have booked, so it keeps the id.
      if (final) saveCrewDayDraft(code, { ...kept, client_request_id: undefined });
      setDraft(readCrewDayDraft(code));
      inFlight.current = false;
      setSubmitting(false);
    }
  }, [addOns, approved, card, code, day, draft, invitationPath, note, option, router]);

  if (!draft) {
    return (
      <main className="min-h-screen bg-app">
        <div className="mx-auto w-full max-w-md">
          <CrewDayStepBar title="Review and book" backHref={pricePath} step="2 of 2" />
        </div>
      </main>
    );
  }

  const arrival = formatWindow(day.window_start, day.window_end);
  const amount = total != null ? formatPrice(total) : null;
  const planLines: Array<{ icon: LucideIcon; text: string }> = [
    { icon: CalendarDays, text: `Free cancellation until ${cutoffText}.` },
    { icon: CloudRain, text: 'Rain? You pick a new date or cancel at no charge. Same price.' },
    { icon: LifeBuoy, text: "A problem? Pantopus support owns it until it's fixed." },
  ];
  const cityLine = [draft.address.city, [draft.address.state, draft.address.zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  return (
    <main className="flex min-h-screen flex-col bg-app text-app-text">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <CrewDayStepBar title="Review and book" backHref={pricePath} backLabel="Back to your price" step="2 of 2" />
        <div className="flex flex-1 flex-col gap-5 px-4 pb-6 pt-1">
          <section aria-labelledby="crew-day-review-title" className="flex flex-col gap-2 rounded-[1.25rem] border border-app-border bg-app-surface p-4">
            <ServiceTag service={day.service} />
            <h2 id="crew-day-review-title" className="text-xl font-semibold leading-[1.625rem] tracking-[-0.012em]">
              {day.title}
            </h2>
            <p className="flex items-start gap-2 text-sm leading-5 text-app-text-strong [font-variant-numeric:tabular-nums]">
              <CalendarDays className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              {formatCrewDate(day.service_date, 'long')}
              {arrival ? ` · Arriving ${arrival}` : ''}
            </p>
            <CrewRow crew={day.crew} />
          </section>

          <section aria-labelledby="crew-day-review-home" className="flex flex-col gap-2">
            <CrewDaySectionTitle id="crew-day-review-home">Your home</CrewDaySectionTitle>
            <CrewDayCard className="flex flex-col gap-3 p-[0.875rem]">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 flex-none text-app-text-strong" aria-hidden="true" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-base font-semibold leading-[1.3125rem]">{draft.address.line}</span>
                  {cityLine ? <span className="text-sm leading-5 text-app-text-secondary">{cityLine}</span> : null}
                  <span className="flex items-center gap-1.5 pt-0.5 text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
                    <Lock className="h-[0.8125rem] w-[0.8125rem] flex-none" aria-hidden="true" />
                    Visible to your crew and Pantopus.
                  </span>
                </div>
              </div>
              <div className="h-px bg-app-border" />
              <div className="flex items-center gap-3">
                <House className="h-5 w-5 flex-none text-app-text-strong" aria-hidden="true" />
                <span className="text-base leading-[1.3125rem]">
                  {[option?.label, ...addOns.map((a) => a.label)].filter(Boolean).join(' · ')}
                </span>
              </div>
              {day.included.length > 0 || day.outside_only ? (
                <>
                  <div className="h-px bg-app-border" />
                  <ul className="flex flex-col gap-2">
                    {day.included.map((item) => (
                      <li key={item} className="flex items-start gap-[0.625rem] text-sm leading-5 text-app-text-strong">
                        <Check className="mt-0.5 h-4 w-4 flex-none text-app-home" strokeWidth={2.4} aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                    {day.outside_only ? (
                      <li className="flex items-start gap-[0.625rem] text-sm leading-5 text-app-text-strong">
                        <House className="mt-0.5 h-4 w-4 flex-none text-app-text-secondary" aria-hidden="true" />
                        Outside only. You don&apos;t need to be home.
                      </li>
                    ) : null}
                  </ul>
                </>
              ) : null}
            </CrewDayCard>
          </section>

          <section className="flex flex-col gap-2">
            <label htmlFor="crew-day-access-note" className={CREW_DAY_OVERLINE}>
              For the crew (optional)
            </label>
            <textarea
              id="crew-day-access-note"
              value={note}
              maxLength={500}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Gate, pets, parking…"
              aria-describedby="crew-day-access-note-hint"
              className="min-h-[5.75rem] w-full resize-y rounded-[0.875rem] border border-app-border-strong bg-app-surface px-[0.875rem] py-3 text-base leading-[1.375rem] text-app-text placeholder:text-app-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p id="crew-day-access-note-hint" className="text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
              The crew sees this on the day. It&apos;s deleted a week after the job.
            </p>
          </section>

          <section aria-labelledby="crew-day-review-payment" className="flex flex-col gap-2">
            <CrewDaySectionTitle id="crew-day-review-payment">Payment</CrewDaySectionTitle>
            <CrewDayCard className="flex flex-col gap-2.5 p-[0.875rem]">
              {cards.isLoading ? (
                <p className="text-sm leading-5 text-app-text-secondary">Loading your saved cards…</p>
              ) : cards.isError ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm leading-5 text-app-text-strong">We couldn&apos;t load your saved cards.</p>
                  <button type="button" onClick={() => void cards.refetch()} className="min-h-11 self-start text-[0.9375rem] font-semibold text-app-link">
                    Try again
                  </button>
                </div>
              ) : card && !choosing && !adding ? (
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-10 flex-none place-items-center rounded-md border border-app-border-strong text-app-text-strong" aria-hidden="true">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-base font-semibold leading-[1.3125rem]">
                    {brandName(card.brand)} ending {card.last4}
                  </span>
                  <button type="button" onClick={() => setChoosing(true)} className="-my-2 min-h-11 px-1 text-[0.9375rem] font-semibold text-app-link">
                    Change
                  </button>
                </div>
              ) : null}

              {choosing && cards.data && cards.data.length > 0 && !adding ? (
                <fieldset className="flex flex-col gap-1">
                  <legend className="sr-only">Choose a card</legend>
                  {cards.data.map((c) => (
                    <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 hover:bg-app-hover">
                      <input
                        type="radio"
                        name="crew-day-card"
                        checked={cardId === c.id}
                        onChange={() => {
                          setCardId(c.id);
                          setChoosing(false);
                        }}
                        className="h-[1.375rem] w-[1.375rem] flex-none accent-[rgb(var(--accent-primary-fill))]"
                      />
                      <span className="text-base leading-[1.3125rem]">
                        {brandName(c.brand)} ending {c.last4}
                      </span>
                    </label>
                  ))}
                  <button type="button" onClick={() => setAdding(true)} className={ADD_CARD_BUTTON}>
                    <Plus className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                    Add a card
                  </button>
                </fieldset>
              ) : null}

              {adding ? (
                <StripeProvider>
                  <PaymentMethodForm
                    inline
                    onSuccess={() => {
                      setAdding(false);
                      setChoosing(false);
                      void cards.refetch();
                    }}
                    onCancel={cards.data && cards.data.length > 0 ? () => setAdding(false) : undefined}
                  />
                </StripeProvider>
              ) : !card && !cards.isLoading && !cards.isError ? (
                <button type="button" onClick={() => setAdding(true)} className={ADD_CARD_BUTTON}>
                  <Plus className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                  Add a card
                </button>
              ) : null}

              <p className="text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
                {amount
                  ? `Saved now. Charged ${amount} the day after the crew finishes your home, unless you tell us something's wrong.`
                  : 'Saved now. Nothing is charged until you approve your price and the crew finishes your home.'}
              </p>
            </CrewDayCard>
          </section>

          <section aria-labelledby="crew-day-review-plans" className="flex flex-col gap-2">
            <CrewDaySectionTitle id="crew-day-review-plans">If plans change</CrewDaySectionTitle>
            <ul className="flex flex-col gap-[0.875rem] rounded-[1.25rem] border border-app-border bg-app-surface p-[0.875rem]">
              {planLines.map(({ icon: LineIcon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <CrewDayIconTile>
                    <LineIcon className="h-4 w-4" />
                  </CrewDayIconTile>
                  <span className="pt-1.5 text-sm leading-5 text-app-text-strong">{text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <CrewDayFooterBar>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-base font-semibold leading-6">{amount ? 'Total' : 'Your price'}</span>
            {amount ? (
              <span className="text-sm leading-5 text-app-text-secondary [font-variant-numeric:tabular-nums]">
                <b className="text-[1.375rem] font-bold leading-7 text-app-text">{amount}</b> · including tax
              </span>
            ) : (
              <span className="text-base font-semibold leading-6 text-app-text-strong">After a look</span>
            )}
          </div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
              className="h-[1.375rem] w-[1.375rem] flex-none accent-[rgb(var(--accent-primary-fill))]"
            />
            <span className="text-sm leading-5 text-app-text-strong">
              {amount
                ? `I approve the scope, the ${amount} total and these terms.`
                : "I approve the scope and these terms. I'll see the price before anything is booked."}
            </span>
          </label>
          <button
            type="button"
            onClick={() => void book()}
            disabled={!approved || !card || submitting || adding}
            className={CREW_DAY_PRIMARY_BUTTON}
          >
            {submitting ? 'Booking…' : amount ? `Book for ${amount}` : 'Ask for my price'}
          </button>
          {error ? (
            <p role="alert" className="text-center text-[0.8125rem] leading-[1.125rem] text-app-error">
              {error}{' '}
              {/filled up|closed|outside/.test(error) ? (
                <Link href={invitationPath} className="font-semibold underline">
                  Back to the invitation
                </Link>
              ) : null}
            </p>
          ) : !card && !cards.isLoading ? (
            <p className="text-center text-xs leading-4 text-app-text-secondary">Add a card to book.</p>
          ) : null}
        </CrewDayFooterBar>
      </div>
    </main>
  );
}
