/**
 * Home IAM Routes
 *
 * New endpoints for the IAM system. Mount alongside existing home routes:
 *   app.use('/api/homes', require('./routes/homeIam'));
 *
 * Provides:
 *   GET  /:id/me              — current user's access & permissions
 *   GET  /:id/role-presets     — available role presets for UI
 *   GET  /:id/role-templates   — role template metadata
 *   POST /:id/members/:userId/role — update member role/preset
 *   POST /:id/members/:userId/permissions — toggle specific permissions
 *   DELETE /:id/members/:userId — revoke/remove a member
 *   GET  /:id/audit-log        — view audit log
 *   POST /:id/guest-passes     — create a guest pass (V2)
 *   GET  /:id/guest-passes     — list guest passes (V2)
 *   DELETE /:id/guest-passes/:passId — revoke a guest pass (V2)
 *   POST /:id/scoped-grants    — create a share link for a single resource
 *   POST /:id/lockdown         — enable lockdown mode
 *   DELETE /:id/lockdown       — disable lockdown mode
 *   GET  /:id/settings         — read home settings & preferences
 *   PATCH /:id/settings        — update home settings & preferences
 *   POST /:id/transfer-admin   — transfer primary ownership
 */

const express = require('express');
const router = express.Router();
// Static recovery routes precede every dynamic Home-id route.
router.use('/member-removals', require('./homeMemberRemovals'));
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const { invalidateRoleCache } = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const { OLD_TO_NEW_PERM } = require('../utils/homeAccessPolicy');
const homeAuthorityService = require('../services/homeAuthorityService');
const homeExternalShareService = require('../services/homeExternalShareService');
const {
  checkHomePermission,
  getUserAccess,
  hasPermission,
  writeAuditLog,
} = require('../utils/homePermissions');


// ============================================================
// GET /:id/me — Current user's access for this home
// ============================================================

router.get('/:id/me', verifyToken, async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await getUserAccess(homeId, userId);

    if (!access.hasAccess) {
      return res.status(403).json({
        hasAccess: false,
        role_base: null,
        permissions: [],
        verification_status: access.occupancy?.verification_status || null,
        verification_required: access.verificationRequired === true,
        verification_kind: access.verificationRequired === true
          ? (access.role_base === 'owner' ? 'ownership' : 'residency') : null,
      });
    }

    const occ = access.occupancy || {};

    // Navigation is a projection of the same effective rights as API checks.
    // A stale template flag or recorded owner role must not undo a deny/age cap.
    const permissions = new Set(access.permissions || []);
    const can = flag => OLD_TO_NEW_PERM[flag].some(permission => permissions.has(permission));
    const isOwnerLike = access.isOwner;
    const can_manage_home = can('can_manage_home');
    const can_manage_access = can('can_manage_access');
    const can_manage_finance = can('can_manage_finance');
    const can_manage_tasks = can('can_manage_tasks');
    const can_view_sensitive = can('can_view_sensitive');

    // Challenge window check
    const is_in_challenge_window = occ.verification_status === 'provisional'
      && !!occ.challenge_window_ends_at
      && new Date(occ.challenge_window_ends_at) > new Date();

    // Pending postcard check
    const { data: postcard } = await supabaseAdmin
      .from('HomePostcardCode')
      .select('expires_at')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    // BUG 5B: Surface claim_window_ends_at from Home table
    const { data: homeSecurityInfo } = await supabaseAdmin
      .from('Home')
      .select('security_state, claim_window_ends_at')
      .eq('id', homeId)
      .single();

    const claim_window_ends_at = homeSecurityInfo?.claim_window_ends_at || null;
    const is_in_claim_window = homeSecurityInfo?.security_state === 'claim_window'
      && !!claim_window_ends_at
      && new Date(claim_window_ends_at) > new Date();

    // Ownership claim state: show rejected/needs_more_info so dashboard can display the right message
    let ownership_claim_state = null;
    const { data: latestClaim } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('state')
      .eq('home_id', homeId)
      .eq('claimant_user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestClaim?.state === 'rejected' || latestClaim?.state === 'needs_more_info') {
      ownership_claim_state = latestClaim.state;
    }

    res.json({
      hasAccess: true,
      // 5 navigation booleans
      can_manage_home,
      can_manage_access,
      can_manage_finance,
      can_manage_tasks,
      can_view_sensitive,
      // Verification context
      verification_status: occ.verification_status || 'unverified',
      ownership_claim_state,
      is_in_challenge_window,
      challenge_window_ends_at: occ.challenge_window_ends_at || null,
      // Claim window context (BUG 5B)
      is_in_claim_window,
      claim_window_ends_at,
      // Member context
      role_base: access.role_base,
      effective_role_base: access.effective_role_base,
      is_owner: isOwnerLike,
      age_band: occ.age_band || null,
      occupancy_id: occ.id,
      // Postcard context
      postcard_expires_at: postcard?.expires_at || null,
      // Legacy (backward compat) — must match getUserAccess + role owner (promotion path)
      isOwner: isOwnerLike,
      permissions: access.permissions,
      occupancy: {
        id: occ.id,
        role: occ.role,
        role_base: access.role_base,
        start_at: occ.start_at,
        end_at: occ.end_at,
        age_band: occ.age_band || null,
      },
    });
  } catch (err) {
    logger.error('GET /me error', { error: err.message, homeId: req.params.id });
    res.status(err.code === 'HOME_ACCESS_UNAVAILABLE' ? 503 : 500).json({ error: 'Failed to load access info. Please retry.' });
  }
});


