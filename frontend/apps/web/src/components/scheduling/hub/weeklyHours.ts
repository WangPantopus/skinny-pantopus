// Pure weekly-hours model + serialization for the first-run wizard (A2 step 3).
// weekday is backend ISO (0 = Sunday … 6 = Saturday); times are "HH:MM". No deps.

export interface DayHours {
  weekday: number;
  label: string;
  enabled: boolean;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export const DEFAULT_WEEK: DayHours[] = [
  { weekday: 1, label: "Monday", enabled: true, start: "09:00", end: "17:00" },
  { weekday: 2, label: "Tuesday", enabled: true, start: "09:00", end: "17:00" },
  {
    weekday: 3,
    label: "Wednesday",
    enabled: true,
    start: "09:00",
    end: "17:00",
  },
  {
    weekday: 4,
    label: "Thursday",
    enabled: true,
    start: "09:00",
    end: "17:00",
  },
  { weekday: 5, label: "Friday", enabled: true, start: "09:00", end: "17:00" },
  {
    weekday: 6,
    label: "Saturday",
    enabled: false,
    start: "09:00",
    end: "17:00",
  },
  { weekday: 0, label: "Sunday", enabled: false, start: "09:00", end: "17:00" },
];

/** Rules payload for PUT /availability/:id/rules — drops disabled / invalid days. */
export function weekToRules(
  week: DayHours[],
): { weekday: number; start_time: string; end_time: string }[] {
  return week
    .filter((d) => d.enabled && d.start < d.end)
    .map((d) => ({ weekday: d.weekday, start_time: d.start, end_time: d.end }));
}
