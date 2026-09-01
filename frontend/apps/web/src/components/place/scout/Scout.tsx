// ============================================================
// Scout — the authed container for /app/place/scout (Wave 5).
//
// PLAIN useState, NOT react-query, and this is a decision rather than an
// omission. A cache keyed on a typed address is itself a record of the
// lookup, and `queryKeys` is a central registry someone would otherwise
// add `scout: (address) => [...]` to. This surface promises the address
// is not kept; keeping it in a client cache would make that false in the
// reader's own browser. Same reasoning as UnlistedView.
//
// The address never enters a URL either — no query param, no router
// push carrying it, no shareable per-address link. A Scout report is
// about a home somebody currently lives in, assembled by us; it must not
// become a page that can be linked, indexed, or found in history.
//
// T1: an account, no claim. The reader is considering an address they do
// NOT live at, so they can never be a verified resident of it — gating
// this behind a postcard would make it unusable by its only audience.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { Search, Loader2, Compass } from 'lucide-react';
import type { ScoutResponse } from '@pantopus/api';
import PlaceShell from '../PlaceShell';
import ScoutView from './ScoutView';

const REDIRECT_TO = encodeURIComponent('/app/place/scout');

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; result: ScoutResponse }
  | { kind: 'rate_limited' }
  | { kind: 'error' };

/**
 * The API client rejects with a PLAIN OBJECT, never an Error, so
 * `err instanceof Error` is always false and silently swallows the
 * server's message. Read the shape it actually sends.
 */
function isRateLimited(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { statusCode?: number; code?: string };
  return e.statusCode === 429 || e.code === 'AI_RATE_LIMITED';
}

/**
 * Accept what people actually type.
 *
 * `Number('2,400')` is NaN — and "2,400" is the exact format the asking-
 * rent placeholder demonstrates, so the field silently discarded the
 * value it had just asked for. The rent section then never rendered and
 * the reader had no way to know why. Currency symbols and spaces go the
 * same way. `0` must survive, because a studio is 0 bedrooms.
 */
