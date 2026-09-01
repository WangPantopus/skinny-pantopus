// ============================================================
// REVIEW ROUTES
// Create and read reviews tied to completed gigs
// ============================================================

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');

// ============ VALIDATION ============

const createReviewSchema = Joi.object({
  gig_id: Joi.string().uuid().required(),
  reviewee_id: Joi.string().uuid().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(2000).allow('', null),
});

// ============ ROUTES ============

/**
 * POST /api/reviews
 * Leave a review for someone after a completed gig.
 * Rules:
 *   - The gig must be in 'completed' status
 *   - Reviewer must be gig owner OR accepted worker
 *   - Reviewer cannot review themselves
 *   - Only one review per gig per reviewer
 */
router.post('/', verifyToken, validate(createReviewSchema), async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const { gig_id, reviewee_id, rating, comment } = req.body;

    // Can't review yourself
    if (reviewerId === reviewee_id) {
      return res.status(400).json({ error: 'You cannot review yourself' });
    }

    // Fetch the gig
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, status')
      .eq('id', gig_id)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // Gig must be completed
    if (gig.status !== 'completed') {
      return res.status(400).json({ error: 'Reviews can only be left on completed gigs' });
    }

    // Reviewer must be owner or worker
    const isOwner = gig.user_id === reviewerId;
    const isWorker = gig.accepted_by === reviewerId;

    if (!isOwner && !isWorker) {
      return res.status(403).json({ error: 'Only the gig owner or worker can leave a review' });
    }

    // Reviewee must be the other party
    if (isOwner && reviewee_id !== gig.accepted_by) {
      return res.status(400).json({ error: 'As the gig owner you can only review the worker' });
    }
    if (isWorker && reviewee_id !== gig.user_id) {
      return res.status(400).json({ error: 'As the worker you can only review the gig owner' });
    }

    // Check for existing review
    const { data: existing } = await supabaseAdmin
      .from('Review')
      .select('id')
      .eq('gig_id', gig_id)
      .eq('reviewer_id', reviewerId)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'You have already reviewed this gig' });
    }

    // Create the review
    const { data: review, error: insertErr } = await supabaseAdmin
      .from('Review')
      .insert({
        gig_id,
        reviewer_id: reviewerId,
        reviewee_id,
        rating,
        comment: comment || null,
      })
      .select()
      .single();

    if (insertErr) {
      logger.error('Review insert error', { error: insertErr.message });
      return res.status(500).json({ error: 'Failed to create review' });
    }

    // Send notification to reviewee (non-blocking).
    // Use the shared service so the row matches the current Notification schema
    // and the recipient gets the standard badge/socket/push updates.
    (async () => {
      try {
        const { data: reviewer } = await supabaseAdmin
          .from('User')
          .select('name, username, first_name')
          .eq('id', reviewerId)
          .maybeSingle();

        await notificationService.createNotification({
          userId: reviewee_id,
          type: 'review_received',
          title: 'New Review',
          body: `${reviewer?.name || reviewer?.first_name || reviewer?.username || 'Someone'} left you a ${rating}-star review`,
          link: `/gigs/${gig_id}`,
          metadata: { gig_id, review_id: review.id },
        });
      } catch (e) {
        logger.warn('Review notification failed', {
          error: e.message,
          reviewId: review.id,
          revieweeId: reviewee_id,
        });
      }
    })();

    logger.info('Review created', { reviewId: review.id, gigId: gig_id, reviewerId });

    res.status(201).json({ review });
  } catch (err) {
    logger.error('Review creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create review' });
  }
});


