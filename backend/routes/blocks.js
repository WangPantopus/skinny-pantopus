const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const { invalidateBlockCache } = require('../services/blockService');
const { writeIdentityAuditLog } = require('../utils/identityAudit');

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

    // Verify target user exists
    const { data: targetUser } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('id', blockedId)
      .single();

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

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
    const blockedId = req.params.userId;

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

/**
 * GET /api/users/blocked
 * List all users the current user has blocked.
 */
router.get('/blocked', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from('UserBlock')
      .select('id, blocked_user_id, reason, created_at, blocked_user:blocked_user_id(id, username, name, profile_picture_url)')
      .eq('blocker_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching blocked users', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch blocked users' });
    }

    res.json({
      blocked: (data || []).map((b) => ({
        id: b.id,
        user_id: b.blocked_user_id,
        username: b.blocked_user?.username || null,
        name: b.blocked_user?.name || null,
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
