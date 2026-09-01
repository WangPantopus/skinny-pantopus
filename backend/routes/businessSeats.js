/**
 * Business Seats Routes — Identity Firewall Seat Management
 *
 * Seat-based CRUD and invite flow for the Identity Firewall architecture.
 * Mount at: app.use('/api/businesses', require('./routes/businessSeats'));
 *
 * CRITICAL: These endpoints never expose which real user sits behind a seat.
 * SeatBinding is only touched internally to verify the acting user's own seat.
 *
 * Endpoints:
 *   GET    /:businessId/seats                — List all seats (with is_you flag)
 *   GET    /:businessId/seats/:seatId        — Single seat detail
 *   POST   /:businessId/seats/invite         — Create a new seat + invite
 *   POST   /seats/accept-invite              — Accept invite via token (top-level)
 *   POST   /seats/decline-invite             — Decline invite via token (top-level)
 *   GET    /seats/invite-details             — Get invite info from token (top-level)
 *   PATCH  /:businessId/seats/:seatId        — Update seat (role, display_name, etc.)
 *   DELETE /:businessId/seats/:seatId        — Deactivate (soft-delete) a seat
 *   GET    /my-seats                         — All seats for the current user (top-level)
 */

const express = require('express');
const crypto = require('crypto');
const Joi = require('joi');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const requireBusinessSeat = require('../middleware/requireBusinessSeat');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const {
  getSeatForUser,
  getBusinessSeats,
  getAllSeatsForUser,
  writeSeatAuditLog,
  getRoleRank,
  BUSINESS_ROLE_RANK,
} = require('../utils/seatPermissions');

// ============================================================
// Column constants for seat queries
// ============================================================

/** Columns returned in list views */
const SEAT_LIST = `
  id, business_user_id, display_name, display_avatar_file_id,
  role_base, contact_method, is_active, invite_status,
  invite_email, invite_expires_at, accepted_at, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

/** All columns for single-seat detail */
const SEAT_DETAIL = `
  id, business_user_id, display_name, display_avatar_file_id,
  role_base, contact_method, is_active,
  invited_by_seat_id, invite_email, invite_status, invite_expires_at,
  accepted_at, deactivated_at, deactivated_reason,
  notes, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

// ============================================================
// Validation schemas
// ============================================================

const inviteSchema = Joi.object({
  display_name: Joi.string().trim().min(1).max(100).required(),
  role_base: Joi.string()
    .valid(...Object.keys(BUSINESS_ROLE_RANK))
    .default('staff'),
  invite_email: Joi.string().email().required(),
  contact_method: Joi.string().trim().max(200).allow('', null),
  notes: Joi.string().trim().max(500).allow('', null),
});

const acceptInviteSchema = Joi.object({
  token: Joi.string().trim().required(),
  display_name: Joi.string().trim().min(1).max(100).allow(null),
});

const declineInviteSchema = Joi.object({
  token: Joi.string().trim().required(),
});

const updateSeatSchema = Joi.object({
  display_name: Joi.string().trim().min(1).max(100),
  role_base: Joi.string().valid(...Object.keys(BUSINESS_ROLE_RANK)),
  contact_method: Joi.string().trim().max(200).allow('', null),
  notes: Joi.string().trim().max(500).allow('', null),
}).min(1);

// ============================================================
// Helpers
// ============================================================

/**
 * Generate a secure invite token and its SHA-256 hash.
 * The raw token is sent to the invitee; only the hash is stored.
 */
function generateInviteToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Hash a raw invite token for lookup.
 */
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}


// ====================================================================
// TOP-LEVEL ROUTES (no :businessId param) — must be defined FIRST
// so Express doesn't capture the path segment as :businessId
// ====================================================================


// ============================================================
// GET /my-seats — All active seats for the current user
// ============================================================

router.get('/my-seats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const seats = await getAllSeatsForUser(userId);
    res.json({ seats });
  } catch (err) {
    logger.error('GET /my-seats error', { error: err.message });
    res.status(500).json({ error: 'Failed to load seats' });
  }
});


// ============================================================
// GET /seats/invite-details?token=XXX — Preview invite before accepting
// ============================================================

