/**
 * Relationship (Trust Graph) Routes
 *
 * Manages mutual connections between users.
 * Connection = identity-level trust (request → accept model).
 *
 * Routes:
 *   POST   /api/relationships/requests          - Send connection request
 *   POST   /api/relationships/:id/accept        - Accept request
 *   POST   /api/relationships/:id/reject        - Reject request
 *   POST   /api/relationships/:id/block         - Block user
 *   DELETE /api/relationships/:id               - Disconnect
 *   GET    /api/relationships                   - List my relationships
 *   GET    /api/relationships/requests/pending   - List pending received requests
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const { isBlocked, getRelationshipStatus } = require('../utils/visibilityPolicy');
const { invalidateFilterCache } = require('../services/feedService');
const { writeIdentityAuditLog } = require('../utils/identityAudit');
const rateLimit = require('express-rate-limit');

// ============ RATE LIMITERS ============

const connectionRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: 'Too many connection requests. Please try again later.',
});

// ============ VALIDATION ============

const requestSchema = Joi.object({
  addressee_id: Joi.string().uuid().required(),
  message: Joi.string().max(500).optional(),
});

// ============ HELPERS ============

const USER_SELECT = 'id, username, name, first_name, last_name, profile_picture_url, city, state';

/**
 * Get user display name for notifications.
 */
async function getUserDisplayName(userId) {
  const { data } = await supabaseAdmin
    .from('User')
    .select('username, name, first_name')
    .eq('id', userId)
    .single();
  if (!data) return 'Someone';
  return data.name || data.first_name || data.username || 'Someone';
}

// ============ ROUTES ============

/**
 * POST /requests - Send a connection request
 */
router.post('/requests', verifyToken, connectionRequestLimiter, validate(requestSchema), async (req, res) => {
  try {
    const requesterId = req.user.id;
    const { addressee_id, message } = req.body;

    // Curator accounts cannot initiate connections
    if (req.user.accountType === 'curator') {
      return res.status(403).json({ error: 'This account cannot send connection requests' });
    }

    // Can't connect with yourself
    if (requesterId === addressee_id) {
      return res.status(400).json({ error: 'Cannot send a connection request to yourself' });
    }

    // Verify target user exists
    const { data: targetUser } = await supabaseAdmin
      .from('User')
      .select('id, username, account_type')
      .eq('id', addressee_id)
      .single();

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Exclude curator accounts — platform-owned, not a real neighbor
    if (targetUser.account_type === 'curator') {
      return res.status(403).json({ error: 'Cannot send connection requests to this account' });
    }

    // Check for existing relationship (the unique pair index enforces one row)
    const { data: existing } = await supabaseAdmin
      .from('Relationship')
      .select('id, status, requester_id, blocked_by')
      .or(
        `and(requester_id.eq.${requesterId},addressee_id.eq.${addressee_id}),and(requester_id.eq.${addressee_id},addressee_id.eq.${requesterId})`
      )
      .single();

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'You are already connected with this user' });
      }
      if (existing.status === 'blocked') {
        return res.status(403).json({ error: 'Cannot send a connection request to this user' });
      }
      if (existing.status === 'pending') {
        // If the other person already sent us a request, auto-accept
        if (existing.requester_id === addressee_id) {
          const { data: updated, error } = await supabaseAdmin
            .from('Relationship')
            .update({
              status: 'accepted',
              responded_at: new Date().toISOString(),
              accepted_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) {
            logger.error('Error auto-accepting relationship', { error: error.message });
            return res.status(500).json({ error: 'Failed to accept connection' });
          }

          // Main profile behavior: accepting a mutual connection also creates
          // mutual follows so both profiles show the relationship immediately.
          await Promise.allSettled([
            supabaseAdmin
              .from('UserFollow')
              .upsert(
                { follower_id: requesterId, following_id: addressee_id },
                { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
              ),
            supabaseAdmin
              .from('UserFollow')
              .upsert(
                { follower_id: addressee_id, following_id: requesterId },
                { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
              ),
          ]);

          // Notify both parties
          const requesterName = await getUserDisplayName(requesterId);
          notificationService.createNotification({
            userId: addressee_id,
            type: 'connection_accepted',
            title: `${requesterName} accepted your connection request`,
            icon: '🤝',
            link: `/${(await supabaseAdmin.from('User').select('username').eq('id', requesterId).single()).data?.username}`,
            metadata: { relationship_id: existing.id, user_id: requesterId },
          });

          return res.status(200).json({
            message: 'Connection established (mutual request)',
            relationship: updated,
          });
        }

        // Requester already sent a request
        return res.status(400).json({ error: 'Connection request already pending' });
      }
    }

    // Create new request
    const { data: relationship, error } = await supabaseAdmin
      .from('Relationship')
      .insert({
        requester_id: requesterId,
        addressee_id: addressee_id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      // Handle unique violation gracefully
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Connection request already exists' });
      }
      logger.error('Error creating relationship', { error: error.message });
      return res.status(500).json({ error: 'Failed to send connection request' });
    }

    // Notify addressee
    const requesterName = await getUserDisplayName(requesterId);
    notificationService.createNotification({
      userId: addressee_id,
      type: 'connection_request',
      title: `${requesterName} wants to connect with you`,
      body: message || null,
      icon: '🤝',
      link: '/app/connections?tab=requests',
      metadata: { relationship_id: relationship.id, requester_id: requesterId },
    });

    res.status(201).json({
      message: 'Connection request sent',
      relationship,
    });
  } catch (err) {
    logger.error('Connection request error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to send connection request' });
  }
});

