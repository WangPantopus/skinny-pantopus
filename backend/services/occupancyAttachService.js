/**
 * OccupancyAttachService — SINGLE GATEWAY for HomeOccupancy creation
 *
 * Every code path that creates or reactivates a HomeOccupancy record MUST go
 * through this service.  Direct inserts/upserts to the HomeOccupancy table
 * outside this file are considered bugs.
 *
 * Enforcement rules:
 *  1. Address must have a valid AddressClaim (status = 'verified') —
 *     or an escalated method (landlord_invite, admin_override, owner_bootstrap, owner_invite)
 *  2. Multi-unit buildings require a unit number
 *  3. Verification tier determines role/permissions
 *  4. Household conflict handling (attach policy)
 *  5. Every attach/detach logged to HomeAuditLog
 *
 * "Detach" (deactivation) also lives here so ALL mutations are auditable.
 */

const logger = require('../utils/logger');
const supabaseAdmin = require('../config/supabaseAdmin');
const { writeAuditLog, applyOccupancyTemplate, VERIFIED_TEMPLATES, ALL_FALSE_TEMPLATE } = require('../utils/homePermissions');

// ── Verification method → role mapping ──────────────────────

const VERIFICATION_ROLE_MAP = {
  autocomplete_ok:    null,           // role derived from claim_type
  mail_code:          'member',       // NEVER admin; limited permissions
  landlord_approval:  'lease_resident',
  landlord_invite:    'lease_resident',
  owner_invite:       'owner',
  doc_upload:         null,           // role derived from claim_type
  manual_review:      null,           // role derived from claim_type
};

/** Methods that bypass the AddressClaim check. */
const ESCALATED_METHODS = new Set([
  'landlord_invite',
  'admin_override',
  'owner_bootstrap',
  'owner_invite',
]);

/** claim_type → default occupancy role. */
const CLAIM_TYPE_ROLE_MAP = {
  owner:    'owner',
  admin:    'admin',
  resident: 'member',
  member:   'member',
};

class OccupancyAttachService {
  // ================================================================
  // attach — THE single entry point for creating/reactivating occupancy
  // ================================================================

  /**
   * Attach a user to a home with full enforcement.
   *
   * @param {object} params
   * @param {string} params.homeId         - Home UUID
   * @param {string} params.userId         - User UUID
   * @param {string} params.method         - How the user was verified:
   *   'autocomplete_ok' | 'mail_code' | 'landlord_approval' | 'landlord_invite' |
   *   'doc_upload' | 'manual_review' | 'admin_override' | 'owner_bootstrap' | 'owner_invite'
   * @param {string} [params.claimType]    - 'owner' | 'admin' | 'resident' | 'member'
   * @param {string} [params.roleOverride] - Force a specific role (for admin/system paths)
   * @param {string} [params.unitNumber]   - Unit/apt for multi-unit buildings
   * @param {string} [params.actorId]      - Who triggered the attach (for audit)
   * @param {object} [params.metadata]     - Extra audit metadata
   * @returns {Promise<{success: boolean, error?: string, occupancy?: object, status?: string}>}
   *   status: 'attached' | 'reactivated' | 'pending_approval' | 'upgraded'
   */
  async attach({
    homeId,
    userId,
    method,
    claimType,
    roleOverride,
    unitNumber,
    actorId,
    metadata = {},
  }) {
    // ── 1. Fetch home + address ────────────────────────────────
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id, name, address_id, home_type, owner_id, member_attach_policy, security_state')
      .eq('id', homeId)
      .maybeSingle();

    if (!home) {
      return { success: false, error: 'Home not found' };
    }

    // ── 2. Validate AddressClaim (unless escalated) ────────────
    if (!ESCALATED_METHODS.has(method)) {
      const claimResult = await this._validateClaim(userId, home.address_id, unitNumber);
      if (!claimResult.valid) {
        return { success: false, error: claimResult.error };
      }
    }

    // ── 3. Multi-unit building check ───────────────────────────
    if (home.address_id) {
      const unitCheck = await this._checkUnitRequirement(home.address_id, unitNumber);
      if (!unitCheck.valid) {
        return { success: false, error: unitCheck.error };
      }
    }

    // ── 4. Determine role ──────────────────────────────────────
    const role = this._resolveRole(method, claimType, roleOverride);

    // ── 5. Determine verification status ───────────────────────
    const verificationStatus = this._resolveVerificationStatus(method);

    // ── 6. Check for existing occupancy ────────────────────────
    const { data: existing } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('*')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing && existing.is_active) {
      // Already active — check if we should upgrade
      return this._handleExistingActive(existing, role, verificationStatus, method, actorId || userId, metadata);
    }

