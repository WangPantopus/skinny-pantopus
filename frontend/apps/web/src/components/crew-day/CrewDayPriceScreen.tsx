'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import * as api from '@pantopus/api';
import type { CrewDayAddress, CrewDayQuote } from '@pantopus/types';
import { buildCrewDayPath } from '@pantopus/utils';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { myHomesQuery } from '@/lib/myHomes';
import { formatCrewDate, formatPrice, type PublicCrewDay } from '@/lib/crewDay';
import { readCrewDayDraft, saveCrewDayDraft } from '@/lib/crewDayDraft';
import {
  CREW_DAY_PRIMARY_BUTTON,
  CREW_DAY_SECONDARY_BUTTON,
  CrewDayCard,
  CrewDaySectionTitle,
  CrewDayStepBar,
} from './CrewDayParts';

// Screen 2, Your price (01-spec.md §3): the home, its option and add-ons, and the price from the crew's list
// (POST …/quote, which also says whether the day reaches the home). Signed in with a home in Pantopus, the home is
// filled in. Continue keeps the choices (lib/crewDayDraft) and goes to Review and book, through sign-up or sign-in
// when signed out.

type HomeChoice = { homeId: string | null; address: CrewDayAddress };

type PantopusHome = { id: string; address: CrewDayAddress };

/** The person's home in Pantopus to fill in: their primary home, else the first they can open with a location. */
function pantopusHomeFrom(reply: Awaited<ReturnType<typeof api.homes.getMyHomes>> | undefined): PantopusHome | null {
  const homes = reply?.homes ?? [];
  const usable = homes.filter(
    (home) =>
      (home.access_kind === undefined || home.access_kind === 'shared' || home.access_kind === 'private_setup') &&
      home.address &&
      home.location &&
      typeof home.location === 'object',
  );
  const home = usable.find((h) => h.id === reply?.primary_home?.id) ?? usable[0];
  if (!home || !home.location || typeof home.location !== 'object') return null;
  const location = home.location as unknown as { latitude: number; longitude: number };
  return {
    id: home.id,
    address: {
      line: home.address || '',
      city: home.city || '',
      state: home.state || '',
      zip: home.zipcode || '',
      latitude: location.latitude,
      longitude: location.longitude,
    },
  };
}

