/**
 * Landlord Authority Service
 *
 * Manages landlord/property-manager authority verification and tenant
 * approval flows. Covers the full lifecycle from authority requests
 * through lease creation and eventual termination.
 *
 * Methods:
 *   requestAuthority(subjectType, subjectId, homeId, evidenceType, evidence?)
 *   verifyAuthority(authorityId, reviewerId, decision, note?)
 *   inviteTenant(authorityId, homeId, inviteeEmail, startAt, endAt?)
 *   acceptInvite(token, userId)
 *   approveTenantRequest(leaseId, authorityId, dates, actorId)
 *   denyTenantRequest(leaseId, authorityId, reason, actorId)
 *   endLease(leaseId, initiatedBy)
 *
 * Tables used:
 *   HomeAuthority, HomeLease, HomeLeaseInvite, HomeLeaseResident,
 *   HomeOwnershipClaim, HomeVerificationEvidence, HomeOccupancy,
 *   HomeAuditLog, Notification
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');
const supabaseAdmin = require('../../config/supabaseAdmin');
const { writeAuditLog } = require('../../utils/homePermissions');
const homeClaimCompatService = require('../homeClaimCompatService');

// ── Constants ────────────────────────────────────────────────

/** Invite token validity. */
const INVITE_EXPIRY_DAYS = 14;

/** Evidence type → verification tier mapping. */
const EVIDENCE_TIER_MAP = {
  deed: 'strong',
  closing_disclosure: 'strong',
  escrow_attestation: 'legal',
  title_match: 'standard',
  tax_bill: 'standard',
  utility_bill: 'weak',
  lease: 'standard',
  idv: 'standard',
};

class LandlordAuthorityService {
  // ================================================================
  // requestAuthority
  // ================================================================

