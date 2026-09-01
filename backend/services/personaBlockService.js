// Persona-side block service.
//
// Audience Profile design v2 §9 (block propagation, asymmetric
// cascade rule), §11.7 (creator's view of a fan), §13.5 (block test
// invariants). The core invariants this service enforces:
//
//   1. Personal-side block of B by A → cascade to PersonaBlock
//      rows on every persona A owns, with source =
//      'personal_block_propagation'.
//   2. Audience-side block of B from persona P → DOES NOT cascade
//      to a UserBlock. Mirroring would tell A "your fan is also
//      someone you know" via the missing-from-list signal — design
//      §9 forbids it. The audience block stands alone.
//   3. Creator never sees WHY a personal_block_propagation row
//      exists. The fan_handle + tier label are the entire surface;
//      source is internal-only.
//   4. Active membership at block time is revoked immediately
//      (status='expired'), the Stripe subscription is hard-cancelled
//      (not at period end), and a prorated refund for the unused
//      portion of the period is issued — except for chargeback
//      blocks (Stripe already reversed the charge in the dispute
//      flow).
//
// Sequential supabase reads only (no nested select) — same pattern
// as the rest of this codebase.

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { writeIdentityAuditLog } = require('../utils/identityAudit');
const lifecycle = require('./personaSubscriptionLifecycleService');

const VALID_SOURCES = new Set([
  'persona_owner_action',
  'personal_block_propagation',
  'platform_safety',
  'chargeback',
]);

// Owner cannot manually unblock these — they're platform-level
// decisions. The §6.5 moderator path (Phase 2) is the only way out.
const OWNER_REMOVABLE_SOURCES = new Set([
  'persona_owner_action',
  'personal_block_propagation',
]);

// §9 goodwill rule: a prorated refund of less than $1 (100 cents)
// becomes a full refund of the last invoice instead.
const GOODWILL_FLOOR_CENTS = 100;

// Compute the prorated refund amount for a fan whose current period
// has remaining days. Returns 0 when the period is already over or
// when the membership has no priced tier.
function computeProratedRefund(membership) {
  const priceCents = membership?.tier?.price_cents;
  if (!priceCents || priceCents <= 0) return 0;
  if (!membership.current_period_start || !membership.current_period_end) return 0;
  const start = new Date(membership.current_period_start).getTime();
  const end   = new Date(membership.current_period_end).getTime();
  const now   = Date.now();
  if (end <= now || end <= start) return 0;
  const totalMs = end - start;
  const remainingMs = end - now;
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs));
  const cents = Math.floor(fraction * priceCents);
  if (cents <= 0) return 0;
  if (cents < GOODWILL_FLOOR_CENTS) return priceCents;
  return cents;
}

// Revoke an active or paid-with-pending-cancel membership for a
// blocked user. Idempotent: no-op when the membership is already
// terminal. Refunds (when applicable) are issued before the Stripe
// cancel so the unused portion is captured at the right billing
// state. Refunds are skipped for chargeback blocks (Stripe already
// reversed the charge during dispute resolution) and for any caller
// that opts out via { refund: false }.
async function revokeActiveMembership({
  membership, source, refund,
}) {
  if (!membership) return false;
  if (!['active', 'past_due', 'canceled_pending'].includes(membership.status)) {
    return false;
  }
  if (refund && source !== 'chargeback' && membership.stripe_subscription_id) {
    const amount = computeProratedRefund(membership);
    if (amount > 0) {
      try {
        await lifecycle.issueRefund(membership, {
          amountCents: amount,
          reason: `block_${source}`,
        });
      } catch (err) {
        // Refund failure does NOT abort the block — a future
        // reconciliation job can retry. The block is the safety
        // priority; the refund is a courtesy.
        logger.warn('persona_block.refund_failed', {
          membershipId: membership.id, source, error: err.message,
        });
      }
    }
  }
  if (membership.stripe_subscription_id) {
    try {
      await lifecycle.cancelSubscriptionImmediately(membership);
    } catch (err) {
      logger.warn('persona_block.cancel_failed', {
        membershipId: membership.id, source, error: err.message,
      });
    }
  }
  await supabaseAdmin
    .from('PersonaMembership')
    .update({
      status: 'expired',
      canceled_at: new Date().toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.id);
  return true;
}

// Block a user from a persona. Idempotent (upsert on the unique
// (persona_id, blocked_user_id)).
//
// Returns { block, revokedMembershipId }.
//
// Refund policy:
//   * persona_owner_action / personal_block_propagation /
//     platform_safety → prorated refund (with goodwill floor) if the
//     fan had a paid active membership.
//   * chargeback → NO refund (Stripe already reversed the charge in
//     the dispute flow). Caller can also pass refund: false to opt out.
async function blockUserFromPersona({
  personaId, blockedUserId, source, reason = null, actorUserId = null, refund = true,
}) {
  if (!personaId || !blockedUserId) {
    throw new Error('blockUserFromPersona requires personaId + blockedUserId');
  }
  if (!VALID_SOURCES.has(source)) {
    throw new Error(`blockUserFromPersona: invalid source "${source}"`);
  }

  // Look up an existing block first; the mock supabaseAdmin doesn't
  // honor onConflict for tables it didn't pre-train (PersonaBlock has
  // a unique (persona_id, blocked_user_id) in production but the mock
  // would happily insert duplicates). Defensive read keeps tests +
  // production aligned.
  const { data: existing } = await supabaseAdmin
    .from('PersonaBlock')
    .select('id, source, reason, created_at')
    .eq('persona_id', personaId)
    .eq('blocked_user_id', blockedUserId)
    .maybeSingle();

  let block = existing;
  if (!existing) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('PersonaBlock')
      .insert({
        persona_id: personaId,
        blocked_user_id: blockedUserId,
        source,
        reason: reason || null,
      })
      .select()
      .single();
    if (insertError) {
      logger.error('persona_block.upsert_error', {
        error: insertError.message, personaId, blockedUserId, source,
      });
      throw insertError;
    }
    block = inserted;
  }

  // Look up + revoke the active membership (if any).
  const membership = await loadMembershipForBlock(personaId, blockedUserId);
  const revoked = await revokeActiveMembership({
    membership, source, refund,
  });

  await writeIdentityAuditLog({
    actorUserId,
    personaId,
    targetUserId: blockedUserId,
    action: 'persona_block.created',
    targetType: 'PersonaBlock',
    targetId: block.id,
    metadata: {
      source,
      had_membership: !!membership,
      revoked_active_membership: revoked,
    },
  });

  return { block, revokedMembershipId: revoked ? membership.id : null };
}