    // ── 7. Household conflict handling ─────────────────────────
    const policyResult = await this._applyAttachPolicy(home, userId, role, verificationStatus, method);
    if (policyResult.deferred) {
      return policyResult;
    }

    // ── 8. First-verified-user → household_creator ─────────────
    const isFirstVerified = await this._isFirstVerifiedOccupant(homeId);

    // ── 9. Create or reactivate occupancy ──────────────────────
    let resultStatus;
    let occupancy;

    if (existing && !existing.is_active) {
      // Reactivate
      resultStatus = 'reactivated';
      occupancy = await this._reactivateOccupancy(existing, role, verificationStatus, isFirstVerified);
    } else {
      // Create new
      resultStatus = 'attached';
      occupancy = await this._createOccupancy(homeId, userId, role, verificationStatus, isFirstVerified);
    }

    if (!occupancy) {
      return { success: false, error: 'Failed to create occupancy record' };
    }

    // ── 10. Apply permission template ──────────────────────────
    try {
      await applyOccupancyTemplate(homeId, userId, role, verificationStatus);
    } catch (templateErr) {
      logger.warn('OccupancyAttachService: template application failed (non-fatal)', {
        error: templateErr.message, homeId, userId,
      });
    }

    // ── 11. Clear vacancy if verified ──────────────────────────
    if (verificationStatus === 'verified') {
      await supabaseAdmin
        .from('Home')
        .update({ vacancy_at: null, updated_at: new Date().toISOString() })
        .eq('id', homeId)
        .not('vacancy_at', 'is', null);
    }

    // ── 12. Audit log ──────────────────────────────────────────
    await writeAuditLog(homeId, actorId || userId, 'OCCUPANCY_ATTACHED', 'HomeOccupancy', occupancy.id, {
      method,
      role,
      verification_status: verificationStatus,
      claim_type: claimType || null,
      status: resultStatus,
      is_first_verified: isFirstVerified,
      ...metadata,
    });

    logger.info('OccupancyAttachService: attached', {
      homeId, userId, role, method, status: resultStatus,
    });

