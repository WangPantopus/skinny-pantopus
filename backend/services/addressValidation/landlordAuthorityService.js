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
 *   approveTenantRequest(leaseId, authorityId)
 *   denyTenantRequest(leaseId, authorityId, reason?)
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
    // ── 1. Hash token + look up invite ────────────────────────
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { data: invite } = await supabaseAdmin
      .from('HomeLeaseInvite')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!invite) {
      return { success: false, error: 'Invite not found or invalid token' };
    }

    // ── 2. Verify not expired/revoked ─────────────────────────
    if (invite.status !== 'pending') {
      return { success: false, error: `Invite is ${invite.status}` };
    }

    if (new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin
        .from('HomeLeaseInvite')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', invite.id);
      return { success: false, error: 'Invite has expired' };
    }

    // ── 2b. Identity binding: verify invite is for this user ────
    if (invite.invitee_email) {
      const normalizedInviteEmail = invite.invitee_email.toLowerCase().trim();
      const normalizedUserEmail = (userEmail || '').toLowerCase().trim();
      if (normalizedInviteEmail !== normalizedUserEmail) {
        return { success: false, error: 'This invitation was sent to a different email address' };
      }
    }

    // ── 3. Create HomeLease (active, source: landlord_invite) ─
    const { data: lease, error: leaseErr } = await supabaseAdmin
      .from('HomeLease')
      .insert({
        home_id: invite.home_id,
        approved_by_subject_type: invite.landlord_subject_type,
        approved_by_subject_id: invite.landlord_subject_id,
        primary_resident_user_id: userId,
        start_at: invite.proposed_start || new Date().toISOString(),
        end_at: invite.proposed_end || null,
        state: 'active',
        source: 'landlord_invite',
        metadata: { invite_id: invite.id },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (leaseErr) {
      logger.error('LandlordAuthorityService.acceptInvite: lease insert failed', {
        inviteId: invite.id, userId, error: leaseErr.message,
      });
      return { success: false, error: 'Failed to create lease' };
    }

    // ── 4. Create HomeLeaseResident ───────────────────────────
    await supabaseAdmin
      .from('HomeLeaseResident')
      .insert({
        lease_id: lease.id,
        user_id: userId,
      });

    // ── 5. Create/activate HomeOccupancy (via centralized gateway) ──
    const occupancyAttachService = require('../occupancyAttachService');
    const attachResult = await occupancyAttachService.attach({
      homeId: invite.home_id,
      userId,
      method: 'landlord_invite',
      roleOverride: 'lease_resident',
      actorId: userId,
      metadata: { source: 'landlord_invite', invite_id: invite.id, lease_id: lease.id },
    });
    const occupancy = attachResult.occupancy || null;

    // ── 6. Update invite status ───────────────────────────────
    await supabaseAdmin
      .from('HomeLeaseInvite')
      .update({
        status: 'accepted',
        invitee_user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invite.id);

    // ── 7. Audit log ──────────────────────────────────────────
    await writeAuditLog(invite.home_id, userId, 'LEASE_INVITE_ACCEPTED', 'HomeLease', lease.id, {
      invite_id: invite.id,
      source: 'landlord_invite',
    });

    logger.info('LandlordAuthorityService.acceptInvite: lease created', {
      leaseId: lease.id, inviteId: invite.id, userId,
    });

    return { success: true, lease, occupancy };
  }

  // ================================================================
  // approveTenantRequest
  // ================================================================

  /**
   * Approve a pending tenant lease request.
   *
   * @param {string} leaseId
   * @param {string} authorityId
   * @returns {Promise<{success: boolean, error?: string, lease?: object, occupancy?: object}>}
   */
  async approveTenantRequest(leaseId, authorityId) {
    // ── 1. Verify authority ───────────────────────────────────
    const { data: authority } = await supabaseAdmin
      .from('HomeAuthority')
      .select('*')
      .eq('id', authorityId)
      .maybeSingle();

    if (!authority || authority.status !== 'verified') {
      return { success: false, error: 'Valid verified authority required' };
    }

    // ── 2. Fetch lease ────────────────────────────────────────
    const { data: lease } = await supabaseAdmin
      .from('HomeLease')
      .select('*')
      .eq('id', leaseId)
      .maybeSingle();

    if (!lease) {
      return { success: false, error: 'Lease not found' };
    }

    if (lease.state !== 'pending') {
      return { success: false, error: `Cannot approve: lease is ${lease.state}` };
    }

    // ── 3. Verify authority matches home ──────────────────────
    if (authority.home_id !== lease.home_id) {
      return { success: false, error: 'Authority does not match lease home' };
    }

    // ── 4. Activate lease ─────────────────────────────────────
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('HomeLease')
      .update({
        state: 'active',
        approved_by_subject_type: authority.subject_type,
        approved_by_subject_id: authority.subject_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId)
      .select()
      .single();

    if (updateErr) {
      logger.error('LandlordAuthorityService.approveTenantRequest: update failed', {
        leaseId, error: updateErr.message,
      });
      return { success: false, error: 'Failed to activate lease' };
    }

    // ── 5. Create/activate HomeOccupancy (via centralized gateway) ──
    const occupancyAttachSvc = require('../occupancyAttachService');
    const attachResult2 = await occupancyAttachSvc.attach({
      homeId: lease.home_id,
      userId: lease.primary_resident_user_id,
      method: 'landlord_approval',
      roleOverride: 'lease_resident',
      actorId: authority.subject_id,
      metadata: { source: 'tenant_request_approved', lease_id: leaseId, authority_id: authorityId },
    });
    const occupancy = attachResult2.occupancy || null;

    // ── 6. Notify tenant ──────────────────────────────────────
    try {
      const notificationService = require('../notificationService');
      notificationService.createNotification({
        userId: lease.primary_resident_user_id,
        type: 'lease_approved',
        title: 'Your lease has been approved',
        body: 'Your landlord approved your lease request. You now have full access.',
        icon: '🏡',
        link: `/homes/${lease.home_id}/dashboard`,
        metadata: { home_id: lease.home_id, lease_id: leaseId },
      });
    } catch (notifErr) {
      logger.warn('LandlordAuthorityService.approveTenantRequest: notification failed (non-fatal)', {
        error: notifErr.message,
      });
    }

    // ── 7. Audit log ──────────────────────────────────────────
    await writeAuditLog(lease.home_id, authority.subject_id, 'LEASE_APPROVED', 'HomeLease', leaseId, {
      authority_id: authorityId,
      tenant_user_id: lease.primary_resident_user_id,
    });

    logger.info('LandlordAuthorityService.approveTenantRequest: approved', {
      leaseId, authorityId,
    });

    return { success: true, lease: updated, occupancy };
  }

  // ================================================================
  // denyTenantRequest
  // ================================================================

  /**
   * Deny a pending tenant lease request.
   *
   * @param {string} leaseId
   * @param {string} authorityId
   * @param {string} [reason]
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async denyTenantRequest(leaseId, authorityId, reason) {
    // ── 1. Verify authority ───────────────────────────────────
    const { data: authority } = await supabaseAdmin
      .from('HomeAuthority')
      .select('*')
      .eq('id', authorityId)
      .maybeSingle();

    if (!authority || authority.status !== 'verified') {
      return { success: false, error: 'Valid verified authority required' };
    }

    // ── 2. Fetch lease ────────────────────────────────────────
    const { data: lease } = await supabaseAdmin
      .from('HomeLease')
      .select('*')
      .eq('id', leaseId)
      .maybeSingle();

    if (!lease) {
      return { success: false, error: 'Lease not found' };
    }

    if (lease.state !== 'pending') {
      return { success: false, error: `Cannot deny: lease is ${lease.state}` };
    }

    if (authority.home_id !== lease.home_id) {
      return { success: false, error: 'Authority does not match lease home' };
    }

    // ── 3. Cancel lease ───────────────────────────────────────
    const { error: updateErr } = await supabaseAdmin
      .from('HomeLease')
      .update({
        state: 'canceled',
        metadata: { ...lease.metadata, denial_reason: reason || null },
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId);

    if (updateErr) {
      logger.error('LandlordAuthorityService.denyTenantRequest: update failed', {
        leaseId, error: updateErr.message,
      });
      return { success: false, error: 'Failed to cancel lease' };
    }

    // ── 4. Notify tenant ──────────────────────────────────────
    try {
      const notificationService = require('../notificationService');
      notificationService.createNotification({
        userId: lease.primary_resident_user_id,
        type: 'lease_denied',
        title: 'Lease request denied',
        body: reason
          ? `Your lease request was denied: ${reason}`
          : 'Your lease request was denied by the property authority.',
        icon: '🚫',
        link: `/homes/${lease.home_id}`,
        metadata: { home_id: lease.home_id, lease_id: leaseId, reason: reason || null },
      });
    } catch (notifErr) {
      logger.warn('LandlordAuthorityService.denyTenantRequest: notification failed (non-fatal)', {
        error: notifErr.message,
      });
    }

    // ── 5. Audit log ──────────────────────────────────────────
    await writeAuditLog(lease.home_id, authority.subject_id, 'LEASE_DENIED', 'HomeLease', leaseId, {
      authority_id: authorityId,
      tenant_user_id: lease.primary_resident_user_id,
      reason: reason || null,
    });

    logger.info('LandlordAuthorityService.denyTenantRequest: denied', {
      leaseId, authorityId, reason,
    });

    return { success: true };
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