/**
 * GET /api/reviews/user/:userId
 * Get all reviews received by a user (for their profile page)
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const resolveReceivedAs = (review, targetUserId) => {
      if (!review) return 'unknown';
      const gig = review.gig;
      if (!gig) return 'unknown';
      if (String(gig.accepted_by || '') === String(targetUserId)) return 'worker';
      if (String(gig.user_id || '') === String(targetUserId)) return 'poster';
      return 'unknown';
    };

    const { data: reviews, error, count } = await supabaseAdmin
      .from('Review')
      .select(`
        id,
        gig_id,
        reviewer_id,
        reviewee_id,
        rating,
        comment,
        media_urls,
        created_at,
        reviewer:User!Review_reviewer_id_fkey(id, username, name, first_name, last_name, profile_picture_url),
        gig:Gig!Review_gig_id_fkey(id, user_id, accepted_by, title)
      `, { count: 'exact' })
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Review fetch error', { error: error.message, userId });

      // Fallback: simpler query without join
      const { data: fallbackReviews, error: fallbackErr } = await supabaseAdmin
        .from('Review')
        .select('*')
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (fallbackErr) {
        return res.status(500).json({ error: 'Failed to fetch reviews' });
      }

      // Hydrate reviewer info
      const reviewerIds = [...new Set(fallbackReviews.map(r => r.reviewer_id))];
      const { data: reviewers } = await supabaseAdmin
        .from('User')
        .select('id, username, name, first_name, last_name, profile_picture_url')
        .in('id', reviewerIds);

      // Hydrate gig role context (worker vs poster)
      const gigIds = [...new Set(fallbackReviews.map(r => r.gig_id).filter(Boolean))];
      let gigMap = {};
      if (gigIds.length > 0) {
        const { data: gigs } = await supabaseAdmin
          .from('Gig')
          .select('id, user_id, accepted_by, title')
          .in('id', gigIds);
        (gigs || []).forEach(g => { gigMap[g.id] = g; });
      }

      const reviewerMap = {};
      (reviewers || []).forEach(u => { reviewerMap[u.id] = u; });

      const enriched = fallbackReviews.map(r => ({
        ...r,
        gig: gigMap[r.gig_id] || null,
        reviewer: reviewerMap[r.reviewer_id] || null,
        reviewer_name: reviewerMap[r.reviewer_id]?.name ||
                       reviewerMap[r.reviewer_id]?.first_name ||
                       reviewerMap[r.reviewer_id]?.username || 'Anonymous',
        reviewer_avatar: reviewerMap[r.reviewer_id]?.profile_picture_url || null,
        reviewer_username: reviewerMap[r.reviewer_id]?.username || null,
        received_as: resolveReceivedAs({ ...r, gig: gigMap[r.gig_id] || null }, userId),
      }));

      const roleCounts = enriched.reduce((acc, r) => {
        if (r.received_as === 'worker') acc.worker += 1;
        else if (r.received_as === 'poster') acc.poster += 1;
        else acc.unknown += 1;
        return acc;
      }, { worker: 0, poster: 0, unknown: 0 });

      return res.json({
        reviews: enriched,
        total: enriched.length,
        average_rating: enriched.length > 0
          ? Math.round((enriched.reduce((sum, r) => sum + (r.rating || 0), 0) / enriched.length) * 100) / 100
          : 0,
        counts: roleCounts,
        page,
        limit
      });
    }

    // Enrich with reviewer_name
    const enriched = (reviews || []).map(r => ({
      ...r,
      reviewer_name: r.reviewer?.name ||
                     r.reviewer?.first_name ||
                     r.reviewer?.username || 'Anonymous',
      reviewer_avatar: r.reviewer?.profile_picture_url || null,
      reviewer_username: r.reviewer?.username || null,
      received_as: resolveReceivedAs(r, userId),
    }));

    // Compute average
    const totalRating = enriched.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = enriched.length > 0 ? (totalRating / enriched.length) : 0;
    const roleCounts = enriched.reduce((acc, r) => {
      if (r.received_as === 'worker') acc.worker += 1;
      else if (r.received_as === 'poster') acc.poster += 1;
      else acc.unknown += 1;
      return acc;
    }, { worker: 0, poster: 0, unknown: 0 });

    res.json({
      reviews: enriched,
      total: count || enriched.length,
      average_rating: Math.round(avgRating * 100) / 100,
      counts: roleCounts,
      page,
      limit,
    });
  } catch (err) {
    logger.error('Reviews fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});


/**
 * GET /api/reviews/gig/:gigId
 * Get all reviews for a specific gig
 */
router.get('/gig/:gigId', async (req, res) => {
  try {
    const { gigId } = req.params;

    const { data: reviews, error } = await supabaseAdmin
      .from('Review')
      .select('*')
      .eq('gig_id', gigId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch reviews' });
    }

    // Hydrate reviewer info
    const reviewerIds = [...new Set(reviews.map(r => r.reviewer_id))];
    let reviewerMap = {};
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabaseAdmin
        .from('User')
        .select('id, username, name, first_name, profile_picture_url')
        .in('id', reviewerIds);
      (reviewers || []).forEach(u => { reviewerMap[u.id] = u; });
    }

    const enriched = reviews.map(r => ({
      ...r,
      reviewer_name: reviewerMap[r.reviewer_id]?.name || reviewerMap[r.reviewer_id]?.username || 'Anonymous',
      reviewer_avatar: reviewerMap[r.reviewer_id]?.profile_picture_url || null,
    }));

    res.json({ reviews: enriched });
  } catch (err) {
    logger.error('Gig reviews fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});


/**
 * GET /api/reviews/my-pending
 * Get gigs where the current user can leave a review but hasn't yet
 */
router.get('/my-pending', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find completed gigs where user is owner or worker
    const { data: gigsAsOwner } = await supabaseAdmin
      .from('Gig')
      .select('id, title, accepted_by, status')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('accepted_by', 'is', null);

    const { data: gigsAsWorker } = await supabaseAdmin
      .from('Gig')
      .select('id, title, user_id, status')
      .eq('accepted_by', userId)
      .eq('status', 'completed');

    // Check which ones already have reviews from this user
    const allGigIds = [
      ...(gigsAsOwner || []).map(g => g.id),
      ...(gigsAsWorker || []).map(g => g.id),
    ];

    if (allGigIds.length === 0) {
      return res.json({ pending: [] });
    }

    const { data: existingReviews } = await supabaseAdmin
      .from('Review')
      .select('gig_id')
      .eq('reviewer_id', userId)
      .in('gig_id', allGigIds);

    const reviewedGigIds = new Set((existingReviews || []).map(r => r.gig_id));

    const pending = [];

    for (const gig of (gigsAsOwner || [])) {
      if (!reviewedGigIds.has(gig.id)) {
        pending.push({
          gig_id: gig.id,
          gig_title: gig.title,
          reviewee_id: gig.accepted_by,
          role: 'owner',
        });
      }
    }

    for (const gig of (gigsAsWorker || [])) {
      if (!reviewedGigIds.has(gig.id)) {
        pending.push({
          gig_id: gig.id,
          gig_title: gig.title,
          reviewee_id: gig.user_id,
          role: 'worker',
        });
      }
    }

    // Hydrate reviewee names
    const revieweeIds = [...new Set(pending.map(p => p.reviewee_id))];
    let nameMap = {};
    if (revieweeIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('User')
        .select('id, username, name, first_name, profile_picture_url')
        .in('id', revieweeIds);
      (users || []).forEach(u => { nameMap[u.id] = u; });
    }

    const enriched = pending.map(p => ({
      ...p,
      reviewee_name: nameMap[p.reviewee_id]?.name || nameMap[p.reviewee_id]?.username || 'Unknown',
      reviewee_avatar: nameMap[p.reviewee_id]?.profile_picture_url || null,
    }));

    res.json({ pending: enriched });
  } catch (err) {
    logger.error('Pending reviews fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});


module.exports = router;
