// W10 Home calendar & RSVP — pure helpers (no React) shared by the home
// scheduling screens. Category accents mirror the design's CAT map but are
// keyed by the real HomeCalendarEvent.event_type enum so they round-trip.

import type { HomeCalendarUnionEvent, RsvpStatus } from "@pantopus/types";

// ─── Members ──────────────────────────────────────────────────
export interface HomeMember {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  /** Deterministic CSS gradient used by the avatar fallback. */
  gradient: string;
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #34d399, #16a34a)",
  "linear-gradient(135deg, #60a5fa, #2563eb)",
  "linear-gradient(135deg, #f472b6, #db2777)",
  "linear-gradient(135deg, #fbbf24, #d97706)",
  "linear-gradient(135deg, #c084fc, #7c3aed)",
  "linear-gradient(135deg, #22d3ee, #0891b2)",
  "linear-gradient(135deg, #fb7185, #e11d48)",
  "linear-gradient(135deg, #a3e635, #65a30d)",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function initialsFor(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function gradientFor(seed: string): string {
  return AVATAR_GRADIENTS[hashString(seed) % AVATAR_GRADIENTS.length];
}

export function toMember(u: {
  id: string;
  name?: string | null;
  username?: string | null;
  profile_picture_url?: string | null;
}): HomeMember {
  const name = u.name || u.username || "Member";
  return {
    id: u.id,
    name,
    initials: initialsFor(name),
    avatarUrl: u.profile_picture_url ?? null,
    gradient: gradientFor(u.id),
  };
}

/** Resolve a list of user ids to members, preserving order; unknown ids get a stub. */
export function resolveMembers(
  ids: string[] | null | undefined,
  byId: Map<string, HomeMember>,
): HomeMember[] {
  if (!ids) return [];
  return ids.map(
    (id) =>
      byId.get(id) ?? {
        id,
        name: "Member",
        initials: "··",
        avatarUrl: null,
        gradient: gradientFor(id),
      },
  );
}

// ─── Event categories (keyed by event_type enum) ──────────────
export interface EventCategoryMeta {
  value: string;
  label: string;
  /** Category accent (dot + chip), domain data — not theme chrome. */
  color: string;
}

export const EVENT_CATEGORIES: Record<string, EventCategoryMeta> = {
  appointment: { value: "appointment", label: "Appointment", color: "#e11d48" },
  chore: { value: "chore", label: "Chore", color: "#f97316" },
  house: { value: "house", label: "House", color: "#d97706" },
  guest: { value: "guest", label: "Guest", color: "#7c3aed" },
  maintenance: { value: "maintenance", label: "Maintenance", color: "#2563eb" },
  vendor: { value: "vendor", label: "Visit", color: "#0d9488" },
  trash_recycling: {
    value: "trash_recycling",
    label: "Trash & recycling",
    color: "#65a30d",
  },
  resource_booking: {
    value: "resource_booking",
    label: "Resource",
    color: "#0891b2",
  },
  other: { value: "other", label: "Other", color: "#6b7280" },
};

const FALLBACK_CATEGORY: EventCategoryMeta = EVENT_CATEGORIES.other;

export function categoryFor(
  eventType: string | null | undefined,
): EventCategoryMeta {
  if (!eventType) return FALLBACK_CATEGORY;
  return EVENT_CATEGORIES[eventType] ?? FALLBACK_CATEGORY;
}

/** Categories offered in the add/edit picker (curated, persistable enum values). */
export const PICKABLE_CATEGORIES: EventCategoryMeta[] = [
  EVENT_CATEGORIES.appointment,
  EVENT_CATEGORIES.chore,
  EVENT_CATEGORIES.house,
  EVENT_CATEGORIES.guest,
  EVENT_CATEGORIES.maintenance,
  EVENT_CATEGORIES.vendor,
  EVENT_CATEGORIES.trash_recycling,
  EVENT_CATEGORIES.other,
];

// ─── Date / time formatting (render local, store/compare UTC) ──
export function parseDate(iso: string): Date {
  return new Date(iso);
}

export interface TimeParts {
  time: string;
  ampm: string;
}

export function formatTimeParts(iso: string): TimeParts {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const time = m === 0 ? `${h}:00` : `${h}:${String(m).padStart(2, "0")}`;
  return { time, ampm };
}

export function formatTime(iso: string): string {
  const p = formatTimeParts(iso);
  return `${p.time} ${p.ampm}`;
}

/** Local YYYY-MM-DD key for day grouping. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Today · Mon Jun 16" / "Tomorrow · Tue Jun 17" / "Wed Jun 18". */
export function formatDayHeading(date: Date, today: Date): string {
  const base = `${WEEKDAY_SHORT[date.getDay()]} ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
  const dk = dayKey(date);
  if (dk === dayKey(today)) return `Today · ${base}`;
  if (dk === dayKey(addDays(today, 1))) return `Tomorrow · ${base}`;
  return base;
}

export function formatLongDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY_SHORT[d.getDay()]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()} · ${formatTime(iso)}`;
}

/** The 7 days (Sun→Sat) of the week containing `anchor`. */
export interface StripDay {
  date: Date;
  weekday: string;
  dayNum: number;
}
export function weekStrip(anchor: Date): StripDay[] {
  const start = addDays(startOfDay(anchor), -anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return {
      date,
      weekday: WEEKDAY_SHORT[date.getDay()][0],
      dayNum: date.getDate(),
    };
  });
}

export function monthLabel(d: Date): string {
  return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Day-grouping of the union ────────────────────────────────
export interface DayGroup {
  key: string;
  date: Date;
  heading: string;
  events: HomeCalendarUnionEvent[];
}

export function groupByDay(
  events: HomeCalendarUnionEvent[],
  today: Date,
): DayGroup[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
  const map = new Map<string, DayGroup>();
  for (const ev of sorted) {
    const d = new Date(ev.start_at);
    const k = dayKey(d);
    let g = map.get(k);
    if (!g) {
      g = {
        key: k,
        date: startOfDay(d),
        heading: formatDayHeading(d, today),
        events: [],
      };
      map.set(k, g);
    }
    g.events.push(ev);
  }
  return Array.from(map.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
}

// ─── Recurrence (simple RRULE subset) ─────────────────────────
export type RepeatOption = "No" | "Daily" | "Weekly" | "Monthly";
export const REPEAT_OPTIONS: RepeatOption[] = [
  "No",
  "Daily",
  "Weekly",
  "Monthly",
];

export function repeatToRule(opt: RepeatOption): string | null {
  switch (opt) {
    case "Daily":
      return "FREQ=DAILY";
    case "Weekly":
      return "FREQ=WEEKLY";
    case "Monthly":
      return "FREQ=MONTHLY";
    default:
      return null;
  }
}

export function ruleToRepeat(rule: string | null | undefined): RepeatOption {
  if (!rule) return "No";
  if (/FREQ=DAILY/i.test(rule)) return "Daily";
  if (/FREQ=WEEKLY/i.test(rule)) return "Weekly";
  if (/FREQ=MONTHLY/i.test(rule)) return "Monthly";
  return "No";
}

export function recurrenceLabel(rule: string | null | undefined): string {
  switch (ruleToRepeat(rule)) {
    case "Daily":
      return "Every day";
    case "Weekly":
      return "Every week";
    case "Monthly":
      return "Every month";
    default:
      return "Does not repeat";
  }
}

// ─── Reminders (minutes-before) ───────────────────────────────
export interface ReminderOption {
  label: string;
  minutes: number;
}
export const REMINDER_OPTIONS: ReminderOption[] = [
  { label: "At time", minutes: 0 },
  { label: "10 min", minutes: 10 },
  { label: "1 hour", minutes: 60 },
  { label: "1 day", minutes: 1440 },
];

/** Normalise the jsonb `reminders` array into a set of minute values. */
export function remindersToMinutes(reminders: unknown[] | undefined): number[] {
  if (!Array.isArray(reminders)) return [];
  const out: number[] = [];
  for (const r of reminders) {
    if (typeof r === "number") out.push(r);
    else if (r && typeof r === "object" && "minutes" in r) {
      const m = (r as { minutes?: unknown }).minutes;
      if (typeof m === "number") out.push(m);
    }
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

export function minutesLabel(min: number): string {
  if (min === 0) return "At time";
  if (min < 60) return `${min} min before`;
  if (min === 60) return "1 hour before";
  if (min < 1440) return `${Math.round(min / 60)} hours before`;
  if (min === 1440) return "1 day before";
  return `${Math.round(min / 1440)} days before`;
}

// ─── datetime-local <-> ISO ───────────────────────────────────
/** Value for <input type="datetime-local"> from an ISO string (local tz). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ─── RSVP display ─────────────────────────────────────────────
export interface RsvpMeta {
  label: string;
  /** Tailwind classes for the pill. */
  cls: string;
  /** Lucide icon name for the pill glyph (design: 11×11). */
  icon: "check" | "help-circle" | "x" | "minus";
  /** Tailwind classes for the recorded-state icon halo (bg + text). */
  recordedHalo: string;
  /** Lucide icon for the recorded-state circle. */
  recordedIcon: "check" | "help-circle" | "x" | "minus";
  /** Recorded-state title text (cross-platform canonical). */
  recordedTitle: string;
}
export const RSVP_META: Record<RsvpStatus, RsvpMeta> = {
  going: {
    label: "Going",
    cls: "bg-app-success-bg text-app-success",
    icon: "check",
    recordedHalo: "bg-app-success-bg text-app-success",
    recordedIcon: "check",
    recordedTitle: "You're going",
  },
  maybe: {
    label: "Maybe",
    cls: "bg-app-warning-bg text-app-warning",
    icon: "help-circle",
    recordedHalo: "bg-app-warning-bg text-app-warning",
    recordedIcon: "help-circle",
    recordedTitle: "You might go",
  },
  declined: {
    label: "Can't",
    cls: "bg-app-error-bg text-app-error",
    icon: "x",
    recordedHalo: "bg-app-error-bg text-app-error",
    recordedIcon: "x",
    recordedTitle: "You can't make it",
  },
  pending: {
    label: "No reply",
    cls: "bg-app-surface-muted text-app-text-muted",
    icon: "minus",
    recordedHalo: "bg-app-surface-sunken text-app-text-muted",
    recordedIcon: "minus",
    recordedTitle: "No reply yet",
  },
};
