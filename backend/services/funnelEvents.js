'use strict';
/**
 * Funnel events — minimal instrumentation for the wedge ladder (T0 → T4).
 *
 * Only the pre-account steps need an event table: T3 (claim) and T4
 * (verified) are already durable state transitions (Home rows /
 * AddressVerificationAttempt.status) and are derived by query, not
 * double-written here.
 *
 * Event vocabulary (CHECK-constrained in the FunnelEvent migration):
 *   t0_preview_viewed  client-side, T0 preview rendered (the preview route
 *                      itself persists nothing — see CLIENT_POSTABLE note)
 *   t0_aha_viewed      client-side, the aha card rendered (meta: section_id,
 *                      tone, grade) — the "aha rate" of Wedge v2 D1
 *   t0_share_clicked   client-side, "Share this address" tapped (meta:
 *                      method share|copy) — the share rate of D5
 *   t0_wall_viewed     client-side, when the soft wall is shown/tapped
 *   register_started   client-side, register form mounted
 *   t1_account_created server-side, on successful registration
 *
 * Writes are fire-and-forget: recordFunnelEvent never throws and never
 * blocks the request path that calls it.
 *
 * @module services/funnelEvents
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const FUNNEL_EVENT_TYPES = Object.freeze([
  't0_preview_viewed',
  't0_aha_viewed',
  't0_share_clicked',
  't0_wall_viewed',
  'register_started',
  't1_account_created',
]);

// The subset a browser may post directly. All T0-stage events are
// client beacons: the /api/public/place route deliberately persists
// NOTHING (the preview's anti-leak/no-storage contract, asserted by
// tests/publicPlace.test.js), so even its funnel event is client-posted.
// Server-owned events (t1_account_created) are recorded by their own
// routes and cannot be spoofed here.
const CLIENT_POSTABLE_EVENT_TYPES = Object.freeze([
  't0_preview_viewed',
  't0_aha_viewed',
  't0_share_clicked',
  't0_wall_viewed',
  'register_started',
]);

/**
 * Record one funnel event. Fire-and-forget: returns a promise that always
 * resolves; failures are logged and swallowed.
 *
 * @param {string} eventType  one of FUNNEL_EVENT_TYPES
 * @param {object} [opts]
 * @param {string|null} [opts.userId]  authenticated user id, when known
 * @param {string|null} [opts.anonId]  client-generated anonymous id (joins T0 → T1)
 * @param {object} [opts.meta]         small JSON payload; keep it non-identifying
 */
async function recordFunnelEvent(eventType, { userId = null, anonId = null, meta = {} } = {}) {
  if (!FUNNEL_EVENT_TYPES.includes(eventType)) {
    logger.warn('funnelEvents: unknown event type dropped', { eventType });
    return;
  }
  try {
    const { error } = await supabaseAdmin.from('FunnelEvent').insert({
      event_type: eventType,
      user_id: userId || null,
      anon_id: anonId ? String(anonId).slice(0, 64) : null,
      meta: meta && typeof meta === 'object' ? meta : {},
    });
    if (error) {
      logger.warn('funnelEvents: insert failed', { eventType, error: error.message });
    }
  } catch (err) {
    logger.warn('funnelEvents: insert threw', { eventType, error: err.message });
  }
}

module.exports = {
  recordFunnelEvent,
  FUNNEL_EVENT_TYPES,
  CLIENT_POSTABLE_EVENT_TYPES,
};