router.get('/seats/invite-details', verifyToken, async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'token query parameter is required' });
    }

    const tokenHash = hashToken(token);

    const { data: seat, error } = await supabaseAdmin
      .from('BusinessSeat')
      .select(`
        id, business_user_id, display_name, role_base, invite_status, invite_email, invite_expires_at, created_at
      `)
      .eq('invite_token_hash', tokenHash)
      .maybeSingle();

    if (error) {
      logger.error('invite-details query error', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch invite details' });
    }

    if (!seat) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    if (seat.invite_status !== 'pending') {
      return res.status(410).json({ error: `Invite already ${seat.invite_status}` });
    }

    // Expiry check (AUTH-1.6)
    if (seat.invite_expires_at && new Date(seat.invite_expires_at) < new Date()) {
      await supabaseAdmin
        .from('BusinessSeat')
        .update({ invite_status: 'expired', invite_token_hash: null, updated_at: new Date().toISOString() })
        .eq('id', seat.id);
      return res.status(410).json({ error: 'Invite has expired' });
    }

    // Enrich with business info (public — no firewall breach)
    const { data: biz } = await supabaseAdmin
      .from('User')
      .select('id, username, name')
      .eq('id', seat.business_user_id)
      .single();

    res.json({
      seat_id: seat.id,
      business: {
        id: biz?.id,
        username: biz?.username,
        name: biz?.name,
      },
      display_name: seat.display_name,
      role_base: seat.role_base,
      invite_email: seat.invite_email,
      created_at: seat.created_at,
    });
  } catch (err) {
    logger.error('GET /seats/invite-details error', { error: err.message });
    res.status(500).json({ error: 'Failed to load invite details' });
  }
});


// ============================================================
// POST /seats/accept-invite — Accept an invitation via token
// ============================================================

router.post('/seats/accept-invite', verifyToken, validate(acceptInviteSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, display_name } = req.body;
    const tokenHash = hashToken(token);

    // 1) Find the pending seat by token hash
    const { data: seat, error: seatErr } = await supabaseAdmin
      .from('BusinessSeat')
      .select(SEAT_DETAIL)
      .eq('invite_token_hash', tokenHash)
      .maybeSingle();

    if (seatErr) {
      logger.error('accept-invite seat lookup error', { error: seatErr.message });
      return res.status(500).json({ error: 'Failed to process invite' });
    }

    if (!seat) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    if (seat.invite_status !== 'pending') {
      logger.warn('auth.invite_replay_attempt', { actor_id: userId, target_id: seat.id, invite_status: seat.invite_status, business_id: seat.business_user_id, ip: req.ip });
      return res.status(410).json({ error: `Invite already ${seat.invite_status}` });
    }

    // 1b) Expiry check (AUTH-1.6)
    if (seat.invite_expires_at && new Date(seat.invite_expires_at) < new Date()) {
      await supabaseAdmin
        .from('BusinessSeat')
        .update({ invite_status: 'expired', invite_token_hash: null, updated_at: new Date().toISOString() })
        .eq('id', seat.id);
      logger.warn('auth.invite_expired_attempt', { actor_id: userId, target_id: seat.id, business_id: seat.business_user_id, ip: req.ip });
      return res.status(410).json({ error: 'Invite has expired' });
    }

    // 1c) Email identity binding (AUTH-1.6)
    if (seat.invite_email) {
      const normalizedInviteEmail = seat.invite_email.toLowerCase().trim();
      const normalizedUserEmail = (req.user.email || '').toLowerCase().trim();
      if (normalizedInviteEmail !== normalizedUserEmail) {
        logger.warn('auth.invite_email_mismatch', { actor_id: userId, target_id: seat.id, expected_email: normalizedInviteEmail, actual_email: normalizedUserEmail, business_id: seat.business_user_id, ip: req.ip });
        return res.status(403).json({ error: 'This invitation was sent to a different email address' });
      }
    }

    // 2) Check if user already has an active seat at this business
    const existingSeat = await getSeatForUser(seat.business_user_id, userId);
    if (existingSeat) {
      return res.status(409).json({ error: 'You already have an active seat at this business' });
    }

    const now = new Date().toISOString();

    // 3) Update seat: mark accepted, optionally update display_name
    const seatUpdate = {
      invite_status: 'accepted',
      accepted_at: now,
      invite_token_hash: null, // clear the token — one-time use
      updated_at: now,
    };
    if (display_name) {
      seatUpdate.display_name = display_name;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('BusinessSeat')
      .update(seatUpdate)
      .eq('id', seat.id);

    if (updateErr) {
      logger.error('accept-invite seat update error', { error: updateErr.message });
      return res.status(500).json({ error: 'Failed to accept invite' });
    }

    // 4) Create the SeatBinding (the firewall vault entry)
    const { error: bindErr } = await supabaseAdmin
      .from('SeatBinding')
      .insert({
        seat_id: seat.id,
        user_id: userId,
        binding_method: 'invite_accept',
      });

    if (bindErr) {
      logger.error('accept-invite binding error', { error: bindErr.message });
      // Roll back seat status
      await supabaseAdmin
        .from('BusinessSeat')
        .update({
          invite_status: 'pending',
          accepted_at: null,
          invite_token_hash: tokenHash,
          updated_at: now,
        })
        .eq('id', seat.id);
      return res.status(500).json({ error: 'Failed to bind seat' });
    }

    // 5) Dual-write: also insert into BusinessTeam for backward compatibility
    try {
      await supabaseAdmin
        .from('BusinessTeam')
        .upsert({
          id: seat.id, // use same ID for consistency
          business_user_id: seat.business_user_id,
          user_id: userId,
          role_base: seat.role_base,
          title: seat.display_name,
          notes: seat.notes,
          is_active: true,
          invited_by: null, // could resolve from invited_by_seat_id but not critical
          invited_at: seat.created_at,
          joined_at: now,
        }, { onConflict: 'id' });
    } catch (dualWriteErr) {
      logger.warn('accept-invite dual-write to BusinessTeam failed (non-fatal)', {
        error: dualWriteErr.message,
        seatId: seat.id,
      });
    }

    // 6) Audit log
    await writeSeatAuditLog(
      seat.business_user_id,
      seat.id,
      'accept_invite',
      'BusinessSeat',
      seat.id,
      { display_name: display_name || seat.display_name, role_base: seat.role_base },
    );

    logger.info('auth.action', { event: 'invite_accepted', actor_id: userId, target_id: seat.id, business_id: seat.business_user_id, role_base: seat.role_base });
    res.status(200).json({
      message: 'Invite accepted',
      seat_id: seat.id,
      business_user_id: seat.business_user_id,
      role_base: seat.role_base,
    });
  } catch (err) {
    logger.error('POST /seats/accept-invite error', { error: err.message });
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});


