/**
 * Landlord & Tenant Routes
 *
 * API endpoints for the landlord portal (authority management, lease approval)
 * and tenant-facing flows (request approval, accept invite, move out).
 *
 * Landlord routes  → /api/v1/landlord/*   (require auth + authority middleware)
 * Tenant routes    → /api/v1/tenant/*     (require auth)
 * Dispute route    → /api/v1/home/:homeId/dispute (require auth)
 *
 * Mounted at /api/v1 in app.js.
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const requireAuthority = require('../middleware/requireAuthority');
const logger = require('../utils/logger');
const { writeAuditLog } = require('../utils/homePermissions');
const { ownershipClaimLimiter } = require('../middleware/rateLimiter');
const landlordAuthorityService = require('../services/addressValidation/landlordAuthorityService');
const { assertCallerOwnsLease, resolveVerifiedAuthorityForActor } = require('../utils/authorityResolution');

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const requestAuthoritySchema = Joi.object({
  home_id: Joi.string().uuid().required(),
  subject_type: Joi.string().valid('user', 'business', 'trust').default('user'),
  subject_id: Joi.string().uuid().required(),
  evidence_type: Joi.string().valid(
    'deed', 'closing_disclosure', 'escrow_attestation', 'title_match',
    'tax_bill', 'utility_bill', 'lease', 'idv',
  ).required(),
  evidence: Joi.object({
    storage_ref: Joi.string().max(512).allow(null),
    provider: Joi.string().max(100).allow(null),
    metadata: Joi.object().allow(null),
  }).allow(null),
});

const inviteTenantSchema = Joi.object({
  home_id: Joi.string().uuid().required(),
  invitee_email: Joi.string().email().required(),
  start_at: Joi.string().isoDate().required(),
  end_at: Joi.string().isoDate().allow(null),
});

const approveDenySchema = Joi.object({});

const denySchema = Joi.object({
  reason: Joi.string().max(500).allow(null, ''),
});

const endLeaseSchema = Joi.object({});

const tenantRequestSchema = Joi.object({
  home_id: Joi.string().uuid().required(),
  start_at: Joi.string().isoDate().allow(null),
  end_at: Joi.string().isoDate().allow(null),
  message: Joi.string().max(1000).allow(null, ''),
});

const acceptInviteSchema = Joi.object({
  token: Joi.string().hex().length(64).required(),
});

const moveOutSchema = Joi.object({
  lease_id: Joi.string().uuid().required(),
  reason: Joi.string().max(500).allow(null, ''),
});

const disputeSchema = Joi.object({
  dispute_type: Joi.string().valid('authority', 'lease', 'occupancy', 'other').required(),
  description: Joi.string().min(10).max(2000).required(),
  target_type: Joi.string().valid('HomeAuthority', 'HomeLease', 'HomeOccupancy').allow(null),
  target_id: Joi.string().uuid().allow(null),
});

// ============================================================
// ═══════════════════════════════════════════════════════════════
// LANDLORD ROUTES — /landlord/*
// ═══════════════════════════════════════════════════════════════
// ============================================================

// ──────────────────────────────────────────────────────────────
// POST /landlord/authority/request
// Request authority over a property (creates pending HomeAuthority).
// ──────────────────────────────────────────────────────────────

router.post(
  '/landlord/authority/request',
  verifyToken,
  ownershipClaimLimiter,
  validate(requestAuthoritySchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { home_id, subject_type, subject_id, evidence_type, evidence } = req.body;

      // Ensure the caller is requesting authority for themselves or their business
      if (subject_type === 'user' && subject_id !== userId) {
        return res.status(403).json({ error: 'Cannot request authority on behalf of another user' });
      }

      if (subject_type === 'business') {
        const { data: membership } = await supabaseAdmin
          .from('BusinessTeam')
          .select('id')
          .eq('business_user_id', subject_id)
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();

        if (!membership) {
          return res.status(403).json({ error: 'Not a member of the specified business' });
        }
      }

      const result = await landlordAuthorityService.requestAuthority(
        subject_type, subject_id, home_id, evidence_type, evidence || undefined,
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(201).json({
        authority: result.authority,
        claim: result.claim || null,
      });
    } catch (err) {
      logger.error('POST /landlord/authority/request failed', { error: err.message });
      res.status(500).json({ error: 'Failed to request authority' });
    }
  },
);

// ──────────────────────────────────────────────────────────────
// GET /landlord/properties
// List properties where the user (or their businesses) has authority.
// ──────────────────────────────────────────────────────────────

router.get(
  '/landlord/properties',
  verifyToken,
  async (req, res) => {
    try {
      const userId = req.user.id;

      // Direct user authorities
      const { data: userAuths } = await supabaseAdmin
        .from('HomeAuthority')
        .select('*, home:home_id(id, name, address_id, home_type)')
        .eq('subject_type', 'user')
        .eq('subject_id', userId)
        .neq('status', 'revoked');

      // Business authorities (find businesses user belongs to)
      const { data: memberships } = await supabaseAdmin
        .from('BusinessTeam')
        .select('business_user_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      let businessAuths = [];
      if (memberships && memberships.length > 0) {
        const bizIds = memberships.map((m) => m.business_user_id);
        const { data } = await supabaseAdmin
          .from('HomeAuthority')
          .select('*, home:home_id(id, name, address_id, home_type)')
          .eq('subject_type', 'business')
          .in('subject_id', bizIds)
          .neq('status', 'revoked');
        businessAuths = data || [];
      }

      const properties = [...(userAuths || []), ...businessAuths];

      res.json({ properties });
    } catch (err) {
      logger.error('GET /landlord/properties failed', { error: err.message });
      res.status(500).json({ error: 'Failed to fetch properties' });
    }
  },
);

// ──────────────────────────────────────────────────────────────
// GET /landlord/properties/:homeId
// Property detail with units, active leases, pending requests.
// ──────────────────────────────────────────────────────────────

router.get(
  '/landlord/properties/:homeId',
  verifyToken,
  requireAuthority,
  async (req, res) => {
    try {
      const { homeId } = req.params;

      // Fetch home details
      const { data: home, error: homeErr } = await supabaseAdmin
        .from('Home')
        .select('id, name, address_id, home_type, owner_id, created_at')
        .eq('id', homeId)
        .single();

      if (homeErr || !home) {
        return res.status(404).json({ error: 'Home not found' });
      }

      // Fetch child units (if this is a building)
      const { data: units } = await supabaseAdmin
        .from('Home')
        .select('id, name, home_type')
        .eq('parent_home_id', homeId);

      // Fetch active leases
      const { data: leases } = await supabaseAdmin
        .from('HomeLease')
        .select(`
          id, home_id, state, source, start_at, end_at, created_at,
          primary_resident:primary_resident_user_id(id, username, name, email)
        `)
        .eq('home_id', homeId)
        .in('state', ['active', 'pending'])
        .order('created_at', { ascending: false });

      // Fetch pending tenant requests (leases sourced from tenant)
      const pendingRequests = (leases || []).filter(
        (l) => l.state === 'pending' && l.source === 'tenant_request',
      );

      // Fetch current occupants
      const { data: occupants } = await supabaseAdmin
        .from('HomeOccupancy')
        .select('id, user_id, role, role_base, verification_status, is_active, start_at')
        .eq('home_id', homeId)
        .eq('is_active', true);

      res.json({
        home,
        units: units || [],
        leases: leases || [],
        pending_requests: pendingRequests,
        occupants: occupants || [],
        authority: req.authority,
      });
    } catch (err) {
      logger.error('GET /landlord/properties/:homeId failed', { error: err.message });
      res.status(500).json({ error: 'Failed to fetch property details' });
    }
  },
);

// ──────────────────────────────────────────────────────────────
// POST /landlord/lease/invite
// Invite a tenant to a unit.
// ──────────────────────────────────────────────────────────────

router.post(
  '/landlord/lease/invite',
  verifyToken,
  validate(inviteTenantSchema),
  requireAuthority,
  async (req, res) => {
    try {
      const { home_id, invitee_email, start_at, end_at } = req.body;

      // Use middleware-verified authority — never trust caller-supplied authority_id (AUTH-2.1)
      const authority_id = req.authority.id;

      const result = await landlordAuthorityService.inviteTenant(
        authority_id, home_id, invitee_email, start_at, end_at || undefined,
      );

      if (!result.success) {
        const status = result.error.includes('not found') ? 404 : 400;
        return res.status(status).json({ error: result.error });
      }

      res.status(201).json({
        invite: result.invite,
        // Return the raw token so the landlord can share it (e.g. email link)
        token: result.token,
      });
    } catch (err) {
      logger.error('POST /landlord/lease/invite failed', { error: err.message });
      res.status(500).json({ error: 'Failed to create invite' });
    }
  },
);

// ──────────────────────────────────────────────────────────────
// POST /landlord/lease/:leaseId/approve
// Approve a pending tenant lease request.
// ──────────────────────────────────────────────────────────────

router.post(
  '/landlord/lease/:leaseId/approve',
  verifyToken,
  validate(approveDenySchema),
  async (req, res) => {
    try {
      const { leaseId } = req.params;
      const userId = req.user.id;

      // Fetch lease to get home_id for authority resolution
      const { data: lease } = await supabaseAdmin
        .from('HomeLease')
        .select('id, home_id')
        .eq('id', leaseId)
        .maybeSingle();

      if (!lease) {
        return res.status(404).json({ error: 'Lease not found' });
      }

      // Resolve authority server-side — never trust caller-supplied authority_id
      const authResult = await resolveVerifiedAuthorityForActor({ userId, homeId: lease.home_id });
      if (!authResult.found) {
        logger.warn('auth.denied', { event: 'lease_approve_denied', actor_id: userId, target_id: leaseId, reason: 'no_verified_authority', ip: req.ip });
        return res.status(403).json({ error: 'No verified authority for this property' });
      }

      const result = await landlordAuthorityService.approveTenantRequest(leaseId, authResult.authority.id);

      if (!result.success) {
        const status = result.error.includes('not found') ? 404 : 400;
        return res.status(status).json({ error: result.error });
      }

      logger.info('auth.action', { event: 'lease_approved', actor_id: userId, target_id: leaseId, home_id: lease.home_id });
      res.json({
        lease: result.lease,
        occupancy: result.occupancy,
      });
    } catch (err) {
      logger.error('POST /landlord/lease/:leaseId/approve failed', { error: err.message });
      res.status(500).json({ error: 'Failed to approve lease' });
    }
  },
);

// ──────────────────────────────────────────────────────────────
// POST /landlord/lease/:leaseId/deny
// Deny a pending tenant lease request.
// ──────────────────────────────────────────────────────────────

router.post(
  '/landlord/lease/:leaseId/deny',
  verifyToken,
  validate(denySchema),
  async (req, res) => {
    try {
      const { leaseId } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      // Fetch lease to get home_id for authority resolution
      const { data: lease } = await supabaseAdmin
        .from('HomeLease')
        .select('id, home_id')
        .eq('id', leaseId)
        .maybeSingle();

      if (!lease) {
        return res.status(404).json({ error: 'Lease not found' });
      }

      // Resolve authority server-side — never trust caller-supplied authority_id
      const authResult = await resolveVerifiedAuthorityForActor({ userId, homeId: lease.home_id });
      if (!authResult.found) {
        logger.warn('auth.denied', { event: 'lease_deny_denied', actor_id: userId, target_id: leaseId, reason: 'no_verified_authority', ip: req.ip });
        return res.status(403).json({ error: 'No verified authority for this property' });
      }

      const result = await landlordAuthorityService.denyTenantRequest(
        leaseId, authResult.authority.id, reason || undefined,
      );

      if (!result.success) {
        const status = result.error.includes('not found') ? 404 : 400;
        return res.status(status).json({ error: result.error });
      }

      logger.info('auth.action', { event: 'lease_denied', actor_id: userId, target_id: leaseId, home_id: lease.home_id });
      res.json({ success: true });
    } catch (err) {
      logger.error('POST /landlord/lease/:leaseId/deny failed', { error: err.message });
      res.status(500).json({ error: 'Failed to deny lease' });
    }
  },
);

// ──────────────────────────────────────────────────────────────
// POST /landlord/lease/:leaseId/end
// End an active lease.
// ──────────────────────────────────────────────────────────────

router.post(
  '/landlord/lease/:leaseId/end',
  verifyToken,
  validate(endLeaseSchema),
  async (req, res) => {
    try {
      const { leaseId } = req.params;
      const userId = req.user.id;

      // Verify caller has rights over this lease (resident or authority holder)
      const authCheck = await assertCallerOwnsLease({ userId, leaseId });
      if (!authCheck.allowed) {
        logger.warn('auth.denied', { event: 'lease_end_denied', actor_id: userId, target_id: leaseId, reason: authCheck.reason, ip: req.ip });
        return res.status(403).json({ error: authCheck.reason || 'Not authorized to end this lease' });
      }

      const result = await landlordAuthorityService.endLease(leaseId, userId);

      if (!result.success) {
        const status = result.error.includes('not found') ? 404 : 400;
        return res.status(status).json({ error: result.error });
      }

      logger.info('auth.action', { event: 'lease_ended', actor_id: userId, target_id: leaseId });
      res.json({ success: true });
    } catch (err) {
      logger.error('POST /landlord/lease/:leaseId/end failed', { error: err.message });
      res.status(500).json({ error: 'Failed to end lease' });
    }
  },
);

// ──────────────────────────────────────────────────────────────
// GET /landlord/properties/:homeId/requests
// List pending tenant requests for a property.
// ──────────────────────────────────────────────────────────────

router.get(
  '/landlord/properties/:homeId/requests',
  verifyToken,
  requireAuthority,
  async (req, res) => {
    try {
      const { homeId } = req.params;

      const { data: requests, error } = await supabaseAdmin
        .from('HomeLease')
        .select(`
          id, home_id, state, source, start_at, end_at, metadata, created_at,
          primary_resident:primary_resident_user_id(id, username, name, email)
        `)
        .eq('home_id', homeId)
        .eq('state', 'pending')
        .eq('source', 'tenant_request')
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({ requests: requests || [] });
    } catch (err) {
      logger.error('GET /landlord/properties/:homeId/requests failed', { error: err.message });
      res.status(500).json({ error: 'Failed to fetch requests' });
    }
  },
);

// ============================================================
// ═══════════════════════════════════════════════════════════════
// TENANT ROUTES — /tenant/*
// ═══════════════════════════════════════════════════════════════
// ============================================================

// ──────────────────────────────────────────────────────────────
// POST /tenant/request-approval
// Create a lease request to a landlord-managed home.
// ──────────────────────────────────────────────────────────────

router.post(
  '/tenant/request-approval',
  verifyToken,
  validate(tenantRequestSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { home_id, start_at, end_at, message } = req.body;

      // Verify home exists
      const { data: home } = await supabaseAdmin
        .from('Home')
        .select('id, name, home_type')
        .eq('id', home_id)
        .maybeSingle();

      if (!home) {
        return res.status(404).json({ error: 'Home not found' });
      }

      if (home.home_type === 'building') {
        return res.status(400).json({ error: 'Cannot request lease on a building — use a unit' });
      }

      // Check that a landlord authority exists for this home
      const { data: authority } = await supabaseAdmin
        .from('HomeAuthority')
        .select('id, subject_type, subject_id')
        .eq('home_id', home_id)
        .eq('status', 'verified')
        .limit(1)
        .maybeSingle();

      if (!authority) {
        return res.status(400).json({ error: 'This property has no verified landlord. Cannot submit a lease request.' });
      }

      // Check for existing pending request
      const { data: existing } = await supabaseAdmin
        .from('HomeLease')
        .select('id')
        .eq('home_id', home_id)
        .eq('primary_resident_user_id', userId)
        .eq('state', 'pending')
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'You already have a pending request for this home' });
      }

      // Check for existing active lease
      const { data: activeLease } = await supabaseAdmin
        .from('HomeLease')
        .select('id')
        .eq('home_id', home_id)
        .eq('primary_resident_user_id', userId)
        .eq('state', 'active')
        .maybeSingle();

      if (activeLease) {
        return res.status(409).json({ error: 'You already have an active lease at this home' });
      }

      // Create pending lease
      const { data: lease, error: leaseErr } = await supabaseAdmin
        .from('HomeLease')
        .insert({
          home_id,
          primary_resident_user_id: userId,
          start_at: start_at || new Date().toISOString(),
          end_at: end_at || null,
          state: 'pending',
          source: 'tenant_request',
          metadata: { message: message || null },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (leaseErr) throw leaseErr;

      // Notify the landlord
      try {
        const notificationService = require('../services/notificationService');
        if (authority.subject_type === 'user') {
          notificationService.createNotification({
            userId: authority.subject_id,
            type: 'tenant_request',
            title: 'New tenant request',
            body: `A tenant has requested to live at ${home.name || 'your property'}.`,
            icon: '📋',
            link: `/landlord/properties/${home_id}/requests`,
            metadata: { home_id, lease_id: lease.id },
          });
        }
      } catch (notifErr) {
        logger.warn('Tenant request notification failed (non-fatal)', { error: notifErr.message });
      }

      await writeAuditLog(home_id, userId, 'TENANT_REQUEST_SUBMITTED', 'HomeLease', lease.id, {
        source: 'tenant_request',
        message: message || null,
      });

      res.status(201).json({ lease });
    } catch (err) {
      logger.error('POST /tenant/request-approval failed', { error: err.message });
      res.status(500).json({ error: 'Failed to submit lease request' });
    }
  },
);

// ──────────────────────────────────────────────────────────────
// POST /tenant/accept-invite
// Accept a lease invite by token.
// ──────────────────────────────────────────────────────────────

router.post(
  '/tenant/accept-invite',
  verifyToken,
  validate(acceptInviteSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { token } = req.body;

      const result = await landlordAuthorityService.acceptInvite(token, userId, req.user.email);

      if (!result.success) {
        const status = result.error.includes('not found') ? 404
          : result.error.includes('expired') ? 410
            : 400;
        if (result.error.includes('expired')) {
          logger.warn('auth.invite_expired_attempt', { actor_id: userId, ip: req.ip });
        } else if (result.error.includes('different email') || result.error.includes('email')) {
          logger.warn('auth.invite_email_mismatch', { actor_id: userId, ip: req.ip });
        } else if (result.error.includes('already')) {
          logger.warn('auth.invite_replay_attempt', { actor_id: userId, ip: req.ip });
        }
        return res.status(status).json({ error: result.error });
      }

      logger.info('auth.action', { event: 'invite_accepted', actor_id: userId, target_id: result.lease?.id });
      res.status(201).json({
        lease: result.lease,
        occupancy: result.occupancy,
      });
    } catch (err) {
      logger.error('POST /tenant/accept-invite failed', { error: err.message });
      res.status(500).json({ error: 'Failed to accept invite' });
    }
  },
);

// ──────────────────────────────────────────────────────────────
// POST /tenant/move-out
// Tenant requests to end their own lease.
// ──────────────────────────────────────────────────────────────

router.post(
  '/tenant/move-out',
  verifyToken,
  validate(moveOutSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { lease_id, reason } = req.body;

      // Verify the tenant owns this lease
      const { data: lease } = await supabaseAdmin
        .from('HomeLease')
        .select('id, home_id, primary_resident_user_id, state')
        .eq('id', lease_id)
        .maybeSingle();

      if (!lease) {
        return res.status(404).json({ error: 'Lease not found' });
      }

      if (lease.primary_resident_user_id !== userId) {
        // Also check if user is a co-resident
        const { data: resident } = await supabaseAdmin
          .from('HomeLeaseResident')
          .select('id')
          .eq('lease_id', lease_id)
          .eq('user_id', userId)
          .maybeSingle();

        if (!resident) {
          logger.warn('auth.denied', { event: 'move_out_denied', actor_id: userId, target_id: lease_id, reason: 'not_resident', ip: req.ip });
          return res.status(403).json({ error: 'Not authorized to end this lease' });
        }
      }

      if (lease.state !== 'active') {
        return res.status(400).json({ error: `Cannot move out: lease is ${lease.state}` });
      }

      const result = await landlordAuthorityService.endLease(lease_id, userId);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Log the move-out reason
      await writeAuditLog(lease.home_id, userId, 'TENANT_MOVE_OUT', 'HomeLease', lease_id, {
        reason: reason || null,
        initiated_by: 'tenant',
      });

      logger.info('auth.action', { event: 'lease_ended', actor_id: userId, target_id: lease_id, initiated_by: 'tenant' });
      res.json({ success: true });
    } catch (err) {
      logger.error('POST /tenant/move-out failed', { error: err.message });
      res.status(500).json({ error: 'Failed to process move-out' });
    }
  },
);

// ============================================================
// ═══════════════════════════════════════════════════════════════
// DISPUTE ROUTE — /home/:homeId/dispute
// ═══════════════════════════════════════════════════════════════
// ============================================================

router.post(
  '/home/:homeId/dispute',
  verifyToken,
  validate(disputeSchema),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { homeId } = req.params;
      const { dispute_type, description, target_type, target_id } = req.body;

      // Verify user has some relationship to the home (occupancy, authority, or ownership)
      const { data: occupancy } = await supabaseAdmin
        .from('HomeOccupancy')
        .select('id')
        .eq('home_id', homeId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      const { data: authority } = await supabaseAdmin
        .from('HomeAuthority')
        .select('id')
        .eq('home_id', homeId)
        .eq('subject_type', 'user')
        .eq('subject_id', userId)
        .neq('status', 'revoked')
        .maybeSingle();

      if (!occupancy && !authority) {
        return res.status(403).json({
          error: 'Must be a current occupant or authority holder to file a dispute',
        });
      }

      // Create dispute record
      const { data: dispute, error: disputeErr } = await supabaseAdmin
        .from('HomeDispute')
        .insert({
          home_id: homeId,
          filed_by_user_id: userId,
          dispute_type,
          description,
          target_type: target_type || null,
          target_id: target_id || null,
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (disputeErr) throw disputeErr;

      // Product: do not flip Home.security_state to disputed when a landlord dispute is filed.

      await writeAuditLog(homeId, userId, 'DISPUTE_FILED', 'HomeDispute', dispute.id, {
        dispute_type,
        target_type: target_type || null,
        target_id: target_id || null,
      });

      logger.info('Dispute filed', { disputeId: dispute.id, homeId, userId, dispute_type });

      res.status(201).json({ dispute });
    } catch (err) {
      logger.error('POST /home/:homeId/dispute failed', { error: err.message });
      res.status(500).json({ error: 'Failed to file dispute' });
    }
  },
);

module.exports = router;