  /**
   * Create a new HomeAuthority request for a landlord or property manager.
   *
   * @param {'user'|'business'|'trust'} subjectType
   * @param {string} subjectId
   * @param {string} homeId
   * @param {string} evidenceType  - e.g. 'deed', 'lease', 'utility_bill'
   * @param {object} [evidence]    - { storage_ref, metadata } for document upload
   * @returns {Promise<{success: boolean, error?: string, authority?: object, claim?: object}>}
   */
  async requestAuthority(subjectType, subjectId, homeId, evidenceType, evidence) {
    // ── 1. Verify home exists ─────────────────────────────────
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id, name')
      .eq('id', homeId)
      .maybeSingle();

    if (!home) {
      return { success: false, error: 'Home not found' };
    }

    // ── 2. Check for existing active authority ────────────────
    const { data: existing } = await supabaseAdmin
      .from('HomeAuthority')
      .select('id, status')
      .eq('home_id', homeId)
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .neq('status', 'revoked')
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: existing.status === 'verified'
          ? 'Subject already has verified authority for this home'
          : 'Subject already has a pending authority request for this home',
      };
    }

    // ── 3. Create HomeAuthority (pending) ─────────────────────
    const { data: authority, error: authErr } = await supabaseAdmin
      .from('HomeAuthority')
      .insert({
        home_id: homeId,
        subject_type: subjectType,
        subject_id: subjectId,
        role: 'owner',
        status: 'pending',
        verification_tier: 'weak',
        added_via: 'landlord_portal',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (authErr) {
      logger.error('LandlordAuthorityService.requestAuthority: insert failed', {
        subjectType, subjectId, homeId, error: authErr.message,
      });
      return { success: false, error: 'Failed to create authority request' };
    }

    // ── 4. If evidence provided, create claim + evidence ──────
    let claim = null;
    if (evidence) {
      const { data: claimData, error: claimErr } = await supabaseAdmin
        .from('HomeOwnershipClaim')
        .insert({
          home_id: homeId,
          claimant_user_id: subjectId,
          claim_type: 'owner',
          state: 'submitted',
          method: 'landlord_portal',
          ...(await homeClaimCompatService.buildInitialClaimCompatibilityFields({
            homeId,
            userId: subjectId,
            claimType: 'owner',
            method: 'landlord_portal',
            legacyState: 'submitted',
          })),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (claimErr) {
        logger.error('LandlordAuthorityService.requestAuthority: claim insert failed', {
          authorityId: authority.id, error: claimErr.message,
        });
      } else {
        claim = claimData;
        await homeClaimCompatService.recalculateHouseholdResolutionState(homeId);

        await supabaseAdmin
          .from('HomeVerificationEvidence')
          .insert({
            claim_id: claim.id,
            evidence_type: evidenceType,
            provider: evidence.provider || 'manual',
            status: 'pending',
            storage_ref: evidence.storage_ref || null,
            metadata: evidence.metadata || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }
    }

    // ── 5. Audit log ──────────────────────────────────────────
    await writeAuditLog(homeId, subjectId, 'AUTHORITY_REQUESTED', 'HomeAuthority', authority.id, {
      subject_type: subjectType,
      evidence_type: evidenceType,
      has_evidence: !!evidence,
    });

    logger.info('LandlordAuthorityService.requestAuthority: created', {
      authorityId: authority.id, homeId, subjectType, subjectId,
    });

    return { success: true, authority, claim };
  }

  // ================================================================
  // verifyAuthority
  // ================================================================

  /**
   * Approve or revoke a HomeAuthority request.
   *
   * @param {string} authorityId
   * @param {string} reviewerId
   * @param {'verified'|'revoked'} decision
   * @param {string} [note]
   * @returns {Promise<{success: boolean, error?: string, authority?: object}>}
   */
  async verifyAuthority(authorityId, reviewerId, decision, note) {
    if (!['verified', 'revoked'].includes(decision)) {
      return { success: false, error: 'Decision must be "verified" or "revoked"' };
    }

    // ── 1. Fetch authority ────────────────────────────────────
    const { data: authority } = await supabaseAdmin
      .from('HomeAuthority')
      .select('*')
      .eq('id', authorityId)
      .maybeSingle();

    if (!authority) {
      return { success: false, error: 'Authority record not found' };
    }

    if (authority.status !== 'pending') {
      return { success: false, error: `Cannot verify: authority is already ${authority.status}` };
    }

    // ── 2. Determine verification tier from evidence ──────────
    let verificationTier = 'weak';
    if (decision === 'verified') {
      // Look for linked evidence via HomeOwnershipClaim
      const { data: claims } = await supabaseAdmin
        .from('HomeOwnershipClaim')
        .select('id')
        .eq('home_id', authority.home_id)
        .eq('claimant_user_id', authority.subject_id)
        .in('state', ['submitted', 'pending_review']);

      if (claims && claims.length > 0) {
        const claimIds = claims.map((c) => c.id);
        const { data: evidenceRows } = await supabaseAdmin
          .from('HomeVerificationEvidence')
          .select('evidence_type, status')
          .in('claim_id', claimIds);

        if (evidenceRows && evidenceRows.length > 0) {
          // Use the highest-tier verified evidence
          for (const ev of evidenceRows) {
            const tier = EVIDENCE_TIER_MAP[ev.evidence_type] || 'weak';
            if (this._tierRank(tier) > this._tierRank(verificationTier)) {
              verificationTier = tier;
            }
          }
        }
      }
    }

    // ── 3. Update authority ───────────────────────────────────
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('HomeAuthority')
      .update({
        status: decision,
        verification_tier: decision === 'verified' ? verificationTier : authority.verification_tier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authorityId)
      .select()
      .single();

    if (updateErr) {
      logger.error('LandlordAuthorityService.verifyAuthority: update failed', {
        authorityId, error: updateErr.message,
      });
      return { success: false, error: 'Failed to update authority' };
    }

    // ── 4. Audit log ──────────────────────────────────────────
    await writeAuditLog(authority.home_id, reviewerId, `AUTHORITY_${decision.toUpperCase()}`, 'HomeAuthority', authorityId, {
      reviewer_id: reviewerId,
      verification_tier: verificationTier,
      note: note || null,
    });

    logger.info('LandlordAuthorityService.verifyAuthority: updated', {
      authorityId, decision, verificationTier,
    });

    return { success: true, authority: updated };
  }

  // ================================================================
  // inviteTenant
  // ================================================================

  /**
   * Invite a tenant to a home via email.
   *
   * @param {string} authorityId
   * @param {string} homeId
   * @param {string} inviteeEmail
   * @param {string} startAt  - proposed lease start (ISO string)
   * @param {string} [endAt]  - proposed lease end (ISO string)
   * @returns {Promise<{success: boolean, error?: string, invite?: object, token?: string}>}
   */
  async inviteTenant(authorityId, homeId, inviteeEmail, startAt, endAt) {
    // ── 1. Verify authority is verified + active ──────────────
    const { data: authority } = await supabaseAdmin
      .from('HomeAuthority')
      .select('*')
      .eq('id', authorityId)
      .maybeSingle();

    if (!authority) {
      return { success: false, error: 'Authority record not found' };
    }

    if (authority.status !== 'verified') {
      return { success: false, error: 'Authority must be verified to invite tenants' };
    }

    if (authority.home_id !== homeId) {
      return { success: false, error: 'Authority does not match home' };
    }

    // ── 2. Verify home exists and is a unit (not building) ───
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id, name, home_type')
      .eq('id', homeId)
      .maybeSingle();

    if (!home) {
      return { success: false, error: 'Home not found' };
    }

    if (home.home_type === 'building') {
      return { success: false, error: 'Cannot invite tenants to a building — use a unit' };
    }

    // ── 3. Check for existing pending invite ──────────────────
    const { data: existingInvite } = await supabaseAdmin
      .from('HomeLeaseInvite')
      .select('id')
      .eq('home_id', homeId)
      .eq('invitee_email', inviteeEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return { success: false, error: 'Pending invite already exists for this email' };
    }

    // ── 4. Generate invite token + hash ───────────────────────
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // ── 5. Create HomeLeaseInvite ─────────────────────────────
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from('HomeLeaseInvite')
      .insert({
        home_id: homeId,
        landlord_subject_type: authority.subject_type,
        landlord_subject_id: authority.subject_id,
        invitee_email: inviteeEmail,
        token_hash: tokenHash,
        proposed_start: startAt,
        proposed_end: endAt || null,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (inviteErr) {
      logger.error('LandlordAuthorityService.inviteTenant: invite insert failed', {
        authorityId, homeId, error: inviteErr.message,
      });
      return { success: false, error: 'Failed to create invite' };
    }

    // ── 6. Send notification ──────────────────────────────────
    try {
      // Look up invitee by email to send in-app notification
      const { data: invitee } = await supabaseAdmin
        .from('User')
        .select('id')
        .eq('email', inviteeEmail)
        .maybeSingle();

      if (invitee) {
        // Link invite to user
        await supabaseAdmin
          .from('HomeLeaseInvite')
          .update({ invitee_user_id: invitee.id })
          .eq('id', invite.id);

        const notificationService = require('../notificationService');
        notificationService.createNotification({
          userId: invitee.id,
          type: 'lease_invite',
          title: 'You\'ve been invited to a home',
          body: `You have been invited to live at ${home.name || 'a verified home'}. Accept the invite to set up your account.`,
          icon: '🏠',
          link: `/invite/lease/${token}`,
          metadata: { home_id: homeId, invite_id: invite.id },
        });
      }
    } catch (notifErr) {
      logger.warn('LandlordAuthorityService.inviteTenant: notification failed (non-fatal)', {
        error: notifErr.message,
      });
    }

    // ── 7. Audit log ──────────────────────────────────────────
    await writeAuditLog(homeId, authority.subject_id, 'TENANT_INVITED', 'HomeLeaseInvite', invite.id, {
      invitee_email: inviteeEmail,
      proposed_start: startAt,
      proposed_end: endAt || null,
    });

    logger.info('LandlordAuthorityService.inviteTenant: created', {
      inviteId: invite.id, homeId, inviteeEmail,
    });

    return { success: true, invite, token };
  }

  // ================================================================
  // acceptInvite
  // ================================================================

  /**
   * Accept a lease invite using the raw token.
   *
   * @param {string} token - raw invite token
   * @param {string} userId
   * @param {string} userEmail - authenticated user's email (for identity binding)
   * @returns {Promise<{success: boolean, error?: string, lease?: object, occupancy?: object}>}
   */
  async acceptInvite(token, userId, userEmail) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return this._decideLease({
      p_action: 'accept', p_actor_id: userId, p_token_hash: tokenHash,
      p_user_email: userEmail || null,
    });
  }

  /** Approve with the authenticated actor and optional reviewed dates. */
  async approveTenantRequest(leaseId, authorityId, dates = {}, actorId) {
    const result = await this._decideLease({
      p_action: 'approve', p_actor_id: actorId, p_lease_id: leaseId,
      p_authority_id: authorityId, p_dates: dates,
    });
    if (!result.success || result.replayed) return result;
    const lease = result.lease;
    await this._notifyLeaseDecision({
      userId: lease.primary_resident_user_id,
      type: 'lease_approved', title: 'Your lease has been approved',
      body: 'Your landlord approved your lease request. Access follows your approved lease dates.',
      icon: '🏡', link: `/homes/${lease.home_id}/dashboard`,
      metadata: { home_id: lease.home_id, lease_id: leaseId },
    });
    return result;
  }

  /** Denial shares the approval transaction so competing decisions cannot win. */
  async denyTenantRequest(leaseId, authorityId, reason, actorId) {
    const result = await this._decideLease({
      p_action: 'deny', p_actor_id: actorId, p_lease_id: leaseId,
      p_authority_id: authorityId, p_reason: reason || null,
    });
    if (!result.success || result.replayed) return result;
    const lease = result.lease;
    await this._notifyLeaseDecision({
      userId: lease.primary_resident_user_id,
      type: 'lease_denied', title: 'Lease request denied',
      body: reason ? `Your lease request was denied: ${reason}`
        : 'Your lease request was denied by the property authority.',
      icon: '🚫', link: `/homes/${lease.home_id}`,
      metadata: { home_id: lease.home_id, lease_id: leaseId, reason: reason || null },
    });
    return result;
  }

  async _decideLease(params) {
    if (!params.p_actor_id) return { success: false, error: 'Authenticated actor required' };
    try {
      const { data, error } = await supabaseAdmin.rpc('decide_home_lease', {
        ...params, p_validity_days: require('../../utils/verificationAge').validityDays(),
      });
      if (error || !data || typeof data.success !== 'boolean'
        || (!data.success && typeof data.error !== 'string')
        || (data.success && (!data.lease || (params.p_action !== 'deny' && !data.occupancy)))) {
        logger.error('LandlordAuthorityService: lease transaction unavailable', {
          action: params.p_action, leaseId: params.p_lease_id, code: error?.code,
        });
        return { success: false, error: 'Unable to complete lease decision. Please retry.' };
      }
      return data;
    } catch (error) {
      logger.error('LandlordAuthorityService: lease transaction interrupted', {
        action: params.p_action, leaseId: params.p_lease_id, code: error.code,
      });
      return { success: false, error: 'Unable to complete lease decision. Please retry.' };
    }
  }

  async _notifyLeaseDecision(notification) {
    try {
      await require('../notificationService').createNotification(notification);
    } catch (error) {
      logger.warn('LandlordAuthorityService: decision notification failed (non-fatal)', { code: error.code });
    }
  }

  // ================================================================
  // endLease
  // ================================================================

  /**
   * End an active lease.
   *
   * @param {string} leaseId
   * @param {string} initiatedBy - userId of person ending the lease
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async endLease(leaseId, initiatedBy) {
    // ── 1. Fetch lease ────────────────────────────────────────
    const { data: lease } = await supabaseAdmin
      .from('HomeLease')
      .select('*')
      .eq('id', leaseId)
      .maybeSingle();

    if (!lease) {
      return { success: false, error: 'Lease not found' };
    }

    if (lease.state !== 'active') {
      return { success: false, error: `Cannot end: lease is ${lease.state}` };
    }

    // ── 2. End the lease ──────────────────────────────────────
    const now = new Date().toISOString();

    const { error: updateErr } = await supabaseAdmin
      .from('HomeLease')
      .update({
        state: 'ended',
        end_at: now,
        updated_at: now,
      })
      .eq('id', leaseId);

    if (updateErr) {
      logger.error('LandlordAuthorityService.endLease: update failed', {
        leaseId, error: updateErr.message,
      });
      return { success: false, error: 'Failed to end lease' };
    }

    // ── 3. Deactivate HomeOccupancy (via centralized gateway) ──
    const occupancyAttachService = require('../occupancyAttachService');
    await occupancyAttachService.detach({
      homeId: lease.home_id,
      userId: lease.primary_resident_user_id,
      reason: 'lease_ended',
      actorId: initiatedBy,
      metadata: { lease_id: leaseId },
    });

    // Also deactivate any co-residents on this lease
    const { data: residents } = await supabaseAdmin
      .from('HomeLeaseResident')
      .select('user_id')
      .eq('lease_id', leaseId);

    if (residents && residents.length > 0) {
      for (const resident of residents) {
        await occupancyAttachService.detach({
          homeId: lease.home_id,
          userId: resident.user_id,
          reason: 'lease_ended',
          actorId: initiatedBy,
          metadata: { lease_id: leaseId },
        });
      }
    }

    // ── 4. Notify tenant ──────────────────────────────────────
    try {
      const notificationService = require('../notificationService');
      notificationService.createNotification({
        userId: lease.primary_resident_user_id,
        type: 'lease_ended',
        title: 'Your lease has ended',
        body: 'Your lease has been terminated. You will retain your own content history but lose household access.',
        icon: '📋',
        link: `/homes/${lease.home_id}`,
        metadata: { home_id: lease.home_id, lease_id: leaseId, initiated_by: initiatedBy },
      });
    } catch (notifErr) {
      logger.warn('LandlordAuthorityService.endLease: notification failed (non-fatal)', {
        error: notifErr.message,
      });
    }

    // ── 5. Audit log ──────────────────────────────────────────
    await writeAuditLog(lease.home_id, initiatedBy, 'LEASE_ENDED', 'HomeLease', leaseId, {
      tenant_user_id: lease.primary_resident_user_id,
      initiated_by: initiatedBy,
    });

    logger.info('LandlordAuthorityService.endLease: ended', {
      leaseId, initiatedBy, tenantUserId: lease.primary_resident_user_id,
    });

    return { success: true };
  }

  // ── Private helpers ─────────────────────────────────────────────

  /**
   * Numeric rank for verification tiers (higher = stronger).
   * @param {string} tier
   * @returns {number}
   */
  _tierRank(tier) {
    const ranks = { weak: 0, standard: 1, strong: 2, legal: 3 };
    return ranks[tier] ?? 0;
  }
}

// Export constants for testing
LandlordAuthorityService.INVITE_EXPIRY_DAYS = INVITE_EXPIRY_DAYS;
LandlordAuthorityService.EVIDENCE_TIER_MAP = EVIDENCE_TIER_MAP;

module.exports = new LandlordAuthorityService();
module.exports.LandlordAuthorityService = LandlordAuthorityService;