function cityLine(address: CrewDayAddress): string {
  return [address.city, [address.state, address.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/** "How many stories?" when the crew's options are stories; otherwise a plain question. */
function optionsQuestion(day: PublicCrewDay): string {
  return day.price_options.some((option) => /stor(y|ies)/i.test(option.label)) ? 'How many stories?' : 'Which fits your home?';
}

export default function CrewDayPriceScreen({ day }: { day: PublicCrewDay }) {
  const router = useRouter();
  const code = day.code;
  const invitationPath = buildCrewDayPath(code);
  const bookPath = `${invitationPath}/book`;
  const addressLabelId = useId();

  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(api.hasActiveSession()), []);
  const homes = useQuery({ ...myHomesQuery(), enabled: signedIn });
  const pantopusHome = useMemo(() => pantopusHomeFrom(homes.data), [homes.data]);

  const [choice, setChoice] = useState<HomeChoice | null>(null);
  const [typing, setTyping] = useState(false);
  const [addressText, setAddressText] = useState('');
  const [optionId, setOptionId] = useState<string | null>(null);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [accessNote, setAccessNote] = useState<string | undefined>(undefined);

  // Choices made earlier on this invitation (before a sign-up, or going back from Review) come back.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const draft = readCrewDayDraft(code);
    if (!draft) return;
    setChoice({ homeId: draft.home_id, address: draft.address });
    setTyping(!draft.home_id);
    setAddressText(draft.home_id ? '' : draft.address.line);
    if (day.price_options.some((o) => o.id === draft.option_id)) setOptionId(draft.option_id);
    setAddOnIds(draft.add_on_ids.filter((id) => day.add_ons.some((a) => a.id === id)));
    setAccessNote(draft.access_note);
  }, [code, day.add_ons, day.price_options]);

  // Signed in with a home in Pantopus and nothing chosen yet: that home.
  useEffect(() => {
    if (!choice && !typing && pantopusHome) setChoice({ homeId: pantopusHome.id, address: pantopusHome.address });
  }, [choice, typing, pantopusHome]);

  const option = day.price_options.find((o) => o.id === optionId) ?? null;
  const addOnTotal = day.add_ons.filter((a) => addOnIds.includes(a.id)).reduce((sum, a) => sum + a.price_cents, 0);
  const localPrice = option && !option.needs_look && option.price_cents != null ? option.price_cents + addOnTotal : null;

  // The quote: whether the day reaches the home, and its price. The newest answer wins.
  const [quote, setQuote] = useState<{ status: 'idle' | 'loading' | 'done' | 'failed'; result: CrewDayQuote | null }>({
    status: 'idle',
    result: null,
  });
  const quoteRun = useRef(0);
  const askQuote = useCallback(async () => {
    if (!choice || !optionId) {
      setQuote({ status: 'idle', result: null });
      return;
    }
    const run = ++quoteRun.current;
    setQuote((q) => ({ status: 'loading', result: q.result }));
    try {
      const result = await api.crewDays.quote(code, {
        latitude: choice.address.latitude,
        longitude: choice.address.longitude,
        address_line: choice.address.line,
        option_id: optionId,
        add_on_ids: addOnIds,
      });
      if (run === quoteRun.current) setQuote({ status: 'done', result });
    } catch {
      if (run === quoteRun.current) setQuote({ status: 'failed', result: null });
    }
  }, [addOnIds, choice, code, optionId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void askQuote(), 250);
    return () => window.clearTimeout(timer);
  }, [askQuote]);

  const outOfArea = quote.status === 'done' && quote.result?.in_area === false;
  const needsLook = option?.needs_look === true || quote.result?.needs_look === true;
  const price = quote.status === 'done' && quote.result?.price_cents != null ? quote.result.price_cents : localPrice;
  const ready = Boolean(choice && option && quote.status === 'done' && quote.result?.in_area);

  const continueTo = (destination: 'book' | 'register' | 'login') => {
    if (!choice || !option) return;
    saveCrewDayDraft(code, {
      home_id: choice.homeId,
      address: choice.address,
      option_id: option.id,
      add_on_ids: addOnIds,
      price_cents: needsLook ? null : price,
      needs_look: needsLook,
      access_note: accessNote,
    });
    if (destination === 'book') router.push(bookPath);
    else router.push(`/${destination}?redirectTo=${encodeURIComponent(bookPath)}`);
  };

  const toggleAddOn = (id: string) =>
    setAddOnIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <main className="min-h-screen bg-app text-app-text">
      <div className="mx-auto w-full max-w-md pb-10">
        <CrewDayStepBar title="Your price" backHref={invitationPath} backLabel="Back to the invitation" step="1 of 2" />
        <div className="flex flex-col gap-5 px-4 pt-4">
          <p className="text-sm leading-5 text-app-text-secondary">
            {day.title} · {formatCrewDate(day.service_date)}
          </p>

          <section aria-labelledby="crew-day-home" className="flex flex-col gap-2">
            <CrewDaySectionTitle id="crew-day-home">Your home</CrewDaySectionTitle>
            <CrewDayCard className="flex flex-col gap-3 p-4">
              {choice && !typing ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {choice.homeId ? (
                      <span className="text-xs font-medium leading-4 text-app-home">From your home in Pantopus</span>
                    ) : null}
                    <span className="text-[0.9375rem] font-semibold leading-5 text-app-text">{choice.address.line}</span>
                    <span className="text-sm leading-5 text-app-text-secondary">{cityLine(choice.address)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTyping(true);
                      setAddressText('');
                      setChoice(null);
                    }}
                    className="flex-none text-sm font-semibold leading-5 text-app-link"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <span id={addressLabelId} className="text-sm font-medium leading-5 text-app-text-strong">
                    Your address
                  </span>
                  <AddressAutocomplete
                    labelId={addressLabelId}
                    value={addressText}
                    onChange={(value) => {
                      setAddressText(value);
                      if (choice) setChoice(null);
                    }}
                    onSelectNormalized={(normalized) => {
                      setAddressText(normalized.address);
                      if (typeof normalized.latitude === 'number' && typeof normalized.longitude === 'number') {
                        setChoice({
                          homeId: null,
                          address: {
                            line: normalized.address,
                            city: normalized.city,
                            state: normalized.state,
                            zip: normalized.zipcode,
                            latitude: normalized.latitude,
                            longitude: normalized.longitude,
                          },
                        });
                        setTyping(false);
                      }
                    }}
                    placeholder="123 Maple Lane"
                    hintText="Start typing, then pick your address from the list."
                  />
                  {pantopusHome ? (
                    <button
                      type="button"
                      onClick={() => {
                        setChoice({ homeId: pantopusHome.id, address: pantopusHome.address });
                        setTyping(false);
                      }}
                      className="self-start text-sm font-semibold leading-5 text-app-link"
                    >
                      Use my home in Pantopus
                    </button>
                  ) : null}
                </div>
              )}
            </CrewDayCard>
            <p className="flex items-start gap-2 text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
              <Lock className="mt-px h-[0.875rem] w-[0.875rem] flex-none" aria-hidden="true" />
              Visible to your crew and Pantopus.
            </p>
          </section>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[0.6875rem] font-semibold uppercase leading-4 tracking-[0.06em] text-app-text-secondary">
              {optionsQuestion(day)}
            </legend>
            <CrewDayCard className="divide-y divide-app-border overflow-hidden">
              {day.price_options.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-start gap-3 px-4 py-[0.875rem] hover:bg-app-hover">
                  <input
                    type="radio"
                    name="crew-day-option"
                    value={o.id}
                    checked={optionId === o.id}
                    onChange={() => setOptionId(o.id)}
                    className="mt-0.5 h-5 w-5 flex-none accent-[rgb(var(--accent-primary-fill))]"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[0.9375rem] font-medium leading-5 text-app-text">{o.label}</span>
                    {o.needs_look ? (
                      <span className="text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
                        The crew confirms the price after a look
                      </span>
                    ) : null}
                  </span>
                  {!o.needs_look && o.price_cents != null ? (
                    <span className="flex-none text-[0.9375rem] font-semibold leading-5 text-app-text [font-variant-numeric:tabular-nums]">
                      {formatPrice(o.price_cents)}
                    </span>
                  ) : null}
                </label>
              ))}
            </CrewDayCard>
          </fieldset>

          {day.add_ons.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[0.6875rem] font-semibold uppercase leading-4 tracking-[0.06em] text-app-text-secondary">
                Add-ons
              </legend>
              <CrewDayCard className="divide-y divide-app-border overflow-hidden">
                {day.add_ons.map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-start gap-3 px-4 py-[0.875rem] hover:bg-app-hover">
                    <input
                      type="checkbox"
                      checked={addOnIds.includes(a.id)}
                      onChange={() => toggleAddOn(a.id)}
                      className="mt-0.5 h-5 w-5 flex-none accent-[rgb(var(--accent-primary-fill))]"
                    />
                    <span className="min-w-0 flex-1 text-[0.9375rem] font-medium leading-5 text-app-text">{a.label}</span>
                    <span className="flex-none text-[0.9375rem] font-semibold leading-5 text-app-text [font-variant-numeric:tabular-nums]">
                      +{formatPrice(a.price_cents)}
                    </span>
                  </label>
                ))}
              </CrewDayCard>
            </fieldset>
          ) : null}

          {outOfArea && choice ? (
            <div role="status" className="flex flex-col gap-3 rounded-[1.25rem] border border-app-border bg-app-surface-sunken p-4">
              <p className="text-sm leading-5 text-app-text-strong">
                This Crew Day doesn&apos;t reach {choice.address.line}. It covers homes near {day.street_label}.
              </p>
              <Link href="/app/crew-days/ask" className={CREW_DAY_SECONDARY_BUTTON}>
                Ask for one on your street
              </Link>
            </div>
          ) : null}

          {quote.status === 'failed' ? (
            <div role="alert" className="flex flex-col gap-3 rounded-[1.25rem] border border-app-border bg-app-surface p-4">
              <p className="text-sm leading-5 text-app-text-strong">
                We couldn&apos;t check your price. Check your connection and try again.
              </p>
              <button type="button" onClick={() => void askQuote()} className={CREW_DAY_SECONDARY_BUTTON}>
                Try again
              </button>
            </div>
          ) : null}

          {!outOfArea ? (
            <CrewDayCard className="flex flex-col gap-3 p-4">
              {needsLook ? (
                <p className="text-[0.9375rem] font-semibold leading-5 text-app-text">
                  The crew confirms your price before you&apos;re booked
                </p>
              ) : (
                <div className="flex flex-col gap-0.5" aria-live="polite">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-[0.9375rem] font-semibold leading-5 text-app-text">Your price</span>
                    {price != null ? (
                      <span className="text-[0.9375rem] leading-5 text-app-text [font-variant-numeric:tabular-nums]">
                        <span className="text-lg font-bold">{formatPrice(price)}</span> · including tax
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
                    {option ? 'Nothing is charged until the work is done.' : 'Pick an option to see your price.'}
                  </span>
                </div>
              )}
              <button
                type="button"
                disabled={!ready}
                onClick={() => continueTo(signedIn ? 'book' : 'register')}
                className={CREW_DAY_PRIMARY_BUTTON}
              >
                {quote.status === 'loading' && choice && option ? 'Checking your price…' : 'Continue'}
              </button>
              {!choice ? (
                <p className="text-center text-xs leading-4 text-app-text-secondary">Add your address to continue.</p>
              ) : null}
              {!signedIn ? (
                <p className="text-center text-xs leading-4 text-app-text-secondary">
                  Booking needs a free Pantopus account.{' '}
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => continueTo('login')}
                    className="font-semibold text-app-link disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Have one? Sign in
                  </button>
                </p>
              ) : null}
            </CrewDayCard>
          ) : null}
        </div>
      </div>
    </main>
  );
}