// ============================================================
// GET /:id/role-presets — List available role presets
// ============================================================

router.get('/:id/role-presets', verifyToken, async (req, res) => {
  try {
    const { data: presets, error } = await supabaseAdmin
      .from('HomeRolePreset')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Error fetching role presets', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch presets' });
    }

    res.json({ presets: presets || [] });
  } catch (err) {
    logger.error('Role presets error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch presets' });
  }
});


// ============================================================
// GET /:id/role-templates — Role template metadata
// ============================================================

router.get('/:id/role-templates', verifyToken, async (req, res) => {
  try {
    const { data: templates, error } = await supabaseAdmin
      .from('HomeRoleTemplateMeta')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('Error fetching role templates', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }

    res.json({ templates: templates || [] });
  } catch (err) {
    logger.error('Role templates error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});


// ============================================================
// POST /:id/members/:userId/role — Update member role/preset
// ============================================================

router.post('/:id/members/:userId/role', verifyToken, async (req, res) => {
  try {
    const result = await homeAuthorityService.mutateMember({
      homeId: req.params.id, actorId: req.user.id, targetId: req.params.userId,
      action: 'role', payload: req.body,
    });
    invalidateRoleCache?.(req.params.userId);
    res.json({ message: result.preset_key ? 'Preset applied' : 'Role updated',
      role_base: result.role_base, ...(result.preset_key ? { preset_key: result.preset_key } : {}) });
  } catch (err) {
    logger.error('Update member role error', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});


// ============================================================
// POST /:id/members/:userId/permissions — Toggle permissions
// ============================================================

router.post('/:id/members/:userId/permissions', verifyToken, async (req, res) => {
  try {
    const result = await homeAuthorityService.mutateMember({
      homeId: req.params.id, actorId: req.user.id, targetId: req.params.userId,
      action: 'override', payload: req.body,
    });
    invalidateRoleCache?.(req.params.userId);
    res.json({ message: 'Permission updated', permission: result.permission, allowed: result.allowed });
  } catch (err) {
    logger.error('Toggle permission error', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});


// ============================================================
// GET /:id/members/:userId/permissions — Get member's permissions
// ============================================================

router.get('/:id/members/:userId/permissions', verifyToken, async (req, res) => {
  try {
    const { id: homeId, userId: targetUserId } = req.params;
    const actorId = req.user.id;

    // Need members.view at minimum, or be the target user
    if (targetUserId !== actorId) {
      const canView = await hasPermission(homeId, actorId, 'members.view');
      if (!canView) {
        // Check basic access
        const access = await checkHomePermission(homeId, actorId);
        if (!access.hasAccess) {
          return res.status(403).json({ error: 'No access' });
        }
      }
    }

    const access = await getUserAccess(homeId, targetUserId);
    res.json({
      permissions: access.permissions,
      role_base: access.role_base,
    });
  } catch (err) {
    logger.error('Get member permissions error', { error: err.message });
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});


// ============================================================
// DELETE /:id/members/:userId — Revoke/remove member
// ============================================================

router.delete('/:id/members/:userId', verifyToken, async (req, res) => {
  try {
    await homeAuthorityService.mutateMember({
      homeId: req.params.id, actorId: req.user.id, targetId: req.params.userId, action: 'remove',
    });
    invalidateRoleCache?.(req.params.userId);
    res.json({ message: 'Member removed' });
  } catch (err) {
    logger.error('Remove member error', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});


// ============================================================
// GET /:id/audit-log — View audit log
// ============================================================

router.get('/:id/audit-log', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const actorId = req.user.id;

    const access = await checkHomePermission(homeId, actorId, 'members.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to view audit log' });
    }

    const { limit = 50, offset = 0 } = req.query;

    const { data, error } = await supabaseAdmin
      .from('HomeAuditLog')
      .select(`
        *,
        actor:actor_user_id (
          id, username, name, profile_picture_url
        )
      `)
      .eq('home_id', homeId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      logger.error('Error fetching audit log', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch audit log' });
    }

    res.json({ entries: data || [] });
  } catch (err) {
    logger.error('Audit log error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});


// Guest and scoped links are issued and revoked with their audit in one
// actor-bound transaction; responses omit credential hashes and private bindings.
function shareFailure(res, error) {
  return res.status(error.statusCode || 503).json({
    error: error.code ? error.message : 'Could not complete the share request. Please retry.',
    code: error.code || 'SHARE_UNAVAILABLE',
  });
}
for (const [kind, path, envelope] of [
  ['guest', '/:id/guest-passes', 'pass'], ['scoped', '/:id/scoped-grants', 'grant'],
]) {
  router.post(path, verifyToken, async (req, res) => {
    try {
      const result = await homeExternalShareService.mutate({ homeId: req.params.id,
        actorId: req.user.id, kind, action: 'create', payload: req.body });
      return res.status(201).json({ [envelope]: result.record, token: result.token });
    } catch (error) { return shareFailure(res, error); }
  });
  router.delete(`${path}/:shareId`, verifyToken, async (req, res) => {
    try {
      const result = await homeExternalShareService.mutate({ homeId: req.params.id,
        actorId: req.user.id, kind, action: 'revoke', shareId: req.params.shareId });
      return res.json({ message: kind === 'guest' ? 'Guest pass revoked' : 'Share link revoked', [envelope]: result.record });
    } catch (error) { return shareFailure(res, error); }
  });
}
router.get('/:id/guest-passes', verifyToken, async (req, res) => {
  try {
    const result = await homeExternalShareService.mutate({ homeId: req.params.id,
      actorId: req.user.id, kind: 'guest', action: 'list', payload: { include_revoked: req.query.include_revoked === 'true' } });
    return res.json({ passes: result.records });
  } catch (error) { return shareFailure(res, error); }
});


// ============================================================
// POST /:id/lockdown — Enable lockdown mode
// ============================================================

router.post('/:id/lockdown', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const actorId = req.user.id;

    const access = await checkHomePermission(homeId, actorId, 'security.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage security' });
    }

    const now = new Date().toISOString();

    // 1. Enable lockdown on the home
    const { data: home, error: homeErr } = await supabaseAdmin
      .from('Home')
      .update({
        lockdown_enabled: true,
        lockdown_enabled_at: now,
        lockdown_enabled_by: actorId,
        visibility: 'private',
        updated_at: now,
      })
      .eq('id', homeId)
      .select()
      .single();

    if (homeErr) {
      logger.error('Error enabling lockdown', { error: homeErr.message, homeId });
      return res.status(500).json({ error: 'Failed to enable lockdown' });
    }

    // 2. Revoke ALL active guest passes
    const { data: revokedPasses, error: revokeErr } = await supabaseAdmin
      .from('HomeGuestPass')
      .update({ revoked_at: now, updated_at: now })
      .eq('home_id', homeId)
      .is('revoked_at', null)
      .select('id');

    if (revokeErr) {
      logger.error('Error revoking guest passes during lockdown', { error: revokeErr.message });
      // Continue — lockdown is already enabled
    }

    const revokedCount = revokedPasses?.length || 0;

    await writeAuditLog(homeId, actorId, 'lockdown_enabled', 'Home', homeId, {
      guest_passes_revoked: revokedCount,
    });

    res.json({
      message: 'Lockdown enabled',
      home,
      guest_passes_revoked: revokedCount,
    });
  } catch (err) {
    logger.error('Lockdown enable error', { error: err.message });
    res.status(500).json({ error: 'Failed to enable lockdown' });
  }
});


// ============================================================
// DELETE /:id/lockdown — Disable lockdown mode
// ============================================================

router.delete('/:id/lockdown', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const actorId = req.user.id;

    const access = await checkHomePermission(homeId, actorId, 'security.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage security' });
    }

    const now = new Date().toISOString();

    const { data: home, error } = await supabaseAdmin
      .from('Home')
      .update({
        lockdown_enabled: false,
        updated_at: now,
      })
      .eq('id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error disabling lockdown', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to disable lockdown' });
    }

    await writeAuditLog(homeId, actorId, 'lockdown_disabled', 'Home', homeId, {});

    res.json({ message: 'Lockdown disabled', home });
  } catch (err) {
    logger.error('Lockdown disable error', { error: err.message });
    res.status(500).json({ error: 'Failed to disable lockdown' });
  }
});


// ============================================================
// GET /:id/settings — Read home settings & preferences
// ============================================================

router.get('/:id/settings', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const actorId = req.user.id;

    const access = await checkHomePermission(homeId, actorId, 'home.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access to view home settings' });
    }

    // Fetch home record and preferences in parallel
    const [homeRes, prefRes] = await Promise.allSettled([
      supabaseAdmin
        .from('Home')
        .select('name, home_type, visibility, trash_day, house_rules, local_tips, guest_welcome_message, entry_instructions, parking_instructions, default_visibility, default_guest_pass_hours, lockdown_enabled')
        .eq('id', homeId)
        .single(),
      supabaseAdmin
        .from('HomePreference')
        .select('*')
        .eq('home_id', homeId),
    ]);

    if ([homeRes, prefRes].some(result => result.status !== 'fulfilled' || !result.value || result.value.error)) {
      return res.status(503).json({ error: 'Current home settings could not be loaded.' });
    }
    const home = homeRes.status === 'fulfilled' ? homeRes.value.data : null;
    if (!home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    const preferences = prefRes.status === 'fulfilled' ? (prefRes.value.data || []) : [];
    const prefMap = preferences[0]?.settings || {};

    res.json({
      home: {
        name: home.name,
        home_type: home.home_type,
        visibility: home.visibility,
        trash_day: home.trash_day,
        house_rules: home.house_rules,
        local_tips: home.local_tips,
        guest_welcome_message: home.guest_welcome_message,
        entry_instructions: home.entry_instructions,
        parking_instructions: home.parking_instructions,
        default_visibility: home.default_visibility,
        default_guest_pass_hours: home.default_guest_pass_hours,
        lockdown_enabled: home.lockdown_enabled,
      },
      preferences: prefMap,
    });
  } catch (err) {
    logger.error('Get settings error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch home settings' });
  }
});


