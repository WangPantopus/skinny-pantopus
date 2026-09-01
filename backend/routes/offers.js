const express = require('express');
const router = express.Router({ mergeParams: true });

const supabase = require('../config/supabase');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');

/** Emit a real-time event to gig detail viewers */
function emitGigUpdate(req, gigId, eventType) {
  const io = req.app.get('io');
  if (!io) return;
  io.to(`gig:${gigId}`).emit(`gig:${eventType}`, {
    gigId,
    eventType,
    timestamp: Date.now(),
  });
}

/**
 * Offer statuses:
 * - pending
 * - accepted
 * - declined
 * - withdrawn (optional, not wired in MVP)
 */

/**
 * POST /api/gigs/:gigId/offers
 * Body: { price, message, availability?, notes? }
 * Creates a pending offer from the current user for a gig (if gig open).
 */
router.post('/gigs/:gigId/offers', verifyToken, async (req, res) => {
  const { gigId } = req.params;
  const userId = req.user.id;

  const { price, message, availability = null, notes = null } = req.body || {};

  if (price === undefined || price === null || Number.isNaN(Number(price))) {
    return res.status(400).json({ error: 'price is required and must be a number' });
  }
  if (!message || String(message).trim().length < 10) {
    return res.status(400).json({ error: 'message is required (min 10 chars)' });
  }

  try {
    // Fetch gig to validate
    const { data: gig, error: gigErr } = await supabase
      .from('gigs')
      .select('id, user_id, status')
      .eq('id', gigId)
      .single();

    if (gigErr) throw gigErr;
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    if (gig.status !== 'open') {
      return res.status(409).json({ error: 'Gig is not accepting offers' });
    }

    if (gig.user_id === userId) {
      return res.status(400).json({ error: 'You cannot make an offer on your own gig' });
    }

    // Prevent duplicate pending offers per user per gig (simple MVP rule)
    const { data: existing } = await supabase
      .from('offers')
      .select('id, status')
      .eq('gig_id', gigId)
      .eq('user_id', userId)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'You already have an active offer for this gig' });
    }

    const offerPayload = {
      gig_id: gigId,
      user_id: userId,
      price: Number(price),
      message: String(message).trim(),
      availability,
      notes,
      status: 'pending',
    };

    const { data: offer, error: createErr } = await supabase
      .from('offers')
      .insert(offerPayload)
      .select('*')
      .single();

    if (createErr) throw createErr;

    emitGigUpdate(req, gigId, 'bid-update');
    return res.json({ offer });
  } catch (err) {
    logger.error('Create offer failed', { err, gigId, userId });
    return res.status(500).json({ error: 'Failed to create offer' });
  }
});

/**
 * GET /api/gigs/:gigId/offers
 * Owner-only: list offers for the gig
 */
router.get('/gigs/:gigId/offers', verifyToken, async (req, res) => {
  const { gigId } = req.params;
  const userId = req.user.id;

  try {
    const { data: gig, error: gigErr } = await supabase
      .from('gigs')
      .select('id, user_id, status')
      .eq('id', gigId)
      .single();

    if (gigErr) throw gigErr;
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    if (gig.user_id !== userId) {
      return res.status(403).json({ error: 'Only the gig owner can view offers' });
    }

    const { data: offers, error: offersErr } = await supabase
      .from('offers')
      .select('id, gig_id, user_id, price, message, availability, notes, status, created_at')
      .eq('gig_id', gigId)
      .order('created_at', { ascending: false });

    if (offersErr) throw offersErr;

    return res.json({ gig, offers: offers || [] });
  } catch (err) {
    logger.error('List offers failed', { err, gigId, userId });
    return res.status(500).json({ error: 'Failed to list offers' });
  }
});

/**
 * POST /api/gigs/:gigId/offers/:offerId/accept
 * Owner-only: accept one offer, auto-decline others, set gig assigned.
 */
router.post('/gigs/:gigId/offers/:offerId/accept', verifyToken, async (req, res) => {
  const { gigId, offerId } = req.params;
  const userId = req.user.id;

  try {
    const { data: gig, error: gigErr } = await supabase
      .from('gigs')
      .select('id, user_id, status')
      .eq('id', gigId)
      .single();

    if (gigErr) throw gigErr;
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    if (gig.user_id !== userId) {
      return res.status(403).json({ error: 'Only the gig owner can accept offers' });
    }

    if (gig.status !== 'open' && gig.status !== 'assigned') {
      return res.status(409).json({ error: 'Gig is not in a valid state to accept offers' });
    }

    // Ensure offer belongs to this gig
    const { data: targetOffer, error: offerErr } = await supabase
      .from('offers')
      .select('id, gig_id, status')
      .eq('id', offerId)
      .single();

    if (offerErr) throw offerErr;
    if (!targetOffer || targetOffer.gig_id !== gigId) {
      return res.status(404).json({ error: 'Offer not found for this gig' });
    }

    if (targetOffer.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending offers can be accepted' });
    }

    // 1) Mark gig assigned
    const { error: gigUpdateErr } = await supabase
      .from('gigs')
      .update({ status: 'assigned' })
      .eq('id', gigId)
      .eq('user_id', userId);

    if (gigUpdateErr) throw gigUpdateErr;

    // 2) Accept target offer
    const { data: accepted, error: acceptErr } = await supabase
      .from('offers')
      .update({ status: 'accepted' })
      .eq('id', offerId)
      .eq('gig_id', gigId)
      .select('*')
      .single();

    if (acceptErr) throw acceptErr;

    // 3) Decline others still pending
    const { error: declineOthersErr } = await supabase
      .from('offers')
      .update({ status: 'declined' })
      .eq('gig_id', gigId)
      .neq('id', offerId)
      .eq('status', 'pending');

    if (declineOthersErr) throw declineOthersErr;

    emitGigUpdate(req, gigId, 'bid-accepted');
    emitGigUpdate(req, gigId, 'status-change');
    return res.json({ accepted });
  } catch (err) {
    logger.error('Accept offer failed', { err, gigId, offerId, userId });
    return res.status(500).json({ error: 'Failed to accept offer' });
  }
});

/**
 * POST /api/gigs/:gigId/offers/:offerId/decline
 * Owner-only: decline one pending offer
 */
router.post('/gigs/:gigId/offers/:offerId/decline', verifyToken, async (req, res) => {
  const { gigId, offerId } = req.params;
  const userId = req.user.id;

  try {
    const { data: gig, error: gigErr } = await supabase
      .from('gigs')
      .select('id, user_id, status')
      .eq('id', gigId)
      .single();

    if (gigErr) throw gigErr;
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    if (gig.user_id !== userId) {
      return res.status(403).json({ error: 'Only the gig owner can decline offers' });
    }

    const { data: declined, error: declineErr } = await supabase
      .from('offers')
      .update({ status: 'declined' })
      .eq('id', offerId)
      .eq('gig_id', gigId)
      .eq('status', 'pending')
      .select('*')
      .single();

    if (declineErr) throw declineErr;

    emitGigUpdate(req, gigId, 'bid-update');
    return res.json({ declined });
  } catch (err) {
    logger.error('Decline offer failed', { err, gigId, offerId, userId });
    return res.status(500).json({ error: 'Failed to decline offer' });
  }
});

module.exports = router;
