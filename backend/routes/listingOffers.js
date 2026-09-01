// ============================================================
// LISTING OFFER ROUTES
// Structured offer/counter-offer system for marketplace listings
// ============================================================

const express = require('express');
const router = express.Router({ mergeParams: true });
const Joi = require('joi');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const listingOfferService = require('../services/marketplace/listingOfferService');

// ============ VALIDATION ============

const createOfferSchema = Joi.object({
  amount: Joi.number().min(0).allow(null),
  message: Joi.string().max(500).allow('', null),
});

const counterOfferSchema = Joi.object({
  counterAmount: Joi.number().min(0.01).required(),
  counterMessage: Joi.string().max(500).allow('', null),
});

// ============ MIDDLEWARE ============

/**
 * Verify the offerId in the URL actually belongs to the listingId in the URL.
 * Prevents operating on offers via the wrong listing resource path.
 */
async function verifyOfferBelongsToListing(req, res, next) {
  const { listingId, offerId } = req.params;
  if (!listingId || !offerId) return next();

  const { data: offer } = await supabaseAdmin
    .from('ListingOffer')
    .select('listing_id')
    .eq('id', offerId)
    .single();

  if (!offer) {
    return res.status(404).json({ error: 'Offer not found' });
  }
  if (offer.listing_id !== listingId) {
    return res.status(400).json({ error: 'Offer does not belong to this listing' });
  }
  next();
}

// ============ ROUTES ============

/**
 * POST /api/listings/:listingId/offers
 * Create an offer on a listing.
 */
router.post('/:listingId/offers', verifyToken, validate(createOfferSchema), async (req, res) => {
  try {
    const { offer } = await listingOfferService.createOffer({
      listingId: req.params.listingId,
      buyerId: req.user.id,
      amount: req.body.amount,
      message: req.body.message,
    });
    return res.status(201).json({ offer });
  } catch (err) {
    logger.error('Create listing offer failed', { error: err.message, listingId: req.params.listingId });
    return res.status(err.status || 500).json({ error: err.message || 'Failed to create offer' });
  }
});

/**
 * GET /api/listings/:listingId/offers
 * Get offers for a listing.
 * Seller sees all offers. Buyer sees only their own.
 */
router.get('/:listingId/offers', verifyToken, async (req, res) => {
  const { listingId } = req.params;
  const userId = req.user.id;

  try {
    // Determine if caller is the seller
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('Listing')
      .select('user_id')
      .eq('id', listingId)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const isSeller = listing.user_id === userId;

    let query = supabaseAdmin
      .from('ListingOffer')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });

    if (!isSeller) {
      query = query.eq('buyer_id', userId);
    }

    const { data: offers, error: fetchErr } = await query;

    if (fetchErr) {
      logger.error('Failed to fetch listing offers', { error: fetchErr.message, listingId });
      return res.status(500).json({ error: 'Failed to fetch offers' });
    }

    // Enrich offers with user profile data (FK points to auth.users, not User table)
    const enriched = await Promise.all(
      (offers || []).map(async (offer) => {
        const userIds = [offer.buyer_id, offer.seller_id].filter(Boolean);
        const { data: users } = await supabaseAdmin
          .from('User')
          .select('id, first_name, last_name, username, profile_picture_url')
          .in('id', userIds);

        const userMap = {};
        (users || []).forEach((u) => { userMap[u.id] = u; });

        return {
          ...offer,
          buyer: userMap[offer.buyer_id] || null,
          seller: userMap[offer.seller_id] || null,
        };
      })
    );

    return res.json({ offers: enriched });
  } catch (err) {
    logger.error('Get listing offers failed', { error: err.message, listingId });
    return res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

/**
 * POST /api/listings/:listingId/offers/:offerId/counter
 * Seller counters an offer.
 */
router.post('/:listingId/offers/:offerId/counter', verifyToken, verifyOfferBelongsToListing, validate(counterOfferSchema), async (req, res) => {
  try {
    const { offer } = await listingOfferService.counterOffer({
      offerId: req.params.offerId,
      sellerId: req.user.id,
      counterAmount: req.body.counterAmount,
      counterMessage: req.body.counterMessage,
    });
    return res.json({ offer });
  } catch (err) {
    logger.error('Counter offer failed', { error: err.message, offerId: req.params.offerId });
    return res.status(err.status || 500).json({ error: err.message || 'Failed to counter offer' });
  }
});

/**
 * POST /api/listings/:listingId/offers/:offerId/accept
 * Seller accepts an offer.
 */
router.post('/:listingId/offers/:offerId/accept', verifyToken, verifyOfferBelongsToListing, async (req, res) => {
  try {
    const { offer } = await listingOfferService.acceptOffer({
      offerId: req.params.offerId,
      userId: req.user.id,
    });
    return res.json({ offer });
  } catch (err) {
    logger.error('Accept offer failed', { error: err.message, offerId: req.params.offerId });
    return res.status(err.status || 500).json({ error: err.message || 'Failed to accept offer' });
  }
});

/**
 * POST /api/listings/:listingId/offers/:offerId/decline
 * Seller declines an offer.
 */
router.post('/:listingId/offers/:offerId/decline', verifyToken, verifyOfferBelongsToListing, async (req, res) => {
  try {
    const { offer } = await listingOfferService.declineOffer({
      offerId: req.params.offerId,
      sellerId: req.user.id,
    });
    return res.json({ offer });
  } catch (err) {
    logger.error('Decline offer failed', { error: err.message, offerId: req.params.offerId });
    return res.status(err.status || 500).json({ error: err.message || 'Failed to decline offer' });
  }
});

/**
 * POST /api/listings/:listingId/offers/:offerId/withdraw
 * Buyer withdraws their offer.
 */
router.post('/:listingId/offers/:offerId/withdraw', verifyToken, verifyOfferBelongsToListing, async (req, res) => {
  try {
    const { offer } = await listingOfferService.withdrawOffer({
      offerId: req.params.offerId,
      buyerId: req.user.id,
    });
    return res.json({ offer });
  } catch (err) {
    logger.error('Withdraw offer failed', { error: err.message, offerId: req.params.offerId });
    return res.status(err.status || 500).json({ error: err.message || 'Failed to withdraw offer' });
  }
});

/**
 * POST /api/listings/:listingId/offers/:offerId/complete
 * Either party confirms the transaction is complete.
 */
router.post('/:listingId/offers/:offerId/complete', verifyToken, verifyOfferBelongsToListing, async (req, res) => {
  try {
    const { offer } = await listingOfferService.completeTransaction({
      offerId: req.params.offerId,
      completedBy: req.user.id,
    });
    return res.json({ offer });
  } catch (err) {
    logger.error('Complete transaction failed', { error: err.message, offerId: req.params.offerId });
    return res.status(err.status || 500).json({ error: err.message || 'Failed to complete transaction' });
  }
});

module.exports = router;
