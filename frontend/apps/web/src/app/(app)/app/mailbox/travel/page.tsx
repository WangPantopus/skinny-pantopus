'use client';

import { useCallback, useMemo, useState } from 'react';
import type { VacationHold } from '@/types/mailbox';
import { useCancelVacationHold, useCreateVacationHold, useVacationHold } from '@/lib/mailbox-queries';
import { mailLoadMessage } from '@/components/mailbox/mailLoadMessage';
import ErrorState from '@/components/ui/ErrorState';
import { toast } from '@/components/ui/toast-store';
// The user's Home; the page sent a hard-coded 'home_1'.
import useHomeProfile from '../_components/useMailboxHome';

/** "Fri, Nov 20" for a YYYY-MM-DD day, as that calendar day. */
function day(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function shortDay(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Sun, Nov 29 at 7 a.m." from the server's release time (the person's zone, shown in this browser's). */
function release(hold: VacationHold): string {
  const at = hold.release_at ? new Date(hold.release_at) : null;
  if (!at || Number.isNaN(at.getTime())) return `the morning of ${day(hold.end_date)}`;
  const when = at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(' AM', ' a.m.').replace(' PM', ' p.m.');
  return `${when} at ${time}`;
}

/** The mailbox with its HOLD tag, and the bundle tied up for the return (R11-Vacation). */
function HoldDrawings() {
  return (
    <div aria-hidden="true" className="flex items-end justify-center gap-4 py-2">
      <svg width="110" height="120" viewBox="0 0 120 130">
        <rect x="54" y="96" width="12" height="34" rx="2" fill="#8a6a4a" />
        <path d="M18 94 V50 A42 42 0 0 1 102 50 V94 Z" fill="#0284c7" />
        <path d="M27 90 V53 A33 33 0 0 1 93 53 V90 Z" fill="#0369a1" />
        <rect x="51" y="38" width="18" height="6" rx="3" fill="#e0f2fe" />
        <rect x="102" y="64" width="16" height="7" rx="1.5" fill="#c2410c" />
        <path d="M60 44 L60 58" stroke="#a16207" strokeWidth="1.4" />
        <path d="M46 58 H74 L78 64 L74 70 H46 Z" fill="#f3e3b5" stroke="#d9c48c" />
        <text x="60" y="67" textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize="7" fontWeight="700" fill="#5c4410">HOLD</text>
      </svg>
      <svg width="140" height="102" viewBox="0 0 150 110">
        <rect x="10" y="62" width="130" height="34" rx="3" fill="#c9a676" />
        <rect x="14" y="44" width="122" height="22" rx="2" fill="#ffffff" stroke="#e2e8f0" />
        <rect x="8" y="26" width="128" height="22" rx="2" fill="#fbf6ea" stroke="#ebe1cb" transform="rotate(-2 72 37)" />
        <rect x="18" y="12" width="116" height="18" rx="2" fill="#fffdf7" stroke="#ebe5d6" transform="rotate(2 76 21)" />
        <path d="M75 8 V100" stroke="#8a6a4a" strokeWidth="2.2" />
        <path d="M4 58 Q75 50 146 58" fill="none" stroke="#8a6a4a" strokeWidth="2.2" />
        <path d="M75 10 q-12 -10 -6 -2 q4 4 6 2 q2 2 6 -2 q6 -8 -6 2" fill="none" stroke="#8a6a4a" strokeWidth="2" />
      </svg>
    </div>
  );
}

/** The hold in effect, or the next one: what's happening, what it has kept, and ending or cancelling it. */
function HoldInEffect({ hold }: { hold: VacationHold }) {
  const cancel = useCancelVacationHold();
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const active = hold.status === 'active';
  const held = hold.held_count ?? hold.items_held_count ?? 0;

  const end = () => {
    setProblem(null);
    cancel.mutate(hold.id, {
      onSuccess: () => {
        setAsking(false);
        toast.success(active ? 'Your hold has ended. What it kept comes with the next morning’s mail.' : 'Your hold is cancelled. Your mail keeps coming as usual.');
      },
      onError: (err) => setProblem(`That didn't work: ${mailLoadMessage(err)} Your hold is as it was.`),
    });
  };

  return (
    <section aria-label="Your mail hold" className="space-y-4">
      <div role="status" className={`rounded-2xl border px-4 py-3.5 ${active ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-app-border bg-app-surface'}`}>
        <p className="text-base font-semibold text-app-text">{active ? 'Your mail is on hold' : `Your mail hold starts ${day(hold.start_date)}`}</p>
        <p className="mt-1 text-sm text-app-text-strong">
          Back home {day(hold.end_date)}. What it keeps comes {release(hold)}, together as one bundle.
        </p>
        {active ? (
          <p className="mt-1 text-sm font-semibold text-app-text">{held === 0 ? 'Nothing held yet.' : `${held} ${held === 1 ? 'piece' : 'pieces'} held so far.`}</p>
        ) : null}
      </div>
      <p className="text-sm text-app-text-secondary">Special deliveries still come right away, and Home mail keeps coming for your household.</p>

      {problem ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p> : null}
      {asking ? (
        <div role="alertdialog" aria-label={active ? 'End your hold now?' : 'Cancel this hold?'} className="rounded-xl border border-app-border bg-app-surface p-3.5">
          <p className="text-sm font-semibold text-app-text">{active ? 'End your hold now?' : 'Cancel this hold?'}</p>
          <p className="mt-0.5 text-sm text-app-text-secondary">
            {active ? 'What it kept comes with the next morning’s mail, and your mail comes as usual after that.' : 'Your mail keeps coming every morning as usual.'}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={end} disabled={cancel.isPending} className="min-h-[44px] flex-1 rounded-lg bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
              {cancel.isPending ? 'Working…' : active ? 'End the hold' : 'Cancel the hold'}
            </button>
            <button type="button" onClick={() => setAsking(false)} disabled={cancel.isPending} className="min-h-[44px] flex-1 rounded-lg border border-app-border px-3 text-sm font-semibold text-app-text">
              {active ? 'Keep holding' : 'Keep it'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="min-h-[48px] w-full rounded-xl border border-app-border bg-app-surface text-sm font-semibold text-app-text hover:bg-app-hover">
          {active ? 'End the hold early' : 'Cancel the hold'}
        </button>
      )}
    </section>
  );
}

/**
 * Hold my mail (Mail tab drawings, R11-Vacation): while you're away your own
 * mail waits, and comes back as one bundle the morning you're home (SRV-5).
 */
export default function HoldMailPage() {
  const home = useHomeProfile();
  const { data: hold, isPending, isError, error, refetch } = useVacationHold();
  const create = useCreateVacationHold();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  // The person's own calendar day (toISOString is the UTC day).
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const submit = useCallback(() => {
    if (!start) { setProblem('Choose the day you leave.'); return; }
    if (!end) { setProblem('Choose the day you’re back home.'); return; }
    if (start < today) { setProblem('Choose a day from today on for when you leave.'); return; }
    if (end < start) { setProblem('Your return date must be on or after the day you leave.'); return; }
    if (!home.homeId) { setProblem('Add your home before holding your mail.'); return; }
    setProblem(null);
    create.mutate(
      // The server keeps the person's own mail; these older fields are stored only.
      { homeId: home.homeId, startDate: start, endDate: end, holdAction: 'hold_in_vault', packageAction: 'hold_at_carrier', autoNeighborRequest: false },
      {
        onSuccess: () => { void refetch(); toast.success(`Holding your mail, ${shortDay(start)} to ${shortDay(end)}`); },
        onError: (err) => setProblem(`Couldn't hold your mail: ${mailLoadMessage(err)}`),
      },
    );
  }, [start, end, today, home.homeId, create, refetch]);

  const inEffect = hold && (hold.status === 'active' || hold.status === 'scheduled') ? hold : null;

  return (
    <div className="mx-auto w-full max-w-xl pb-10 md:h-full md:overflow-y-auto">
      <div className="px-4 pt-4">
        <h1 className="text-2xl font-bold tracking-tight text-app-text">Hold my mail</h1>
        <p className="mt-1 text-sm leading-5 text-app-text-secondary">
          Deliveries pause while you&apos;re away. Everything that comes waits for you and arrives as one bundle the morning you&apos;re back.
        </p>
      </div>
      <HoldDrawings />

      <div className="px-4">
        {isPending || (home.isLoading && !hold) ? (
          <div className="h-32 rounded-2xl bg-app-surface-sunken animate-pulse" role="status" aria-label="Loading your mail hold" />
        ) : isError && !hold ? (
          <ErrorState title="Couldn't load your mail hold" message={mailLoadMessage(error)} onRetry={() => { void refetch(); }} />
        ) : inEffect ? (
          <>
            {isError ? (
              <p role="alert" className="mb-3 text-sm text-red-700">
                Couldn&apos;t refresh your hold. {mailLoadMessage(error)}{' '}
                <button type="button" onClick={() => { void refetch(); }} className="font-semibold underline">Try again</button>
              </p>
            ) : null}
            <HoldInEffect hold={inEffect} />
          </>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate className="space-y-4">
            <section aria-label="Dates" className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
              <label className="flex min-h-[56px] items-center justify-between gap-3 border-b border-app-border-subtle px-4">
                <span className="text-sm font-semibold text-app-text">Starts</span>
                <input type="date" value={start} min={today} onChange={(event) => { setStart(event.target.value); setProblem(null); }} className="rounded-lg bg-transparent py-2 text-right text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </label>
              <label className="flex min-h-[56px] items-center justify-between gap-3 px-4">
                <span className="text-sm font-semibold text-app-text">Back home</span>
                <input type="date" value={end} min={start || today} onChange={(event) => { setEnd(event.target.value); setProblem(null); }} className="rounded-lg bg-transparent py-2 text-right text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </label>
            </section>
            {end && (!start || end >= start) ? (
              <p className="text-sm text-app-text-strong">Your held mail arrives the morning of {day(end)}, as one bundle with that day&apos;s mail.</p>
            ) : null}
            <p className="text-sm text-app-text-secondary">Special deliveries still come right away, and Home mail keeps coming for your household.</p>
            {home.isError ? <p role="alert" className="text-sm text-red-700">Couldn&apos;t load your home. {mailLoadMessage(null)}</p> : null}
            {problem ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p> : null}
            <button type="submit" disabled={create.isPending} className="min-h-[48px] w-full rounded-xl bg-primary-600 px-4 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
              {create.isPending ? 'Holding your mail…' : start && end && end >= start ? `Hold my mail, ${shortDay(start)} to ${shortDay(end)}` : 'Hold my mail'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
