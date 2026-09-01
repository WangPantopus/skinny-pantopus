// Tier ladder service for the audience-profile feature.
//
// Audience Profile design v2 §7.1 (default ladder), §10 (tier CRUD API
// surface), §15 PR 2.
//
// Phase 1 / P1.4 — pure CRUD with no Stripe integration. Stripe Prices
// are wired up in P1.7; until then, the rank-2/3 tiers seeded here have
// stripe_price_id = NULL and are not yet subscribable end-to-end.
//
// Side-effects: writes to PersonaTier and reads PersonaMembership for
// the active-member check. No notifications, no Stripe, no audit log
// rows in this PR.

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// v1.0 default ladder. Rank 4 (Direct / video calls) is reserved in the
// schema (migration 136) and seeded by PR 10 in v1.1 — do NOT seed it
// here.
//
// Object.freeze (deep) prevents an accidental mutation of the seed shape
// from elsewhere in the service.
const DEFAULT_LADDER = Object.freeze([
  Object.freeze({
    rank: 1,
    name: 'Follower',
    description: 'Public posts + follower updates',
    price_cents: 0,
    msg_threads_per_period: null,
    creator_can_initiate_dm: false,
    reply_policy: 'discretion',
  }),
  Object.freeze({
    rank: 2,
    name: 'Member',
    description: 'Everything in Follower, plus 5 message threads per month',
    price_cents: 500,
    msg_threads_per_period: 5,
    creator_can_initiate_dm: false,
    reply_policy: 'discretion',
  }),
  Object.freeze({
    rank: 3,
    name: 'Insider',
    description: 'Everything in Member, plus 25 threads/month and creator can DM you back',
    price_cents: 1500,
    msg_threads_per_period: 25,
    creator_can_initiate_dm: true,
    reply_policy: 'within_7_days',
  }),
]);

// Allow-list of fields a creator can change on a tier. Deliberately omits:
//   * persona_id, rank — set at creation, never re-assigned.
//   * stripe_price_id — written by the Stripe sync service in P1.7.
//   * currency, billing_interval — fixed at creation; changing them
//     mid-flight would orphan Stripe subscription_schedules.
//   * status — use setTierVisibility() (which has rank-1 protection).
//   * id, created_at, updated_at — implementation detail.
const UPDATABLE_FIELDS = Object.freeze([
  'name',
  'description',
  'price_cents',
  'msg_threads_per_period',
  'reply_policy',
  'creator_can_initiate_dm',
  'video_call_duration_minutes',
  'position',
]);

// Seeds the v1.0 default ladder for personaId. Idempotent: only inserts
// ranks that don't already exist on the persona. Returns the full set
// of tiers (existing + newly inserted).
async function ensureDefaultLadder(personaId) {
  const { data: existing, error: readErr } = await supabaseAdmin
    .from('PersonaTier')
    .select('id, rank, name, status, price_cents, msg_threads_per_period, reply_policy, creator_can_initiate_dm, position')
    .eq('persona_id', personaId);
  if (readErr) {
    logger.error('persona_tier.read_error', { personaId, error: readErr.message });
    throw readErr;
  }

  const existingRanks = new Set((existing || []).map((t) => t.rank));
  const toInsert = DEFAULT_LADDER
    .filter((t) => !existingRanks.has(t.rank))
    .map((t) => ({ ...t, persona_id: personaId, position: t.rank }));

  if (toInsert.length === 0) return existing || [];

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('PersonaTier')
    .insert(toInsert)
    .select();
  if (insertErr) {
    logger.error('persona_tier.seed_error', { personaId, error: insertErr.message });
    throw insertErr;
  }

  logger.info('persona_tier.seeded', {
    personaId,
    count: inserted.length,
    ranks: inserted.map((t) => t.rank),
  });

  return [...(existing || []), ...inserted];
}

// Lists tiers for a persona. By default returns only active tiers; pass
// includeHidden: true to also include hidden / archived tiers (creator
// dashboard usage).
async function listTiers(personaId, { includeHidden = false } = {}) {
  let query = supabaseAdmin
    .from('PersonaTier')
    .select('*')
    .eq('persona_id', personaId)
    .order('rank', { ascending: true });
  if (!includeHidden) query = query.eq('status', 'active');
  const { data, error } = await query;
  if (error) {
    logger.error('persona_tier.list_error', { personaId, error: error.message });
    return [];
  }
  return data || [];
}

