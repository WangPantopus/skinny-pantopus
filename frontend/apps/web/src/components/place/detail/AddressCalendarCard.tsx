// ============================================================
// Address calendar — what recurs at THIS address (Wedge Phase 2, D6).
//
// The next two weeks as a dated list (garbage, recycling, tax dates,
// council, hearings…), plus the one control that makes it the
// household's own: the pickup-day picker. Seeded city defaults say so
// ("unverified") until the household sets its day or the city confirms.
// ============================================================

'use client';

import { useState } from 'react';
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
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<PickupWeekday | null>(null);
  const [picking, setPicking] = useState(data.needs_pickup_day);

  const upcoming = data.upcoming ?? [];

  const choose = async (weekday: PickupWeekday) => {
    if (!homeId) return;
    setSaving(weekday);
    try {
      await api.setPickupDay(homeId, { weekday });
      toast.success(`Pickup day set to ${WEEKDAYS.find((w) => w.id === weekday)?.label}. Reminders start the night before.`);
      setPicking(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.placeIntelligence(homeId) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your pickup day.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-text-secondary">Next {data.window_days} days at this address</span>
        {homeId ? (
          <button type="button" onClick={() => setPicking((p) => !p)} className="text-[12.5px] font-semibold text-primary-600 hover:text-primary-700">
            {picking ? 'Done' : 'Pickup day'}
          </button>
        ) : null}
      </div>

      {picking ? (
        <div className="mt-2 mb-3 rounded-xl bg-app-surface-sunken p-3">
          <p className="text-[13px] text-app-text-strong leading-[18px] mb-2">
            {data.needs_pickup_day
              ? 'Which day do your bins go out? This replaces the city default for your home.'
              : 'Change your pickup day.'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w) => (
              <button
                key={w.id}
                type="button"
                disabled={saving !== null}
                onClick={() => choose(w.id)}
                className="px-3 py-1.5 rounded-lg border border-app-border bg-app-surface text-[13px] font-semibold text-app-text hover:border-primary-500 disabled:opacity-60"
              >
                {saving === w.id ? '…' : w.label}
              </button>
            ))}
          </div>
          <p className="text-[11.5px] text-app-text-muted mt-2">Recycling is assumed every other week on the same day. You can change this any time.</p>
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
