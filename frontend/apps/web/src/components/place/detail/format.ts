// ============================================================
// Place detail — small shared formatters + the envelope→card-state
// mapping the detail pages reuse to degrade a section that isn't ready.
// ============================================================

import type { PlaceSectionStatus } from '@pantopus/types';
import type { PlaceSectionState } from '@/components/archetypes/place';

export function usd(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** "$498k" — compact money for tight stat cells. */
export function usdK(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000).toLocaleString('en-US')}k`;
  return `$${Math.round(n)}`;
}

export function fmtTime(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function fmtMonthYear(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function fmtLongDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** Map a section envelope status to the SectionCard fallback state. */
export function statusToState(status: PlaceSectionStatus): PlaceSectionState {
  if (status === 'ready' || status === 'partial') return 'loaded';
  if (status === 'stale') return 'stale';
  if (status === 'error') return 'error';
  return 'unavailable';
}

/** True when a section is gated for this tier (render a LockedCard). */
export function isLocked(access: 'available' | 'preview' | 'locked'): boolean {
  return access === 'locked';
}

/**
 * The server's own message off whatever a failed request threw.
 *
 * The API client's interceptor rejects with a PLAIN OBJECT
 * (`{ message, code, statusCode, ... }`), never an `Error` — so the
 * common `err instanceof Error ? err.message : fallback` reads false on
 * every server failure and silently swallows the message. That matters
 * wherever the route has coded, actionable failures: the rent
 * contribution's 403 `VERIFICATION_REQUIRED` and 400 `BAD_AMOUNT` both
 * carry copy the resident needs, and both would otherwise be replaced
 * by a generic "could not save".
 */
export function apiErrorText(err: unknown, fallback: string): string {
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return fallback;
}
