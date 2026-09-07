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
import type { PlaceAddressCalendarData, PlaceCalendarEvent, PlaceCalendarKind } from '@pantopus/types';
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
  const [weekday, setWeekday] = useState<PickupWeekday | ''>(data.pickup_schedule?.weekday ?? '');
  const [frequency, setFrequency] = useState<'not_set' | 'weekly' | 'biweekly'>(data.pickup_schedule?.recycling_frequency ?? 'not_set');
  const [nextDate, setNextDate] = useState(data.pickup_schedule?.recycling_next_date ?? '');
  const [error, setError] = useState<string | null>(null);

  const upcoming = calendar.upcoming ?? [];
  const dateOptions = Array.from({ length: frequency === 'weekly' ? 7 : 14 }, (_, offset) => {
    const date = new Date(`${calendar.today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
  }).filter(Boolean);

  const save = async (reset = false) => {
    if (!homeId || busy.current || (!reset && !weekday)) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = reset ? await api.clearPickupDay(homeId) : await api.setPickupDay(homeId, {
        weekday: weekday as PickupWeekday,
        recycling_frequency: frequency,
        ...(frequency !== 'not_set' ? { recycling_next_date: nextDate } : {}),
      });
      setConfirmed(response.calendar);
      setWeekday(response.calendar.pickup_schedule?.weekday ?? '');
      setFrequency(response.calendar.pickup_schedule?.recycling_frequency ?? 'not_set');
      setNextDate(response.calendar.pickup_schedule?.recycling_next_date ?? '');
      toast.success(reset ? 'Household pickup schedule cleared.' : 'Pickup schedule saved to your household calendar.');
      setPicking(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.placeIntelligence(homeId) });
    } catch (err) {
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
            setWeekday(calendar.pickup_schedule?.weekday ?? '');
            setFrequency(calendar.pickup_schedule?.recycling_frequency ?? 'not_set');
            setNextDate(calendar.pickup_schedule?.recycling_next_date ?? '');
            setError(null);
            setPicking((p) => !p);
          }} className="text-[12.5px] font-semibold text-primary-600 hover:text-primary-700">
            {picking ? 'Cancel' : 'Pickup schedule'}
          </button>
        ) : null}
      </div>

      {picking && homeId ? (
        <div className="mt-2 mb-3 rounded-xl bg-app-surface-sunken p-3">
          <p className="text-[13px] text-app-text-strong leading-[18px] mb-2">
            Which day is garbage collected each week?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w) => (
              <button
                key={w.id}
                type="button"
                disabled={saving}
                aria-pressed={weekday === w.id}
                onClick={() => setWeekday(w.id)}
                className="px-3 py-1.5 rounded-lg border border-app-border bg-app-surface text-[13px] font-semibold text-app-text hover:border-primary-500 disabled:opacity-60"
              >
                {w.label}{weekday === w.id ? ' ✓' : ''}
              </button>
            ))}
          </div>
          <label className="block text-[13px] text-app-text mt-3">
            Recycling
            <select value={frequency} disabled={saving} onChange={(e) => { setFrequency(e.target.value as typeof frequency); setNextDate(''); }} className="mt-1 w-full rounded-lg border border-app-border bg-app-surface p-2">
              <option value="not_set">Not sure yet — save garbage only</option>
              <option value="weekly">Every week</option>
              <option value="biweekly">Every other week</option>
            </select>
          </label>
          {frequency !== 'not_set' ? (
            <label className="block text-[13px] text-app-text mt-3">
              Next recycling pickup
              <select value={nextDate} disabled={saving} onChange={(e) => setNextDate(e.target.value)} className="mt-1 w-full rounded-lg border border-app-border bg-app-surface p-2">
                <option value="">Choose a date</option>
                {dateOptions.map((date) => <option key={date} value={date}>{new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}</option>)}
              </select>
            </label>
          ) : null}
          <p className="text-[11.5px] text-app-text-muted mt-2">Use your collection day, not the night you put bins out. Dates follow your home’s calendar. Check your provider for holiday changes.</p>
          {error ? <p role="alert" className="text-[13px] text-red-600 mt-2">{error}</p> : null}
          <div className="flex flex-wrap gap-3 mt-3">
            <button type="button" disabled={saving || !weekday || (frequency !== 'not_set' && !dateOptions.includes(nextDate))} onClick={() => save()} className="rounded-lg bg-primary-600 px-3 py-2 text-white text-[13px] font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Save schedule'}</button>
            {calendar.pickup_schedule ? <button type="button" disabled={saving} onClick={() => save(true)} className="text-[13px] text-app-text-secondary">Clear household schedule</button> : null}
          </div>
        </div>
      ) : null}

      {upcoming.length === 0 ? (
        <div className="flex items-start gap-2.5 py-3">
          <Info size={16} strokeWidth={2} className="shrink-0 mt-0.5 text-app-text-muted" />
          <p className="text-[13.5px] text-app-text-secondary leading-[19px]">Nothing on the calendar for the next two weeks.</p>
        </div>
      ) : (
        <ul className="divide-y divide-app-border-subtle">
          {upcoming.map((e) => (
            <EventRow key={`${e.rule_id}:${e.date}`} e={e} />
          ))}
        </ul>
      )}
    </div>
  );
}
