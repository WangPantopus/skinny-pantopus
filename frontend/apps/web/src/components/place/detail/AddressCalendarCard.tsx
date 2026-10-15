// ============================================================
// Address calendar — what recurs at THIS address (Wedge Phase 2, D6).
//
// The next two weeks as a dated list (garbage, recycling, tax dates,
// council, hearings…), plus the one control that makes it the
// household's own: the pickup-day picker. Seeded city defaults say so
// ("unverified") until the household sets its day or the city confirms.
// ============================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  Trash2,
  Recycle,
  Leaf,
  Truck,
  Landmark,
  Receipt,
  Flame,
  Droplets,
  Construction,
  Gavel,
  School,
  Vote,
  Info,
} from 'lucide-react';
import * as api from '@pantopus/api';
import type { PickupWeekday } from '@pantopus/api';
import type { PlaceAddressCalendarData, PlaceCalendarEvent, PlaceCalendarKind, PickupCollection } from '@pantopus/types';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/components/ui/toast-store';
import { IconTile } from '@/components/archetypes/place';

const KIND_ICON: Record<PlaceCalendarKind, LucideIcon> = {
  garbage: Trash2,
  recycling: Recycle,
  yard_waste: Leaf,
  bulk_pickup: Truck,
  street_sweeping: Truck,
  property_tax: Receipt,
  utility_bill: Receipt,
  burn_ban: Flame,
  boil_water: Droplets,
  road_closure: Construction,
  council: Landmark,
  permit_hearing: Gavel,
  school: School,
  election_deadline: Vote,
  other: CalendarDays,
};

const WEEKDAYS: { id: PickupWeekday; label: string }[] = [
  { id: 'MO', label: 'Mon' },
  { id: 'TU', label: 'Tue' },
  { id: 'WE', label: 'Wed' },
  { id: 'TH', label: 'Thu' },
  { id: 'FR', label: 'Fri' },
  { id: 'SA', label: 'Sat' },
  { id: 'SU', label: 'Sun' },
];

const PICKUP_KINDS: PlaceCalendarKind[] = ['garbage', 'recycling', 'yard_waste', 'bulk_pickup'];

// Same wording as the apps' holiday line.
function holidayMoveLine(e: PlaceCalendarEvent): string | null {
  if (!e.moved_from || !e.holiday || !e.shift_days || e.shift_days <= 0) return null;
  return e.shift_days === 1 ? `Moved a day for ${e.holiday}.` : `Moved for ${e.holiday}.`;
}

