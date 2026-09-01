/**
 * Business Founding Offer Routes
 *
 * First-50 founding business slot management.
 * Mount at: app.use('/api/businesses', require('./routes/businessFounding'));
 *
 * Endpoints:
 *   GET  /founding-offer/status              — Global slot availability + user's claims
 *   POST /:businessId/founding-offer/claim   — Claim a founding slot for a business
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const {
  checkBusinessPermission,
  writeAuditLog,
} = require('../utils/businessPermissions');

const TOTAL_FOUNDING_SLOTS = 50;


// ============================================================
// GET /founding-offer/status — Global founding offer status
// ============================================================

router.get('/founding-offer/status', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Count claimed slots
    const { count: slotsClaimed, error: countErr } = await supabaseAdmin
      .from('FoundingBusinessSlot')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    if (countErr) {
      logger.error('Error counting founding slots', { error: countErr.message });
      return res.status(500).json({ error: 'Failed to fetch founding offer status' });
    }

    const claimed = slotsClaimed || 0;

    // Get user's owned business IDs (seat-based with BusinessTeam fallback)
    let ownerships;
    const { data: seatOwnerships } = await supabaseAdmin
      .from('SeatBinding')
      .select('seat:seat_id ( business_user_id, role_base, is_active )')
      .eq('user_id', userId);
    const seatOwned = (seatOwnerships || [])
      .filter(s => s.seat?.is_active && s.seat?.role_base === 'owner')
      .map(s => ({ business_user_id: s.seat.business_user_id }));
    if (seatOwned.length > 0) {
      ownerships = seatOwned;
    } else {
      const { data: legacyOwnerships } = await supabaseAdmin
        .from('BusinessTeam')
        .select('business_user_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('role_base', 'owner');
      ownerships = legacyOwnerships;
    }

    const businessIds = (ownerships || []).map(o => o.business_user_id);

    // Check if any of user's businesses have founding slots
    let userBusinesses = [];
    if (businessIds.length > 0) {
      const { data: slots } = await supabaseAdmin
        .from('FoundingBusinessSlot')
        .select('business_user_id, slot_number, claimed_at, status')
        .in('business_user_id', businessIds);

      userBusinesses = slots || [];
    }

    res.json({
      total_slots: TOTAL_FOUNDING_SLOTS,
      slots_claimed: claimed,
      slots_remaining: TOTAL_FOUNDING_SLOTS - claimed,
      is_offer_active: claimed < TOTAL_FOUNDING_SLOTS,
      user_businesses: userBusinesses,
    });
  } catch (err) {
    logger.error('Founding offer status error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch founding offer status' });
  }
});


// ============================================================
// POST /:businessId/founding-offer/claim — Claim a founding slot
// ============================================================

router.post('/:businessId/founding-offer/claim', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    // Must be owner
    const access = await checkBusinessPermission(businessId, userId);
    if (!access.hasAccess || !access.isOwner) {
      return res.status(403).json({ error: 'Only the business owner can claim a founding slot' });
    }

    // Business must be published
    const { data: profile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('is_published, verification_status')
      .eq('business_user_id', businessId)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Business profile not found' });
    }

    if (!profile.is_published) {
      return res.status(400).json({
        error: 'Business must be published before claiming a founding slot',
        code: 'NOT_PUBLISHED',
      });
    }

    // Must be at minimum document_verified
    if (profile.verification_status !== 'document_verified' && profile.verification_status !== 'government_verified') {
      return res.status(400).json({
        error: 'Business must complete document verification before claiming a founding slot. Self-attestation alone is not sufficient.',
        code: 'INSUFFICIENT_VERIFICATION',
        current_status: profile.verification_status || 'unverified',
        required: 'document_verified',
      });
    }

    // Check if already has a founding slot
    const { data: existingSlot } = await supabaseAdmin
      .from('FoundingBusinessSlot')
      .select('id, slot_number')
      .eq('business_user_id', businessId)
      .maybeSingle();

    if (existingSlot) {
      return res.status(409).json({
        error: 'Your business already has a founding slot',
        code: 'ALREADY_CLAIMED',
        slot_number: existingSlot.slot_number,
      });
    }

    // Insert — let DB handle slot_number auto-increment and constraints
    const { data: slot, error: insertErr } = await supabaseAdmin
      .from('FoundingBusinessSlot')
      .insert({
        business_user_id: businessId,
        status: 'active',
      })
      .select()
      .single();

    if (insertErr) {
      // Unique constraint violation on business_user_id
      if (insertErr.code === '23505') {
        return res.status(409).json({
          error: 'Your business already has a founding slot',
          code: 'ALREADY_CLAIMED',
        });
      }
      // Check constraint violation on slot_number range (all 50 claimed)
      if (insertErr.code === '23514') {
        return res.status(409).json({
          error: 'All 50 founding business slots have been claimed',
          code: 'SLOTS_FULL',
        });
      }
      logger.error('Error claiming founding slot', { error: insertErr.message, businessId });
      return res.status(500).json({ error: 'Failed to claim founding slot' });
    }

    // Set founding benefits on BusinessProfile
    const benefitExpiry = new Date();
    benefitExpiry.setMonth(benefitExpiry.getMonth() + 12);

    const benefitUpdates = {
      founding_badge: true,
      founding_benefit_expires_at: benefitExpiry.toISOString(),
    };

    // Set fee_override_pct to 10% only if not already set or currently higher
    const { data: currentProfile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('fee_override_pct')
      .eq('business_user_id', businessId)
      .single();

    if (!currentProfile?.fee_override_pct || currentProfile.fee_override_pct > 10) {
      benefitUpdates.fee_override_pct = 10;
    }

    const { error: benefitErr } = await supabaseAdmin
      .from('BusinessProfile')
      .update(benefitUpdates)
      .eq('business_user_id', businessId);

    if (benefitErr) {
      logger.error('Failed to set founding benefits', { error: benefitErr.message, businessId });
      // Non-fatal — slot is claimed, benefits can be applied manually
    }

    await writeAuditLog(businessId, userId, 'claim_founding_offer', 'FoundingBusinessSlot', slot.id, {
      slot_number: slot.slot_number,
      benefits_applied: !benefitErr,
      fee_override_pct: benefitUpdates.fee_override_pct || currentProfile?.fee_override_pct,
      founding_benefit_expires_at: benefitExpiry.toISOString(),
    });

    res.status(201).json({
      slot_number: slot.slot_number,
      claimed_at: slot.claimed_at,
      status: 'active',
      founding_badge: true,
      founding_benefit_expires_at: benefitExpiry.toISOString(),
      message: `Congratulations! You are Founding Business #${slot.slot_number}`,
    });
  } catch (err) {
    logger.error('Founding offer claim error', { error: err.message, businessId: req.params.businessId });
    res.status(500).json({ error: 'Failed to claim founding slot' });
  }
});


module.exports = router;