    return { success: true, occupancy, status: resultStatus };
  }

  // ================================================================
  // detach — Deactivate an occupancy (move-out, removal, lease end)
  // ================================================================

  /**
   * Deactivate a user's occupancy at a home.
   *
   * @param {object} params
   * @param {string} params.homeId
   * @param {string} params.userId
   * @param {string} params.reason    - 'move_out' | 'removed' | 'lease_ended' | 'challenged' | 'suspended'
   * @param {string} [params.actorId] - Who initiated the detach
   * @param {object} [params.metadata]
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async detach({ homeId, userId, reason, actorId, metadata = {} }) {
    const now = new Date().toISOString();

    const { data: occupancy } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id, is_active')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!occupancy) {
      return { success: false, error: 'No active occupancy found' };
    }

    const verificationStatus = reason === 'move_out' ? 'moved_out'
      : reason === 'challenged' ? 'suspended_challenged'
        : reason === 'suspended' ? 'suspended'
          : 'inactive';

    const { error } = await supabaseAdmin
      .from('HomeOccupancy')
      .update({
        is_active: false,
        end_at: now,
        verification_status: verificationStatus,
        updated_at: now,
      })
      .eq('id', occupancy.id);

    if (error) {
      logger.error('OccupancyAttachService.detach: update failed', {
        error: error.message, homeId, userId,
      });
      return { success: false, error: 'Failed to deactivate occupancy' };
    }

    await writeAuditLog(homeId, actorId || userId, 'OCCUPANCY_DETACHED', 'HomeOccupancy', occupancy.id, {
      reason,
      verification_status: verificationStatus,
      ...metadata,
    });

    logger.info('OccupancyAttachService: detached', { homeId, userId, reason });

    return { success: true };
  }

  // ================================================================
  // upgradeRole — Promote an existing occupant (e.g. claim approved)
  // ================================================================

  /**
   * Upgrade an active occupant's role (e.g. member → owner after claim).
   *
   * @param {object} params
   * @param {string} params.homeId
   * @param {string} params.userId
   * @param {string} params.newRole
   * @param {string} [params.verificationStatus='verified']
   * @param {string} [params.actorId]
   * @param {object} [params.metadata]
   * @returns {Promise<{success: boolean, error?: string, occupancy?: object}>}
   */
  async upgradeRole({ homeId, userId, newRole, verificationStatus = 'verified', actorId, metadata = {} }) {
    const { data: existing } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id, role, role_base, is_active')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: 'No occupancy found for this user' };
    }

    const previousRole = existing.role_base;

    try {
      const { occupancy } = await applyOccupancyTemplate(homeId, userId, newRole, verificationStatus);

      await writeAuditLog(homeId, actorId || userId, 'OCCUPANCY_ROLE_UPGRADED', 'HomeOccupancy', existing.id, {
        previous_role: previousRole,
        new_role: newRole,
        verification_status: verificationStatus,
        ...metadata,
      });

      return { success: true, occupancy };
    } catch (err) {
      logger.error('OccupancyAttachService.upgradeRole: failed', {
        error: err.message, homeId, userId, newRole,
      });
      return { success: false, error: 'Failed to upgrade role' };
    }
  }

  // ── Private: Validation ─────────────────────────────────────

  /**
   * Validate that the user has a verified AddressClaim for this address.
   */
  async _validateClaim(userId, addressId, unitNumber) {
    if (!addressId) {
      // No address linked to home — skip claim check (legacy homes)
      return { valid: true };
    }

    const query = supabaseAdmin
      .from('AddressClaim')
      .select('id, claim_status, verification_method, claim_type')
      .eq('user_id', userId)
      .eq('address_id', addressId)
      .eq('claim_status', 'verified');

    const { data: claims } = await query;

    if (!claims || claims.length === 0) {
      return { valid: false, error: 'No verified address claim found. Complete address verification first.' };
    }

    return { valid: true, claim: claims[0] };
  }

  /**
   * Check if a unit number is required for multi-unit buildings.
   */
  async _checkUnitRequirement(addressId, unitNumber) {
    const { data: address } = await supabaseAdmin
      .from('HomeAddress')
      .select('building_type, missing_secondary_flag')
      .eq('id', addressId)
      .maybeSingle();

    if (!address) {
      return { valid: true }; // No address record — allow
    }

    if (address.building_type === 'multi_unit' && address.missing_secondary_flag && !unitNumber) {
      return {
        valid: false,
        error: 'This is a multi-unit building. A unit number is required.',
      };
    }

    return { valid: true };
  }

  // ── Private: Role / Status Resolution ───────────────────────

  /**
   * Determine the occupancy role based on verification method + claim type.
   */
  _resolveRole(method, claimType, roleOverride) {
    if (roleOverride) return roleOverride;

    // Method-specific role
    const methodRole = VERIFICATION_ROLE_MAP[method];
    if (methodRole) return methodRole;

    // Derive from claim type
    if (claimType) return CLAIM_TYPE_ROLE_MAP[claimType] || 'member';

    // Fallback
    return 'member';
  }

  /**
   * Map the method to a verificationStatus value.
   */
  _resolveVerificationStatus(method) {
    switch (method) {
      case 'autocomplete_ok':
      case 'mail_code':
      case 'landlord_invite':
      case 'owner_invite':
      case 'admin_override':
      case 'doc_upload':
        return 'verified';

      case 'landlord_approval':
        return 'verified';

      case 'owner_bootstrap':
        return 'provisional_bootstrap';

      default:
        return 'unverified';
    }
  }

  // ── Private: Household Policy ───────────────────────────────

  /**
   * Apply the home's member_attach_policy.
   *
   * @returns {Promise<{deferred: boolean, success?: boolean, status?: string, error?: string, occupancy?: object}>}
   */
  async _applyAttachPolicy(home, userId, role, verificationStatus, method) {
    const policy = home.member_attach_policy || 'open_invite';

    // Escalated methods bypass policy checks
    if (ESCALATED_METHODS.has(method)) {
      return { deferred: false };
    }

    // Owners/admins always attach immediately
    if (role === 'owner' || role === 'admin') {
      return { deferred: false };
    }

    // Check if household has any active occupants
    const { data: occupants } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id')
      .eq('home_id', home.id)
      .eq('is_active', true)
      .limit(1);

    const householdExists = occupants && occupants.length > 0;

    if (!householdExists) {
      // No household → first verified user becomes creator; attach immediately
      return { deferred: false };
    }

    // Household exists — apply policy
    switch (policy) {
      case 'open_invite':
        return { deferred: false };

      case 'admin_approval': {
        // Create as pending (is_active = false)
        const occupancy = await this._createPendingOccupancy(home.id, userId, role);
        if (!occupancy) {
          return { deferred: true, success: false, error: 'Failed to create pending occupancy' };
        }

        await writeAuditLog(home.id, userId, 'OCCUPANCY_PENDING_APPROVAL', 'HomeOccupancy', occupancy.id, {
          method,
          policy,
        });

        return {
          deferred: true,
          success: true,
          occupancy,
          status: 'pending_approval',
        };
      }

      case 'verified_only': {
        // Require landlord verification
        const { data: authority } = await supabaseAdmin
          .from('HomeAuthority')
          .select('id')
          .eq('home_id', home.id)
          .eq('status', 'verified')
          .limit(1)
          .maybeSingle();

        if (!authority && method !== 'landlord_approval' && method !== 'landlord_invite') {
          return {
            deferred: true,
            success: false,
            error: 'This home requires landlord verification. Contact the property manager.',
          };
        }

        return { deferred: false };
      }

      default:
        return { deferred: false };
    }
  }

  // ── Private: Occupancy Creation ─────────────────────────────

  /**
   * Check if this will be the first verified occupant.
   */
  async _isFirstVerifiedOccupant(homeId) {
    const { data: existing } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id')
      .eq('home_id', homeId)
      .eq('is_active', true)
      .limit(1);

    return !existing || existing.length === 0;
  }

  /**
   * Create a new active HomeOccupancy record.
   */
  async _createOccupancy(homeId, userId, role, verificationStatus, isFirstVerified) {
    const now = new Date().toISOString();

    const { data: occupancy, error } = await supabaseAdmin
      .from('HomeOccupancy')
      .insert({
        home_id: homeId,
        user_id: userId,
        role,
        role_base: role,
        is_active: true,
        verification_status: verificationStatus,
        can_manage_home: isFirstVerified,
        start_at: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error('OccupancyAttachService._createOccupancy: insert failed', {
        error: error.message, homeId, userId,
      });
      return null;
    }

    return occupancy;
  }

  /**
   * Create a pending occupancy (admin_approval policy).
   */
  async _createPendingOccupancy(homeId, userId, role) {
    const now = new Date().toISOString();

    const { data: occupancy, error } = await supabaseAdmin
      .from('HomeOccupancy')
      .insert({
        home_id: homeId,
        user_id: userId,
        role,
        role_base: role,
        is_active: false,
        verification_status: 'pending_approval',
        start_at: null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error('OccupancyAttachService._createPendingOccupancy: insert failed', {
        error: error.message, homeId, userId,
      });
      return null;
    }

    return occupancy;
  }

  /**
   * Reactivate an existing inactive occupancy.
   */
  async _reactivateOccupancy(existing, role, verificationStatus, isFirstVerified) {
    const now = new Date().toISOString();

    const { data: occupancy, error } = await supabaseAdmin
      .from('HomeOccupancy')
      .update({
        role,
        role_base: role,
        is_active: true,
        verification_status: verificationStatus,
        can_manage_home: isFirstVerified || undefined,
        start_at: now,
        end_at: null,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      logger.error('OccupancyAttachService._reactivateOccupancy: update failed', {
        error: error.message, occupancyId: existing.id,
      });
      return null;
    }

    return occupancy;
  }

  /**
   * Handle the case where an active occupancy already exists.
   * If the new role is higher, upgrade; otherwise no-op.
   */
  async _handleExistingActive(existing, newRole, verificationStatus, method, actorId, metadata) {
    const ROLE_RANK = {
      guest: 10, restricted_member: 20, member: 30, lease_resident: 35,
      manager: 40, admin: 50, owner: 60,
    };

    const existingRank = ROLE_RANK[existing.role_base] || 0;
    const newRank = ROLE_RANK[newRole] || 0;

    if (newRank > existingRank) {
      // Upgrade
      try {
        const { occupancy } = await applyOccupancyTemplate(
          existing.home_id, existing.user_id, newRole, verificationStatus,
        );

        await writeAuditLog(existing.home_id, actorId, 'OCCUPANCY_UPGRADED', 'HomeOccupancy', existing.id, {
          method,
          previous_role: existing.role_base,
          new_role: newRole,
          ...metadata,
        });

        return { success: true, occupancy, status: 'upgraded' };
      } catch (err) {
        logger.error('OccupancyAttachService: upgrade failed', { error: err.message });
        return { success: false, error: 'Failed to upgrade occupancy' };
      }
    }

    // Already attached at equal/higher role — just update verification if needed
    if (existing.verification_status !== 'verified' && verificationStatus === 'verified') {
      await supabaseAdmin
        .from('HomeOccupancy')
        .update({
          verification_status: 'verified',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    }

    return {
      success: true,
      occupancy: existing,
      status: 'already_attached',
    };
  }
}

// Expose constants for testing
OccupancyAttachService.VERIFICATION_ROLE_MAP = VERIFICATION_ROLE_MAP;
OccupancyAttachService.ESCALATED_METHODS = ESCALATED_METHODS;
OccupancyAttachService.CLAIM_TYPE_ROLE_MAP = CLAIM_TYPE_ROLE_MAP;

module.exports = new OccupancyAttachService();
module.exports.OccupancyAttachService = OccupancyAttachService;