// Load the membership row + tier + persona in three sequential reads.
// Mirrors the lifecycle service's helper but tagged for readability.
async function loadMembershipForBlock(personaId, blockedUserId) {
  const { data: membership } = await supabaseAdmin
    .from('PersonaMembership')
    .select('*')
    .eq('persona_id', personaId)
    .eq('user_id', blockedUserId)
    .maybeSingle();
  if (!membership) return null;

  let tier = null;
  if (membership.tier_id) {
    const { data: t } = await supabaseAdmin
      .from('PersonaTier')
      .select('id, rank, price_cents, currency, billing_interval, stripe_price_id')
      .eq('id', membership.tier_id)
      .maybeSingle();
    tier = t || null;
  }

  let persona = null;
  if (membership.persona_id) {
    const { data: p } = await supabaseAdmin
      .from('PublicPersona')
      .select('id, user_id, handle, display_name')
      .eq('id', membership.persona_id)
      .maybeSingle();
    persona = p || null;
  }

  return { ...membership, tier, persona };
}

// Owner-driven unblock. chargeback / platform_safety blocks are
// reserved to the moderator path and throw an unblock-refused error.
async function unblockUserFromPersona({
  personaId, blockedUserId, actorUserId,
}) {
  const { data: existing } = await supabaseAdmin
    .from('PersonaBlock')
    .select('id, source')
    .eq('persona_id', personaId)
    .eq('blocked_user_id', blockedUserId)
    .maybeSingle();
  if (!existing) return { unblocked: false };

  if (!OWNER_REMOVABLE_SOURCES.has(existing.source)) {
    throw new Error('This block cannot be removed by the persona owner.');
  }

  const { error } = await supabaseAdmin
    .from('PersonaBlock')
    .delete()
    .eq('id', existing.id);
  if (error) {
    logger.error('persona_block.delete_error', {
      error: error.message, blockId: existing.id,
    });
    throw error;
  }

  await writeIdentityAuditLog({
    actorUserId,
    personaId,
    targetUserId: blockedUserId,
    action: 'persona_block.removed',
    targetType: 'PersonaBlock',
    targetId: existing.id,
    metadata: { source: existing.source },
  });

  return { unblocked: true };
}

// Cascade a personal-side block to every persona the blocker owns.
// This is the ONLY path that creates source='personal_block_propagation'
// rows. Returns one result per persona for caller diagnostics; the
// HTTP route fires this fire-and-forget so the user gets their
// /api/users/:id/block 200 fast.
//
// CRITICAL (audience-profile §9 + unified-IA §5.1): the cascade is
// strictly one-way. We never mirror an audience-side block back to
// personal — that would leak the personal-side relationship to the
// creator's view.
async function propagatePersonalBlock({ blockerUserId, blockedUserId }) {
  if (!blockerUserId || !blockedUserId) return [];

  const { data: personas, error } = await supabaseAdmin
    .from('PublicPersona')
    .select('id')
    .eq('user_id', blockerUserId);
  if (error) {
    logger.error('persona_block.propagation_personas_lookup_error', {
      error: error.message, blockerUserId,
    });
    return [];
  }

  const results = [];
  for (const persona of personas || []) {
    try {
      const r = await blockUserFromPersona({
        personaId: persona.id,
        blockedUserId,
        source: 'personal_block_propagation',
        actorUserId: blockerUserId,
        refund: true,
      });
      results.push({
        personaId: persona.id, ok: true,
        revokedMembershipId: r.revokedMembershipId,
      });
    } catch (err) {
      logger.error('persona_block.propagation_block_error', {
        personaId: persona.id, error: err.message,
      });
      results.push({
        personaId: persona.id, ok: false, error: err.message,
      });
    }
  }
  return results;
}

// Lightweight existence check used by the notification suppression
// path in notificationService (§9 + §6.2: blocked fans never receive
// audience-context notifications about the persona they were blocked
// from).
async function isFanBlockedFromPersona(personaId, userId) {
  if (!personaId || !userId) return false;
  const { data } = await supabaseAdmin
    .from('PersonaBlock')
    .select('id')
    .eq('persona_id', personaId)
    .eq('blocked_user_id', userId)
    .maybeSingle();
  return !!data;
}

module.exports = {
  blockUserFromPersona,
  unblockUserFromPersona,
  propagatePersonalBlock,
  isFanBlockedFromPersona,
  computeProratedRefund,
  // Exposed for documentation / tests:
  VALID_SOURCES,
  OWNER_REMOVABLE_SOURCES,
};
