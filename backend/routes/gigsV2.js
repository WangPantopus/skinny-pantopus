/**
 * Gigs V2 Routes — New endpoints for Gigs MVP
 *
 * Mounted at /api/gigs alongside existing gig routes.
 * All paths here are NEW — no conflicts with routes/gigs.js.
 *
 * Endpoints:
 *   POST /:gigId/instant-accept
 *   POST /:gigId/share-status
 *   GET  /status/:token          (public, no auth)
 *   POST /:gigId/update-location
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const { canActAsBusiness } = require('../services/chatBusinessAccess');
const logger = require('../utils/logger');
const { createNotification } = require('../services/notificationService');
const stripeService = require('../stripe/stripeService');
const blockService = require('../services/blockService');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');
const { emitPrivateGigUpdate } = require('../socket/chatSocketio');
const parsePostGISPoint = require('../utils/parsePostGISPoint');
const { hydrateListingCreatorIdentities, serializeTaskPerson } = require('../utils/listingCreatorIdentity');

// ============ REAL-TIME HELPER (same pattern as gigs.js) ============

function emitGigUpdate(req, gigId, eventType, extra) {
  const io = req.app.get('io');
  if (!io) return;
  io.to(`gig:${gigId}`).emit(`gig:${eventType}`, {
    gigId,
    eventType,
    timestamp: Date.now(),
    ...extra,
  });
}

// The stored timestamp and conditional write enforce this across API processes.
const LOCATION_UPDATE_INTERVAL_MS = 30_000;

// ============ HAVERSINE HELPER ============

/**
 * Straight-line distance between two lat/lng pairs in kilometres.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =====================================================================
//  POST /:gigId/instant-accept
// =====================================================================

router.post('/:gigId/instant-accept', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const helperId = req.user.id;

    // 1. Fetch gig
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status, engagement_mode, price, title, scheduled_start, origin_home_id, accepted_by, updated_at, deadline')
      .eq('id', gigId)
      .maybeSingle();

    if (gigErr) return res.status(503).json({ error: 'Task acceptance is temporarily unavailable' });
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // 2. Validate engagement mode
    if (gig.engagement_mode !== 'instant_accept') {
      return res.status(400).json({
        error: 'This task does not use instant accept',
      });
    }

    // 3. Validate not already assigned
    const replay = gig.status === 'assigned' && gig.accepted_by === helperId;
    if (gig.status !== 'open' && !replay) {
      return res.status(409).json({
        error: 'This task has already been assigned',
      });
    }

    // 4. Validate not self-accept
    if (await canActAsBusiness(gig.user_id, helperId)) {
      return res.status(400).json({
        error: 'You cannot accept your own task',
      });
    }

    try {
      if (await blockService.isBlocked(gig.user_id, helperId)) {
        return res.status(403).json({ code: 'blocked', error: 'You cannot accept this task' });
      }
    } catch {
      return res.status(503).json({ error: 'Task acceptance is temporarily unavailable. Please retry.' });
    }
    const gigPrice = Number(gig.price);
    let customerId = null;
    let platformFee = null;
    if (!replay && gig.deadline && Date.parse(gig.deadline) <= Date.now()) {
      return res.status(409).json({ code: 'expired', error: 'This task is no longer accepting helpers' });
    }
    if (gigPrice > 0 && !replay) {
      const { data: stripeAcct, error: stripeErr } = await supabaseAdmin
        .from('StripeAccount').select('details_submitted').eq('user_id', helperId).maybeSingle();
      if (stripeErr) return res.status(503).json({ error: 'Payout verification is temporarily unavailable' });
      if (!stripeAcct?.details_submitted) {
        return res.status(403).json({ code: 'payout_required', error: 'Please complete payout onboarding before accepting paid tasks' });
      }
      try {
        customerId = await stripeService.getOrCreateCustomer(gig.user_id);
        const rate = await stripeService.getEffectiveFeeRate(helperId);
        platformFee = stripeService.calculateFees(Math.round(gigPrice * 100), rate).platformFee;
      } catch (paymentErr) {
        logger.error('Instant accept: payer setup unavailable', { gigId, error: paymentErr.message });
        return res.status(503).json({ code: 'payer_payment_required', error: 'The task owner’s payment setup is unavailable. Please try again later.' });
      }
    }

    // Reserve the payment and assignment in one transaction before any intent.
    // Only the owner may start checkout through assigned authorization recovery.
    const { data: reservation, error: reserveError } = await supabaseAdmin.rpc('reserve_instant_gig', {
      p_gig_id: gigId, p_helper_id: helperId, p_updated_at: gig.updated_at,
      p_customer_id: customerId, p_platform_fee: platformFee,
    });
    if (reserveError || !reservation) {
      logger.error('Instant accept reservation failed', { gigId, error: reserveError?.message });
      return res.status(503).json({ error: 'Task acceptance is temporarily unavailable. Please retry.' });
    }
    if (reservation.code) {
      const errors = {
        not_found: [404, 'Gig not found'],
        wrong_mode: [400, 'This task does not use instant accept'],
        self_accept: [400, 'You cannot accept your own task'],
        blocked: [403, 'You cannot accept this task'],
        payout_required: [403, 'Please complete payout onboarding before accepting paid tasks'],
        assigned: [409, 'This task has already been assigned'],
        changed: [409, 'This task has changed. Refresh it before accepting.'],
        expired: [409, 'This task is no longer accepting helpers'],
        payment_pending: [409, 'This task has a payment in progress. Please try again later.'],
        invalid_price: [409, 'This task’s price needs to be updated by its owner'],
      };
      const [status, message] = errors[reservation.code] || [503, 'Task acceptance is temporarily unavailable'];
      return res.status(status).json({ code: reservation.code, error: message });
    }
    const updated = reservation.gig;

    // A successful retry returns the existing assignment without duplicate alerts.
    if (!reservation.reused) try {
      await createNotification({
        userId: gig.user_id,
        type: 'task_accepted',
        title: 'Someone accepted your task!',
        body: `Your task "${gig.title}" has been accepted.`,
        icon: '⚡',
        link: `/gig/${gigId}`,
        metadata: { gig_id: gigId },
      });

      if (gigPrice > 0) {
        // A payment hold can start only a day before the task, and the hourly job reminds the owner then.
        const opensLater = Date.parse(gig.scheduled_start) - Date.now() > 24 * 60 * 60 * 1000;
        await createNotification({
          userId: gig.user_id,
          type: 'payment_action_required',
          title: opensLater ? 'Payment authorization opens later' : 'Complete payment authorization',
          body: opensLater
            ? `Your task "${gig.title}" has been accepted. You can authorize payment starting one day before it begins. We'll remind you then.`
            : `Your task "${gig.title}" has been accepted. Please complete payment authorization so work can start.`,
          icon: '💳',
          link: `/gigs/${gigId}`,
          metadata: { gig_id: gigId, required_status: PAYMENT_STATES.AUTHORIZED },
        });
      }
    } catch (notifErr) {
      logger.error('Failed to send instant-accept notification', { gigId, error: notifErr.message });
    }

    // 8. Real-time event
    emitGigUpdate(req, gigId, 'status-change');

    return res.status(200).json({
      message: 'Task accepted successfully',
      gig: updated,
      paymentRequired: gigPrice > 0,
      requiresPaymentSetup: gigPrice > 0 && updated.payment_status !== PAYMENT_STATES.AUTHORIZED,
      isSetupIntent: false,
      payment: null,
      assignment: {
        gig_id: gigId,
        helper_id: helperId,
        accepted_at: updated.accepted_at,
      },
    });
  } catch (err) {
    logger.error('Instant accept error', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Failed to accept task' });
  }
});

// =====================================================================
//  POST /:gigId/share-status
// =====================================================================

router.post('/:gigId/share-status', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const { gigId } = req.params;
    const userId = req.user.id;
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, status_share_token, status_share_expires_at')
      .eq('id', gigId)
      .maybeSingle();

    if (gigErr) return res.status(503).json({ error: 'Task sharing is temporarily unavailable' });
    if (!gig) return res.status(404).json({ error: 'Gig not found' });
    if (gig.user_id !== userId && gig.accepted_by !== userId) {
      return res.status(403).json({ error: 'Not authorised to share this task status' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    let update = supabaseAdmin.from('Gig').update({ status_share_token: token, status_share_expires_at: expiresAt }).eq('id', gigId);
    // A delayed command cannot replace another work relationship or newer link.
    for (const field of ['user_id', 'accepted_by', 'status_share_token', 'status_share_expires_at']) {
      update = gig[field] == null ? update.is(field, null) : update.eq(field, gig[field]);
    }
    const { data: saved, error: updateErr } = await update.select('status_share_token, status_share_expires_at').maybeSingle();
    if (updateErr) {
      logger.error('Failed to save share token', { gigId, error: updateErr.message });
      return res.status(500).json({ error: 'Failed to generate share link' });
    }
    if (!saved) return res.status(409).json({ error: 'Task sharing changed. Reopen the task and try again.' });
    if (saved.status_share_token !== token || Date.parse(saved.status_share_expires_at) !== Date.parse(expiresAt)) {
      return res.status(503).json({ error: 'Share link could not be confirmed. Please retry.' });
    }
    const baseUrl = (process.env.APP_URL || 'https://pantopus.com').replace(/\/$/, '');
    return res.status(200).json({ share_url: `${baseUrl}/status/${token}`, expires_at: saved.status_share_expires_at });
  } catch (err) {
    logger.error('Share status error', { error: err.message });
    return res.status(500).json({ error: 'Failed to share status' });
  }
});

// Public bearer-link reader. Recheck the link after the helper lookup so a
// revoked/expired link or replaced helper cannot use the opening snapshot.
router.get('/status/:token', async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const { token } = req.params;
    if (!/^[a-f0-9]{32}$/.test(token)) return res.status(404).json({ error: 'Not found' });
    const columns = 'id, title, status, helper_eta_minutes, helper_location_updated_at, updated_at, status_share_expires_at, accepted_by';
    const { data: gig, error: gigErr } = await supabaseAdmin.from('Gig').select(columns).eq('status_share_token', token).maybeSingle();
    if (gigErr) return res.status(503).json({ error: 'Status is temporarily unavailable' });
    if (!gig) return res.status(404).json({ error: 'Not found' });
    const live = value => Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now();
    if (!live(gig.status_share_expires_at)) return res.status(404).json({ error: 'Status link expired' });

    // A helper who named their Local Profile goes by that name, as on the task (serializeTaskPerson). Anyone else, a
    // business included, keeps the first name alone, as before: never the full account name.
    let helperFirstName = null;
    if (gig.accepted_by) {
      const holder = { user_id: gig.accepted_by };
      await hydrateListingCreatorIdentities(holder);
      const helper = holder.creator;
      helperFirstName = helper?.display_name && helper.account_type !== 'business'
        ? serializeTaskPerson(helper).displayName
        : helper?.first_name || null;
    }
    const { data: current, error: currentErr } = await supabaseAdmin.from('Gig').select(columns).eq('id', gig.id).eq('status_share_token', token).maybeSingle();
    if (currentErr) return res.status(503).json({ error: 'Status is temporarily unavailable' });
    if (!current || current.accepted_by !== gig.accepted_by || !live(current.status_share_expires_at)) {
      return res.status(404).json({ error: 'Status link expired or unavailable' });
    }
    // Limited shared status: excludes IDs, addresses, exact coordinates and payment details.
    return res.status(200).json({
      title: current.title,
      status: current.status,
      helper_first_name: helperFirstName,
      helper_eta_minutes: current.helper_eta_minutes,
      helper_location_updated_at: current.helper_location_updated_at ?? null,
      updated_at: current.updated_at,
      expires_at: current.status_share_expires_at,
    });
  } catch (err) {
    logger.error('Public status lookup error', { error: err.message });
    return res.status(500).json({ error: 'Failed to retrieve status' });
  }
});

// =====================================================================
//  POST /:gigId/update-location   (assigned helper only)
// =====================================================================

router.post('/:gigId/update-location', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const helperId = req.user.id;
    const { latitude, longitude } = req.body || {};

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Valid numeric latitude and longitude are required' });
    }

    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, status, accepted_at, started_at, updated_at, exact_location, helper_last_location, helper_location_updated_at, helper_eta_minutes')
      .eq('id', gigId)
      .maybeSingle();
    if (gigErr) return res.status(503).json({ error: 'Unable to verify the current task' });
    if (!gig) return res.status(404).json({ error: 'Gig not found' });
    if (gig.accepted_by !== helperId) {
      return res.status(403).json({ error: 'Only the assigned helper can update location' });
    }
    if (!['assigned', 'in_progress'].includes(gig.status)) {
      return res.status(409).json({ error: 'Location updates require an active task' });
    }
    const previousUpdate = Date.parse(gig.helper_location_updated_at);
    if (Number.isFinite(previousUpdate) && Date.now() - previousUpdate < LOCATION_UPDATE_INTERVAL_MS) {
      return res.status(429).json({ error: 'Location updates limited to once per 30 seconds' });
    }

    const target = parsePostGISPoint(gig.exact_location);
    const etaMinutes = target && Number.isFinite(target.latitude) && Number.isFinite(target.longitude)
      && Math.abs(target.latitude) <= 90 && Math.abs(target.longitude) <= 180
      ? Math.max(1, Math.round((haversineKm(latitude, longitude, target.latitude, target.longitude) / 30) * 60))
      : null;
    const pointWkt = `SRID=4326;POINT(${longitude} ${latitude})`;
    const now = new Date().toISOString();
    const updateData = {
      helper_last_location: pointWkt,
      helper_location_updated_at: now,
      helper_eta_minutes: etaMinutes,
      updated_at: now,
    };

    // Preserve the exact work relationship, target and previously observed update.
    // Competing requests cannot both replace the same snapshot, even on separate servers.
    let update = supabaseAdmin.from('Gig').update(updateData).eq('id', gigId);
    for (const field of ['user_id', 'accepted_by', 'status', 'accepted_at', 'started_at', 'updated_at',
      'exact_location', 'helper_last_location', 'helper_location_updated_at', 'helper_eta_minutes']) {
      update = gig[field] == null ? update.is(field, null) : update.eq(field, gig[field]);
    }
    const { data: saved, error: updateErr } = await update
      .select('id, user_id, accepted_by, status, helper_last_location, helper_location_updated_at, helper_eta_minutes')
      .maybeSingle();
    if (updateErr) {
      logger.error('Failed to update helper location', { gigId, error: updateErr.message });
      return res.status(503).json({ error: 'Unable to confirm the location update' });
    }
    if (!saved) return res.status(409).json({ error: 'Task changed. Refresh before updating location' });
    const savedLocation = parsePostGISPoint(saved.helper_last_location);
    if (saved.id !== gigId || saved.user_id !== gig.user_id || saved.accepted_by !== helperId
      || saved.status !== gig.status || saved.helper_eta_minutes !== etaMinutes
      || Date.parse(saved.helper_location_updated_at) !== Date.parse(now)
      || savedLocation?.latitude !== latitude || savedLocation?.longitude !== longitude) {
      return res.status(503).json({ error: 'Unable to confirm the location update' });
    }

    // Real-time ETA event
    await emitPrivateGigUpdate(req.app.get('io'), gig, 'gig:eta-update', {
      gigId,
      eventType: 'eta-update',
      timestamp: Date.now(),
      eta_minutes: etaMinutes,
    });

    return res.status(200).json({
      eta_minutes: etaMinutes,
      updated_at: now,
    });
  } catch (err) {
    logger.error('Update location error', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Failed to update location' });
  }
});

module.exports = router;