// ============================================================
// PATCH /:id/settings — Update home settings & preferences
// ============================================================

router.patch('/:id/settings', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const actorId = req.user.id;

    const access = await checkHomePermission(homeId, actorId, 'home.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit home settings' });
    }

    const {
      trash_day,
      house_rules,
      local_tips,
      guest_welcome_message,
      entry_instructions,
      parking_instructions,
      default_visibility,
      default_guest_pass_hours,
      preferences,
    } = req.body;

    // Build home field updates
    const homeUpdates = {};
    const settableFields = {
      trash_day,
      house_rules,
      local_tips,
      guest_welcome_message,
      entry_instructions,
      parking_instructions,
      default_visibility,
      default_guest_pass_hours,
    };

    for (const [key, value] of Object.entries(settableFields)) {
      if (value !== undefined) {
        homeUpdates[key] = value;
      }
    }

    // Validate default_visibility if present
    if (homeUpdates.default_visibility) {
      const validVisibilities = ['public', 'members', 'managers', 'sensitive'];
      if (!validVisibilities.includes(homeUpdates.default_visibility)) {
        return res.status(400).json({
          error: `Invalid default_visibility. Must be one of: ${validVisibilities.join(', ')}`,
        });
      }
    }

    // Validate default_guest_pass_hours if present
    if (homeUpdates.default_guest_pass_hours !== undefined) {
      const hours = Number(homeUpdates.default_guest_pass_hours);
      if (!Number.isFinite(hours) || hours < 1 || hours > 8760) {
        return res.status(400).json({ error: 'default_guest_pass_hours must be between 1 and 8760' });
      }
      homeUpdates.default_guest_pass_hours = hours;
    }

    const { data, error } = await supabaseAdmin.rpc('update_home_settings', {
      p_home_id: homeId, p_actor_id: actorId, p_fields: homeUpdates,
      p_preferences: preferences === undefined ? {} : preferences,
    }).catch(() => ({ data: null, error: true }));
    if (error || !data || typeof data.ok !== 'boolean') {
      return res.status(503).json({ error: 'The settings change could not be confirmed. Reload current settings before trying again.' });
    }
    if (!data.ok) {
      const status = { HOME_SETTINGS_INVALID: 400, HOME_NOT_FOUND: 404, HOME_SETTINGS_DENIED: 403 }[data.code] || 503;
      return res.status(status).json({ error: status === 400 ? 'Invalid home settings.' : 'Current permission to change these settings could not be confirmed.', code: data.code });
    }

    res.json({ message: 'Settings updated' });
  } catch (err) {
    logger.error('Update settings error', { error: err.message });
    res.status(500).json({ error: 'Failed to update settings' });
  }
});


// ============================================================
// POST /:id/transfer-admin — Transfer primary ownership
// ============================================================

router.post('/:id/transfer-admin', verifyToken, async (_req, res) => {
  // The old sequential pointer/role rewrite bypassed HomeOwner verification,
  // current authority and ownership transaction integrity.
  res.status(409).json({
    error: 'Use the ownership transfer flow so the new owner can verify ownership.',
    code: 'OWNERSHIP_FLOW_REQUIRED',
  });
});


module.exports = router;
