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
