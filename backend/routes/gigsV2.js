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
const logger = require('../utils/logger');
const { createNotification } = require('../services/notificationService');
const stripeService = require('../stripe/stripeService');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');

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

// ============ RATE-LIMIT MAP FOR LOCATION UPDATES ============

/** In-memory per-gig throttle: gigId → last update timestamp */
const locationUpdateTimestamps = new Map();

const LOCATION_UPDATE_INTERVAL_MS = 30_000; // 30 seconds

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
      .select('id, user_id, status, engagement_mode, price, title, scheduled_start, origin_home_id')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // 2. Validate engagement mode
    if (gig.engagement_mode !== 'instant_accept') {
      return res.status(400).json({
        error: 'This task does not use instant accept',
      });
    }

    // 3. Validate not already assigned
    if (gig.status !== 'open') {
      return res.status(409).json({
        error: 'This task has already been assigned',
      });
    }

    // 4. Validate not self-accept
    if (gig.user_id === helperId) {
      return res.status(400).json({
        error: 'You cannot accept your own task',
      });
    }

    // 5. Validate payout setup (if paid gig)
    const gigPrice = parseFloat(gig.price || 0);
    let paymentResult = null;
    if (gigPrice > 0) {
      const { data: stripeAcct } = await supabaseAdmin
        .from('StripeAccount')
        .select('id, details_submitted, payouts_enabled')
        .eq('user_id', helperId)
        .single();

      if (!stripeAcct || !stripeAcct.details_submitted) {
        return res.status(403).json({
          error: 'Please complete payout onboarding before accepting paid tasks',
        });
      }

      // Initialize payment before assignment to avoid paid gigs getting stuck
      // with no payment_id (which blocks worker start).
      try {
        const amountCents = Math.round(gigPrice * 100);
        const scheduledStart = gig?.scheduled_start ? new Date(gig.scheduled_start) : null;
        const now = new Date();
        const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
        const startsWithinFiveDays = !scheduledStart || scheduledStart <= fiveDaysFromNow;

        paymentResult = startsWithinFiveDays
          ? await stripeService.createPaymentIntentForGig({
              payerId: gig.user_id,
              payeeId: helperId,
              gigId,
              amount: amountCents,
              homeId: gig?.origin_home_id || null,
            })
          : await stripeService.createSetupIntent({
              payerId: gig.user_id,
              payeeId: helperId,
              gigId,
              amount: amountCents,
              homeId: gig?.origin_home_id || null,
            });
      } catch (paymentErr) {
        logger.error('Instant accept: payment setup failed', {
          gigId,
          helperId,
          error: paymentErr?.message,
        });
        return res.status(400).json({
          error: 'Payment setup failed. Please add a payment method before accepting this task.',
          code: 'payer_payment_required',
        });
      }
    }

    // 6. Atomically assign — .eq('status', 'open') prevents race conditions
    const now = new Date().toISOString();
    const paymentStatus = paymentResult?.payment?.payment_status
      || (paymentResult?.setupIntentId ? PAYMENT_STATES.SETUP_PENDING : PAYMENT_STATES.AUTHORIZE_PENDING);
    const updatePayload = {
      status: 'assigned',
      accepted_by: helperId,
      accepted_at: now,
      ...(paymentResult?.paymentId
        ? {
            payment_id: paymentResult.paymentId,
            payment_status: paymentStatus,
          }
        : {}),
    };
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('Gig')
      .update(updatePayload)
      .eq('id', gigId)
      .eq('status', 'open') // optimistic concurrency guard
      .select('id, status, accepted_by, accepted_at, title, user_id, price, payment_id, payment_status')
      .single();

    if (updateErr || !updated) {
      // Another helper won the race
      return res.status(409).json({
        error: 'This task has already been assigned',
      });
    }

    // 7. Notify poster
    try {
      await createNotification({
        userId: gig.user_id,
        type: 'task_accepted',
        title: 'Someone accepted your task!',
        body: `Your task "${gig.title}" has been accepted.`,
        icon: '⚡',
        link: `/gig/${gigId}`,
        metadata: { gig_id: gigId },
      });

      if (paymentResult?.clientSecret) {
        await createNotification({
          userId: gig.user_id,
          type: 'payment_action_required',
          title: 'Complete payment authorization',
          body: `Your task "${gig.title}" has been accepted. Please complete payment authorization so work can start.`,
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
      requiresPaymentSetup: Boolean(paymentResult?.clientSecret),
      isSetupIntent: Boolean(paymentResult?.setupIntentId),
      payment: paymentResult
        ? {
            clientSecret: paymentResult.clientSecret || null,
            paymentId: paymentResult.paymentId || null,
            setupIntentId: paymentResult.setupIntentId || null,
            paymentIntentId: paymentResult.paymentIntentId || null,
          }
        : null,
      assignment: {
        gig_id: gigId,
        helper_id: helperId,
        accepted_at: now,
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
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    // Fetch gig
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // Only poster or assigned helper can share status
    if (gig.user_id !== userId && gig.accepted_by !== userId) {
      return res.status(403).json({ error: 'Not authorised to share this task status' });
    }

    // Generate token + expiry
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    const { error: updateErr } = await supabaseAdmin
      .from('Gig')
      .update({
        status_share_token: token,
        status_share_expires_at: expiresAt,
      })
      .eq('id', gigId);

    if (updateErr) {
      logger.error('Failed to save share token', { gigId, error: updateErr.message });
      return res.status(500).json({ error: 'Failed to generate share link' });
    }

    const baseUrl = process.env.APP_URL || 'https://pantopus.com';
    return res.status(200).json({
      share_url: `${baseUrl}/status/${token}`,
      expires_at: expiresAt,
    });
  } catch (err) {
    logger.error('Share status error', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Failed to share status' });
  }
});

// =====================================================================
//  GET /status/:token   (PUBLIC — no auth)
// =====================================================================

router.get('/status/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('title, status, helper_eta_minutes, updated_at, status_share_expires_at, accepted_by')
      .eq('status_share_token', token)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Check expiry
    if (new Date(gig.status_share_expires_at) < new Date()) {
      return res.status(404).json({ error: 'Status link expired' });
    }

    // Fetch helper first name only (sanitised)
    let helperFirstName = null;
    if (gig.accepted_by) {
      const { data: helper } = await supabaseAdmin
        .from('User')
        .select('first_name')
        .eq('id', gig.accepted_by)
        .single();
      helperFirstName = helper?.first_name || null;
    }

    // Return sanitised response — NO PII, NO IDs, NO addresses, NO payment info
    return res.status(200).json({
      title: gig.title,
      status: gig.status,
      helper_first_name: helperFirstName,
      helper_eta_minutes: gig.helper_eta_minutes,
      updated_at: gig.updated_at,
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
    const { latitude, longitude } = req.body;

    // Validate input
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Rate limit: 1 update per 30s per gig
    const lastUpdate = locationUpdateTimestamps.get(gigId);
    if (lastUpdate && Date.now() - lastUpdate < LOCATION_UPDATE_INTERVAL_MS) {
      return res.status(429).json({ error: 'Location updates limited to once per 30 seconds' });
    }

    // Fetch gig — verify caller is the assigned helper
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, accepted_by, exact_location')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    if (gig.accepted_by !== helperId) {
      return res.status(403).json({ error: 'Only the assigned helper can update location' });
    }

    // Calculate ETA using Haversine if gig has a location
    let etaMinutes = null;
    if (gig.exact_location) {
      // Parse PostGIS point: SRID=4326;POINT(lng lat) or POINT(lng lat)
      const pointMatch = String(gig.exact_location).match(
        /POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i
      );
      if (pointMatch) {
        const gigLng = parseFloat(pointMatch[1]);
        const gigLat = parseFloat(pointMatch[2]);
        const distKm = haversineKm(latitude, longitude, gigLat, gigLng);
        etaMinutes = Math.max(1, Math.round((distKm / 30) * 60)); // 30 km/h average
      }
    }

    // Build PostGIS point string
    const pointWkt = `SRID=4326;POINT(${longitude} ${latitude})`;
    const now = new Date().toISOString();

    const updateData = {
      helper_last_location: pointWkt,
      helper_location_updated_at: now,
    };
    if (etaMinutes != null) {
      updateData.helper_eta_minutes = etaMinutes;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('Gig')
      .update(updateData)
      .eq('id', gigId);

    if (updateErr) {
      logger.error('Failed to update helper location', { gigId, error: updateErr.message });
      return res.status(500).json({ error: 'Failed to update location' });
    }

    // Record timestamp for rate-limiting
    locationUpdateTimestamps.set(gigId, Date.now());

    // Real-time ETA event
    emitGigUpdate(req, gigId, 'eta-update', {
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