function numberOrUndefined(value: string): number | undefined {
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export default function Scout() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const [address, setAddress] = useState('');
  const [askingRent, setAskingRent] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [bedrooms, setBedrooms] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !getAuthToken()) {
      router.replace(`/login?redirectTo=${REDIRECT_TO}`);
    }
  }, [mounted, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = address.trim();
    if (!value) return;
    setPhase({ kind: 'loading' });
    try {
      const result = await api.scout.getScoutReport(value, {
        askingRent: numberOrUndefined(askingRent),
        yearBuilt: numberOrUndefined(yearBuilt),
        bedrooms: numberOrUndefined(bedrooms),
      });
      setPhase({ kind: 'result', result });
    } catch (err) {
      setPhase({ kind: isRateLimited(err) ? 'rate_limited' : 'error' });
    }
  };

  const result = phase.kind === 'result' ? phase.result : null;
  const report = result?.status === 'ready' ? result.scout : undefined;

  /*
    A LIVE REGION THAT OUTLIVES THE BRANCH.
    It sits above the early return on purpose: a region mounted at the
    same moment its text appears is not announced by most screen readers,
    so putting it inside either branch would make it useless. Between
    submit and answer the page otherwise looks and sounds unchanged —
    there is no skeleton, the button label is the only visual cue, and a
    non-sighted reader got nothing at all.
  */
  // Worded as an ANNOUNCEMENT, deliberately not a copy of the visible
  // card: a screen reader reaching the card will read it anyway, and
  // repeating the sentence verbatim means hearing it twice.
  const liveMessage = phase.kind === 'loading'
    ? 'Checking public records.'
    : report
      ? `Report ready, with ${report.ask_before_you_sign.length} questions to ask.`
      : result?.status === 'could_not_place'
        ? 'Address not recognised. See the note below the form.'
        : result?.status === 'unsupported_region'
          ? 'Outside coverage. See the note below the form.'
          : phase.kind === 'rate_limited'
            ? 'Request limit reached. See the note below the form.'
            : phase.kind === 'error'
              ? 'Something went wrong. See the note below the form.'
              : '';

  const liveRegion = (
    <p aria-live="polite" role="status" className="sr-only">{liveMessage}</p>
  );

  if (report) {
    return (
      <PlaceShell active="scout">
        {liveRegion}
        <ScoutView report={report} onNewSearch={() => setPhase({ kind: 'idle' })} />
      </PlaceShell>
    );
  }

  return (
    <PlaceShell active="scout">
      {liveRegion}
      <div className="px-4 sm:px-5 pt-4 pb-16 max-w-[640px]">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-[11px] bg-app-home-bg text-app-home">
            <Compass size={19} strokeWidth={2} />
          </span>
          <h1 className="text-[22px] leading-7 font-bold -tracking-[0.02em] text-app-text">Before you sign</h1>
        </div>
        <p className="mt-2.5 text-[14.5px] leading-[21px] text-app-text-secondary">
          Check an address you are considering, and get the questions worth asking before you commit — each one with
          the fact behind it, and a source where there is a public record to point at.
        </p>

        <form onSubmit={submit} className="mt-5">
          <label htmlFor="scout-address" className="block text-[12.5px] font-semibold text-app-text-secondary mb-1.5">
            The address you are considering
          </label>
          {/*
            A plain input, NOT AddressAutocomplete: the typeahead sends
            every keystroke to the geocoder, which is a disclosure the
            scope note does not cover and the reader did not agree to.
          */}
          <input
            id="scout-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
            autoComplete="off"
            placeholder="1421 SE Oak St, Portland, OR"
            className="w-full h-[50px] px-4 text-[15.5px] text-app-text bg-app-surface border-[1.5px] border-app-border rounded-xl outline-none transition focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10 placeholder:text-app-text-muted"
          />

          <div className="grid grid-cols-3 gap-2.5 mt-3">
            <div>
              <label htmlFor="scout-rent" className="block text-[12.5px] font-semibold text-app-text-secondary mb-1.5">
                Asking rent
              </label>
              <input
                id="scout-rent"
                value={askingRent}
                onChange={(e) => setAskingRent(e.target.value)}
                inputMode="numeric"
                placeholder="2,400"
                className="w-full h-[44px] px-3 text-[14.5px] text-app-text bg-app-surface border-[1.5px] border-app-border rounded-[11px] outline-none transition focus:border-primary-600 placeholder:text-app-text-muted"
              />
            </div>
            <div>
              <label htmlFor="scout-bedrooms" className="block text-[12.5px] font-semibold text-app-text-secondary mb-1.5">
                Bedrooms
              </label>
              <select
                id="scout-bedrooms"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="w-full h-[44px] px-3 text-[14.5px] text-app-text bg-app-surface border-[1.5px] border-app-border rounded-[11px] outline-none transition focus:border-primary-600"
              >
                <option value="">Not sure</option>
                <option value="0">Studio</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                {/*
                  Labelled "4" rather than "4+": HUD publishes a 4-bedroom
                  band and nothing above it, so picking this compares
                  against a 4-bedroom band. Offering "4+" and then
                  reporting the answer as a stated 4-bedroom overstated
                  what the reader told us for every larger unit.
                */}
                <option value="4">4</option>
              </select>
            </div>
            <div>
              <label htmlFor="scout-year" className="block text-[12.5px] font-semibold text-app-text-secondary mb-1.5">
                Year built
              </label>
              <input
                id="scout-year"
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                inputMode="numeric"
                placeholder="1961"
                className="w-full h-[44px] px-3 text-[14.5px] text-app-text bg-app-surface border-[1.5px] border-app-border rounded-[11px] outline-none transition focus:border-primary-600 placeholder:text-app-text-muted"
              />
            </div>
          </div>

          {/*
            Year built is the reader's, off the listing — we do not look
            it up for an address they have no claim on. It is also what
            unlocks the radon and lead-paint questions, so saying why it
            is worth filling in is not decoration.
          */}
          <p className="text-[12.5px] leading-[18px] text-app-text-muted mt-2">
            From the listing. The build year is what brings up the lead-paint and radon questions, and the bedroom
            count decides which rent band this is compared against.
          </p>

          <button
            type="submit"
            disabled={!address.trim() || phase.kind === 'loading'}
            className="w-full h-[50px] mt-4 rounded-xl bg-primary-600 text-white text-[15.5px] font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition disabled:opacity-50"
          >
            {phase.kind === 'loading'
              ? (<><Loader2 size={18} className="animate-spin" /> Checking public records…</>)
              : (<><Search size={17} strokeWidth={2.25} /> Show me what to ask</>)}
          </button>
        </form>

        {/* The two non-ready answers are DIFFERENT answers and must never
            be rendered alike — collapsing them once told every US user
            during a geocoder outage that the product was not for them. */}
        {result && result.status === 'could_not_place' ? (
          <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 mt-6">
            <h2 className="text-[15.5px] font-bold text-app-text -tracking-[0.01em]">
              {result.message ?? 'We could not find that address'}
            </h2>
            <p className="text-[13.5px] text-app-text-secondary leading-[20px] mt-1.5">
              Adding the city and state usually does it — &ldquo;1421 SE Oak St, Portland, OR&rdquo;.
            </p>
          </div>
        ) : null}

        {result && result.status === 'unsupported_region' ? (
          <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 mt-6">
            <h2 className="text-[15.5px] font-bold text-app-text -tracking-[0.01em]">
              {result.message ?? 'Scout is U.S.-only for now'}
            </h2>
            <p className="text-[13.5px] text-app-text-secondary leading-[20px] mt-1.5">
              The records behind these questions are U.S. federal and county sources, so there is nothing accurate to
              give you outside the U.S. yet.
            </p>
          </div>
        ) : null}

        {phase.kind === 'rate_limited' ? (
          <p className="text-[13.5px] text-app-error leading-[20px] mt-4">
            You have run through the checks available this hour. Try again shortly.
          </p>
        ) : null}

        {phase.kind === 'error' ? (
          <p className="text-[13.5px] text-app-error leading-[20px] mt-4">
            We couldn&apos;t put that report together. Check the address and try again.
          </p>
        ) : null}
      </div>
    </PlaceShell>
  );
}
