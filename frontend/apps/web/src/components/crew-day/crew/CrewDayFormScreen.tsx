'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, CircleAlert, Lock, Plus, X } from 'lucide-react';
import * as api from '@pantopus/api';
import type { CrewDayCrewView, CrewDayForm, CrewDayService } from '@pantopus/types';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { toast } from '@/components/ui/toast-store';
import { bookedLine, crewDayServiceLabel, formatCrewDate, formatPrice, formatWindow, includedItems } from '@/lib/crewDay';
import { CrewRow, OutsideOnlyLine, ServiceTag, StreetMiniMap } from '../CrewDayParts';

// Screen 14, New Crew Day on the web (board `NewCrewDay`): one form in four numbered sections (service and what's
// included; where and when; prices; review and send) beside a live preview of the invitation. The same page edits a
// draft or a day Pantopus didn't approve, and "Offer a Crew Day here again" opens it filled in from a past day.
// An open day changes only what `editable_fields` allows; its date moves only through "Propose new dates".
// POST /api/crew-days, PATCH /api/crew-days/:id, POST /api/crew-days/:id/submit.

const SERVICES: ReadonlyArray<{ key: CrewDayService; label: string }> = [
  { key: 'gutter_cleaning', label: 'Gutter cleaning' },
  { key: 'leaf_cleanup', label: 'Leaf cleanup' },
  { key: 'roof_moss', label: 'Roof moss' },
  { key: 'holiday_lights', label: 'Holiday lights' },
  { key: 'window_washing', label: 'Window washing' },
  { key: 'pressure_washing', label: 'Pressure washing' },
  { key: 'other', label: 'Something else' },
];

const REACH = [
  { meters: 150, label: 'Just this street', hint: 'About 150 m' },
  { meters: 400, label: 'A few blocks', hint: 'About 400 m' },
  { meters: 800, label: 'The neighborhood', hint: 'About 800 m' },
] as const;

