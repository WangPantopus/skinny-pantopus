// Tier CRUD routes for the audience-profile feature.
//
// Audience Profile design v2 §10. Owner-only — every route requires the
// authenticated user to own the PublicPersona referenced by :id, and the
// audience_profile feature flag must be enabled for that user.
//
// Mounted in app.js with a UUID regex on :id so the existing public
// route GET /api/personas/:handle/tiers (in routes/personas.js) can
// continue to use a non-UUID handle without colliding here.
//
// What's NOT here (deferred):
//   * POST / — creating brand new tiers. Design v2 §1 invariant 2 caps
//     the ladder at 4 ranks, all seeded by P1.4 ensureDefaultLadder.
//     Creators rename / reprice / hide existing tiers; they don't add.
//   * Stripe Price syncing — P1.7 wraps updateTier with a sidecar that
//     writes Stripe Prices. PR 1.5 only mutates the DB row.

const express = require('express');
const Joi = require('joi');
const router = express.Router({ mergeParams: true });

const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const requireFeatureFlag = require('../middleware/requireFeatureFlag');
const logger = require('../utils/logger');
const { writeIdentityAuditLog } = require('../utils/identityAudit');
const personaTierService = require('../services/personaTierService');

// Express 5 / path-to-regexp 8 dropped the inline `:name(regex)`
// shorthand, so we constrain :id to UUID format with a router-level
// gate. If the param doesn't look like a UUID we fall through to the
// next mounted router via next('router') — that lets the public
// GET /api/personas/:handle/tiers route in routes/personas.js handle
// handle-shaped URLs without colliding here.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.use((req, _res, next) => {
  if (!UUID_RE.test(req.params.id || '')) return next('router');
  return next();
});

// Every route in this module requires:
//   1. An authenticated user (verifyToken).
//   2. The audience_profile feature flag enabled for that user.
// The flag check returns 404 (not 403) so the surface is invisible to
// users without access — see middleware/requireFeatureFlag.js.
router.use(verifyToken, requireFeatureFlag('audience_profile'));

// Loads the persona referenced by :id and enforces ownership. Returns
// the persona row on success, or null if the request was already ended
// with the appropriate response.
//
// Uses 404 (not 403) for non-owners: the existence of a persona at this
// id MUST NOT leak to a viewer who doesn't own it. For audience-profile,
// "is this URL valid" is itself privacy-sensitive.
async function loadOwnedPersona(req, res) {
  const personaId = req.params.id;
  const { data: persona, error } = await supabaseAdmin
    .from('PublicPersona')
    .select('id, user_id, status, handle, display_name')
    .eq('id', personaId)
    .maybeSingle();

  if (error) {
    logger.error('persona_tiers.lookup_error', {
      personaId, error: error.message,
    });
    res.status(500).json({ error: 'Internal error' });
    return null;
  }
  if (!persona) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  if (persona.user_id !== req.user.id) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return persona;
}

// Owner serializer. Includes stripe_price_id (the owner sees their own
// Stripe state). The PUBLIC tier serializer in routes/personas.js
// strips stripe_price_id — fans never need it.
function serializeTierForOwner(tier) {
  if (!tier) return null;
  return {
    id: tier.id,
    rank: tier.rank,
    name: tier.name,
    description: tier.description || null,
    priceCents: tier.price_cents,
    currency: tier.currency,
    billingInterval: tier.billing_interval,
    msgThreadsPerPeriod: tier.msg_threads_per_period,
    videoCallsPerPeriod: tier.video_calls_per_period,
    videoCallDurationMinutes: tier.video_call_duration_minutes,
    creatorCanInitiateDm: !!tier.creator_can_initiate_dm,
    replyPolicy: tier.reply_policy,
    status: tier.status,
    stripePriceId: tier.stripe_price_id || null,
    position: tier.position,
  };
}

// GET /api/personas/:id/tiers — owner's view. include_hidden=true also
// returns hidden + archived tiers (for the management UI).
router.get('/', async (req, res) => {
  const persona = await loadOwnedPersona(req, res);
  if (!persona) return;
  const includeHidden = req.query.include_hidden === 'true';
  const tiers = await personaTierService.listTiers(persona.id, { includeHidden });
  return res.json({ tiers: tiers.map(serializeTierForOwner) });
});

