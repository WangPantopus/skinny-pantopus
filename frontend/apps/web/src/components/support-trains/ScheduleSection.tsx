'use client';

import { useCallback } from 'react';
import type { GenerateSlotsPreset } from '@pantopus/types';
import {
  PRESET_SLOT_DEFAULTS,
  PRESET_CHIPS,
  WEEKDAY_SHORT,
  weekdaysEnabledForPreset,
  toLocalYMD,
  fromYMD,
} from './scheduleUtils';

interface ScheduleSectionProps {
  preset: GenerateSlotsPreset;
  onPresetChange: (p: GenerateSlotsPreset) => void;
  rangeStart: Date;
  rangeEnd: Date;
  onRangeStartChange: (d: Date) => void;
  onRangeEndChange: (d: Date) => void;
  weekdaysEnabled: boolean[];
  onWeekdaysEnabledChange: (next: boolean[]) => void;
  slotStart: string;
  slotEnd: string;
  onSlotStartChange: (t: string) => void;
  onSlotEndChange: (t: string) => void;
}

export default function ScheduleSection({
  preset,
  onPresetChange,
  rangeStart,
  rangeEnd,
  onRangeStartChange,
  onRangeEndChange,
  weekdaysEnabled,
  onWeekdaysEnabledChange,
  slotStart,
  slotEnd,
  onSlotStartChange,
  onSlotEndChange,
}: ScheduleSectionProps) {
  const applyPreset = useCallback(
    (p: GenerateSlotsPreset) => {
      onPresetChange(p);
      onWeekdaysEnabledChange(weekdaysEnabledForPreset(p));
      const def = PRESET_SLOT_DEFAULTS[p];
      onSlotStartChange(def.start);
      onSlotEndChange(def.end);
    },
    [onPresetChange, onWeekdaysEnabledChange, onSlotStartChange, onSlotEndChange],
  );

  const toggleWeekday = useCallback(
    (dow: number) => {
      const next = [...weekdaysEnabled];
      next[dow] = !next[dow];
      onWeekdaysEnabledChange(next);
    },
    [weekdaysEnabled, onWeekdaysEnabledChange],
  );

  return (
    <div className="space-y-4">
      {/* Shortcuts */}
      <div>
        <FieldLabel>Shortcuts</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {PRESET_CHIPS.map((p) => {
            const active = preset === p.key;
            return (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${
                  active
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'border-app-border text-app-text-secondary hover:border-primary-400'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date range */}
      <div>
        <FieldLabel>Date range</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={toLocalYMD(rangeStart)}
            onChange={(e) => {
              if (e.target.value) onRangeStartChange(fromYMD(e.target.value));
            }}
            className="flex-1 px-3 py-2 bg-app-surface-sunken border border-app-border rounded-lg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500 [color-scheme:light] dark:[color-scheme:dark]"
          />
          <span className="text-app-text-muted text-sm">–</span>
          <input
            type="date"
            value={toLocalYMD(rangeEnd)}
            onChange={(e) => {
              if (e.target.value) onRangeEndChange(fromYMD(e.target.value));
            }}
            className="flex-1 px-3 py-2 bg-app-surface-sunken border border-app-border rounded-lg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500 [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>
      </div>

      {/* Weekdays */}
      <div>
        <FieldLabel>Repeat on *</FieldLabel>
        <div className="flex gap-1.5">
          {WEEKDAY_SHORT.map((label, dow) => {
            const on = weekdaysEnabled[dow];
            return (
              <button
                key={dow}
                onClick={() => toggleWeekday(dow)}
                className={`flex-1 aspect-square max-w-[44px] rounded-lg border text-sm font-semibold transition ${
                  on
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'bg-app-surface-sunken border-app-border text-app-text-secondary hover:border-primary-400'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slot time */}
      <div>
        <FieldLabel>Default slot time</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={slotStart}
            onChange={(e) => onSlotStartChange(e.target.value)}
            className="flex-1 px-3 py-2 bg-app-surface-sunken border border-app-border rounded-lg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500 [color-scheme:light] dark:[color-scheme:dark]"
          />
          <span className="text-app-text-muted text-sm">to</span>
          <input
            type="time"
            value={slotEnd}
            onChange={(e) => onSlotEndChange(e.target.value)}
            className="flex-1 px-3 py-2 bg-app-surface-sunken border border-app-border rounded-lg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500 [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}
