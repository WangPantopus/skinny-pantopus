// ============================================================
// LISTING TRADE ROUTES
// Trade / swap proposal system for marketplace listings
// ============================================================

const express = require('express');
const router = express.Router({ mergeParams: true });
const Joi = require('joi');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const tradeService = require('../services/marketplace/tradeService');

// ============ VALIDATION ============

const proposeTradeSchema = Joi.object({
  offeredListingIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .required(),
  message: Joi.string().max(500).allow('', null),
  cashSupplement: Joi.number().min(0).allow(null),
});

const respondTradeSchema = Joi.object({
  action: Joi.string().valid('accept', 'decline').required(),
});

// ============ ROUTES ============

/**
 * POST /api/listings/:listingId/trades
 * Propose a trade on a listing.
 */
router.post('/:listingId/trades', verifyToken, validate(proposeTradeSchema), async (req, res) => {
  try {
    const { trade } = await tradeService.proposeTrade({
      targetListingId: req.params.listingId,
      proposerId: req.user.id,
      offeredListingIds: req.body.offeredListingIds,
      message: req.body.message,
      cashSupplement: req.body.cashSupplement,
    });
    return res.status(201).json({ trade });
  } catch (err) {
    logger.error('Propose trade failed', { error: err.message, listingId: req.params.listingId });
    return res.status(err.status || 500).json({ error: err.message || 'Failed to propose trade' });
  }
});

/**
 * GET /api/listings/:listingId/trades
 * Get trades for a listing.
 * Target owner sees all trades. Proposers see only their own.
 */
router.get('/:listingId/trades', verifyToken, async (req, res) => {
  const { listingId } = req.params;
  const userId = req.user.id;

  try {
    // Determine if caller is the target listing owner
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('Listing')
      .select('user_id')
      .eq('id', listingId)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const isOwner = listing.user_id === userId;

    let query = supabaseAdmin
      .from('ListingTrade')
      .select('*')
      .eq('target_listing_id', listingId)
      .order('created_at', { ascending: false });

    if (!isOwner) {
      query = query.eq('proposer_id', userId);
    }

    const { data: trades, error: fetchErr } = await query;

    if (fetchErr) {
      logger.error('Failed to fetch listing trades', { error: fetchErr.message, listingId });
      return res.status(500).json({ error: 'Failed to fetch trades' });
    }

    // Enrich trades with offered listing details
    const enrichedTrades = await enrichTradesWithListings(trades || []);

    return res.json({ trades: enrichedTrades });
  } catch (err) {
    logger.error('Get listing trades failed', { error: err.message, listingId });
    return res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

/**
 * POST /api/trades/:tradeId/respond
 * Accept or decline a trade proposal.
 */
router.post('/trades/:tradeId/respond', verifyToken, validate(respondTradeSchema), async (req, res) => {
  try {
    const { trade } = await tradeService.respondToTrade({
      tradeId: req.params.tradeId,
      targetUserId: req.user.id,
      action: req.body.action,
    });
    return res.json({ trade });
  } catch (err) {
    logger.error('Respond to trade failed', { error: err.message, tradeId: req.params.tradeId });
    return res.status(err.status || 500).json({ error: err.message || 'Failed to respond to trade' });
  }
});

/**
 * POST /api/trades/:tradeId/complete
 * Mark a trade as completed.
 */
router.post('/trades/:tradeId/complete', verifyToken, async (req, res) => {
  try {
    const { trade } = await tradeService.completeTrade({
      tradeId: req.params.tradeId,
      userId: req.user.id,
    });
    return res.json({ trade });
  } catch (err) {
    logger.error('Complete trade failed', { error: err.message, tradeId: req.params.tradeId });
    return res.status(err.status || 500).json({ error: err.message || 'Failed to complete trade' });
  }
});

/**
 * POST /api/trades/:tradeId/cancel
 * Cancel a proposed trade (proposer only).
 */
router.post('/trades/:tradeId/cancel', verifyToken, async (req, res) => {
  try {
    const { trade } = await tradeService.cancelTrade({
      tradeId: req.params.tradeId,
      userId: req.user.id,
    });
    return res.json({ trade });
  } catch (err) {
    logger.error('Cancel trade failed', { error: err.message, tradeId: req.params.tradeId });
    return res.status(err.status || 500).json({ error: err.message || 'Failed to cancel trade' });
  }
});

// ============ HELPERS ============

/**
 * Enrich trades with offered listing details (title, price, first media_url).
 */
async function enrichTradesWithListings(trades) {
  if (!trades.length) return trades;

  // Collect all unique offered listing IDs
  const allOfferedIds = [...new Set(trades.flatMap(t => t.offered_listing_ids || []))];
  if (!allOfferedIds.length) return trades;

  const { data: offeredListings, error } = await supabaseAdmin
    .from('Listing')
    .select('id, title, price, media_urls')
    .in('id', allOfferedIds);

  if (error || !offeredListings) return trades;

  const listingMap = new Map(offeredListings.map(l => [l.id, {
    id: l.id,
    title: l.title,
    price: l.price,
    media_url: l.media_urls && l.media_urls.length > 0 ? l.media_urls[0] : null,
  }]));

  return trades.map(trade => ({
    ...trade,
    offered_listings: (trade.offered_listing_ids || []).map(id => listingMap.get(id) || { id }),
  }));
}

module.exports = router;