function whenLabel(e: PlaceCalendarEvent): string {
  if (e.days_until === 0) return 'Today';
  if (e.days_until === 1) return 'Tomorrow';
  const d = new Date(`${e.date}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function EventRow({ e }: { e: PlaceCalendarEvent }) {
  const Icon = KIND_ICON[e.kind] ?? CalendarDays;
  const soon = e.days_until <= e.lead_days;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <IconTile icon={Icon} tone={soon ? 'home' : 'muted'} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14.5px] font-semibold text-app-text truncate">{e.title}</span>
          <span className={`shrink-0 text-[12.5px] font-semibold tabular-nums ${soon ? 'text-app-home' : 'text-app-text-secondary'}`}>{whenLabel(e)}</span>
        </div>
        {e.detail ? <p className="text-[12.5px] leading-[17px] text-app-text-secondary mt-0.5">{e.detail}</p> : null}
        {holidayMoveLine(e) ? <p className="text-[12.5px] leading-[17px] text-app-text-secondary mt-0.5">{holidayMoveLine(e)}</p> : null}
        <p className="text-[11.5px] leading-4 text-app-text-muted mt-1">
          {e.source ?? 'Pantopus registry'}
          {e.confidence === 'unverified' ? ' · unconfirmed, please double-check' : ''}
        </p>
      </div>
    </li>
  );
}

export interface AddressCalendarCardProps {
  homeId: string | null;
  data: PlaceAddressCalendarData;
}

export default function AddressCalendarCard({ homeId, data }: AddressCalendarCardProps) {
  return <HouseholdCalendar key={homeId ?? 'preview'} homeId={homeId} data={data} />;
}

function HouseholdCalendar({ homeId, data }: AddressCalendarCardProps) {
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState<PlaceAddressCalendarData | null>(null);
  useEffect(() => { setConfirmed(null); }, [data]);
  const calendar = confirmed ?? data;
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [picking, setPicking] = useState(data.needs_pickup_day);
  const [collections, setCollections] = useState<PickupCollection[]>(data.pickup_schedule?.collections ?? []);
  // The schedule this form started from. A save sends it back, so a change
  // saved meanwhile on another device is not silently undone.
  const [openedVersion, setOpenedVersion] = useState(data.pickup_version);
  const [error, setError] = useState<string | null>(null);

  const upcoming = calendar.upcoming ?? [];
  // A home whose pickups still need a day hears how to start them, as in the apps.
  const setupMessage = homeId && calendar.needs_pickup_day && !upcoming.some((e) => PICKUP_KINDS.includes(e.kind))
    ? 'Set your pickup day and your pickups start here.'
    : null;
  const update = (kind: PickupCollection['kind'], patch: Partial<PickupCollection>) => {
    setCollections(rows => rows.map(row => row.kind === kind ? { ...row, ...patch } : row));
  };
  const valid = collections.length > 0 && collections.every(row => row.anchor_date
    && (row.frequency !== 'weekly' || row.weekdays.length > 0));

  const save = async (reset = false) => {
    if (!homeId || busy.current || (!reset && !valid)) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = reset ? await api.clearPickupDay(homeId, openedVersion) : await api.setPickupDay(homeId, {
        collections,
        ...(openedVersion ? { expected_version: openedVersion } : {}),
      });
      setConfirmed(response.calendar);
      setCollections(response.calendar.pickup_schedule?.collections ?? []);
      setOpenedVersion(response.calendar.pickup_version);
      toast.success(reset ? 'Household pickup schedule cleared.' : 'Pickup schedule saved to your household calendar.');
      setPicking(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.placeIntelligence(homeId) });
      void queryClient.invalidateQueries({ queryKey: ['household-calendar', homeId] });
    } catch (err) {
      // Changed meanwhile: nothing was saved. Show the current schedule in the
      // form so the person can review it and try again.
      const failure = err as { statusCode?: number; data?: { calendar?: PlaceAddressCalendarData } } | null;
      if (failure?.statusCode === 409 && failure.data?.calendar) {
        const current = failure.data.calendar;
        setConfirmed(current);
        setCollections(current.pickup_schedule?.collections ?? []);
        setOpenedVersion(current.pickup_version);
        void queryClient.invalidateQueries({ queryKey: queryKeys.placeIntelligence(homeId) });
        void queryClient.invalidateQueries({ queryKey: ['household-calendar', homeId] });
      }
      setError(err instanceof Error ? err.message : 'Could not save your pickup schedule. Try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-text-secondary">Next {data.window_days} days at this address</span>
        {homeId ? (
          <button type="button" disabled={saving} onClick={() => {
            setCollections(calendar.pickup_schedule?.collections ?? []);
            setOpenedVersion(calendar.pickup_version);
            setError(null);
            setPicking((p) => !p);
          }} className="text-[12.5px] font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
            {picking ? 'Cancel' : 'Pickup schedule'}
          </button>
        ) : null}
      </div>

      {picking && homeId ? (
        <div className="mt-2 mb-3 rounded-xl bg-app-surface-sunken p-3">
          <p className="text-[13px] text-app-text-strong mb-2">Choose the collections your household uses.</p>
          {(['garbage', 'recycling', 'yard_waste', 'bulk_pickup'] as const).map(kind => {
            const row = collections.find(item => item.kind === kind);
            const label = { garbage: 'Garbage', recycling: 'Recycling', yard_waste: 'Yard waste', bulk_pickup: 'Bulk collection' }[kind];
            const pattern = row?.frequency === 'weekly' ? `weekly-${row.interval}` : row?.frequency === 'monthly' ? `monthly-${row.monthly_mode ?? 'day_of_month'}` : 'once';
            return <fieldset key={kind} className="mb-3 border-b border-app-border pb-3" disabled={saving}>
              <label className="flex gap-2 items-center text-[13px] font-semibold">
                <input type="checkbox" checked={!!row} onChange={e => setCollections(rows => e.target.checked
                  ? [...rows, { kind, frequency: 'weekly', interval: 1, weekdays: [], anchor_date: '', monthly_mode: 'day_of_month' }]
                  : rows.filter(item => item.kind !== kind))} />{label}
              </label>
              {row && <div className="mt-2 space-y-2">
                <label className="block text-[13px]">{label} repeats
                  <select aria-label={`${label} repeats`} value={pattern} onChange={e => {
                    const value = e.target.value;
                    update(kind, value.startsWith('weekly-') ? { frequency: 'weekly', interval: Number(value.slice(7)) }
                      : value.startsWith('monthly-') ? { frequency: 'monthly', interval: row.frequency === 'monthly' ? row.interval : 1, monthly_mode: value.slice(8) as PickupCollection['monthly_mode'] }
                      : { frequency: 'once', interval: 1, until_date: null });
                  }} className="mt-1 w-full rounded-lg border border-app-border bg-app-surface p-2">
                    {[1, 2, 3, 4].map(n => <option key={n} value={`weekly-${n}`}>{n === 1 ? 'Every week' : `Every ${n} weeks`}</option>)}
                    <option value="monthly-day_of_month">Monthly on this date</option>
                    <option value="monthly-weekday">Monthly on this weekday (e.g. second Tuesday)</option>
                    <option value="once">One time</option>
                  </select>
                </label>
                {row.frequency === 'monthly' && <label className="block text-[13px]">{label} month interval
                  <select aria-label={`${label} month interval`} value={row.interval} onChange={e => update(kind, { interval: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-app-border bg-app-surface p-2">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n === 1 ? 'Every month' : `Every ${n} months`}</option>)}
                  </select>
                </label>}
                {row.frequency === 'weekly' && <div className="flex flex-wrap gap-1.5" aria-label={`${label} days`}>
                  {WEEKDAYS.map(day => <button key={day.id} type="button" aria-label={`${label} ${day.label}`} aria-pressed={row.weekdays.includes(day.id)}
                    onClick={() => update(kind, { weekdays: row.weekdays.includes(day.id) ? row.weekdays.filter(d => d !== day.id) : [...row.weekdays, day.id] })}
                    className="px-3 py-1.5 rounded-lg border border-app-border bg-app-surface text-[13px]">{day.label}{row.weekdays.includes(day.id) ? ' ✓' : ''}</button>)}
                </div>}
                <label className="block text-[13px]">{row.frequency === 'once' ? `${label} collection date` : `${label} first collection date`}
                  <input aria-label={`${label} collection date`} type="date" value={row.anchor_date} onChange={e => update(kind, { anchor_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-app-border bg-app-surface p-2" />
                </label>
                {row.frequency !== 'once' && <label className="block text-[13px]">{label} end date (optional)
                  <input type="date" value={row.until_date ?? ''} min={row.anchor_date} onChange={e => update(kind, { until_date: e.target.value || null })}
                    className="mt-1 w-full rounded-lg border border-app-border bg-app-surface p-2" />
                </label>}
                {row.frequency === 'weekly' && row.interval > 1 && <p className="text-[12px] text-app-text-secondary">The start date anchors the collection week. Weeks begin Monday.</p>}
                {row.frequency === 'monthly' && <p className="text-[12px] text-app-text-secondary">The start date sets the monthly pattern. Dates absent from a month are skipped; a fifth weekday means the last weekday.</p>}
              </div>}
            </fieldset>;
          })}
          <p className="text-[11.5px] text-app-text-muted mt-2">Use collection dates, not the night you put bins out. Keep the original start date when editing an unchanged cycle. Uncheck a type to remove it. Check your provider for holiday changes.</p>
          {error ? <p role="alert" className="text-[13px] text-red-600 mt-2">{error}</p> : null}
          <div className="flex flex-wrap gap-3 mt-3">
            <button type="button" disabled={saving || !valid} onClick={() => save()} className="rounded-lg bg-primary-600 px-3 py-2 text-white text-[13px] font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Save schedule'}</button>
            {calendar.pickup_schedule ? <button type="button" disabled={saving} onClick={() => save(true)} className="text-[13px] text-app-text-secondary">Clear household schedule</button> : null}
          </div>
        </div>
      ) : null}

      {upcoming.length === 0 ? (
        <div className="flex items-start gap-2.5 py-3">
          <Info size={16} strokeWidth={2} className="shrink-0 mt-0.5 text-app-text-muted" />
          <p className="text-[13.5px] text-app-text-secondary leading-[19px]">{setupMessage ?? 'Nothing on the calendar for the next two weeks.'}</p>
        </div>
      ) : (
        <>
          {setupMessage ? <p className="text-[13.5px] text-app-text-secondary leading-[19px] py-2">{setupMessage}</p> : null}
          <ul className="divide-y divide-app-border-subtle">
            {upcoming.map((e) => (
              <EventRow key={`${e.rule_id}:${e.date}`} e={e} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
