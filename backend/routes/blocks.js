const express = require('express');
const Joi = require('joi');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const { invalidateBlockCache, removeFollowsBetween } = require('../services/blockService');
const { invalidateFilterCache } = require('../services/feedService');
const marketplaceService = require('../services/marketplace/marketplaceService');
const { writeIdentityAuditLog } = require('../utils/identityAudit');
const { chosenUsernameOrNull } = require('../utils/personalUsername');
const { loadChatPeople, chatPersonRow } = require('../services/chatPeople');

/**
 * POST /api/users/:userId/block
 * Block a user. Prevents direct chat creation and messaging.
 */
router.post('/:userId/block', verifyToken, async (req, res) => {
  try {
    const blockerId = req.user.id;
    const blockedId = req.params.userId;
    const { reason } = req.body || {};

    if (String(blockerId) === String(blockedId)) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Verify target user exists (22P02: the id isn't one at all)
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('id', blockedId)
      .maybeSingle();

    if (targetError && targetError.code !== '22P02') throw targetError;
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // The block ends their follows, both ways (blockService.removeFollowsBetween):
    // first, so a failure (503) records nothing and Block is still offered for a
    // retry, and again once the block is recorded, for a follow added in between.
    await removeFollowsBetween(blockerId, blockedId);

    const { error } = await supabaseAdmin
      .from('UserBlock')
      .upsert(
        {
          blocker_user_id: blockerId,
          blocked_user_id: blockedId,
          reason: reason || null,
        },
        { onConflict: 'blocker_user_id,blocked_user_id', ignoreDuplicates: true }
      );

    if (error) {
      logger.error('Error creating block', { error: error.message, blockerId, blockedId });
      return res.status(500).json({ error: 'Failed to block user' });
    }

    invalidateBlockCache(blockerId, blockedId);
    invalidateFilterCache(blockerId);
    invalidateFilterCache(blockedId);
    marketplaceService.invalidateFilterCache(blockerId);
    marketplaceService.invalidateFilterCache(blockedId);

    await removeFollowsBetween(blockerId, blockedId);

    // P1.14: audience-profile §9 + unified-IA §5.1 — personal-side
    // block cascades to every persona the blocker owns. The cascade
    // is fire-and-forget so this HTTP request stays fast; failures
    // log but do not bubble. Audience-side blocks NEVER cascade
    // back to personal — that path is intentionally absent.
    setImmediate(async () => {
      try {
        await require('../services/personaBlockService')
          .propagatePersonalBlock({
            blockerUserId: blockerId,
            blockedUserId: blockedId,
          });
      } catch (err) {
        logger.error('block.persona_propagation_async_error', {
          blockerId, blockedId, error: err.message,
        });
      }
    });

    await writeIdentityAuditLog({
      req,
      actorUserId: blockerId,
      targetUserId: blockedId,
      action: 'user.blocked',
      targetType: 'UserBlock',
      targetId: blockedId,
      metadata: {
        has_reason: !!reason,
      },
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'BLOCK_INCOMPLETE') return res.status(503).json({ error: err.message, code: err.code });
    logger.error('Block user error', { error: err.message });
    res.status(500).json({ error: 'Failed to block user' });
  }
});

/**
 * DELETE /api/users/:userId/block
 * Unblock a user.
 *
 * P1.14: deliberately does NOT cascade an unblock to PersonaBlock
 * rows created by the personal-block propagation. The propagation
 * created persona_block_propagation rows when the personal block
 * happened; if the creator later wants the fan back, they remove
 * the persona block deliberately on the persona side
 * (DELETE /api/personas/:id/fans/:membershipId/block). Unified-IA
 * §5.1: cascades are one-way and conservative.
 */
router.delete('/:userId/block', verifyToken, async (req, res) => {
  try {
    const blockerId = req.user.id;
    let blockedId = req.params.userId;
    if (blockedId.startsWith('anonymous:')) {
      const blockId = blockedId.slice('anonymous:'.length);
      if (Joi.string().uuid().validate(blockId).error) {
        return res.status(400).json({ error: 'Invalid block handle' });
      }
      const { data: anonymousBlock, error: lookupError } = await supabaseAdmin
        .from('UserBlock')
        .select('blocked_user_id')
        .eq('id', blockId)
        .eq('blocker_user_id', blockerId)
        .eq('reason', 'neighbor_message')
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!anonymousBlock) return res.json({ success: true });
      blockedId = anonymousBlock.blocked_user_id;
    }

    const { error } = await supabaseAdmin
      .from('UserBlock')
      .delete()
      .eq('blocker_user_id', blockerId)
      .eq('blocked_user_id', blockedId);

    if (error) {
      logger.error('Error removing block', { error: error.message, blockerId, blockedId });
      return res.status(500).json({ error: 'Failed to unblock user' });
    }

    invalidateBlockCache(blockerId, blockedId);
    invalidateFilterCache(blockerId);
    invalidateFilterCache(blockedId);
    marketplaceService.invalidateFilterCache(blockerId);
    marketplaceService.invalidateFilterCache(blockedId);
    await writeIdentityAuditLog({
      req,
      actorUserId: blockerId,
      targetUserId: blockedId,
      action: 'user.unblocked',
      targetType: 'UserBlock',
      targetId: blockedId,
      metadata: {},
    });
    res.json({ success: true });
  } catch (err) {
    logger.error('Unblock user error', { error: err.message });
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// List personal blocks; anonymous notes never expose a sender identity.
router.get('/blocked', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from('UserBlock')
      .select('id, blocked_user_id, reason, created_at, blocked_user:blocked_user_id(id, username, name, first_name, last_name, profile_picture_url)')
      .eq('blocker_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching blocked users', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch blocked users' });
    }

    // A blocked person goes by the name, handle and photo neighbors see on their posts and in chats: their Local
    // Profile's, or a business's (or anyone else's) account as before (services/chatPeople.js).
    const people = await loadChatPeople((data || [])
      .filter((b) => b.reason !== 'neighbor_message')
      .map((b) => b.blocked_user_id));
    const blocks = (data || []).map((b) => ({ ...b, blocked_user: chatPersonRow(b.blocked_user, people) }));

    res.json({
      // Keep the existing list/unblock contract, but never expose an anonymous
      // note's sender. Older clients can still unblock using this opaque handle.
      blocked: blocks.map((b) => b.reason === 'neighbor_message' ? {
        id: b.id,
        user_id: `anonymous:${b.id}`,
        username: null,
        name: 'Anonymous neighbor',
        profile_picture_url: null,
        reason: b.reason,
        created_at: b.created_at,
      } : ({
        id: b.id,
        user_id: b.blocked_user_id,
        // Only a username the person chose (a made-up one can show part of their email address).
        username: chosenUsernameOrNull(b.blocked_user?.username),
        name: b.blocked_user?.name
          || [b.blocked_user?.first_name, b.blocked_user?.last_name].filter(Boolean).join(' ')
          || null,
        profile_picture_url: b.blocked_user?.profile_picture_url || null,
        reason: b.reason,
        created_at: b.created_at,
      })),
    });
  } catch (err) {
    logger.error('Fetch blocked users error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

module.exports = router;
