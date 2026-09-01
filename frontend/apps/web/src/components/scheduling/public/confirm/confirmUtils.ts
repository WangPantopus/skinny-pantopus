// W6 — Invitee confirm & manage. Pure helpers behind D1 (intake validation),
// D2 (price/checkout math), and the shared summary card formatting. No React /
// network here so this stays unit-testable (see tests/scheduling).
//
// NOTE ON QUESTIONS: the live public read (GET /public/book/:slug + …/slots)
// does NOT expose an event type's intake questions today — `PublicEventType`
// has no `questions` field (only the host-authed GET /event-types/:id returns
// them). D1 therefore renders questions DEFENSIVELY: if a future public payload
// adds `questions`, they render dynamically; until then the form is the base
// name / email / phone (+ optional guests). The `answers` object is still sent
// on create (the backend accepts arbitrary keys).

import type {
  EventTypeLocationMode,
  IntakeQuestionFieldType,
  PublicBookingInput,
  PublicEventType,
} from "@pantopus/types";
import type { Pillar } from "@/components/scheduling";

// ─── Intake questions (defensive public shape) ──────────────────────────────

export interface PublicIntakeQuestion {
  id?: string;
  label: string;
  field_type: IntakeQuestionFieldType;
  options?: string[];
  required?: boolean;
  sort_order?: number;
}

/** An event type that MAY carry public intake questions (forward-compatible). */
export type PublicEventTypeWithQuestions = PublicEventType & {
  questions?: PublicIntakeQuestion[];
};

/** Read + sort the (optional) public questions off an event type, safely. */
export function readQuestions(
  et: PublicEventType | PublicEventTypeWithQuestions | null | undefined,
): PublicIntakeQuestion[] {
  const raw = (et as PublicEventTypeWithQuestions | null | undefined)
    ?.questions;
  if (!Array.isArray(raw)) return [];
  return [...raw].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** Stable key for a question's answer + error map. */
export function questionKey(q: PublicIntakeQuestion, index: number): string {
  return q.id || `q${index}`;
}

// ─── Intake values + validation ─────────────────────────────────────────────

export type AnswerValue = string | string[] | boolean;

export interface IntakeValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Keyed by questionKey(q, i). */
  answers: Record<string, AnswerValue>;
  /** Optional guest emails (sent inside answers — see buildBookingInput). */
  guests: string[];
}

export function emptyIntake(): IntakeValues {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    answers: {},
    guests: [],
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function answerIsEmpty(v: AnswerValue | undefined): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return v === false; // unchecked required checkbox counts as empty
}

/**
 * Validate the intake form. Returns a `{ field: message }` map; empty = valid.
 * Field keys: firstName · lastName · email · `${questionKey}` · `guest${i}`.
 */
export function validateIntake(
  values: IntakeValues,
  questions: PublicIntakeQuestion[] = [],
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.firstName.trim()) errors.firstName = "Enter your first name";
  if (!values.lastName.trim()) errors.lastName = "Enter your last name";

  const email = values.email.trim();
  if (!email) errors.email = "Enter your email address";
  else if (!isValidEmail(email)) errors.email = "Enter a valid email address";

  // Phone is always required per design spec (intake-booking-frames.jsx:274).
  if (!values.phone.trim()) {
    errors.phone = "Enter your phone number";
  } else if (values.phone.replace(/[^\d]/g, "").length < 7) {
    errors.phone = "Enter a valid phone number";
  }

  questions.forEach((q, i) => {
    const key = questionKey(q, i);
    if (q.required && answerIsEmpty(values.answers[key])) {
      errors[key] = "This question is required";
    }
    if (q.field_type === "phone" && !answerIsEmpty(values.answers[key])) {
      const v = String(values.answers[key]);
      if (v.replace(/[^\d]/g, "").length < 7)
        errors[key] = "Enter a valid phone number";
    }
  });

  values.guests.forEach((g, i) => {
    const v = g.trim();
    if (v && !isValidEmail(v))
      errors[`guest${i}`] = "Enter a valid email address";
  });

  return errors;
}

export function isIntakeValid(
  values: IntakeValues,
  questions: PublicIntakeQuestion[] = [],
): boolean {
  return Object.keys(validateIntake(values, questions)).length === 0;
}

/** Build the POST body for createPublicBooking from the intake form. */
export function buildBookingInput(
  values: IntakeValues,
  opts: {
    startAt: string;
    durationMin?: number | null;
    timezone?: string | null;
    questions?: PublicIntakeQuestion[];
  },
): PublicBookingInput {
  const name = `${values.firstName.trim()} ${values.lastName.trim()}`.trim();
  const answers: Record<string, unknown> = {};

  (opts.questions ?? []).forEach((q, i) => {
    const v = values.answers[questionKey(q, i)];
    if (!answerIsEmpty(v)) answers[q.label || questionKey(q, i)] = v;
  });

  const guests = values.guests.map((g) => g.trim()).filter(Boolean);
  if (guests.length > 0) answers.guest_emails = guests;

  const phone = values.phone.trim();

  return {
    start_at: opts.startAt,
    duration_min: opts.durationMin ?? undefined,
    name,
    email: values.email.trim(),
    phone: phone || null,
    timezone: opts.timezone || null,
    answers,
  };
}