const updateTierSchema = Joi.object({
  name: Joi.string().trim().min(1).max(60),
  description: Joi.string().max(500).allow(''),
  // 50000 cents = $500/mo cap on a single tier; sane upper bound for v1.
  price_cents: Joi.number().integer().min(0).max(50000),
  msg_threads_per_period: Joi.number().integer().min(0).max(1000).allow(null),
  reply_policy: Joi.string().valid(
    'discretion', 'within_3_days', 'within_7_days', 'within_14_days', 'always',
  ),
  creator_can_initiate_dm: Joi.boolean(),
  position: Joi.number().integer().min(0).max(10),
}).min(1);

// PATCH /api/personas/:id/tiers/:tierId — edit name/price/quota/policy/etc.
//
// The service's UPDATABLE_FIELDS allow-list is the canonical filter; the
// Joi schema above just rejects bad input early with a friendly error.
router.patch('/:tierId', validate(updateTierSchema), async (req, res) => {
  const persona = await loadOwnedPersona(req, res);
  if (!persona) return;
  try {
    const updated = await personaTierService.updateTier(
      req.params.tierId,
      persona.id,
      req.body,
    );
    if (!updated) return res.status(404).json({ error: 'Tier not found' });
    await writeIdentityAuditLog({
      req,
      actorUserId: req.user.id,
      personaId: persona.id,
      action: 'persona_tier.update',
      targetType: 'PersonaTier',
      targetId: updated.id,
      metadata: { rank: updated.rank, fields: Object.keys(req.body) },
    });
    return res.json({ tier: serializeTierForOwner(updated) });
  } catch (err) {
    logger.error('persona_tiers.update_error', {
      tierId: req.params.tierId, error: err.message,
    });
    return res.status(400).json({ error: err.message });
  }
});

const visibilitySchema = Joi.object({
  status: Joi.string().valid('active', 'hidden', 'archived').required(),
});

// PATCH /api/personas/:id/tiers/:tierId/visibility — hide / show / archive.
//
// Service enforces the "rank 1 must always be active" invariant; if the
// caller tries to hide rank 1, the service throws and we return 400 with
// the message.
router.patch('/:tierId/visibility', validate(visibilitySchema), async (req, res) => {
  const persona = await loadOwnedPersona(req, res);
  if (!persona) return;
  try {
    const updated = await personaTierService.setTierVisibility(
      req.params.tierId,
      persona.id,
      req.body.status,
    );
    if (!updated) return res.status(404).json({ error: 'Tier not found' });
    await writeIdentityAuditLog({
      req,
      actorUserId: req.user.id,
      personaId: persona.id,
      action: 'persona_tier.visibility_change',
      targetType: 'PersonaTier',
      targetId: updated.id,
      metadata: { rank: updated.rank, status: req.body.status },
    });
    return res.json({ tier: serializeTierForOwner(updated) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// DELETE /api/personas/:id/tiers/:tierId — only when no active members.
//
// Returns 409 (Conflict) when the tier still has members in any
// non-terminal status. Owner-facing UI should suggest hiding instead.
router.delete('/:tierId', async (req, res) => {
  const persona = await loadOwnedPersona(req, res);
  if (!persona) return;

  let hasMembers;
  try {
    hasMembers = await personaTierService.tierHasActiveMembers(req.params.tierId);
  } catch (err) {
    logger.error('persona_tiers.member_check_error', {
      tierId: req.params.tierId, error: err.message,
    });
    return res.status(500).json({ error: 'Internal error' });
  }
  if (hasMembers) {
    return res.status(409).json({
      error: 'Cannot delete a tier with active members. Hide it instead.',
      code: 'tier_has_active_members',
    });
  }

  const { error } = await supabaseAdmin
    .from('PersonaTier')
    .delete()
    .eq('id', req.params.tierId)
    .eq('persona_id', persona.id);
  if (error) {
    logger.error('persona_tiers.delete_error', {
      tierId: req.params.tierId, error: error.message,
    });
    return res.status(500).json({ error: 'Internal error' });
  }

  await writeIdentityAuditLog({
    req,
    actorUserId: req.user.id,
    personaId: persona.id,
    action: 'persona_tier.delete',
    targetType: 'PersonaTier',
    targetId: req.params.tierId,
  });
  return res.json({ ok: true });
});

module.exports = router;