/** Every half hour from 6 AM to 8 PM, as "HH:MM". */
const CLOCK_TIMES = Array.from({ length: 29 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

/** "09:30" → "9:30 AM". */
function clockLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

type OptionRow = { key: string; id?: string; label: string; price: string; needsLook: boolean };
type AddOnRow = { key: string; id?: string; label: string; price: string };

let rowSeq = 0;
const rowKey = () => `row-${(rowSeq += 1)}`;

function dollars(cents: number | null | undefined): string {
  return cents == null ? '' : Number.isInteger(cents / 100) ? String(cents / 100) : (cents / 100).toFixed(2);
}

function cents(text: string): number | null {
  const value = Number(String(text).replace(/[$,\s]/g, ''));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

/** A calendar date (YYYY-MM-DD) n days from today, in the browser's own time zone. */
function dayFromToday(days: number): string {
  const at = new Date();
  at.setDate(at.getDate() + days);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

/** "YYYY-MM-DDTHH:MM" for a datetime-local field, from an instant, in the browser's time zone. */
function localInputValue(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** The default close: 48 hours before the window starts (the server's own default), as a datetime-local value. */
function defaultCloses(date: string, windowStart: string): string {
  if (!date || !windowStart) return '';
  const start = new Date(`${date}T${windowStart}`);
  if (Number.isNaN(start.getTime())) return '';
  return localInputValue(new Date(start.getTime() - 48 * 3600 * 1000).toISOString());
}

function Section({ n, id, title, intro, children }: { n: number; id: string; title: string; intro: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 rounded-2xl border border-app bg-surface p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
          {n}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={id} className="text-lg font-semibold text-app">
            {title}
          </h2>
          <p className="text-sm text-app-secondary">{intro}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const INPUT =
  'w-full rounded-lg border border-app-strong bg-surface px-3 py-2 text-[0.9375rem] text-app placeholder:text-app-secondary focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60';
const LABEL = 'text-sm font-semibold text-app-strong';
const HINT = 'text-[0.8125rem] text-app-secondary';
const SMALL_BUTTON =
  'inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg px-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:text-violet-300 dark:hover:bg-violet-950/40';

export default function CrewDayFormScreen({
  businessId,
  crewDayId,
  repeatOf,
}: {
  businessId: string;
  /** Editing this day (a draft, a declined day, one waiting for approval, or an open day's editable fields). */
  crewDayId?: string;
  /** "Offer a Crew Day here again": a new day filled in from this one. */
  repeatOf?: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const formId = useId();
  const centerLabelId = useId();
  const business = useQuery({
    queryKey: ['crew-day', 'business', businessId],
    queryFn: () => api.crewDays.getBusinessCrewDays(businessId),
    staleTime: 30_000,
  });
  const sourceId = crewDayId ?? repeatOf ?? null;
  const source = useQuery({
    queryKey: ['crew-day', 'crew', sourceId],
    queryFn: () => api.crewDays.getCrewDay(sourceId as string),
    enabled: Boolean(sourceId),
  });
  const crewName = useQuery({ queryKey: ['crew-day', 'business-name', businessId], queryFn: () => api.businesses.getBusiness(businessId), staleTime: 300_000 });

  const [service, setService] = useState<CrewDayService>('gutter_cleaning');
  const [included, setIncluded] = useState<string[]>([]);
  const [outsideOnly, setOutsideOnly] = useState(true);
  const [street, setStreet] = useState('');
  const [centerText, setCenterText] = useState('');
  const [center, setCenter] = useState<{ latitude: number; longitude: number; city: string; state: string } | null>(null);
  const [radius, setRadius] = useState<number>(150);
  const [date, setDate] = useState('');
  const [windowStart, setWindowStart] = useState('09:00');
  const [windowEnd, setWindowEnd] = useState('13:00');
  const [capacity, setCapacity] = useState('10');
  const [closes, setCloses] = useState('');
  const [closesTouched, setClosesTouched] = useState(false);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [addOns, setAddOns] = useState<AddOnRow[]>([]);
  const [prepNote, setPrepNote] = useState('');
  const [saving, setSaving] = useState<'draft' | 'send' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const filled = useRef(false);

  const services = business.data?.services ?? [];
  const defaultsFor = (key: CrewDayService) => services.find((s) => s.key === key)?.included ?? [];

  // Fill the form once: from the day being edited or repeated, else the service's usual lines and the example prices.
  useEffect(() => {
    if (filled.current || !business.data) return;
    if (sourceId && !source.data) return;
    filled.current = true;
    const from: CrewDayCrewView | undefined = source.data;
    if (from) {
      setService(from.service);
      setIncluded(from.included.length ? from.included : defaultsFor(from.service));
      setOutsideOnly(from.outside_only);
      setStreet(from.street_label);
      setCenterText([from.street_label, from.city, from.state].filter(Boolean).join(', '));
      if (from.center) setCenter({ ...from.center, city: from.city || '', state: from.state || '' });
      setRadius(from.radius_m);
      setWindowStart(from.window_start.slice(0, 5));
      setWindowEnd(from.window_end.slice(0, 5));
      setCapacity(String(from.capacity));
      setOptions(from.price_options.map((o) => ({ key: rowKey(), id: repeatOf ? undefined : o.id, label: o.label, price: dollars(o.price_cents), needsLook: o.needs_look })));
      setAddOns(from.add_ons.map((a) => ({ key: rowKey(), id: repeatOf ? undefined : a.id, label: a.label, price: dollars(a.price_cents) })));
      setPrepNote(from.prep_note || '');
      if (!repeatOf) {
        setDate(from.service_date);
        if (from.booking_closes_at) {
          setCloses(localInputValue(from.booking_closes_at));
          setClosesTouched(true);
        }
      }
    } else {
      setIncluded(defaultsFor('gutter_cleaning'));
      setOptions([
        { key: rowKey(), label: 'One story', price: '', needsLook: false },
        { key: rowKey(), label: 'Two stories', price: '', needsLook: false },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.data, source.data, sourceId]);

  // Booking closes 48 hours before the window unless the crew set it.
  useEffect(() => {
    if (!closesTouched) setCloses(defaultCloses(date, windowStart));
  }, [date, windowStart, closesTouched]);

  const editing = Boolean(crewDayId);
  const existing = editing ? source.data : undefined;
  const open = existing ? ['open', 'in_progress'].includes(existing.status) : false;
  const editable = (field: string) => !existing || existing.editable_fields.includes(field);
  const dayTitle = services.find((s) => s.key === service)?.day_title ?? `${crewDayServiceLabel(service)} Day`;
  const title = existing && existing.status !== 'draft' && existing.status !== 'declined' ? existing.title : `${dayTitle} on ${street.trim() || 'your street'}`;
  const rate = business.data?.fee.rate_pct ?? 15;
  const founding = business.data?.fee.founding ?? false;

  const changeService = (next: CrewDayService) => {
    const usual = defaultsFor(service);
    const untouched = included.length === 0 || (included.length === usual.length && included.every((line, i) => line === usual[i]));
    setService(next);
    if (untouched) setIncluded(defaultsFor(next));
  };

  const optionCents = options.map((o) => (o.needsLook ? null : cents(o.price)));
  const priced = optionCents.filter((c): c is number => c != null);
  const fromCents = priced.length ? Math.min(...priced) : null;

  const formBody = (): { body: CrewDayForm; problem: string | null } => {
    const lines = included.map((l) => l.trim()).filter(Boolean);
    const optionRows = options.filter((o) => o.label.trim() || o.price.trim());
    const addOnRows = addOns.filter((a) => a.label.trim() || a.price.trim());
    let problem: string | null = null;
    if (!street.trim()) problem = 'Name the street or area.';
    else if (!center) problem = 'Pick the center of the area from the address suggestions.';
    else if (!date) problem = 'Pick the date.';
    else if (windowEnd <= windowStart) problem = 'The arrival window has to end after it starts.';
    else if (!(Number(capacity) >= 1 && Number(capacity) <= 60)) problem = 'Take between 1 and 60 homes.';
    else if (!optionRows.length) problem = 'Add at least one price option.';
    else if (optionRows.some((o) => !o.label.trim())) problem = 'Name every price option.';
    else if (optionRows.some((o) => !o.needsLook && cents(o.price) == null)) problem = 'Give every option a price, or mark it "I confirm this one after a look".';
    else if (addOnRows.some((a) => !a.label.trim() || cents(a.price) == null)) problem = 'Give every add-on a name and a price.';
    const body: CrewDayForm = {
      service,
      street_label: street.trim(),
      city: center?.city || existing?.city || '',
      state: center?.state || existing?.state || '',
      center: center ? { latitude: center.latitude, longitude: center.longitude } : { latitude: 0, longitude: 0 },
      radius_m: radius,
      service_date: date,
      window_start: windowStart,
      window_end: windowEnd,
      capacity: Number(capacity),
      included: lines,
      outside_only: outsideOnly,
      prep_note: prepNote.trim(),
      price_options: optionRows.map((o) => ({ ...(o.id ? { id: o.id } : {}), label: o.label.trim(), price_cents: o.needsLook ? null : cents(o.price), needs_look: o.needsLook })),
      add_ons: addOnRows.map((a) => ({ ...(a.id ? { id: a.id } : {}), label: a.label.trim(), price_cents: cents(a.price) ?? 0 })),
      ...(closesTouched && closes ? { booking_closes_at: new Date(closes).toISOString() } : {}),
      ...(repeatOf ? { repeat_of: repeatOf } : {}),
    };
    return { body, problem };
  };

  const fail = (err: unknown, fallback: string) => {
    const e = err as { message?: string; code?: string };
    setError(e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : fallback);
    setSaving(null);
  };

  const save = async (mode: 'draft' | 'send' | 'save') => {
    if (saving) return;
    setError(null);
    const { body, problem } = formBody();
    if (problem && mode !== 'draft') {
      setError(problem);
      return;
    }
    if (mode === 'draft' && (!street.trim() || !center || !date || !options.some((o) => o.label.trim()))) {
      setError('A draft needs the street, the center, the date and one price option.');
      return;
    }
    setSaving(mode);
    try {
      let day: CrewDayCrewView;
      if (existing) {
        const patchBody = Object.fromEntries(Object.entries(body).filter(([field]) => existing.editable_fields.includes(field))) as Partial<CrewDayForm>;
        day = (await api.crewDays.updateCrewDay(existing.id, patchBody)).crew_day;
        if (mode === 'send') day = (await api.crewDays.submitCrewDay(existing.id)).crew_day;
      } else {
        day = (await api.crewDays.createCrewDay({ ...body, business_id: businessId, submit: mode === 'send' })).crew_day;
      }
      void queryClient.invalidateQueries({ queryKey: ['crew-day', 'business', businessId] });
      queryClient.setQueryData(['crew-day', 'crew', day.id], undefined);
      if (mode === 'send') {
        setSent(true);
        toast.success("Sent to Pantopus. We'll tell you within a business day.");
        router.push(`/app/businesses/${encodeURIComponent(businessId)}/crew-days/${encodeURIComponent(day.id)}`);
      } else if (mode === 'save') {
        toast.success('Saved.');
        router.push(`/app/businesses/${encodeURIComponent(businessId)}/crew-days/${encodeURIComponent(day.id)}`);
      } else {
        toast.success('Draft saved.');
        setSaving(null);
        if (!existing) router.replace(`/app/businesses/${encodeURIComponent(businessId)}/crew-days/${encodeURIComponent(day.id)}/edit`);
      }
    } catch (err) {
      fail(err, "We couldn't save this Crew Day. Check your connection and try again.");
    }
  };

  const dashboard = `/app/businesses/${encodeURIComponent(businessId)}/dashboard?tab=crew-days`;
  const back = existing ? `/app/businesses/${encodeURIComponent(businessId)}/crew-days/${encodeURIComponent(existing.id)}` : dashboard;
  const loading = business.isLoading || (Boolean(sourceId) && source.isLoading);
  const crew = useMemo(
    () => ({
      business_user_id: businessId,
      name: crewName.data?.business?.name || existing?.crew?.name || 'Your business',
      username: null,
      avatar_url: null,
      verified: business.data?.readiness.documents_verified ?? false,
      rating: null,
    }),
    [business.data, businessId, crewName.data, existing],
  );

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-app-secondary">Loading…</div>;
  if (!business.data || (sourceId && !source.data)) {
    return (
      <div role="alert" className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-8">
        <p className="text-sm text-app-strong">We couldn&apos;t load this Crew Day. Check your connection and try again.</p>
        <Link href={dashboard} className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">
          Back to Crew Days
        </Link>
      </div>
    );
  }
  if (!business.data.can_edit) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-8">
        <p className="text-sm text-app-strong">Only the business&apos;s owners and editors can set up a Crew Day.</p>
        <Link href={dashboard} className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">
          Back to Crew Days
        </Link>
      </div>
    );
  }
  if (!existing && business.data.readiness.missing.length) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-8">
        <p className="text-sm text-app-strong">Publish your business page and set up payouts before you start a Crew Day.</p>
        <Link href={dashboard} className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">
          See what&apos;s missing
        </Link>
      </div>
    );
  }

  const heading = existing ? (open ? 'Edit Crew Day' : existing.status === 'declined' ? 'Fix and send again' : 'Edit draft') : repeatOf ? 'Offer it again' : 'New Crew Day';
  const canSend = !existing || ['draft', 'declined'].includes(existing.status);
  const previewIncluded = includedItems({ included: included.map((l) => l.trim()).filter(Boolean), outside_only: outsideOnly });
  const capacityNumber = Math.max(1, Math.min(60, Number(capacity) || 1));

  return (
    <div className="min-h-screen bg-app">
      <div className="border-b border-app bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            <Link href={back} className="inline-flex min-h-8 items-center gap-1 self-start text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {existing ? existing.title : 'Crew Days'}
            </Link>
            <h1 className="text-xl font-semibold text-app">{heading}</h1>
            <p className="text-sm text-app-secondary">
              {crew.name} · Pantopus approves each Crew Day before its invitation works.
            </p>
          </div>
          {canSend ? (
            <button
              type="button"
              disabled={!!saving}
              onClick={() => void save('draft')}
              className="rounded-xl border border-app-strong px-4 py-2 text-sm font-semibold text-app-strong hover:bg-surface-raised disabled:opacity-50"
            >
              {saving === 'draft' ? 'Saving…' : 'Save draft'}
            </button>
          ) : null}
        </div>
      </div>

      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          void save(canSend ? 'send' : 'save');
        }}
        className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div className="flex min-w-0 flex-col gap-5">
          {existing?.status === 'declined' && existing.review_note ? (
            <p role="status" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              Pantopus didn&apos;t approve this: {existing.review_note}
            </p>
          ) : null}
          {open ? (
            <p role="status" className="rounded-xl border border-app bg-surface px-4 py-3 text-sm text-app-strong">
              This Crew Day is open. You can change how many homes you take, what&apos;s included, the note and future prices; booked homes keep
              their prices. The date moves only through Propose new dates.
            </p>
          ) : null}

          <Section n={1} id="cd-form-s1" title="Service and what's included" intro="Households see these lines on the invitation.">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cd-service" className={LABEL}>
                Service
              </label>
              <select id="cd-service" value={service} disabled={!editable('service')} onChange={(e) => changeService(e.target.value as CrewDayService)} className={INPUT}>
                {SERVICES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="flex min-w-0 flex-col gap-2" disabled={!editable('included')}>
              <legend className={LABEL}>What&apos;s included</legend>
              <p className={HINT}>Up to 6 lines. We started you with the usual ones for {crewDayServiceLabel(service).toLowerCase()}.</p>
              {included.map((line, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    aria-label={`Included, line ${index + 1}`}
                    value={line}
                    maxLength={120}
                    onChange={(e) => setIncluded((list) => list.map((l, i) => (i === index ? e.target.value : l)))}
                    className={INPUT}
                  />
                  <button
                    type="button"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() => setIncluded((list) => list.filter((_, i) => i !== index))}
                    className="grid h-10 w-10 flex-none place-items-center rounded-lg text-app-secondary hover:bg-surface-raised"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              {included.length < 6 ? (
                <button type="button" onClick={() => setIncluded((list) => [...list, ''])} className={SMALL_BUTTON}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add a line
                </button>
              ) : null}
            </fieldset>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                role="switch"
                checked={outsideOnly}
                disabled={!editable('outside_only')}
                onChange={(e) => setOutsideOnly(e.target.checked)}
                className="h-5 w-5 flex-none accent-violet-600"
              />
              <span className="text-[0.9375rem] text-app">Outside only (households don&apos;t need to be home)</span>
            </label>
          </Section>

          <Section
            n={2}
            id="cd-form-s2"
            title="Where and when"
            intro="Only homes inside your reach can book. You can't move the date later except by proposing new dates."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cd-street" className={LABEL}>
                  Street or area name
                </label>
                <input id="cd-street" value={street} maxLength={80} disabled={!editable('street_label')} onChange={(e) => setStreet(e.target.value)} placeholder="Maple Lane" className={INPUT} />
                <span className={HINT}>Households see &ldquo;{`${dayTitle} on ${street.trim() || 'your street'}`}&rdquo;.</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span id={centerLabelId} className={LABEL}>
                  Center of the area
                </span>
                {editable('center') ? (
                  <AddressAutocomplete
                    labelId={centerLabelId}
                    value={centerText}
                    placeholder="An address near the middle"
                    onChange={(value) => {
                      setCenterText(value);
                      setCenter(null);
                    }}
                    onSelectNormalized={(n) => {
                      setCenterText(n.address);
                      if (typeof n.latitude === 'number' && typeof n.longitude === 'number') {
                        setCenter({ latitude: n.latitude, longitude: n.longitude, city: n.city, state: n.state });
                        if (!street.trim()) setStreet(n.address.replace(/^\s*\d+[A-Za-z]?\s+/, '').split(',')[0].trim());
                      }
                    }}
                  />
                ) : (
                  <input aria-labelledby={centerLabelId} value={centerText} disabled className={INPUT} />
                )}
                <span className={`flex items-center gap-1.5 ${HINT}`}>
                  <Lock className="h-3.5 w-3.5 flex-none" aria-hidden="true" /> Never shown to households.
                </span>
              </div>
            </div>
            <fieldset className="flex min-w-0 flex-col gap-2" disabled={!editable('radius_m')}>
              <legend className={LABEL}>Reach</legend>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="flex flex-col divide-y divide-app overflow-hidden rounded-xl border border-app">
                  {REACH.map((r) => (
                    <label key={r.meters} className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-raised">
                      <input type="radio" name="cd-reach" checked={radius === r.meters} onChange={() => setRadius(r.meters)} className="h-5 w-5 flex-none accent-violet-600" />
                      <span className="flex flex-col">
                        <span className="text-[0.9375rem] font-medium text-app">{r.label}</span>
                        <span className={HINT}>{r.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="relative hidden overflow-hidden rounded-xl sm:block" aria-hidden="true">
                  <StreetMiniMap street={street.trim() || 'Your street'} className="h-full min-h-[9rem]" />
                  <i
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-violet-500/70 bg-violet-500/10"
                    style={{ width: `${radius === 150 ? 40 : radius === 400 ? 70 : 100}%`, aspectRatio: '1 / 1' }}
                  />
                </div>
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cd-date" className={LABEL}>
                  Date
                </label>
                <input
                  id="cd-date"
                  type="date"
                  value={date}
                  min={dayFromToday(1)}
                  max={dayFromToday(182)}
                  disabled={!editable('service_date')}
                  onChange={(e) => setDate(e.target.value)}
                  className={INPUT}
                />
                <span className={HINT}>{date ? formatCrewDate(date, 'long') : 'From tomorrow, up to six months out.'}</span>
              </div>
              <fieldset className="flex min-w-0 flex-col gap-1.5" disabled={!editable('window_start')}>
                <legend className={LABEL}>Arrival window</legend>
                <div className="flex items-center gap-2">
                  <select aria-label="Window starts" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className={INPUT}>
                    {CLOCK_TIMES.map((t) => (
                      <option key={t} value={t}>
                        {clockLabel(t)}
                      </option>
                    ))}
                  </select>
                  <span aria-hidden="true" className="text-app-secondary">
                    –
                  </span>
                  <select aria-label="Window ends" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className={INPUT}>
                    {CLOCK_TIMES.map((t) => (
                      <option key={t} value={t}>
                        {clockLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <span className={HINT}>Households see &ldquo;Arriving {formatWindow(windowStart, windowEnd)}&rdquo;.</span>
              </fieldset>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cd-capacity" className={LABEL}>
                  How many homes you can take
                </label>
                <input id="cd-capacity" type="number" min={1} max={60} value={capacity} disabled={!editable('capacity')} onChange={(e) => setCapacity(e.target.value)} className={INPUT} />
                <span className={HINT}>
                  1 to 60{existing && open ? `. ${existing.booked_count} booked so far.` : ''}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cd-closes" className={LABEL}>
                  Booking closes
                </label>
                <input
                  id="cd-closes"
                  type="datetime-local"
                  value={closes}
                  disabled={!editable('booking_closes_at')}
                  onChange={(e) => {
                    setCloses(e.target.value);
                    setClosesTouched(true);
                  }}
                  className={INPUT}
                />
                <span className={HINT}>48 hours before the window starts, unless you change it.</span>
              </div>
            </div>
          </Section>

          <Section n={3} id="cd-form-s3" title="Prices" intro="Each home pays its own price. It never changes with how many neighbors book.">
            <fieldset className="flex min-w-0 flex-col gap-2" disabled={!editable('price_options')}>
              <legend className={LABEL}>Options</legend>
              {options.map((o, index) => (
                <div key={o.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-app p-2">
                  <input
                    aria-label={`Option ${index + 1} name`}
                    value={o.label}
                    maxLength={60}
                    placeholder="Two stories"
                    onChange={(e) => setOptions((list) => list.map((x) => (x.key === o.key ? { ...x, label: e.target.value } : x)))}
                    className={`${INPUT} min-w-[min(12rem,100%)] flex-1`}
                  />
                  <span className="flex items-center gap-1">
                    <span aria-hidden="true" className="text-app-secondary">
                      $
                    </span>
                    <input
                      aria-label={o.needsLook ? `Option ${index + 1} price, set after a look` : `Option ${index + 1} price`}
                      inputMode="decimal"
                      value={o.needsLook ? '' : o.price}
                      disabled={o.needsLook}
                      placeholder={o.needsLook ? 'After a look' : '180'}
                      onChange={(e) => setOptions((list) => list.map((x) => (x.key === o.key ? { ...x, price: e.target.value } : x)))}
                      className={`${INPUT} w-28`}
                    />
                  </span>
                  <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-app-strong">
                    <input
                      type="checkbox"
                      checked={o.needsLook}
                      onChange={(e) => setOptions((list) => list.map((x) => (x.key === o.key ? { ...x, needsLook: e.target.checked } : x)))}
                      className="h-4 w-4 accent-violet-600"
                    />
                    I confirm this one after a look
                  </label>
                  {options.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove option ${index + 1}`}
                      onClick={() => setOptions((list) => list.filter((x) => x.key !== o.key))}
                      className="ml-auto grid h-10 w-10 flex-none place-items-center rounded-lg text-app-secondary hover:bg-surface-raised"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ))}
              {options.length < 6 ? (
                <button type="button" onClick={() => setOptions((list) => [...list, { key: rowKey(), label: '', price: '', needsLook: false }])} className={SMALL_BUTTON}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add an option
                </button>
              ) : null}
            </fieldset>
            <fieldset className="flex min-w-0 flex-col gap-2" disabled={!editable('add_ons')}>
              <legend className={LABEL}>Add-ons</legend>
              {addOns.map((a, index) => (
                <div key={a.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-app p-2">
                  <input
                    aria-label={`Add-on ${index + 1} name`}
                    value={a.label}
                    maxLength={60}
                    placeholder="Clean the gutter guards"
                    onChange={(e) => setAddOns((list) => list.map((x) => (x.key === a.key ? { ...x, label: e.target.value } : x)))}
                    className={`${INPUT} min-w-[min(12rem,100%)] flex-1`}
                  />
                  <span className="flex items-center gap-1">
                    <span aria-hidden="true" className="text-app-secondary">
                      +$
                    </span>
                    <input
                      aria-label={`Add-on ${index + 1} price`}
                      inputMode="decimal"
                      value={a.price}
                      placeholder="30"
                      onChange={(e) => setAddOns((list) => list.map((x) => (x.key === a.key ? { ...x, price: e.target.value } : x)))}
                      className={`${INPUT} w-28`}
                    />
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove add-on ${index + 1}`}
                    onClick={() => setAddOns((list) => list.filter((x) => x.key !== a.key))}
                    className="ml-auto grid h-10 w-10 flex-none place-items-center rounded-lg text-app-secondary hover:bg-surface-raised"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              {addOns.length < 4 ? (
                <button type="button" onClick={() => setAddOns((list) => [...list, { key: rowKey(), label: '', price: '' }])} className={SMALL_BUTTON}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add an add-on
                </button>
              ) : null}
            </fieldset>
            <p className={HINT}>Prices include any sales tax you owe. Households see one total.</p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cd-prep" className={LABEL}>
                Note for households
              </label>
              <textarea
                id="cd-prep"
                rows={2}
                maxLength={500}
                value={prepNote}
                disabled={!editable('prep_note')}
                onChange={(e) => setPrepNote(e.target.value)}
                placeholder="Please keep the side gate unlocked and pets inside."
                className={INPUT}
              />
              <span className={HINT}>Households see this once they book, and again the evening before.</span>
            </div>
            <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
              Pantopus keeps {rate}% of each charge{founding ? ' (founding business)' : ''}. Money reaches your bank 48 hours after each charge.
            </p>
          </Section>

          <Section
            n={4}
            id="cd-form-s4"
            title={canSend ? 'Review and send' : 'Save your changes'}
            intro={
              canSend
                ? 'Pantopus checks the day and your price list. Once approved, the invitation link works and you can share it.'
                : 'Households who already booked keep their prices.'
            }
          >
            {error ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                <CircleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                {error}
              </p>
            ) : null}
            {sent ? (
              <p role="status" className="text-sm text-app-strong">
                Waiting for Pantopus. We&apos;ll tell you within a business day.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={!!saving}
                  className="inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-5 text-[0.9375rem] font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {saving === 'send' ? 'Sending…' : saving === 'save' ? 'Saving…' : canSend ? 'Send to Pantopus for approval' : 'Save changes'}
                </button>
                {canSend ? (
                  <button
                    type="button"
                    disabled={!!saving}
                    onClick={() => void save('draft')}
                    className="inline-flex min-h-11 items-center rounded-xl border border-app-strong px-5 text-[0.9375rem] font-semibold text-app-strong hover:bg-surface-raised disabled:opacity-50"
                  >
                    {saving === 'draft' ? 'Saving…' : 'Save draft'}
                  </button>
                ) : null}
              </div>
            )}
          </Section>
        </div>

        <aside aria-labelledby="cd-form-preview" className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-20 lg:self-start">
          <h2 id="cd-form-preview" className="text-xs font-semibold uppercase tracking-[0.07em] text-app-secondary">
            What households see
          </h2>
          <div className="overflow-hidden rounded-[1.25rem] border border-app-border bg-app-surface text-app-text shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <StreetMiniMap street={street.trim() || 'Your street'} className="h-[7.5rem]" />
            <div className="flex flex-col gap-2 p-4">
              <ServiceTag service={service} />
              <p className="text-lg font-semibold leading-6 tracking-[-0.012em]">{title}</p>
              <p className="text-sm leading-5 text-app-text-strong [font-variant-numeric:tabular-nums]">
                {[date ? formatCrewDate(date, 'long') : 'Pick a date', `Arriving ${formatWindow(windowStart, windowEnd)}`].join(' · ')}
              </p>
              <p className="text-sm leading-5 text-app-text-strong">
                {fromCents != null ? (
                  <>
                    <span className="font-semibold text-app-text">From {formatPrice(fromCents)}</span> a home, including tax
                  </>
                ) : (
                  "The crew confirms each home's price after a look"
                )}
              </p>
              <CrewRow crew={crew} />
              <p className="text-sm leading-5 text-app-text-secondary">{bookedLine(existing?.booked_count ?? 0, capacityNumber - (existing?.booked_count ?? 0), capacityNumber)}</p>
            </div>
            {previewIncluded.length || outsideOnly ? (
              <div className="flex flex-col gap-2 border-t border-app-border p-4">
                {previewIncluded.map((line) => (
                  <p key={line} className="text-sm leading-5 text-app-text-strong">
                    {line}
                  </p>
                ))}
                {outsideOnly ? <OutsideOnlyLine /> : null}
              </div>
            ) : null}
          </div>
          <p className="text-[0.8125rem] text-app-secondary">Counts only: neighbors never see which homes booked.</p>
        </aside>
      </form>
    </div>
  );
}
