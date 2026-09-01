// ============================================================
// TRANSACTION REVIEW ROUTES
// Create and read reviews tied to completed marketplace
// transactions (listing sales, trades, gigs).
// Writes to TransactionReview table (separate from gig Review).
// ============================================================

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const reputationService = require('../services/marketplace/reputationService');

// ============ VALIDATION ============

const createTransactionReviewSchema = Joi.object({
  reviewed_id: Joi.string().uuid().required(),
  context: Joi.string().valid('listing_sale', 'listing_trade', 'gig').required(),
  listing_id: Joi.string().uuid().allow(null),
  offer_id: Joi.string().uuid().allow(null),
  trade_id: Joi.string().uuid().allow(null),
  gig_id: Joi.string().uuid().allow(null),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(2000).allow('', null),
  communication_rating: Joi.number().integer().min(1).max(5).allow(null),
  accuracy_rating: Joi.number().integer().min(1).max(5).allow(null),
  punctuality_rating: Joi.number().integer().min(1).max(5).allow(null),
});

// ============ ROUTES ============

/**
 * POST /api/transaction-reviews
 * Create a transaction review for a completed marketplace transaction.
 * Rules:
 *   - Reviewer cannot review themselves
 *   - For listing_sale: offer must be completed, reviewer must be buyer or seller
 *   - One review per reviewer + offer/gig combination
 */
router.post('/', verifyToken, validate(createTransactionReviewSchema), async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const {
      reviewed_id, context, listing_id, offer_id, trade_id, gig_id,
      rating, comment, communication_rating, accuracy_rating, punctuality_rating,
    } = req.body;

    // Cannot review yourself
    if (reviewerId === reviewed_id) {
      return res.status(400).json({ error: 'You cannot review yourself' });
    }

    let is_buyer = true;

    // For listing_sale context: verify the offer exists and is completed
    if (context === 'listing_sale') {
      if (!offer_id) {
        return res.status(400).json({ error: 'offer_id is required for listing_sale reviews' });
      }

      const { data: offer, error: offerErr } = await supabaseAdmin
        .from('ListingOffer')
        .select('id, buyer_id, seller_id, status')
        .eq('id', offer_id)
        .single();

      if (offerErr || !offer) {
        return res.status(404).json({ error: 'Offer not found' });
      }

      if (offer.status !== 'completed') {
        return res.status(400).json({ error: 'Reviews can only be left on completed transactions' });
      }

      // Reviewer must be buyer or seller on the offer
      const isBuyer = offer.buyer_id === reviewerId;
      const isSeller = offer.seller_id === reviewerId;

      if (!isBuyer && !isSeller) {
        return res.status(403).json({ error: 'You are not a party to this transaction' });
      }

      is_buyer = isBuyer;
    }

    // Prevent duplicate reviews: check for existing review with same reviewer + offer/gig.
    // Only check if we have a concrete transaction reference to filter on.
    // The DB unique index (reviewer_id + COALESCE(offer_id) + COALESCE(gig_id))
    // is the ultimate guard against duplicates.
    if (offer_id || gig_id) {
      const dupeQuery = supabaseAdmin
        .from('TransactionReview')
        .select('id')
        .eq('reviewer_id', reviewerId);

      if (offer_id) {
        dupeQuery.eq('offer_id', offer_id);
      } else {
        dupeQuery.eq('gig_id', gig_id);
      }

      const { data: existing } = await dupeQuery.single();

      if (existing) {
        return res.status(409).json({ error: 'You have already reviewed this transaction' });
      }
    }

    // Insert the review
    const insertData = {
      reviewer_id: reviewerId,
      reviewed_id,
      context,
      listing_id: listing_id || null,
      offer_id: offer_id || null,
      gig_id: gig_id || null,
      rating,
      comment: comment || null,
      communication_rating: communication_rating || null,
      accuracy_rating: accuracy_rating || null,
      punctuality_rating: punctuality_rating || null,
      is_buyer,
    };

    const { data: review, error: insertErr } = await supabaseAdmin
      .from('TransactionReview')
      .insert(insertData)
      .select()
      .single();

    if (insertErr) {
      logger.error('TransactionReview insert error', { error: insertErr.message });
      return res.status(500).json({ error: 'Failed to create review' });
    }

    // Fire-and-forget: recompute reputation for the reviewed user
    reputationService.computeReputation(reviewed_id).catch(err => {
      logger.error('[transactionReviews] Reputation recompute failed', {
        reviewed_id,
        error: err.message,
      });
    });

    logger.info('TransactionReview created', {
      reviewId: review.id,
      reviewerId,
      reviewed_id,
      context,
      rating,
    });

    res.status(201).json({ review });
  } catch (err) {
    logger.error('TransactionReview creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create review' });
  }
});


/**
 * GET /api/transaction-reviews/user/:userId
 * Get transaction reviews for a user (public).
 * Returns reviews, average_rating, and total count.
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: reviews, error } = await supabaseAdmin
      .from('TransactionReview')
      .select(`
        id,
        reviewer_id,
        reviewed_id,
        context,
        listing_id,
        offer_id,
        gig_id,
        rating,
        comment,
        communication_rating,
        accuracy_rating,
        punctuality_rating,
        is_buyer,
        created_at
      `)
      .eq('reviewed_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('TransactionReview fetch error', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch reviews' });
    }

    // Hydrate reviewer info
    const reviewerIds = [...new Set((reviews || []).map(r => r.reviewer_id))];
    let reviewerMap = {};
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabaseAdmin
        .from('User')
        .select('id, first_name, last_name, username, profile_picture_url')
        .in('id', reviewerIds);
      (reviewers || []).forEach(u => { reviewerMap[u.id] = u; });
    }

    const enriched = (reviews || []).map(r => ({
      ...r,
      reviewer: reviewerMap[r.reviewer_id] || null,
    }));

    const totalRating = enriched.reduce((sum, r) => sum + r.rating, 0);
    const average_rating = enriched.length > 0
      ? Math.round((totalRating / enriched.length) * 100) / 100
      : 0;

    res.json({
      reviews: enriched,
      average_rating,
      total: enriched.length,
    });
  } catch (err) {
    logger.error('TransactionReview fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});


module.exports = router;
