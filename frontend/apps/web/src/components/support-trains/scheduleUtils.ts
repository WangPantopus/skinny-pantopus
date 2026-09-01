import type { GenerateSlotsPreset, GenerateSlotsRequest } from '@pantopus/types';

/** Matches backend PRESET_CONFIG — days null means every day (0=Sun … 6=Sat). */
export const PRESET_SLOT_DEFAULTS: Record<
  GenerateSlotsPreset,
  { days: number[] | null; start: string; end: string }
> = {
  every_dinner: { days: null, start: '17:00', end: '19:00' },
  mwf_dinners: { days: [1, 3, 5], start: '17:00', end: '19:00' },
  every_lunch: { days: null, start: '12:00', end: '13:30' },
  weekly_groceries: { days: [6], start: '09:00', end: '11:00' },
};

export const PRESET_CHIPS: Array<{ key: GenerateSlotsPreset; label: string }> = [
  { key: 'every_dinner', label: 'Every dinner' },
  { key: 'mwf_dinners', label: 'Mon/Wed/Fri' },
  { key: 'every_lunch', label: 'Every lunch' },
  { key: 'weekly_groceries', label: 'Weekly groceries' },
];

export const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export function snapNoon(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
}

export function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(12, 0, 0, 0);
  return dt;
}

export function weekdaysEnabledForPreset(preset: GenerateSlotsPreset): boolean[] {
  const d = PRESET_SLOT_DEFAULTS[preset].days;
  if (d === null) return Array.from({ length: 7 }, () => true);
  return Array.from({ length: 7 }, (_, i) => d.includes(i));
}

function sortedDows(enabled: boolean[]): number[] {
  return enabled.map((on, i) => (on ? i : -1)).filter((i) => i >= 0).sort((a, b) => a - b);
}

export function weekdaysOverrideForApi(
  preset: GenerateSlotsPreset,
  enabled: boolean[],
): number[] | undefined {
  const cur = sortedDows(enabled);
  if (cur.length === 0) return undefined;
  const def = PRESET_SLOT_DEFAULTS[preset].days;
  if (def === null) {
    if (cur.length === 7) return undefined;
    return cur;
  }
  const defSorted = [...def].sort((a, b) => a - b);
  if (defSorted.length === cur.length && defSorted.every((v, i) => v === cur[i])) {
    return undefined;
  }
  return cur;
}

export function normalizeGenerateSlotsPreset(raw?: string | null): GenerateSlotsPreset {
  const keys: GenerateSlotsPreset[] = ['every_dinner', 'mwf_dinners', 'every_lunch', 'weekly_groceries'];
  if (raw && keys.includes(raw as GenerateSlotsPreset)) return raw as GenerateSlotsPreset;
  return 'every_dinner';
}

export function buildSupportTrainGenerateSlotsPayload(
  preset: GenerateSlotsPreset,
  rangeStart: Date,
  rangeEnd: Date,
  weekdaysEnabled: boolean[],
  slotStart: string,
  slotEnd: string,
): GenerateSlotsRequest {
  const start = snapNoon(rangeStart);
  const end = snapNoon(rangeEnd);
  const [from, to] = end < start ? [end, start] : [start, end];
  const weekdays = weekdaysOverrideForApi(preset, weekdaysEnabled);
  const def = PRESET_SLOT_DEFAULTS[preset];
  const timeCustom = slotStart !== def.start || slotEnd !== def.end;
  return {
    preset,
    start_date: toLocalYMD(from),
    end_date: toLocalYMD(to),
    replace_existing: false,
    ...(weekdays ? { weekdays } : {}),
    ...(timeCustom ? { start_time: slotStart, end_time: slotEnd } : {}),
  };
}
