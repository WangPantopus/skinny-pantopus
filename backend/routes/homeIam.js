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
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const { invalidateRoleCache } = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const { OLD_TO_NEW_PERM } = require('../utils/homeAccessPolicy');
const homeAuthorityService = require('../services/homeAuthorityService');
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


// ============================================================
// Guest Pass Template Defaults
// ============================================================

const GUEST_PASS_TEMPLATES = {
  wifi_only: {
    default_hours: 2,
    sections: ['wifi', 'parking'],
  },
  guest: {
    default_hours: 48,
    sections: ['wifi', 'parking', 'house_rules', 'entry_instructions', 'emergency'],
  },
  airbnb: {
    default_hours: null, // must be explicitly set
    sections: ['wifi', 'parking', 'house_rules', 'entry_instructions', 'trash_day', 'local_tips', 'emergency'],
  },
  vendor: {
    default_hours: 8,
    sections: ['entry_instructions', 'parking'],
  },
};


// ============================================================
// POST /:id/guest-passes — Create guest pass (V2)
// ============================================================

router.post('/:id/guest-passes', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const actorId = req.user.id;

    const access = await checkHomePermission(homeId, actorId, 'members.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to create guest passes' });
    }

    const {
      label,
      kind = 'guest',
      included_sections,
      custom_title,
      duration_hours,
      start_at,
      end_at,
      passcode,
      max_views,
      permissions: passPermissions,
    } = req.body;

    if (!label) {
      return res.status(400).json({ error: 'label is required' });
    }

    const validKinds = ['wifi_only', 'guest', 'airbnb', 'vendor'];
    if (!validKinds.includes(kind)) {
      return res.status(400).json({ error: `Invalid kind. Must be one of: ${validKinds.join(', ')}` });
    }

    // Resolve included_sections: user override or template defaults
    const template = GUEST_PASS_TEMPLATES[kind];
    const resolvedSections = Array.isArray(included_sections) && included_sections.length > 0
      ? included_sections
      : template.sections;

    // Resolve timing
    const resolvedStart = start_at ? new Date(start_at) : new Date();
    let resolvedEnd = null;
    if (end_at) {
      resolvedEnd = new Date(end_at);
    } else if (duration_hours) {
      resolvedEnd = new Date(resolvedStart.getTime() + duration_hours * 60 * 60 * 1000);
    } else if (template.default_hours) {
      resolvedEnd = new Date(resolvedStart.getTime() + template.default_hours * 60 * 60 * 1000);
    }
    // If still null (e.g. airbnb with no duration), fall back to home default
    if (!resolvedEnd) {
      const { data: home } = await supabaseAdmin
        .from('Home')
        .select('default_guest_pass_hours')
        .eq('id', homeId)
        .single();
      const fallbackHours = home?.default_guest_pass_hours || 48;
      resolvedEnd = new Date(resolvedStart.getTime() + fallbackHours * 60 * 60 * 1000);
    }

    // Generate token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Hash passcode if provided
    let passcodeHash = null;
    if (passcode && passcode.length > 0) {
      passcodeHash = crypto.createHash('sha256').update(passcode).digest('hex');
    }

    const { data, error } = await supabaseAdmin
      .from('HomeGuestPass')
      .insert({
        home_id: homeId,
        label,
        kind,
        token_hash: tokenHash,
        role_base: 'guest',
        permissions: passPermissions || {},
        start_at: resolvedStart.toISOString(),
        end_at: resolvedEnd.toISOString(),
        created_by: actorId,
        included_sections: resolvedSections,
        custom_title: custom_title || null,
        passcode_hash: passcodeHash,
        max_views: max_views ?? null,
        view_count: 0,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating guest pass', { error: error.message });
      return res.status(500).json({ error: 'Failed to create guest pass' });
    }

    await writeAuditLog(homeId, actorId, 'guest_pass_created', 'HomeGuestPass', data.id, {
      label, kind, included_sections: resolvedSections,
    });

    // Return the raw token ONCE (it's not stored, only the hash is)
    res.status(201).json({
      pass: data,
      token, // only returned on creation
    });
  } catch (err) {
    logger.error('Create guest pass error', { error: err.message });
    res.status(500).json({ error: 'Failed to create guest pass' });
  }
});


// ============================================================
// GET /:id/guest-passes — List guest passes (V2)
// ============================================================

router.get('/:id/guest-passes', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const actorId = req.user.id;

    const access = await checkHomePermission(homeId, actorId, 'members.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to view guest passes' });
    }

    const includeRevoked = req.query.include_revoked === 'true';

    let query = supabaseAdmin
      .from('HomeGuestPass')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (!includeRevoked) {
      query = query.is('revoked_at', null);
    }

    const { data: passes, error } = await query;

    if (error) {
      logger.error('Error fetching guest passes', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch guest passes' });
    }

    // Enrich with last_viewed_at from HomeGuestPassView
    const passIds = (passes || []).map(p => p.id);
    let lastViewedMap = {};

    if (passIds.length > 0) {
      // Get last view per pass using a raw approach (supabase doesn't support GROUP BY natively)
      const { data: views } = await supabaseAdmin
        .from('HomeGuestPassView')
        .select('guest_pass_id, viewed_at')
        .in('guest_pass_id', passIds)
        .order('viewed_at', { ascending: false });

      for (const v of (views || [])) {
        if (!lastViewedMap[v.guest_pass_id]) {
          lastViewedMap[v.guest_pass_id] = v.viewed_at;
        }
      }
    }

    const now = new Date();
    const enriched = (passes || []).map(p => {
      let status = 'active';
      if (p.revoked_at) {
        status = 'revoked';
      } else if (p.end_at && new Date(p.end_at) <= now) {
        status = 'expired';
      } else if (p.max_views && p.view_count >= p.max_views) {
        status = 'expired';
      }
      return {
        ...p,
        status,
        last_viewed_at: lastViewedMap[p.id] || null,
      };
    });

    res.json({ passes: enriched });
  } catch (err) {
    logger.error('Guest passes error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch guest passes' });
  }
});


