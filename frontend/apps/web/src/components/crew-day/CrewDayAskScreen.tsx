'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, House, Lock } from 'lucide-react';
import * as api from '@pantopus/api';
import type { CrewDayService } from '@pantopus/types';
import { myHomesQuery, type MyHomesReply } from '@/lib/myHomes';
import { toast } from '@/components/ui/toast-store';
import { CREW_DAY_OVERLINE, CREW_DAY_PRIMARY_BUTTON, CREW_DAY_SECONDARY_BUTTON, CrewDayStepBar } from './CrewDayParts';
import CrewDayFooterBar from './CrewDayFooterBar';

// Screen 11, Ask for a Crew Day on your street (board `AskStreet`): a service, the street of one of your homes, the
// months that suit you and an optional note. Neighbors see the street and the service, never who asked. Without a
// home in Pantopus: "Add your home first" and the existing home setup. POST /api/crew-days/requests.

const SERVICES: ReadonlyArray<{ key: CrewDayService; label: string }> = [
  { key: 'gutter_cleaning', label: 'Gutter cleaning' },
  { key: 'leaf_cleanup', label: 'Leaf cleanup' },
  { key: 'roof_moss', label: 'Roof moss' },
  { key: 'holiday_lights', label: 'Holiday lights' },
  { key: 'window_washing', label: 'Window washing' },
  { key: 'pressure_washing', label: 'Pressure washing' },
  { key: 'other', label: 'Something else' },
];

// The months the server takes: this one and the next five, counted in Pacific time as it counts them.
const MONTHS_ZONE = 'America/Los_Angeles';

function nextSixMonths(now = new Date()): Array<{ value: string; short: string; long: string }> {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: MONTHS_ZONE, year: 'numeric', month: 'numeric' }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return Array.from({ length: 6 }, (_, i) => {
    const at = new Date(Date.UTC(year, month - 1 + i, 15));
    return {
      value: `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`,
      short: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(at),
      long: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(at),
    };
  });
}

type AskHome = { id: string; street: string; city: string };

/** The homes a request can be for, the primary one first, by street ("123 Maple Lane" → "Maple Lane"). */
function askHomes(reply: MyHomesReply | undefined): AskHome[] {
  const homes = (reply?.homes ?? []).filter(
    (home) =>
      home.address && (home.access_kind === undefined || home.access_kind === 'shared' || home.access_kind === 'private_setup'),
  );
  const primaryId = reply?.primary_home?.id;
  return [...homes]
    .sort((a, b) => Number(b.id === primaryId) - Number(a.id === primaryId))
    .map((home) => ({
      id: home.id,
      street: String(home.address).replace(/^\s*\d+[A-Za-z]?\s+/, '').split(',')[0].trim() || String(home.address),
      city: home.city || '',
    }));
}

