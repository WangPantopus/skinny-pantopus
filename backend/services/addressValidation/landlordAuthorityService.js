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
   * @param {string} actorId - authenticated actor, rechecked inside the transaction
   * @param {string} [retainedToken] - random client proof retained for exact retry
   * @returns {Promise<{success: boolean, error?: string, invite?: object, token?: string}>}
   */
  async inviteTenant(authorityId, homeId, inviteeEmail, startAt, endAt, actorId, retainedToken) {
    const token = retainedToken || crypto.randomBytes(32).toString('hex');
    if (!/^[a-f0-9]{64}$/.test(token)) return { success: false, status: 400, error: 'Invalid invitation proof' };
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await this._decideLease({ p_action: 'invite', p_actor_id: actorId,
      p_authority_id: authorityId, p_home_id: homeId, p_user_email: inviteeEmail,
      p_token_hash: tokenHash, p_dates: { start_at: startAt, end_at: endAt || null },
      p_validity_days: INVITE_EXPIRY_DAYS });
    if (!result.success) return result;
    const invite = result.invite;
    if (invite.status === 'pending' && invite.invitee_user_id) {
      await this._notifyLeaseDecision({ userId: invite.invitee_user_id, type: 'lease_invite',
        idempotencyKey: `lease-invite:${invite.id}`,
        title: "You've been invited to a home",
        body: `You have been invited to live at ${result.home?.name || 'a verified home'}. Review the invitation using the account it was sent to.`,
        icon: '🏠', link: `/invite/lease/${token}`, metadata: { home_id: homeId, invite_id: invite.id } });
    }
    return { ...result, token };
  }

  // ================================================================
  // acceptInvite
  // ================================================================

  /** Read only the intended authenticated recipient's lease invitation. */
  async previewInvite(token, userId, userEmail) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: invite, error } = await supabaseAdmin.from('HomeLeaseInvite')
      .select('home_id, invitee_user_id, invitee_email, status, proposed_start, proposed_end, expires_at, landlord_subject_type, landlord_subject_id')
      .eq('token_hash', tokenHash).maybeSingle();
    if (error) throw error;
    // Never disclose a Home or the intended recipient's address to another account.
    if (!invite || (invite.invitee_user_id && invite.invitee_user_id !== userId)
      || !invite.invitee_email || invite.invitee_email.trim().toLowerCase() !== (userEmail || '').trim().toLowerCase()) {
      return { success: false, status: 404, error: 'Invitation not available for this account. Use the account it was sent to.' };
    }
    if (!['pending', 'accepted'].includes(invite.status)
      || (invite.status === 'pending' && new Date(invite.expires_at).getTime() <= Date.now())) {
      return { success: false, status: 410, error: 'This invitation is closed or expired. Ask the landlord for a new invitation.' };
    }
    const { data: authority, error: authorityError } = await supabaseAdmin.from('HomeAuthority')
      .select('id').eq('home_id', invite.home_id).eq('subject_type', invite.landlord_subject_type)
      .eq('subject_id', invite.landlord_subject_id).eq('status', 'verified').limit(1).maybeSingle();
    if (authorityError) throw authorityError;
    if (!authority) return { success: false, status: 403, error: 'Current verified authority required' };
    const { data: home, error: homeError } = await supabaseAdmin.from('Home')
      .select('id, name, city').eq('id', invite.home_id).maybeSingle();
    if (homeError) throw homeError;
    if (!home) return { success: false, status: 404, error: 'Home not found' };
    return { success: true, home: { id: home.id, name: home.name, city: home.city },
      invitation: { status: invite.status, proposed_start: invite.proposed_start,
        proposed_end: invite.proposed_end, expires_at: invite.expires_at }, account_email: userEmail };
  }

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

  async requestLease(homeId, actorId, dates = {}, message = null, requestContext = null) {
    const result = await this._decideLease({ p_action: 'request', p_actor_id: actorId,
      p_home_id: homeId, p_dates: dates, p_message: message, p_request_context: requestContext });
    if (!result.success || result.replayed) return result;
    if (result.authority?.subject_type === 'user') {
      await this._notifyLeaseDecision({ userId: result.authority.subject_id,
        type: 'tenant_request', title: 'New tenant request',
        body: 'A tenant has requested lease approval for your property.', icon: '📋',
        link: `/app/landlord/properties/${homeId}?tab=requests`,
        metadata: { home_id: homeId, lease_id: result.lease.id },
      });
    }
    return result;
  }

  async cancelLeaseRequest(leaseId, actorId) {
    return this._decideLease({ p_action: 'cancel', p_actor_id: actorId, p_lease_id: leaseId });
  }

  async _decideLease(params) {
    if (!params.p_actor_id) return { success: false, error: 'Authenticated actor required' };
    try {
      const { data, error } = await supabaseAdmin.rpc('decide_home_lease', {
        ...params, p_validity_days: params.p_validity_days ?? require('../../utils/verificationAge').validityDays(),
      });
      if (error || !data || typeof data.success !== 'boolean'
        || (!data.success && typeof data.error !== 'string')
        || (data.success && (params.p_action === 'invite'
          ? !data.invite?.id || data.invite.home_id !== params.p_home_id || data.invite.token_hash !== params.p_token_hash
          : !data.lease || (['approve', 'accept'].includes(params.p_action) && !data.occupancy)))) {
        logger.error('LandlordAuthorityService: lease transaction unavailable', {
          action: params.p_action, leaseId: params.p_lease_id, code: error?.code,
        });
        return { success: false, ...(params.p_action === 'invite' ? { status: 503 } : {}), error: 'Unable to complete lease decision. Please retry.' };
      }
      return data;
    } catch (error) {
      logger.error('LandlordAuthorityService: lease transaction interrupted', {
        action: params.p_action, leaseId: params.p_lease_id, code: error.code,
      });
      return { success: false, ...(params.p_action === 'invite' ? { status: 503 } : {}), error: 'Unable to complete lease decision. Please retry.' };
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
  async endLease(leaseId, initiatedBy, options = {}) {
    const result = await this._decideLease({
      p_action: options.moveOut ? 'move_out' : 'end', p_actor_id: initiatedBy,
      p_lease_id: leaseId, p_authority_id: options.authorityId || null,
      p_reason: options.reason || null,
    });
    if (!result.success || result.replayed) return result;
    await this._notifyLeaseDecision({
      userId: options.moveOut ? initiatedBy : result.lease.primary_resident_user_id,
      type: 'lease_ended', title: options.moveOut ? 'You have moved out' : 'Your lease has ended',
      body: options.moveOut ? 'You have moved out. You retain your own content history.' : 'Your lease has ended. You retain your own content history.',
      icon: '📋', link: `/homes/${result.lease.home_id}`,
      metadata: { home_id: result.lease.home_id, lease_id: leaseId, initiated_by: initiatedBy },
    });
    return result;
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
