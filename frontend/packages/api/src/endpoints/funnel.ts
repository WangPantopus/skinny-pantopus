// ============================================================
// FUNNEL — pre-account instrumentation for the wedge ladder (T0 → T1)
//
// Thin, fire-and-forget beacons over POST /api/public/funnel-events.
// The T0 stage is client-reported end to end because the public preview
// route persists nothing by contract; only t1_account_created is recorded
// server-side (by the register route).
//   t0_preview_viewed  the T0 preview rendered
//   t0_wall_viewed     the soft wall was shown/tapped
//   register_started   the register form mounted
//
// Continuity: a random anonymous id (localStorage) is stamped on every
// beacon and echoed on the register call, so T0 → T1 can be joined
// without cookies or PII. Everything here swallows errors — a beacon
// must never surface a failure to the funnel UI.
// ============================================================

import { post } from '../client';

export type ClientFunnelEventType =
  | 't0_preview_viewed'
  | 't0_aha_viewed'
  | 't0_share_clicked'
  | 't0_wall_viewed'
  | 'register_started';

const ANON_ID_KEY = 'pantopus_anon_id';
const ROUTE_KEY = 'pantopus_route';

/**
 * The acquisition route a visitor arrived on — `/start?r=<route>` printed
 * on an EDDM card or an invite postcard (Wedge v2 D5). Remembered per
 * browser so the wall and the register beacons carry it and route-level
 * CAC can be read straight from FunnelEvent.meta.
 */
export function rememberFunnelRoute(route: string | null | undefined): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const clean = String(route ?? '').trim().slice(0, 64);
    if (!clean) return;
    window.localStorage.setItem(ROUTE_KEY, clean);
  } catch {
    /* storage unavailable */
  }
}

export function getFunnelRoute(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(ROUTE_KEY);
  } catch {
    return null;
  }
}

/**
 * The stable per-browser anonymous id. Generated once, kept in
 * localStorage; returns null where storage or crypto is unavailable
 * (SSR, blocked storage) — beacons still send, just unjoined.
 */
export function getFunnelAnonId(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(ANON_ID_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/**
 * Fire one funnel beacon. Never throws, never blocks — call it and move on.
 */
export function recordFunnelEvent(
  eventType: ClientFunnelEventType,
  meta?: Record<string, string | number | boolean>,
): void {
  try {
    void post('/api/public/funnel-events', {
      event_type: eventType,
      anon_id: getFunnelAnonId(),
      meta: { ...(getFunnelRoute() ? { route: getFunnelRoute() } : {}), ...(meta ?? {}) },
    }).catch(() => {});
  } catch {
    // Beacons are best-effort by design.
  }
}