// ============================================================
// DELETE /:id/guest-passes/:passId — Revoke guest pass (V2)
// ============================================================

router.delete('/:id/guest-passes/:passId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, passId } = req.params;
    const actorId = req.user.id;

    const access = await checkHomePermission(homeId, actorId, 'members.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to revoke guest passes' });
    }

    const { data, error } = await supabaseAdmin
      .from('HomeGuestPass')
      .update({
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', passId)
      .eq('home_id', homeId)
      .is('revoked_at', null)
      .select()
      .single();

    if (error) {
      logger.error('Error revoking guest pass', { error: error.message });
      return res.status(500).json({ error: 'Failed to revoke guest pass' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Guest pass not found or already revoked' });
    }

    await writeAuditLog(homeId, actorId, 'guest_pass_revoked', 'HomeGuestPass', passId, {});

    res.json({ message: 'Guest pass revoked', pass: data });
  } catch (err) {
    logger.error('Revoke guest pass error', { error: err.message });
    res.status(500).json({ error: 'Failed to revoke guest pass' });
  }
});


// ============================================================
// POST /:id/scoped-grants — Create a share link for a single resource
// ============================================================

router.post('/:id/scoped-grants', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const actorId = req.user.id;

    const access = await checkHomePermission(homeId, actorId, 'home.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to create share links' });
    }

    const {
      resource_type,
      resource_id,
      duration_hours = 24,
      passcode,
      can_edit = false,
    } = req.body;

    if (!resource_type || !resource_id) {
      return res.status(400).json({ error: 'resource_type and resource_id are required' });
    }

    const validTypes = ['HomeIssue', 'HomeTask', 'HomeDocument', 'HomeCalendarEvent', 'HomeAsset', 'HomePackage'];
    if (!validTypes.includes(resource_type)) {
      return res.status(400).json({ error: `Invalid resource_type. Must be one of: ${validTypes.join(', ')}` });
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    let passcodeHash = null;
    if (passcode && passcode.length > 0) {
      passcodeHash = crypto.createHash('sha256').update(passcode).digest('hex');
    }

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + duration_hours * 60 * 60 * 1000);

    const { data, error } = await supabaseAdmin
      .from('HomeScopedGrant')
      .insert({
        home_id: homeId,
        resource_type,
        resource_id,
        can_view: true,
        can_edit,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        token_hash: tokenHash,
        passcode_hash: passcodeHash,
        max_views: null,
        view_count: 0,
        created_by: actorId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating scoped grant', { error: error.message });
      return res.status(500).json({ error: 'Failed to create share link' });
    }

    await writeAuditLog(homeId, actorId, 'scoped_grant_created', 'HomeScopedGrant', data.id, {
      resource_type,
      resource_id,
      duration_hours,
    });

    res.status(201).json({
      grant: data,
      token, // only returned on creation
    });
  } catch (err) {
    logger.error('Create scoped grant error', { error: err.message });
    res.status(500).json({ error: 'Failed to create share link' });
  }
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

    const home = homeRes.status === 'fulfilled' ? homeRes.value.data : null;
    if (!home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    const preferences = prefRes.status === 'fulfilled' ? (prefRes.value.data || []) : [];

    // Transform preferences into a key-value map
    const prefMap = {};
    for (const pref of preferences) {
      prefMap[pref.key] = pref.value;
    }

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

    const promises = [];

    // Update home fields if any
    if (Object.keys(homeUpdates).length > 0) {
      homeUpdates.updated_at = new Date().toISOString();
      promises.push(
        supabaseAdmin
          .from('Home')
          .update(homeUpdates)
          .eq('id', homeId)
      );
    }

    // Upsert HomePreference rows if provided
    if (preferences && typeof preferences === 'object') {
      const prefRows = Object.entries(preferences).map(([key, value]) => ({
        home_id: homeId,
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        updated_at: new Date().toISOString(),
      }));

      if (prefRows.length > 0) {
        promises.push(
          supabaseAdmin
            .from('HomePreference')
            .upsert(prefRows, { onConflict: 'home_id,key' })
        );
      }
    }

    if (promises.length === 0) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    const results = await Promise.allSettled(promises);

    // Check for errors
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.error) {
        logger.error('Error updating settings', { error: result.value.error.message });
        return res.status(500).json({ error: 'Failed to update settings' });
      }
    }

    await writeAuditLog(homeId, actorId, 'home_settings_updated', 'Home', homeId, {
      fields_updated: Object.keys(homeUpdates).filter(k => k !== 'updated_at'),
      preferences_updated: preferences ? Object.keys(preferences) : [],
    });

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