// Updates a tier. The (tierId, personaId) double-key is a defense in
// depth: even if a caller compromises tierId, they can only update tiers
// belonging to the persona they specify (which the caller must own,
// enforced at the route layer). Returns the updated row, or null if
// no row matched or no allowed fields were supplied.
//
// P1.7 — when price_cents changed AND the persona has a ready Connect
// account, fire a fire-and-forget Stripe sync that creates a new Price
// and atomically swaps stripe_price_id. Stripe failure must NOT roll
// back the DB update; the next save (or the manual sync route in P1.13)
// reconciles. The sync intentionally uses the post-update tier row so
// the Stripe Price reflects what the creator just saved.
async function updateTier(tierId, personaId, updates = {}) {
  const payload = {};
  for (const key of UPDATABLE_FIELDS) {
    if (key in updates) payload[key] = updates[key];
  }
  if (Object.keys(payload).length === 0) return null;
  payload.updated_at = new Date().toISOString();

  // Read the pre-update price so we know whether to trigger a Stripe
  // sync afterwards. Skip the read if price_cents isn't being touched.
  let priceChanged = false;
  if ('price_cents' in payload) {
    const { data: pre } = await supabaseAdmin
      .from('PersonaTier')
      .select('price_cents')
      .eq('id', tierId)
      .eq('persona_id', personaId)
      .maybeSingle();
    priceChanged = !!pre && pre.price_cents !== payload.price_cents;
  }

  const { data, error } = await supabaseAdmin
    .from('PersonaTier')
    .update(payload)
    .eq('id', tierId)
    .eq('persona_id', personaId)
    .select()
    .maybeSingle();

  if (error) {
    logger.error('persona_tier.update_error', { tierId, personaId, error: error.message });
    throw error;
  }

  if (data && priceChanged) {
    // Lazy require to avoid a circular dependency (personaPaymentsService
    // does not import this service today, but the lazy require keeps
    // the option open and matches the pattern used by personas.js).
    Promise.resolve()
      .then(() => require('./personaPaymentsService').syncTierIfReady(tierId))
      .catch((err) => {
        logger.warn('persona_tier.stripe_sync_failed', {
          tierId, error: err.message,
        });
      });
  }

  return data;
}

// Toggle a tier's visibility. The free Follower (rank 1) cannot be
// hidden or archived — every persona must always have a free tier so a
// fan can follow without payment.
//
// Note: status is deliberately NOT in UPDATABLE_FIELDS, so updateTier
// can't be misused to bypass the rank-1 invariant. We write status
// directly here.
async function setTierVisibility(tierId, personaId, status) {
  if (!['active', 'hidden', 'archived'].includes(status)) {
    throw new Error(`Invalid tier status: ${status}`);
  }

  const { data: tier, error: lookupErr } = await supabaseAdmin
    .from('PersonaTier')
    .select('rank')
    .eq('id', tierId)
    .eq('persona_id', personaId)
    .maybeSingle();
  if (lookupErr) {
    logger.error('persona_tier.visibility_lookup_error', { tierId, personaId, error: lookupErr.message });
    throw lookupErr;
  }
  if (!tier) return null;
  if (tier.rank === 1 && status !== 'active') {
    throw new Error('The free Follower tier cannot be hidden or archived.');
  }

  const { data: updated, error: writeErr } = await supabaseAdmin
    .from('PersonaTier')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', tierId)
    .eq('persona_id', personaId)
    .select()
    .maybeSingle();
  if (writeErr) {
    logger.error('persona_tier.status_write_error', { tierId, personaId, error: writeErr.message });
    throw writeErr;
  }
  return updated;
}

// Returns true if there is at least one PersonaMembership pointing at
// tierId with a status that should block tier deletion. Used by the
// future tier-delete route (P1.13). Statuses that block:
//   active            — currently paying
//   past_due          — still in dunning, retains capabilities
//   canceled_pending  — will retain access through current_period_end
// Terminal statuses (expired, canceled) do not block deletion.
async function tierHasActiveMembers(tierId) {
  const { count, error } = await supabaseAdmin
    .from('PersonaMembership')
    .select('id', { count: 'exact', head: true })
    .eq('tier_id', tierId)
    .in('status', ['active', 'past_due', 'canceled_pending']);
  if (error) {
    logger.error('persona_tier.member_count_error', { tierId, error: error.message });
    throw error;
  }
  return (count || 0) > 0;
}

module.exports = {
  DEFAULT_LADDER,
  UPDATABLE_FIELDS,
  ensureDefaultLadder,
  listTiers,
  updateTier,
  setTierVisibility,
  tierHasActiveMembers,
};
