// W15 — Packages. Pure form logic for the Create/Edit Package editor (G9):
// default values, Package ⇄ form mapping, serialization to the backend
// PackageInput, and validation. Framework-free so it's trivially unit-testable
// (see w15-packages.test.ts) and reusable by the editor without React.
//
// Backed fields only. The design also shows a description, an expiry policy,
// and multi-event-type eligibility — none are persisted by the backend
// (POST/PUT /packages accept name, sessions_count, price_cents, currency,
// event_type_id, is_active). We model a single optional event_type_id
// ("Redeems against"); the rest are intentionally omitted, not faked.

import type { Package, PackageInput } from "@pantopus/types";
import { dollarsToCents } from "@/components/scheduling/packages/money";

// Backend bounds (packageSchema): sessions_count 1–1000, price_cents >= 0.
export const MIN_SESSIONS = 1;
export const MAX_SESSIONS = 1000;
export const DEFAULT_SESSIONS = 5;

export interface PackageFormValues {
  name: string;
  /** "" = redeemable against any event type (event_type_id → null). */
  eventTypeId: string;
  sessionsCount: number;
  /** Plain dollars string bound to the price input ("220", "240.00"). */
  priceDollars: string;
  currency: string;
  isActive: boolean;
}

export function defaultPackageForm(): PackageFormValues {
  return {
    name: "",
    eventTypeId: "",
    sessionsCount: DEFAULT_SESSIONS,
    priceDollars: "",
    currency: "USD",
    isActive: true,
  };
}

/** Integer cents → a plain dollars string for the input ("24000" → "240"). */
export function centsToDollars(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return "";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

export function packageToForm(pkg: Package): PackageFormValues {
  return {
    name: pkg.name ?? "",
    eventTypeId: pkg.event_type_id ?? "",
    sessionsCount:
      Number.isFinite(pkg.sessions_count) && pkg.sessions_count > 0
        ? pkg.sessions_count
        : DEFAULT_SESSIONS,
    priceDollars: centsToDollars(pkg.price_cents ?? 0),
    currency: pkg.currency || "USD",
    isActive: pkg.is_active !== false,
  };
}

/** Serialize the form → backend PackageInput. */
export function formToInput(values: PackageFormValues): PackageInput {
  return {
    name: values.name.trim(),
    sessions_count: clampSessions(values.sessionsCount),
    price_cents: dollarsToCents(values.priceDollars),
    currency: (values.currency || "USD").toUpperCase().slice(0, 3),
    event_type_id: values.eventTypeId ? values.eventTypeId : null,
    is_active: values.isActive,
  };
}

export function clampSessions(value: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return MIN_SESSIONS;
  return Math.min(MAX_SESSIONS, Math.max(MIN_SESSIONS, n));
}

/**
 * Client-side validation. Keys mirror the backend `details[].field` names so a
 * 400 maps onto the same fields. Price is required above $0 — these surfaces
 * exist to *sell* sessions (the design treats $0 as an error), and a $0 buy
 * would never create a PaymentIntent.
 */
export function validatePackageForm(
  values: PackageFormValues,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = "Give this package a name.";
  } else if (name.length > 200) {
    errors.name = "Keep the name under 200 characters.";
  }

  const sessions = Math.round(Number(values.sessionsCount));
  if (!Number.isFinite(sessions) || sessions < MIN_SESSIONS) {
    errors.sessions_count = "Add at least one session.";
  } else if (sessions > MAX_SESSIONS) {
    errors.sessions_count = "That's more sessions than we can package.";
  }

  if (!(dollarsToCents(values.priceDollars) > 0)) {
    errors.price_cents = "Enter a price above $0.";
  }

  return errors;
}