/**
 * POST /:id/accept - Accept a connection request
 */
router.post('/:id/accept', verifyToken, async (req, res) => {
  try {
    const relationshipId = req.params.id;
    const userId = req.user.id;

    // Fetch the relationship
    const { data: rel } = await supabaseAdmin
      .from('Relationship')
      .select('*')
      .eq('id', relationshipId)
      .single();

    if (!rel) {
      return res.status(404).json({ error: 'Connection request not found' });
    }

    // Only the addressee can accept
    if (rel.addressee_id !== userId) {
      return res.status(403).json({ error: 'Only the recipient can accept this request' });
    }

    if (rel.status !== 'pending') {
      return res.status(400).json({ error: `Cannot accept a ${rel.status} request` });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('Relationship')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      })
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) {
      logger.error('Error accepting relationship', { error: error.message });
      return res.status(500).json({ error: 'Failed to accept connection' });
    }

    // Main profile behavior: connecting auto-creates mutual follows.
    await Promise.allSettled([
      supabaseAdmin
        .from('UserFollow')
        .upsert(
          { follower_id: rel.requester_id, following_id: rel.addressee_id },
          { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
        ),
      supabaseAdmin
        .from('UserFollow')
        .upsert(
          { follower_id: rel.addressee_id, following_id: rel.requester_id },
          { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
        ),
    ]);

    // Notify the requester
    const accepterName = await getUserDisplayName(userId);
    notificationService.createNotification({
      userId: rel.requester_id,
      type: 'connection_accepted',
      title: `${accepterName} accepted your connection request`,
      icon: '🤝',
      link: `/${(await supabaseAdmin.from('User').select('username').eq('id', userId).single()).data?.username}`,
      metadata: { relationship_id: relationshipId, user_id: userId },
    });

    res.json({ message: 'Connection accepted', relationship: updated });
  } catch (err) {
    logger.error('Accept connection error', { error: err.message });
    res.status(500).json({ error: 'Failed to accept connection' });
  }
});

/**
 * POST /:id/reject - Reject a connection request
 */