// ─── Money / pricing (D2) ───────────────────────────────────────────────────

export type PriceMode = "free" | "full" | "deposit";

export function priceMode(
  et: Pick<PublicEventType, "price_cents" | "deposit_cents">,
): PriceMode {
  const price = et.price_cents ?? 0;
  if (price <= 0) return "free";
  const deposit = et.deposit_cents ?? 0;
  if (deposit > 0 && deposit < price) return "deposit";
  return "full";
}

/** What the invitee pays now (full price, or deposit when deposit < price). */
export function dueNowCents(
  et: Pick<PublicEventType, "price_cents" | "deposit_cents">,
): number {
  return priceMode(et) === "deposit" ? et.deposit_cents : (et.price_cents ?? 0);
}

export function balanceCents(
  et: Pick<PublicEventType, "price_cents" | "deposit_cents">,
): number {
  return priceMode(et) === "deposit"
    ? (et.price_cents ?? 0) - (et.deposit_cents ?? 0)
    : 0;
}

export function formatCents(cents: number, currency = "usd"): string {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/** Primary CTA label for the review step. */
export function reviewCtaLabel(
  et: Pick<PublicEventType, "price_cents" | "deposit_cents" | "currency">,
  paidEnabled: boolean,
): string {
  if (!paidEnabled || priceMode(et) === "free") return "Confirm booking";
  return `Pay ${formatCents(dueNowCents(et), et.currency)} & book`;
}

// ─── Time + timezone formatting ─────────────────────────────────────────────

function safeDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function timeParts(d: Date, tz: string): { time: string; period: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(d);
    const period = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
    const time = parts
      .filter(
        (p) => p.type === "hour" || p.type === "literal" || p.type === "minute",
      )
      .map((p) => p.value)
      .join("")
      .trim();
    return { time, period };
  } catch {
    return { time: "", period: "" };
  }
}

/** "Wed, Jun 17 · 9:30 – 10:00 AM" rendered in `tz`. Collapses the meridiem. */
export function formatSlotRange(
  startISO: string,
  endISO: string,
  tz: string,
): string {
  const start = safeDate(startISO);
  const end = safeDate(endISO);
  if (!start) return startISO;
  let datePart = "";
  try {
    datePart = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(start);
  } catch {
    datePart = start.toDateString();
  }
  const s = timeParts(start, tz);
  if (!end) return `${datePart} · ${s.time} ${s.period}`.trim();
  const e = timeParts(end, tz);
  const startLabel =
    s.period && s.period === e.period ? s.time : `${s.time} ${s.period}`;
  return `${datePart} · ${startLabel.trim()} – ${e.time} ${e.period}`.trim();
}

/** Human timezone label for the chip, e.g. "Pacific Daylight Time". */
export function tzChipLabel(tz: string, atISO?: string): string {
  const d = (atISO && safeDate(atISO)) || new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "long",
    }).formatToParts(d);
    const long = parts.find((p) => p.type === "timeZoneName")?.value;
    if (long) return long;
  } catch {
    /* fall through */
  }
  const tail = tz.split("/").pop() || tz;
  return tail.replace(/_/g, " ");
}

// ─── Misc ───────────────────────────────────────────────────────────────────

/** Plain-language location summary for the booking ("Video call", "In person", …). */
export function locationLabel(
  mode: EventTypeLocationMode | null | undefined,
  detail?: string | null,
): { label: string; sub: string | null } {
  switch (mode) {
    case "video":
      return { label: "Video call", sub: "Join link is sent after you book." };
    case "phone":
      return {
        label: "Phone call",
        sub: detail?.trim() || "We'll call the number you provide.",
      };
    case "in_person":
      return {
        label: detail?.trim() || "In person",
        sub: detail?.trim() ? null : "Address sent after you book.",
      };
    case "ask":
      return {
        label: "They'll ask you",
        sub: "Location is arranged after booking.",
      };
    case "custom":
      return { label: detail?.trim() || "Details to follow", sub: null };
    default:
      return { label: "Details to follow", sub: null };
  }
}

/** "30 min" · "1 hr" · "1 hr 30 min". */
export function durationLabelFromMinutes(
  min: number | null | undefined,
): string {
  if (min == null || !Number.isFinite(min) || min <= 0) return "";
  if (min < 60) return `${min} min`;
  const hrs = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${hrs} hr` : `${hrs} hr ${rem} min`;
}

export function pillarLabel(pillar: Pillar): string {
  if (pillar === "home") return "Home";
  if (pillar === "business") return "Business";
  return "Personal";
}

export function initialsFromName(value: string | null | undefined): string {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** True for booking statuses that have already concluded (read-only manage). */
export function isPastBooking(status: string, endISO?: string | null): boolean {
  if (status === "completed" || status === "no_show") return true;
  if (status !== "confirmed") return false;
  const end = endISO ? safeDate(endISO) : null;
  return end ? end.getTime() < Date.now() : false;
}
