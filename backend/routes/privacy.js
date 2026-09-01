/**
 * Privacy Settings & Block Routes
 *
 * Manages UserPrivacySettings and UserProfileBlock for the Identity Firewall.
 * Mount at: app.use('/api/privacy', require('./routes/privacy'));
 *
 * Endpoints:
 *   GET    /settings                — Get current user's privacy settings
 *   PATCH  /settings                — Update privacy settings
 *   GET    /blocks                  — List blocked users/contexts
 *   POST   /blocks                  — Block a user (scoped)
 *   DELETE /blocks/:blockId         — Remove a block
 */

const express = require('express');
const Joi = require('joi');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const { writeIdentityAuditLog } = require('../utils/identityAudit');

// ============================================================
// Validation schemas
// ============================================================

const updateSettingsSchema = Joi.object({
  search_visibility: Joi.string().valid('everyone', 'mutuals', 'nobody'),
  findable_by_name: Joi.boolean(),
  findable_by_email: Joi.boolean(),
  findable_by_phone: Joi.boolean(),
  profile_default_visibility: Joi.string().valid('public', 'followers', 'private'),
  show_gig_history: Joi.string().valid('public', 'followers', 'private'),
  show_neighborhood: Joi.string().valid('public', 'followers', 'private'),
  show_home_affiliation: Joi.string().valid('public', 'followers', 'private'),
}).min(1);

const createBlockSchema = Joi.object({
  blocked_user_id: Joi.string().uuid().required(),
  block_scope: Joi.string().valid('full', 'search_only', 'business_context').default('full'),
  reason: Joi.string().trim().max(500).allow('', null),
});


// ============================================================
// GET /settings — Current user's privacy settings
// ============================================================

router.get('/settings', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    let { data: settings, error } = await supabaseAdmin
      .from('UserPrivacySettings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error('Error fetching privacy settings', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to load privacy settings' });
    }

    // Auto-create defaults if no row exists yet
    if (!settings) {
      const { data: created, error: insertErr } = await supabaseAdmin
        .from('UserPrivacySettings')
        .insert({ user_id: userId })
        .select('*')
        .single();

      if (insertErr) {
        logger.error('Error creating default privacy settings', { error: insertErr.message, userId });
        return res.status(500).json({ error: 'Failed to initialize privacy settings' });
      }
      settings = created;
    }

    res.json({ settings });
  } catch (err) {
    logger.error('GET /privacy/settings error', { error: err.message });
    res.status(500).json({ error: 'Failed to load privacy settings' });
  }
});


// ============================================================
// PATCH /settings — Update privacy settings
// ============================================================

router.patch('/settings', verifyToken, validate(updateSettingsSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    // Upsert — ensures row exists even if GET wasn't called first
    const { data: settings, error } = await supabaseAdmin
      .from('UserPrivacySettings')
      .upsert(
        { user_id: userId, ...updates },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();

    if (error) {
      logger.error('Error updating privacy settings', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to update privacy settings' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'search_visibility')) {
      const { error: localProfileError } = await supabaseAdmin
        .from('LocalProfile')
        .update({
          search_visibility: req.body.search_visibility,
          updated_at: updates.updated_at,
        })
        .eq('user_id', userId);

      if (localProfileError) {
        logger.error('Error syncing local profile search visibility', {
          error: localProfileError.message,
          userId,
        });
        return res.status(500).json({ error: 'Failed to update profile search visibility' });
      }
    }

    await writeIdentityAuditLog({
      req,
      actorUserId: userId,
      targetUserId: userId,
      action: 'privacy.settings_updated',
      targetType: 'UserPrivacySettings',
      targetId: userId,
      metadata: {
        changed_fields: Object.keys(req.body).sort(),
      },
    });

    res.json({ message: 'Privacy settings updated', settings });
  } catch (err) {
    logger.error('PATCH /privacy/settings error', { error: err.message });
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});


// ============================================================
// GET /blocks — List user's scoped blocks
// ============================================================

router.get('/blocks', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: blocks, error } = await supabaseAdmin
      .from('UserProfileBlock')
      .select(`
        id, blocked_user_id, block_scope, reason, created_at,
        blocked:blocked_user_id (
          id, username, name, profile_picture_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching blocks', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to load blocks' });
    }

    res.json({ blocks: blocks || [] });
  } catch (err) {
    logger.error('GET /privacy/blocks error', { error: err.message });
    res.status(500).json({ error: 'Failed to load blocks' });
  }
});


// ============================================================
// POST /blocks — Create a scoped block
// ============================================================

router.post('/blocks', verifyToken, validate(createBlockSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { blocked_user_id, block_scope, reason } = req.body;

    if (blocked_user_id === userId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Check if the target user exists
    const { data: targetUser } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('id', blocked_user_id)
      .maybeSingle();

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Upsert: if block already exists for this pair, update scope
    const { data: block, error } = await supabaseAdmin
      .from('UserProfileBlock')
      .upsert(
        {
          user_id: userId,
          blocked_user_id,
          block_scope,
          reason: reason || null,
        },
        { onConflict: 'user_id,blocked_user_id' },
      )
      .select('id, blocked_user_id, block_scope, reason, created_at')
      .single();

    if (error) {
      logger.error('Error creating block', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to create block' });
    }

    await writeIdentityAuditLog({
      req,
      actorUserId: userId,
      targetUserId: blocked_user_id,
      action: 'privacy.block_created',
      targetType: 'UserProfileBlock',
      targetId: block.id,
      metadata: {
        block_scope: block.block_scope,
        has_reason: !!block.reason,
      },
    });

    res.status(201).json({ message: 'Block created', block });
  } catch (err) {
    logger.error('POST /privacy/blocks error', { error: err.message });
    res.status(500).json({ error: 'Failed to create block' });
  }
});


// ============================================================
// DELETE /blocks/:blockId — Remove a block
// ============================================================

router.delete('/blocks/:blockId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { blockId } = req.params;

    // Ensure the block belongs to the current user
    const { data: existing } = await supabaseAdmin
      .from('UserProfileBlock')
      .select('id, blocked_user_id, block_scope')
      .eq('id', blockId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Block not found' });
    }

    const { error } = await supabaseAdmin
      .from('UserProfileBlock')
      .delete()
      .eq('id', blockId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error removing block', { error: error.message, blockId });
      return res.status(500).json({ error: 'Failed to remove block' });
    }

    await writeIdentityAuditLog({
      req,
      actorUserId: userId,
      targetUserId: existing.blocked_user_id,
      action: 'privacy.block_removed',
      targetType: 'UserProfileBlock',
      targetId: existing.id,
      metadata: {
        block_scope: existing.block_scope,
      },
    });

    res.json({ message: 'Block removed' });
  } catch (err) {
    logger.error('DELETE /privacy/blocks error', { error: err.message });
    res.status(500).json({ error: 'Failed to remove block' });
  }
});


module.exports = router;