router.post('/:id/reject', verifyToken, async (req, res) => {
  try {
    const relationshipId = req.params.id;
    const userId = req.user.id;

    const { data: rel } = await supabaseAdmin
      .from('Relationship')
      .select('*')
      .eq('id', relationshipId)
      .single();

    if (!rel) {
      return res.status(404).json({ error: 'Connection request not found' });
    }

    if (rel.addressee_id !== userId) {
      return res.status(403).json({ error: 'Only the recipient can reject this request' });
    }

    if (rel.status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject a ${rel.status} request` });
    }

    // Delete the request (allow re-requesting later)
    const { error } = await supabaseAdmin
      .from('Relationship')
      .delete()
      .eq('id', relationshipId);

    if (error) {
      logger.error('Error rejecting relationship', { error: error.message });
      return res.status(500).json({ error: 'Failed to reject connection' });
    }

    res.json({ message: 'Connection request rejected' });
  } catch (err) {
    logger.error('Reject connection error', { error: err.message });
    res.status(500).json({ error: 'Failed to reject connection' });
  }
});

/**
 * POST /:id/block - Block a user (from an existing relationship or create new block)
 */
router.post('/:id/block', verifyToken, async (req, res) => {
  try {
    const relationshipId = req.params.id;
    const userId = req.user.id;
    const { reason } = req.body || {};

    const { data: rel } = await supabaseAdmin
      .from('Relationship')
      .select('*')
      .eq('id', relationshipId)
      .single();

    if (!rel) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    // Must be one of the two parties
    if (rel.requester_id !== userId && rel.addressee_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (rel.status === 'blocked') {
      return res.status(400).json({ error: 'Already blocked' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('Relationship')
      .update({
        status: 'blocked',
        blocked_by: userId,
        block_reason: reason || null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) {
      logger.error('Error blocking user', { error: error.message });
      return res.status(500).json({ error: 'Failed to block user' });
    }

    const otherUserId = rel.requester_id === userId ? rel.addressee_id : rel.requester_id;
    await Promise.allSettled([
      supabaseAdmin.from('UserFollow').delete().eq('follower_id', userId).eq('following_id', otherUserId),
      supabaseAdmin.from('UserFollow').delete().eq('follower_id', otherUserId).eq('following_id', userId),
    ]);

    invalidateFilterCache(userId);
    await writeIdentityAuditLog({
      req,
      actorUserId: userId,
      targetUserId: otherUserId,
      action: 'relationship.blocked',
      targetType: 'Relationship',
      targetId: relationshipId,
      metadata: {
        had_reason: !!reason,
      },
    });
    res.json({ message: 'User blocked', relationship: updated });
  } catch (err) {
    logger.error('Block user error', { error: err.message });
    res.status(500).json({ error: 'Failed to block user' });
  }
});

/**
 * POST /block-user - Block a user by their user ID (no existing relationship needed)
 */
router.post('/block-user', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { user_id: targetId, reason } = req.body;

    if (!targetId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    if (userId === targetId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Check existing relationship
    const { data: existing } = await supabaseAdmin
      .from('Relationship')
      .select('id, status')
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userId})`
      )
      .single();

    if (existing) {
      if (existing.status === 'blocked') {
        return res.status(400).json({ error: 'Already blocked' });
      }

      // Update existing relationship to blocked
      const { data: updated, error } = await supabaseAdmin
        .from('Relationship')
        .update({
          status: 'blocked',
          blocked_by: userId,
          block_reason: reason || null,
          responded_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        logger.error('Error blocking via existing relationship', { error: error.message });
        return res.status(500).json({ error: 'Failed to block user' });
      }

      await Promise.allSettled([
        supabaseAdmin.from('UserFollow').delete().eq('follower_id', userId).eq('following_id', targetId),
        supabaseAdmin.from('UserFollow').delete().eq('follower_id', targetId).eq('following_id', userId),
      ]);

      invalidateFilterCache(userId);
      await writeIdentityAuditLog({
        req,
        actorUserId: userId,
        targetUserId: targetId,
        action: 'relationship.blocked',
        targetType: 'Relationship',
        targetId: existing.id,
        metadata: {
          had_reason: !!reason,
          mode: 'existing_relationship',
        },
      });
      return res.json({ message: 'User blocked', relationship: updated });
    }

    // Create a new blocked relationship
    const { data: rel, error } = await supabaseAdmin
      .from('Relationship')
      .insert({
        requester_id: userId,
        addressee_id: targetId,
        status: 'blocked',
        blocked_by: userId,
        block_reason: reason || null,
        responded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating block relationship', { error: error.message });
      return res.status(500).json({ error: 'Failed to block user' });
    }

    await Promise.allSettled([
      supabaseAdmin.from('UserFollow').delete().eq('follower_id', userId).eq('following_id', targetId),
      supabaseAdmin.from('UserFollow').delete().eq('follower_id', targetId).eq('following_id', userId),
    ]);

    invalidateFilterCache(userId);
    await writeIdentityAuditLog({
      req,
      actorUserId: userId,
      targetUserId: targetId,
      action: 'relationship.blocked',
      targetType: 'Relationship',
      targetId: rel.id,
      metadata: {
        had_reason: !!reason,
        mode: 'created_relationship',
      },
    });
    res.json({ message: 'User blocked', relationship: rel });
  } catch (err) {
    logger.error('Block user error', { error: err.message });
    res.status(500).json({ error: 'Failed to block user' });
  }
});

/**
 * POST /:id/unblock - Unblock a user
 */
router.post('/:id/unblock', verifyToken, async (req, res) => {
  try {
    const relationshipId = req.params.id;
    const userId = req.user.id;

    const { data: rel } = await supabaseAdmin
      .from('Relationship')
      .select('*')
      .eq('id', relationshipId)
      .single();

    if (!rel) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    if (rel.status !== 'blocked') {
      return res.status(400).json({ error: 'This relationship is not blocked' });
    }

    // Only the blocker can unblock
    if (rel.blocked_by !== userId) {
      return res.status(403).json({ error: 'Only the person who blocked can unblock' });
    }

    // Delete the relationship entirely (they can re-request if desired)
    const otherUserId = rel.requester_id === userId ? rel.addressee_id : rel.requester_id;
    const { error } = await supabaseAdmin
      .from('Relationship')
      .delete()
      .eq('id', relationshipId);

    if (error) {
      logger.error('Error unblocking user', { error: error.message });
      return res.status(500).json({ error: 'Failed to unblock user' });
    }

    invalidateFilterCache(userId);
    await writeIdentityAuditLog({
      req,
      actorUserId: userId,
      targetUserId: otherUserId,
      action: 'relationship.unblocked',
      targetType: 'Relationship',
      targetId: relationshipId,
      metadata: {},
    });
    res.json({ message: 'User unblocked' });
  } catch (err) {
    logger.error('Unblock error', { error: err.message });
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

/**
 * DELETE /:id - Disconnect (remove an accepted connection)
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const relationshipId = req.params.id;
    const userId = req.user.id;

    const { data: rel } = await supabaseAdmin
      .from('Relationship')
      .select('*')
      .eq('id', relationshipId)
      .single();

    if (!rel) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Must be one of the two parties
    if (rel.requester_id !== userId && rel.addressee_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (rel.status === 'blocked') {
      return res.status(400).json({ error: 'Cannot disconnect a blocked relationship. Unblock first.' });
    }

    const { error } = await supabaseAdmin
      .from('Relationship')
      .delete()
      .eq('id', relationshipId);

    if (error) {
      logger.error('Error disconnecting', { error: error.message });
      return res.status(500).json({ error: 'Failed to disconnect' });
    }

    res.json({ message: 'Disconnected successfully' });
  } catch (err) {
    logger.error('Disconnect error', { error: err.message });
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/**
 * GET / - List my relationships (filtered by status)
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabaseAdmin
      .from('Relationship')
      .select(`
        id, status, created_at, responded_at, accepted_at, blocked_by,
        requester:requester_id (${USER_SELECT}),
        addressee:addressee_id (${USER_SELECT})
      `)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: relationships, error } = await query;

    if (error) {
      logger.error('Error fetching relationships', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch connections' });
    }

    // Enrich with role info (who is the "other" user relative to current user)
    const enriched = (relationships || []).map(rel => {
      const isRequester = rel.requester?.id === userId;
      return {
        ...rel,
        other_user: isRequester ? rel.addressee : rel.requester,
        direction: isRequester ? 'sent' : 'received',
      };
    });

    res.json({ relationships: enriched });
  } catch (err) {
    logger.error('List relationships error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

/**
 * GET /requests/pending - List pending connection requests received by me
 */
router.get('/requests/pending', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: requests, error } = await supabaseAdmin
      .from('Relationship')
      .select(`
        id, status, created_at,
        requester:requester_id (${USER_SELECT})
      `)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching pending requests', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch pending requests' });
    }

    res.json({ requests: requests || [] });
  } catch (err) {
    logger.error('Pending requests error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

/**
 * GET /requests/sent - List pending connection requests sent by me
 */
router.get('/requests/sent', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: requests, error } = await supabaseAdmin
      .from('Relationship')
      .select(`
        id, status, created_at,
        addressee:addressee_id (${USER_SELECT})
      `)
      .eq('requester_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching sent requests', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch sent requests' });
    }

    res.json({ requests: requests || [] });
  } catch (err) {
    logger.error('Sent requests error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
});

/**
 * GET /blocked - List users I've blocked
 */
router.get('/blocked', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: blocked, error } = await supabaseAdmin
      .from('Relationship')
      .select(`
        id, created_at, responded_at, block_reason,
        requester:requester_id (${USER_SELECT}),
        addressee:addressee_id (${USER_SELECT})
      `)
      .eq('status', 'blocked')
      .eq('blocked_by', userId)
      .order('responded_at', { ascending: false });

    if (error) {
      logger.error('Error fetching blocked users', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch blocked users' });
    }

    const enriched = (blocked || []).map(rel => {
      const blockedUser = rel.requester?.id === userId ? rel.addressee : rel.requester;
      return { ...rel, blocked_user: blockedUser };
    });

    res.json({ blocked: enriched });
  } catch (err) {
    logger.error('Blocked list error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});


module.exports = router;
