// Pure helpers + data for the A4 notification matrix. The /notification-preferences
// object is flexible (service-defined); these read/write the keys W1 owns while
// round-tripping every unknown key untouched. No React — unit-testable.

export type Prefs = Record<string, unknown>;
export type Channels = { push: boolean; email: boolean };
export type Group = "host" | "attendee";

export interface RowDef {
  key: string;
  label: string;
  sub?: string;
  def: Channels;
  lockedEmail?: boolean;
}

export const NOTIFY_ME: RowDef[] = [
  {
    key: "new_booking",
    label: "New booking",
    sub: "We’ll tell you the moment someone books.",
    def: { push: true, email: true },
  },
  {
    key: "cancellation",
    label: "Cancellation",
    def: { push: true, email: true },
  },
  { key: "reschedule", label: "Reschedule", def: { push: true, email: true } },
  {
    key: "reminder_sent",
    label: "Reminder sent",
    sub: "When your reminder goes out",
    def: { push: true, email: false },
  },
  {
    key: "no_show",
    label: "No-show",
    sub: "Attendee missed the booking",
    def: { push: true, email: false },
  },
  {
    key: "daily_agenda",
    label: "Daily agenda",
    sub: "Each morning at 8am",
    def: { push: false, email: true },
  },
];

export const NOTIFY_ATTENDEES: RowDef[] = [
  {
    key: "booking_confirmation",
    label: "Booking confirmation",
    sub: "Sent the moment they book",
    def: { push: false, email: true },
    lockedEmail: true,
  },
  {
    key: "reminder",
    label: "Reminder",
    sub: "Before the booking starts",
    def: { push: false, email: true },
  },
  {
    key: "reschedule_notice",
    label: "Reschedule notice",
    def: { push: false, email: true },
  },
  {
    key: "cancellation_notice",
    label: "Cancellation notice",
    def: { push: false, email: true },
  },
];

export const REMINDER_PRESETS = [10080, 1440, 120, 60, 30, 15]; // 1 week → 15 min
export const DEFAULT_REMINDERS = [1440, 60];

export function readGroup(prefs: Prefs): Record<string, unknown> {
  const v = prefs.scheduling;
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export function readChannels(
  prefs: Prefs,
  group: Group,
  key: string,
  def: Channels,
): Channels {
  const sched = readGroup(prefs);
  const g = sched[group];
  const entry =
    g && typeof g === "object"
      ? (g as Record<string, unknown>)[key]
      : undefined;
  if (entry && typeof entry === "object") {
    const e = entry as Record<string, unknown>;
    return {
      push: typeof e.push === "boolean" ? e.push : def.push,
      email: typeof e.email === "boolean" ? e.email : def.email,
    };
  }
  return { ...def };
}

export function writeChannels(
  prefs: Prefs,
  group: Group,
  key: string,
  channels: Channels,
): Prefs {
  const sched = readGroup(prefs);
  const g = (
    sched[group] && typeof sched[group] === "object" ? sched[group] : {}
  ) as Record<string, unknown>;
  return {
    ...prefs,
    scheduling: { ...sched, [group]: { ...g, [key]: channels } },
  };
}

export function readReminders(prefs: Prefs): number[] {
  const sched = readGroup(prefs);
  const r = sched.reminder_minutes;
  if (Array.isArray(r))
    return r.filter((n): n is number => typeof n === "number");
  return DEFAULT_REMINDERS;
}

export function writeReminders(prefs: Prefs, minutes: number[]): Prefs {
  const sched = readGroup(prefs);
  return {
    ...prefs,
    scheduling: {
      ...sched,
      reminder_minutes: [...minutes].sort((a, b) => b - a),
    },
  };
}
