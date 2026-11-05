// Crew Day (launch cut #13): a local crew's street day that each household books and pays for on its own.
// The shapes the web reads (docs/product/crew-day-build/02-contract.md) and the way its screens write dates,
// times and money: times in the Crew Day's own time zone ("9 AM–1 PM", "Tue, Nov 17"), whole-dollar prices
// ("$180") and receipts with cents ("$180.00").

import type { CrewDayAvailability, CrewDayService, PublicCrewDay } from '@pantopus/types';

export type {
  CrewDayAddOn,
  CrewDayAvailability,
  CrewDayCrew,
  CrewDayPriceOption,
  CrewDayService,
  CrewDayViewer,
  PublicCrewDay,
} from '@pantopus/types';

const INVITATION_STATES: ReadonlyArray<CrewDayAvailability> = ['open', 'full', 'closed', 'cancelled', 'done'];

function isInvitationState(value: unknown): value is CrewDayAvailability {
  return typeof value === 'string' && (INVITATION_STATES as ReadonlyArray<string>).includes(value);
}

/**
 * The public read as the web uses it. The contract's draft listed `state` twice (the US state and the invitation's
 * state); CDSRV keeps `state` = "WA" and names the other `availability` (QUESTIONS.md, 2026-11-05). A `state` that is
 * an invitation state still reads as the invitation's, with no US state.
 */
export function toPublicCrewDay(raw: Record<string, unknown>): PublicCrewDay {
  const day = raw as unknown as PublicCrewDay & { state?: string | null };
  const stateIsAvailability = isInvitationState(day.state);
  const availability = isInvitationState(day.availability)
    ? day.availability
    : stateIsAvailability
      ? (day.state as CrewDayAvailability)
      : 'open';
  return {
    ...day,
    state: stateIsAvailability ? null : (day.state ?? null),
    availability,
    included: Array.isArray(day.included) ? day.included : [],
    price_options: Array.isArray(day.price_options) ? day.price_options : [],
    add_ons: Array.isArray(day.add_ons) ? day.add_ons : [],
  };
}

export const CREW_DAY_SERVICE_LABEL: Record<CrewDayService, string> = {
  gutter_cleaning: 'Gutter cleaning',
  leaf_cleanup: 'Leaf cleanup',
  roof_moss: 'Roof moss',
  holiday_lights: 'Holiday lights',
  window_washing: 'Window washing',
  pressure_washing: 'Pressure washing',
  other: 'Home service',
};

export function crewDayServiceLabel(service: string): string {
  return CREW_DAY_SERVICE_LABEL[service as CrewDayService] ?? CREW_DAY_SERVICE_LABEL.other;
}

const DEFAULT_TIME_ZONE = 'America/Los_Angeles';

/** A local calendar date (YYYY-MM-DD) as noon UTC, so formatting it in UTC never moves it a day. */
function calendarDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

/** "Tue, Nov 17", or "Tuesday, Nov 17" with the long weekday. */
export function formatCrewDate(date: string, weekday: 'short' | 'long' = 'short'): string {
  const day = calendarDate(date);
  if (!day) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday, month: 'short', day: 'numeric' }).format(day);
}

type Clock = { hour: number; minute: number };

function parseClock(value: string): Clock | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || '');
  if (!match) return null;
  return { hour: Number(match[1]) % 24, minute: Number(match[2]) };
}

function clockText({ hour, minute }: Clock, withPeriod = true): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  const time = minute === 0 ? `${twelve}` : `${twelve}:${String(minute).padStart(2, '0')}`;
  return withPeriod ? `${time} ${hour < 12 ? 'AM' : 'PM'}` : time;
}

/** Two clock times as a range: "9 AM–1 PM", or "10–11 AM" when both are in the same half of the day. */
function rangeText(start: Clock, end: Clock): string {
  const samePeriod = start.hour < 12 === end.hour < 12;
  return `${clockText(start, !samePeriod)}–${clockText(end)}`;
}

/** The arrival window from its local times ("09:00", "13:00:00"): "9 AM–1 PM". */
export function formatWindow(start: string, end: string): string {
  const from = parseClock(start);
  const to = parseClock(end);
  if (!from || !to) return '';
  return rangeText(from, to);
}

function zonedParts(iso: string, timeZone: string): { date: string; clock: Clock } | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    clock: { hour: Number(part('hour')) % 24, minute: Number(part('minute')) },
  };
}

/** An instant's date in the Crew Day's time zone: "Sun, Nov 15" (or "Sunday, Nov 15"). */
export function formatInstantDate(iso: string, timeZone: string, weekday: 'short' | 'long' = 'short'): string {
  const parts = zonedParts(iso, timeZone);
  return parts ? formatCrewDate(parts.date, weekday) : '';
}

/** An instant's clock time in the Crew Day's time zone: "9 AM", "11:42 AM". */
export function formatInstantTime(iso: string, timeZone: string): string {
  const parts = zonedParts(iso, timeZone);
  return parts ? clockText(parts.clock) : '';
}

/** Two instants as a time range in the Crew Day's time zone: "10–11 AM". */
export function formatInstantRange(startIso: string, endIso: string, timeZone: string): string {
  const start = zonedParts(startIso, timeZone);
  const end = zonedParts(endIso, timeZone);
  if (!start || !end) return '';
  return rangeText(start.clock, end.clock);
}

/** A price as people read it: "$180", with cents only when there are some ("$180.50"). */
export function formatPrice(cents: number): string {
  const dollars = Math.round(cents) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/** A receipt amount, always with cents: "$180.00". */
export function formatReceipt(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(
    Math.round(cents) / 100,
  );
}

/**
 * The crew's included items to list. A crew that also wrote "Outside only" as an item gets it once: the screens
 * say "Outside only. You don't need to be home." on their own line when the day is outside only.
 */
export function includedItems(day: Pick<PublicCrewDay, 'included' | 'outside_only'>): string[] {
  return day.outside_only ? day.included.filter((item) => !/^\s*outside only\.?\s*$/i.test(item)) : day.included;
}

/** "6 homes booked · room for 4 more". Counts only, never which homes. */
export function bookedLine(booked: number, spotsLeft: number, capacity: number): string {
  if (booked <= 0) return `Room for ${capacity} ${capacity === 1 ? 'home' : 'homes'}`;
  const homes = `${booked} ${booked === 1 ? 'home' : 'homes'} booked`;
  return spotsLeft > 0 ? `${homes} · room for ${spotsLeft} more` : homes;
}

/** "Maple Lane in Camas", or the street alone when the day has no city. */
export function streetInCity(day: Pick<PublicCrewDay, 'street_label' | 'city'>): string {
  return day.city ? `${day.street_label} in ${day.city}` : day.street_label;
}