function Chip({ pressed, onClick, children, label }: { pressed: boolean; onClick: () => void; children: string; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-[0.875rem] text-[0.9375rem] leading-5 ${
        pressed
          ? 'border-[1.5px] border-app-link bg-app-info-bg pl-3 font-semibold text-app-info'
          : 'border border-app-border-strong bg-app-surface font-medium text-app-text hover:bg-app-hover'
      }`}
    >
      {pressed ? <Check className="h-4 w-4 flex-none" strokeWidth={2.6} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export default function CrewDayAskScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const homesQuery = useQuery(myHomesQuery());
  const homes = useMemo(() => askHomes(homesQuery.data), [homesQuery.data]);
  const months = useMemo(() => nextSixMonths(), []);

  const [service, setService] = useState<CrewDayService | null>(null);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [homeRequired, setHomeRequired] = useState(false);

  useEffect(() => {
    if (!homeId && homes[0]) setHomeId(homes[0].id);
  }, [homeId, homes]);
  const home = homes.find((h) => h.id === homeId) ?? homes[0] ?? null;
  const noHome = homeRequired || (homesQuery.isSuccess && homes.length === 0);

  const toggleMonth = (value: string) =>
    setPicked((list) => (list.includes(value) ? list.filter((m) => m !== value) : [...list, value]));

  const send = async () => {
    if (!service || !home || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.crewDays.createRequest({
        service,
        home_id: home.id,
        months: picked.length ? months.map((m) => m.value).filter((m) => picked.includes(m)) : ['any'],
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      void queryClient.invalidateQueries({ queryKey: ['crew-day', 'mine'] });
      toast.success("Request sent. We'll tell you within a week.");
      router.replace('/app/crew-days');
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e?.code === 'HOME_REQUIRED') setHomeRequired(true);
      setError(
        e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : "We couldn't send your request. Check your connection and try again.",
      );
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-xl flex-col text-app-text">
      <CrewDayStepBar title="Ask for a Crew Day" backHref="/app/crew-days" backLabel="Back to Your Crew Days" />
      <div className="flex flex-1 flex-col gap-5 px-4 pb-6 pt-1">
        <p className="text-base leading-6 text-app-text-strong">
          Tell us what your street needs. We&apos;ll look for a local crew. Nothing is booked until you see a price.
        </p>

        <section aria-labelledby="cd-ask-service" className="flex flex-col gap-2">
          <h2 id="cd-ask-service" className={CREW_DAY_OVERLINE}>
            Service
          </h2>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((s) => (
              <Chip key={s.key} pressed={service === s.key} onClick={() => setService(s.key)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </section>

        <section aria-labelledby="cd-ask-street" className="flex flex-col gap-2">
          <h2 id="cd-ask-street" className={CREW_DAY_OVERLINE}>
            Your street
          </h2>
          {homesQuery.isLoading ? <p className="text-sm text-app-text-secondary">Finding your home…</p> : null}
          {homesQuery.isError && !noHome ? (
            <div role="alert" className="flex flex-col gap-3 rounded-[1.25rem] border border-app-border bg-app-surface p-4">
              <p className="text-sm leading-5 text-app-text-strong">We couldn&apos;t load your homes. Check your connection and try again.</p>
              <button type="button" onClick={() => void homesQuery.refetch()} className={CREW_DAY_SECONDARY_BUTTON}>
                Try again
              </button>
            </div>
          ) : null}
          {noHome ? (
            <div className="flex flex-col gap-3 rounded-[1.25rem] border border-app-warning-light bg-app-warning-bg p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-semibold leading-[1.3125rem]">Add your home first</span>
                <span className="text-sm leading-5 text-app-text-strong">We ask crews for the street your home is on.</span>
              </div>
              <Link href="/app/homes/new" className={`${CREW_DAY_PRIMARY_BUTTON} min-h-11`}>
                Add your home
              </Link>
            </div>
          ) : home ? (
            <div className="flex flex-col gap-3 rounded-[1.25rem] border border-app-border bg-app-surface p-[0.875rem]">
              {homes.length > 1 ? (
                <fieldset className="flex min-w-0 flex-col gap-1">
                  <legend className="sr-only">Which home&apos;s street?</legend>
                  {homes.map((h) => (
                    <label key={h.id} className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name="cd-ask-home"
                        checked={home.id === h.id}
                        onChange={() => setHomeId(h.id)}
                        className="h-[1.375rem] w-[1.375rem] flex-none accent-[rgb(var(--accent-primary-fill))]"
                      />
                      <span className="text-base font-semibold leading-[1.3125rem]">{[h.street, h.city].filter(Boolean).join(', ')}</span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-app-home-bg text-app-home">
                    <House className="h-5 w-5" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-base font-semibold leading-[1.3125rem]">{[home.street, home.city].filter(Boolean).join(', ')}</span>
                    <span className="text-[0.8125rem] font-semibold leading-[1.125rem] text-app-home">From your home</span>
                  </span>
                </div>
              )}
              <div className="h-px bg-app-border" />
              <p className="flex items-start gap-2 text-sm leading-5 text-app-text-secondary">
                <Lock className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                Neighbors see the street and the service, never who asked.
              </p>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="cd-ask-when" className="flex flex-col gap-2">
          <h2 id="cd-ask-when" className={CREW_DAY_OVERLINE}>
            When suits you
          </h2>
          <div className="flex flex-wrap gap-2">
            {months.map((m) => (
              <Chip key={m.value} pressed={picked.includes(m.value)} onClick={() => toggleMonth(m.value)} label={m.long}>
                {m.short}
              </Chip>
            ))}
            <Chip pressed={picked.length === 0} onClick={() => setPicked([])}>
              Any time
            </Chip>
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <label htmlFor="cd-ask-note" className={CREW_DAY_OVERLINE}>
            Anything else? (optional)
          </label>
          <textarea
            id="cd-ask-note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Front and back yards, a big maple, a steep driveway"
            className="min-h-[5.75rem] rounded-[0.875rem] border border-app-border-strong bg-app-surface px-[0.875rem] py-3 text-base leading-[1.375rem] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="self-end text-xs leading-4 text-app-text-secondary [font-variant-numeric:tabular-nums]">{note.length} / 500</span>
        </div>
      </div>
      <CrewDayFooterBar>
        {error ? (
          <p role="alert" className="text-center text-[0.8125rem] leading-[1.125rem] text-app-error">
            {error}
          </p>
        ) : null}
        <button type="button" disabled={!service || !home || noHome || sending} onClick={() => void send()} className={CREW_DAY_PRIMARY_BUTTON}>
          {sending ? 'Sending…' : 'Send request'}
        </button>
        <p className="text-center text-xs leading-4 text-app-text-secondary">
          {service ? "We'll tell you within a week whether a crew can come." : 'Pick a service to send your request.'}
        </p>
      </CrewDayFooterBar>
    </div>
  );
}
