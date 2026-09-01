/**
 * Offers V2 Routes — Scored & ranked offers for Gigs MVP
 *
 * Mounted at /api/v2 in app.js.
 * Path: GET /api/v2/gigs/:gigId/offers
 *
 * Old frontend keeps calling /api/gigs/:gigId/offers (unchanged).
 * New v2 frontend calls this endpoint for scored/ranked offers
 * with trust capsule data.
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const { scoreOffers } = require('../services/offerScoringService');
const { hasPermission } = require('../utils/businessPermissions');

async function getGigOwnerAccess(ownerUserId, actorUserId, permission = 'gigs.manage') {
  if (String(ownerUserId) === String(actorUserId)) {
    return { allowed: true, viaBusiness: false, ownerUserId };
  }

  const { data: owner } = await supabaseAdmin
    .from('User')
    .select('id, account_type')
    .eq('id', ownerUserId)
    .maybeSingle();

  if (!owner || owner.account_type !== 'business') {
    return { allowed: false, viaBusiness: false, ownerUserId };
  }

  let allowed = await hasPermission(ownerUserId, actorUserId, permission);
  if (!allowed && permission === 'gigs.manage') {
    allowed = await hasPermission(ownerUserId, actorUserId, 'gigs.post');
  }

  return { allowed, viaBusiness: allowed, ownerUserId };
}

// =====================================================================
//  GET /api/v2/gigs/:gigId/offers
// =====================================================================

router.get('/gigs/:gigId/offers', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    // 1. Fetch gig — only owner can view offers
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status, engagement_mode, exact_location')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig owner can view offers' });
    }

    await supabaseAdmin
      .from('GigBid')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('gig_id', gigId)
      .eq('status', 'pending')
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString());

    // 2. Fetch bids/offers for this gig
    const { data: offers, error: offersErr } = await supabaseAdmin
      .from('GigBid')
      .select('id, gig_id, user_id, bid_amount, message, proposed_time, status, created_at')
      .eq('gig_id', gigId)
      .order('created_at', { ascending: false });

    if (offersErr) {
      logger.error('Failed to fetch offers', { gigId, error: offersErr.message });
      return res.status(500).json({ error: 'Failed to fetch offers' });
    }

    if (!offers || offers.length === 0) {
      return res.json({ gig, offers: [] });
    }

    // 3. Fetch User data for each offer's user_id (batch query)
    const userIds = [...new Set(offers.map((o) => o.user_id))];
    const { data: users, error: usersErr } = await supabaseAdmin
      .from('User')
      .select('id, username, name, first_name, last_name, profile_picture_url, verified_at, average_rating, review_count, gigs_completed, no_show_count, reliability_score')
      .in('id', userIds);

    if (usersErr) {
      logger.error('Failed to fetch offer users', { gigId, error: usersErr.message });
      return res.status(500).json({ error: 'Failed to fetch offer details' });
    }

    const userMap = {};
    (users || []).forEach((u) => {
      userMap[u.id] = u;
    });

    // 4. Enrich offers with user data for scoring
    const enrichedOffers = offers.map((offer) => {
      const user = userMap[offer.user_id] || {};
      return {
        ...offer,
        price: Number(offer.bid_amount ?? 0),
        amount: Number(offer.bid_amount ?? 0),
        availability: offer.proposed_time ?? null,
        notes: null,
        bidder: {
          id: user.id || offer.user_id,
          username: user.username ?? null,
          name: user.name ?? null,
          first_name: user.first_name ?? null,
          last_name: user.last_name ?? null,
          profile_picture_url: user.profile_picture_url ?? null,
          average_rating: user.average_rating ?? null,
          review_count: user.review_count ?? 0,
          reliability_score: user.reliability_score ?? 100,
          no_show_count: user.no_show_count ?? 0,
          gigs_completed: user.gigs_completed ?? 0,
          verified: Boolean(user.verified_at),
        },
        // Fields needed by scoreOffers
        reliability_score: user.reliability_score ?? 100,
        average_rating: user.average_rating ?? null,
        review_count: user.review_count ?? 0,
        gigs_completed: user.gigs_completed ?? 0,
        no_show_count: user.no_show_count ?? 0,
        // distance_miles left null for now (would need helper location)
        distance_miles: null,
        // avg_response_minutes not tracked yet — use default
        avg_response_minutes: null,
        // For trust capsule
        _user_verified: Boolean(user.verified_at),
        _user_first_name: user.first_name ?? null,
      };
    });

    // 5. Score and rank
    const scored = scoreOffers(enrichedOffers, gig);

    // 6. Build response — add trust_capsule to each offer
    const responseOffers = scored.map((o) => ({
      id: o.id,
      gig_id: o.gig_id,
      user_id: o.user_id,
      price: o.price,
      amount: o.amount,
      message: o.message,
      availability: o.availability,
      notes: o.notes,
      status: o.status === 'assigned' ? 'accepted' : o.status,
      created_at: o.created_at,
      bidder: o.bidder,
      match_score: o.match_score,
      match_rank: o.match_rank,
      is_recommended: o.is_recommended,
      trust_capsule: {
        verified: o._user_verified,
        first_name: o._user_first_name,
        average_rating: o.average_rating != null ? Number(o.average_rating) : null,
        rating: o.average_rating != null ? Number(o.average_rating) : null,
        review_count: o.review_count,
        reliability_score: Number(o.reliability_score),
        gigs_completed: o.gigs_completed,
        distance_miles: o.distance_miles,
      },
    }));

    return res.json({ gig, offers: responseOffers });
  } catch (err) {
    logger.error('V2 offers error', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

module.exports = router;
