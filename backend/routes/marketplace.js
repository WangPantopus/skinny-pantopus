// ============================================================
// MARKETPLACE ROUTES — Price Intelligence & Reputation
// ============================================================

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const optionalAuth = require('../middleware/optionalAuth');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const supabaseAdmin = require('../config/supabaseAdmin');
const priceIntelligenceService = require('../services/marketplace/priceIntelligenceService');
const reputationService = require('../services/marketplace/reputationService');
const savedSearchService = require('../services/marketplace/savedSearchService');

/**
 * GET /api/marketplace/price-suggestion
 * Returns price intelligence for a given category.
 * Query params: category (required), lat, lng, title, condition
 */
router.get('/price-suggestion', optionalAuth, async (req, res) => {
  try {
    const { category, lat, lng, title, condition } = req.query;

    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }

    const suggestion = await priceIntelligenceService.getPriceSuggestion({
      category,
      latitude: lat ? parseFloat(lat) : undefined,
      longitude: lng ? parseFloat(lng) : undefined,
      title,
      condition,
    });

    res.json({ suggestion });
  } catch (err) {
    logger.error('Price suggestion error', { error: err.message });
    res.status(500).json({ error: 'Failed to get price suggestion' });
  }
});

/**
 * GET /api/marketplace/reputation/:userId
 * Returns the cached reputation score for a user (public).
 */
router.get('/reputation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const reputation = await reputationService.getReputation(userId);
    res.json({ reputation });
  } catch (err) {
    logger.error('Reputation fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to get reputation' });
  }
});

// ============ SELLER ANALYTICS ============

/**
 * GET /api/marketplace/seller-analytics
 * Returns comprehensive seller analytics dashboard data.
 */
router.get('/seller-analytics', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    // 1. Active listings with per-listing stats
    const { data: activeListings, error: listingsErr } = await supabaseAdmin
      .from('Listing')
      .select('id, title, view_count, save_count, message_count, active_offer_count, status, created_at')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (listingsErr) {
      logger.error('seller-analytics.listings_error', { error: listingsErr.message });
      return res.status(500).json({ error: 'Failed to fetch listings' });
    }

    const listings = activeListings || [];
    const now = Date.now();

    // 2. Aggregate 30-day stats from all user listings (not just active)
    const { data: allListings } = await supabaseAdmin
      .from('Listing')
      .select('view_count, save_count, message_count')
      .eq('user_id', userId);

    const totalViews30d = (allListings || []).reduce((sum, l) => sum + (l.view_count || 0), 0);
    const totalSaves30d = (allListings || []).reduce((sum, l) => sum + (l.save_count || 0), 0);

    // 3. 30-day offers received
    const { count: totalOffers30d } = await supabaseAdmin
      .from('ListingOffer')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .gte('created_at', thirtyDaysAgo);

    // 4. 30-day completed sales
    const { data: completedOffers } = await supabaseAdmin
      .from('ListingOffer')
      .select('amount, completed_at, listing_id')
      .eq('seller_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', thirtyDaysAgo);

    const completed = completedOffers || [];
    const totalSales30d = completed.length;
    const totalRevenue30d = completed.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);

    // 5. Conversion rate: completed / views
    const conversionRate = totalViews30d > 0
      ? Math.round((totalSales30d / totalViews30d) * 10000) / 10000
      : 0;

    // 6. Average time to sell (hours)
    let avgTimeToSellHours = null;
    if (completed.length > 0) {
      const listingIds = [...new Set(completed.map(o => o.listing_id))];
      const { data: soldListings } = await supabaseAdmin
        .from('Listing')
        .select('id, created_at')
        .in('id', listingIds);

      const createdMap = new Map((soldListings || []).map(l => [l.id, new Date(l.created_at).getTime()]));

      const sellTimes = completed
        .map(o => {
          const createdAt = createdMap.get(o.listing_id);
          if (!createdAt || !o.completed_at) return null;
          return (new Date(o.completed_at).getTime() - createdAt) / 3600000;
        })
        .filter(t => t != null);

      if (sellTimes.length > 0) {
        avgTimeToSellHours = Math.round(sellTimes.reduce((a, b) => a + b, 0) / sellTimes.length * 10) / 10;
      }
    }

    // 7. Per-listing breakdown
    const perListing = listings.map(l => ({
      id: l.id,
      title: l.title,
      views: l.view_count || 0,
      saves: l.save_count || 0,
      offers: l.active_offer_count || 0,
      status: l.status,
      days_listed: Math.floor((now - new Date(l.created_at).getTime()) / 86400000),
    }));

    // 8. Reputation
    const reputation = await reputationService.getReputation(userId);

    res.json({
      overview: {
        total_active_listings: listings.length,
        total_views_30d: totalViews30d,
        total_saves_30d: totalSaves30d,
        total_offers_30d: totalOffers30d || 0,
        total_sales_30d: totalSales30d,
        total_revenue_30d: totalRevenue30d,
        conversion_rate: conversionRate,
        avg_time_to_sell_hours: avgTimeToSellHours,
      },
      listings: perListing,
      reputation,
    });
  } catch (err) {
    logger.error('Seller analytics error', { error: err.message });
    res.status(500).json({ error: 'Failed to get seller analytics' });
  }
});

// ============ SAVED SEARCHES ============

const createSavedSearchSchema = Joi.object({
  query: Joi.string().max(200).allow('', null),
  filters: Joi.object().required(),
  label: Joi.string().max(100).allow('', null),
});

/**
 * POST /api/marketplace/saved-searches
 * Create a saved search for the authenticated user.
 */
router.post('/saved-searches', verifyToken, validate(createSavedSearchSchema), async (req, res) => {
  try {
    const { query, filters, label } = req.body;
    const { search } = await savedSearchService.createSavedSearch({
      userId: req.user.id,
      query,
      filters,
      label,
    });
    res.status(201).json({ search });
  } catch (err) {
    logger.error('Create saved search error', { error: err.message });
    res.status(500).json({ error: 'Failed to create saved search' });
  }
});

/**
 * GET /api/marketplace/saved-searches
 * Get all saved searches for the authenticated user.
 */
router.get('/saved-searches', verifyToken, async (req, res) => {
  try {
    const { searches } = await savedSearchService.getSavedSearches(req.user.id);
    res.json({ searches });
  } catch (err) {
    logger.error('Get saved searches error', { error: err.message });
    res.status(500).json({ error: 'Failed to get saved searches' });
  }
});

/**
 * DELETE /api/marketplace/saved-searches/:id
 * Delete a saved search for the authenticated user.
 */
router.delete('/saved-searches/:id', verifyToken, async (req, res) => {
  try {
    await savedSearchService.deleteSavedSearch({
      searchId: req.params.id,
      userId: req.user.id,
    });
    res.json({ deleted: true });
  } catch (err) {
    logger.error('Delete saved search error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete saved search' });
  }
});

module.exports = router;
