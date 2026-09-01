// Persona block routes — creator-facing block / unblock / list.
//
// Audience Profile design v2 §9 (block propagation), §11.7 (creator's
// view of a fan + block + report buttons), §13.5 (block test
// invariants). The creator NEVER sees the underlying user_id of a
// fan in any request or response — they operate on membership_id
// and the response carries fan_handle / fan_display_name only.
//
// Mounted at /api/personas/:id with the same UUID-gate pattern as
// personaTiers / personaPayments / personaDms / personaMembership so
// handle-shaped URLs fall through to the public personas router.
// Internal routes:
//   POST   /fans/:membershipId/block
//   DELETE /fans/:membershipId/block
//   GET    /blocks

const express = require('express');
const Joi = require('joi');
const router = express.Router({ mergeParams: true });

const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const requireFeatureFlag = require('../middleware/requireFeatureFlag');
const logger = require('../utils/logger');
const personaBlockService = require('../services/personaBlockService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.use((req, _res, next) => {
  if (!UUID_RE.test(req.params.id || '')) return next('router');
  return next();
});

router.use(verifyToken, requireFeatureFlag('audience_profile'));

async function loadOwnedPersona(req, res) {
  const { data: persona } = await supabaseAdmin
    .from('PublicPersona')
    .select('id, user_id, handle')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!persona) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  if (persona.user_id !== req.user.id) {
    // 404 (not 403) keeps the surface invisible to non-owners.
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return persona;
}

// Resolve membership_id → blocked user identity for the creator. The
// creator only sees / supplies membership_id; this helper returns the
// underlying user_id (server-side use only) plus the fan_handle for
// audit metadata. Returns null if the membership doesn't belong to
// this persona.
async function resolveMembership(personaId, membershipId) {
  if (!membershipId) return null;
  const { data: membership } = await supabaseAdmin
    .from('PersonaMembership')
    .select('id, user_id, fan_handle, fan_display_name, fan_avatar_url')
    .eq('id', membershipId)
    .eq('persona_id', personaId)
    .maybeSingle();
  return membership || null;
}

const blockSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('', null),
});

// POST /api/personas/:id/fans/:membershipId/block
router.post('/fans/:membershipId/block', validate(blockSchema), async (req, res) => {
  const persona = await loadOwnedPersona(req, res);
  if (!persona) return;

  const membership = await resolveMembership(persona.id, req.params.membershipId);
  if (!membership) return res.status(404).json({ error: 'Not found' });

  if (persona.user_id === membership.user_id) {
    // Defensive: shouldn't be possible (the persona owner doesn't
    // have a membership on their own persona) but guard anyway.
    return res.status(400).json({ error: 'Cannot block yourself' });
  }

  try {
    const { block, revokedMembershipId } = await personaBlockService.blockUserFromPersona({
      personaId: persona.id,
      blockedUserId: membership.user_id,
      source: 'persona_owner_action',
      reason: req.body.reason || null,
      actorUserId: req.user.id,
      refund: true,
    });
    return res.json({
      blocked: true,
      blockId: block.id,
      revokedMembershipId,
      // The fan_handle round-trips so the client can display a toast
      // without re-fetching the membership.
      fanHandle: membership.fan_handle,
    });
  } catch (err) {
    logger.error('persona_blocks.block_error', {
      personaId: persona.id, membershipId: membership.id, error: err.message,
    });
    return res.status(500).json({ error: 'Could not block fan' });
  }
});

// DELETE /api/personas/:id/fans/:membershipId/block
// Owner-removable sources only; chargeback / platform_safety throw
// out of the service (returned as 400).
router.delete('/fans/:membershipId/block', async (req, res) => {
  const persona = await loadOwnedPersona(req, res);
  if (!persona) return;

  const membership = await resolveMembership(persona.id, req.params.membershipId);
  if (!membership) return res.status(404).json({ error: 'Not found' });

  try {
    const result = await personaBlockService.unblockUserFromPersona({
      personaId: persona.id,
      blockedUserId: membership.user_id,
      actorUserId: req.user.id,
    });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/personas/:id/blocks — list all blocks on this persona.
//
// The creator sees fan_handle / fan_display_name / fan_avatar_url
// (looked up via PersonaMembership). user_id is NEVER returned. The
// block `source` / `reason` fields are also intentionally omitted: a
// personal_block_propagation row must look identical to a creator-made
// block on every creator-facing surface. canUnblock tells the UI
// whether to render an unblock button without revealing why.
router.get('/blocks', async (req, res) => {
  const persona = await loadOwnedPersona(req, res);
  if (!persona) return;

  const { data: blocks } = await supabaseAdmin
    .from('PersonaBlock')
    .select('id, source, created_at, blocked_user_id')
    .eq('persona_id', persona.id);

  // Resolve fan_handle for each block via PersonaMembership lookup.
  // Membership may be expired (the block path flips status to
  // expired) — we read it anyway for the handle.
  const blockedUserIds = [...new Set((blocks || []).map((b) => b.blocked_user_id).filter(Boolean))];
  let handleByUserId = new Map();
  if (blockedUserIds.length > 0) {
    const { data: memberships } = await supabaseAdmin
      .from('PersonaMembership')
      .select('id, user_id, fan_handle, fan_display_name, fan_avatar_url')
      .eq('persona_id', persona.id)
      .in('user_id', blockedUserIds);
    handleByUserId = new Map(
      (memberships || []).map((m) => [m.user_id, m]),
    );
  }

  return res.json({
    blocks: (blocks || []).map((b) => {
      const m = handleByUserId.get(b.blocked_user_id) || {};
      return {
        id: b.id,
        membershipId: m.id || null,
        createdAt: b.created_at,
        fanHandle: m.fan_handle || null,
        fanDisplayName: m.fan_display_name || m.fan_handle || null,
        fanAvatarUrl: m.fan_avatar_url || null,
        canUnblock: personaBlockService.OWNER_REMOVABLE_SOURCES.has(b.source),
      };
    }),
  });
});

module.exports = router;