// ============================================================
// POST /seats/decline-invite — Decline an invitation via token
// ============================================================

router.post('/seats/decline-invite', verifyToken, validate(declineInviteSchema), async (req, res) => {
  try {
    const { token } = req.body;
    const tokenHash = hashToken(token);

    const { data: seat, error: seatErr } = await supabaseAdmin
      .from('BusinessSeat')
      .select('id, business_user_id, invite_status')
      .eq('invite_token_hash', tokenHash)
      .maybeSingle();

    if (seatErr) {
      logger.error('decline-invite seat lookup error', { error: seatErr.message });
      return res.status(500).json({ error: 'Failed to process decline' });
    }

    if (!seat) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    if (seat.invite_status !== 'pending') {
      return res.status(410).json({ error: `Invite already ${seat.invite_status}` });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('BusinessSeat')
      .update({
        invite_status: 'declined',
        invite_token_hash: null,
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_reason: 'Invite declined by recipient',
        updated_at: new Date().toISOString(),
      })
      .eq('id', seat.id);

    if (updateErr) {
      logger.error('decline-invite update error', { error: updateErr.message });
      return res.status(500).json({ error: 'Failed to decline invite' });
    }

    await writeSeatAuditLog(
      seat.business_user_id,
      null, // no seat for the declining user
      'decline_invite',
      'BusinessSeat',
      seat.id,
      {},
    );

    res.json({ message: 'Invite declined' });
  } catch (err) {
    logger.error('POST /seats/decline-invite error', { error: err.message });
    res.status(500).json({ error: 'Failed to decline invite' });
  }
});


// ====================================================================
// BUSINESS-SCOPED ROUTES (with :businessId param)
// ====================================================================


// ============================================================
// GET /:businessId/seats — List all seats at this business
// ============================================================

router.get('/:businessId/seats', verifyToken, requireBusinessSeat('team.view'), async (req, res) => {
  try {
    const { businessId } = req.params;
    const callerSeatId = req.businessSeat.id;

    const { data: seats, error } = await supabaseAdmin
      .from('BusinessSeat')
      .select(SEAT_LIST)
      .eq('business_user_id', businessId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching business seats', { error: error.message, businessId });
      return res.status(500).json({ error: 'Failed to fetch seats' });
    }

    // Tag the caller's own seat with is_you flag
    const enriched = (seats || []).map(seat => ({
      ...seat,
      is_you: seat.id === callerSeatId,
    }));

    res.json({ seats: enriched });
  } catch (err) {
    logger.error('GET business seats error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});


// ============================================================
// GET /:businessId/seats/:seatId — Single seat detail
// ============================================================

router.get('/:businessId/seats/:seatId', verifyToken, requireBusinessSeat('team.view'), async (req, res) => {
  try {
    const { businessId, seatId } = req.params;
    const callerSeatId = req.businessSeat.id;

    const { data: seat, error } = await supabaseAdmin
      .from('BusinessSeat')
      .select(SEAT_DETAIL)
      .eq('id', seatId)
      .eq('business_user_id', businessId)
      .maybeSingle();

    if (error) {
      logger.error('Error fetching seat detail', { error: error.message, seatId });
      return res.status(500).json({ error: 'Failed to fetch seat' });
    }

    if (!seat) {
      return res.status(404).json({ error: 'Seat not found' });
    }

    res.json({
      ...seat,
      is_you: seat.id === callerSeatId,
    });
  } catch (err) {
    logger.error('GET seat detail error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch seat' });
  }
});


// ============================================================
// POST /:businessId/seats/invite — Create a seat + generate invite token
// ============================================================

router.post('/:businessId/seats/invite', verifyToken, requireBusinessSeat('team.invite'), validate(inviteSchema), async (req, res) => {
  try {
    const { businessId } = req.params;
    const callerSeatId = req.businessSeat.id;
    const callerRole = req.businessSeat.role_base;

    const { display_name, role_base, invite_email, contact_method, notes } = req.body;

    // Role hierarchy: cannot invite someone with a higher or equal role unless you're owner
    if (callerRole !== 'owner' && getRoleRank(role_base) >= getRoleRank(callerRole)) {
      return res.status(403).json({
        error: 'Cannot invite a seat with a role equal to or higher than your own',
      });
    }

    // Only owner can invite another owner
    if (role_base === 'owner' && callerRole !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can invite another owner' });
    }

    // Check if there's already a pending invite for this email at this business
    const { data: existingInvite } = await supabaseAdmin
      .from('BusinessSeat')
      .select('id, invite_status')
      .eq('business_user_id', businessId)
      .eq('invite_email', invite_email)
      .eq('invite_status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return res.status(409).json({ error: 'A pending invite already exists for this email' });
    }

    // Generate token
    const { token, hash } = generateInviteToken();

    // Create the seat (invite expires in 14 days — AUTH-1.6)
    const inviteExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: newSeat, error: insertErr } = await supabaseAdmin
      .from('BusinessSeat')
      .insert({
        business_user_id: businessId,
        display_name,
        role_base,
        contact_method: contact_method || null,
        invite_email,
        invite_token_hash: hash,
        invite_status: 'pending',
        invite_expires_at: inviteExpiresAt,
        invited_by_seat_id: callerSeatId,
        notes: notes || null,
      })
      .select(SEAT_LIST)
      .single();

    if (insertErr) {
      logger.error('Error creating seat invite', { error: insertErr.message, businessId });
      return res.status(500).json({ error: 'Failed to create invite' });
    }

    // Audit log
    await writeSeatAuditLog(
      businessId,
      callerSeatId,
      'create_invite',
      'BusinessSeat',
      newSeat.id,
      { display_name, role_base, invite_email },
    );

    // TODO: Send invite email via emailService (Prompt 6 will add notification routing)

    res.status(201).json({
      message: 'Invite created',
      seat: newSeat,
      invite_token: token, // send to client so they can share the link
    });
  } catch (err) {
    logger.error('POST seat invite error', { error: err.message });
    res.status(500).json({ error: 'Failed to create invite' });
  }
});


// ============================================================
// PATCH /:businessId/seats/:seatId — Update seat attributes
// ============================================================

router.patch('/:businessId/seats/:seatId', verifyToken, requireBusinessSeat('team.manage'), validate(updateSeatSchema), async (req, res) => {
  try {
    const { businessId, seatId } = req.params;
    const callerSeatId = req.businessSeat.id;
    const callerRole = req.businessSeat.role_base;

    // Cannot modify your own seat's role (prevents self-promotion)
    if (seatId === callerSeatId && req.body.role_base) {
      return res.status(400).json({ error: 'Cannot change your own role. Ask another admin/owner.' });
    }

    // Fetch the target seat
    const { data: targetSeat, error: fetchErr } = await supabaseAdmin
      .from('BusinessSeat')
      .select('id, role_base, is_active, business_user_id')
      .eq('id', seatId)
      .eq('business_user_id', businessId)
      .maybeSingle();

    if (fetchErr) {
      logger.error('PATCH seat fetch error', { error: fetchErr.message, seatId });
      return res.status(500).json({ error: 'Failed to fetch seat' });
    }

    if (!targetSeat) {
      return res.status(404).json({ error: 'Seat not found' });
    }

    if (!targetSeat.is_active) {
      return res.status(400).json({ error: 'Cannot modify a deactivated seat' });
    }

    // Role hierarchy enforcement
    if (req.body.role_base) {
      const targetCurrentRank = getRoleRank(targetSeat.role_base);
      const callerRank = getRoleRank(callerRole);
      const newRank = getRoleRank(req.body.role_base);

      // Can't modify someone with higher/equal role (unless owner)
      if (callerRole !== 'owner' && targetCurrentRank >= callerRank) {
        return res.status(403).json({ error: 'Cannot modify a seat with a role equal to or higher than your own' });
      }

      // Can't promote to a role equal/above your own (unless owner)
      if (callerRole !== 'owner' && newRank >= callerRank) {
        return res.status(403).json({ error: 'Cannot promote a seat to a role equal to or higher than your own' });
      }

      // Only owner can set role to owner
      if (req.body.role_base === 'owner' && callerRole !== 'owner') {
        return res.status(403).json({ error: 'Only the owner can promote to owner' });
      }
    }

    // Build update payload
    const updatePayload = { updated_at: new Date().toISOString() };
    if (req.body.display_name !== undefined) updatePayload.display_name = req.body.display_name;
    if (req.body.role_base !== undefined) updatePayload.role_base = req.body.role_base;
    if (req.body.contact_method !== undefined) updatePayload.contact_method = req.body.contact_method || null;
    if (req.body.notes !== undefined) updatePayload.notes = req.body.notes || null;

    const { data: updatedSeat, error: updateErr } = await supabaseAdmin
      .from('BusinessSeat')
      .update(updatePayload)
      .eq('id', seatId)
      .select(SEAT_DETAIL)
      .single();

    if (updateErr) {
      logger.error('PATCH seat update error', { error: updateErr.message, seatId });
      return res.status(500).json({ error: 'Failed to update seat' });
    }

    // Dual-write: update BusinessTeam if role changed
    if (req.body.role_base || req.body.display_name) {
      try {
        const btUpdate = { updated_at: new Date().toISOString() };
        if (req.body.role_base) btUpdate.role_base = req.body.role_base;
        if (req.body.display_name) btUpdate.title = req.body.display_name;

        await supabaseAdmin
          .from('BusinessTeam')
          .update(btUpdate)
          .eq('id', seatId); // using same ID due to migration
      } catch (dualWriteErr) {
        logger.warn('PATCH seat dual-write to BusinessTeam failed (non-fatal)', {
          error: dualWriteErr.message,
          seatId,
        });
      }
    }

    // Audit log
    await writeSeatAuditLog(
      businessId,
      callerSeatId,
      'update_seat',
      'BusinessSeat',
      seatId,
      { changes: req.body, previous_role: targetSeat.role_base },
    );

    res.json({ message: 'Seat updated', seat: updatedSeat });
  } catch (err) {
    logger.error('PATCH seat error', { error: err.message });
    res.status(500).json({ error: 'Failed to update seat' });
  }
});


// ============================================================
// DELETE /:businessId/seats/:seatId — Deactivate (soft-delete) a seat
// ============================================================

router.delete('/:businessId/seats/:seatId', verifyToken, requireBusinessSeat('team.manage'), async (req, res) => {
  try {
    const { businessId, seatId } = req.params;
    const callerSeatId = req.businessSeat.id;
    const callerRole = req.businessSeat.role_base;
    const isSelf = seatId === callerSeatId;

    // Self-removal: anyone can leave (except sole owner)
    // Removing others: need team.manage (already checked by middleware)

    // Fetch target seat
    const { data: targetSeat, error: fetchErr } = await supabaseAdmin
      .from('BusinessSeat')
      .select('id, role_base, is_active, business_user_id')
      .eq('id', seatId)
      .eq('business_user_id', businessId)
      .maybeSingle();

    if (fetchErr) {
      logger.error('DELETE seat fetch error', { error: fetchErr.message, seatId });
      return res.status(500).json({ error: 'Failed to fetch seat' });
    }

    if (!targetSeat) {
      return res.status(404).json({ error: 'Seat not found' });
    }

    if (!targetSeat.is_active) {
      return res.status(400).json({ error: 'Seat is already deactivated' });
    }

    // Prevent removing a higher-ranked seat (unless you're the owner)
    if (!isSelf && callerRole !== 'owner') {
      if (getRoleRank(targetSeat.role_base) >= getRoleRank(callerRole)) {
        return res.status(403).json({ error: 'Cannot remove a seat with a role equal to or higher than your own' });
      }
    }

    // If target is an owner, check they're not the sole owner
    if (targetSeat.role_base === 'owner') {
      const { data: otherOwners } = await supabaseAdmin
        .from('BusinessSeat')
        .select('id')
        .eq('business_user_id', businessId)
        .eq('role_base', 'owner')
        .eq('is_active', true)
        .neq('id', seatId);

      if (!otherOwners || otherOwners.length === 0) {
        return res.status(400).json({ error: 'Cannot remove the sole owner. Transfer ownership first.' });
      }
    }

    const now = new Date().toISOString();

    // Resolve the bound user_id BEFORE deleting the binding
    // (needed for dual-write and override cleanup)
    let boundUserId = null;
    try {
      const { data: binding } = await supabaseAdmin
        .from('SeatBinding')
        .select('user_id')
        .eq('seat_id', seatId)
        .maybeSingle();
      boundUserId = binding?.user_id || null;
    } catch {
      // Binding may not exist (pending invite)
    }

    // Deactivate the seat
    const { error: updateErr } = await supabaseAdmin
      .from('BusinessSeat')
      .update({
        is_active: false,
        deactivated_at: now,
        deactivated_reason: isSelf ? 'Self-removal' : 'Removed by team manager',
        updated_at: now,
      })
      .eq('id', seatId);

    if (updateErr) {
      logger.error('DELETE seat update error', { error: updateErr.message, seatId });
      return res.status(500).json({ error: 'Failed to deactivate seat' });
    }

    // Remove the SeatBinding
    if (boundUserId) {
      const { error: bindErr } = await supabaseAdmin
        .from('SeatBinding')
        .delete()
        .eq('seat_id', seatId);

      if (bindErr) {
        logger.warn('DELETE seat binding removal failed (non-fatal)', {
          error: bindErr.message,
          seatId,
        });
      }

      // Clean up permission overrides (still keyed by user_id during transition)
      await supabaseAdmin
        .from('BusinessPermissionOverride')
        .delete()
        .eq('business_user_id', businessId)
        .eq('user_id', boundUserId);
    }

    // Dual-write: deactivate in BusinessTeam
    try {
      await supabaseAdmin
        .from('BusinessTeam')
        .update({
          is_active: false,
          left_at: now,
          updated_at: now,
        })
        .eq('id', seatId);
    } catch (dualWriteErr) {
      logger.warn('DELETE seat dual-write to BusinessTeam failed (non-fatal)', {
        error: dualWriteErr.message,
        seatId,
      });
    }

    // Audit log
    await writeSeatAuditLog(
      businessId,
      callerSeatId,
      isSelf ? 'self_leave' : 'remove_seat',
      'BusinessSeat',
      seatId,
      { target_role: targetSeat.role_base },
    );

    res.json({ message: isSelf ? 'You have left the business' : 'Seat deactivated' });
  } catch (err) {
    logger.error('DELETE seat error', { error: err.message });
    res.status(500).json({ error: 'Failed to deactivate seat' });
  }
});


module.exports = router;
