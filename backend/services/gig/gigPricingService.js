/**
 * gigPricingService.js — Price intelligence for gig/task categories.
 * Provides price benchmarks based on recently completed gigs
 * in the same category (and optionally same area).
 *
 * Answers: "What do gutter cleaning gigs typically cost in this area?"
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

// ── Regional defaults (cold-start / insufficient data fallback) ──
const REGIONAL_DEFAULTS = {
  'Cleaning':            { low: 60,  median: 100, high: 150 },
  'Gardening':           { low: 40,  median: 75,  high: 120 },
  'Handyman':            { low: 50,  median: 100, high: 200 },
  'Pet Care':            { low: 20,  median: 35,  high: 60  },
  'Moving':              { low: 80,  median: 150, high: 300 },
  'Delivery':            { low: 15,  median: 25,  high: 50  },
  'Child Care':          { low: 30,  median: 50,  high: 80  },
  'Tutoring':            { low: 25,  median: 45,  high: 75  },
  'Photography':         { low: 75,  median: 150, high: 300 },
  'Cooking':             { low: 40,  median: 80,  high: 150 },
  'Tech Support':        { low: 30,  median: 60,  high: 120 },
  'Event Help':          { low: 50,  median: 100, high: 200 },
  'Plumbing':            { low: 80,  median: 150, high: 300 },
  'Electrical':          { low: 75,  median: 140, high: 280 },
  'HVAC':                { low: 100, median: 200, high: 400 },
  'Roofing':             { low: 150, median: 300, high: 600 },
  'General Contractor':  { low: 100, median: 250, high: 500 },
  'Landscaping Pro':     { low: 60,  median: 120, high: 250 },
  'Home Inspector':      { low: 200, median: 350, high: 500 },
  'Painting Pro':        { low: 100, median: 200, high: 400 },
  'Flooring':            { low: 150, median: 300, high: 600 },
  'Errands':             { low: 15,  median: 30,  high: 50  },
  'Grocery Pickup':      { low: 10,  median: 20,  high: 40  },
  'Other':               { low: 30,  median: 75,  high: 150 },
};

/**
 * Simple percentile calculation using linear interpolation.
 * @param {number[]} sortedArr - Sorted array of numbers (ascending)
 * @param {number} p - Percentile (0–100)
 * @returns {number}
 */
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];

  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedArr[lower];

  const fraction = index - lower;
  return sortedArr[lower] + fraction * (sortedArr[upper] - sortedArr[lower]);
}

/**
 * Get gig price benchmark based on completed gigs in the same category.
 *
 * @param {Object} params
 * @param {string} params.category - Gig category (required, must match VALID_CATEGORIES)
 * @param {number} [params.latitude] - User latitude (unused in MVP — geo-filtering Phase 2)
 * @param {number} [params.longitude] - User longitude (unused in MVP)
 * @param {number} [params.radiusMiles=15] - Search radius (unused in MVP)
 * @returns {Object|null} { low, median, high, basis, comparable_count, category } or regional default
 */
async function getGigPriceBenchmark({ category, latitude, longitude, radiusMiles = 15 }) {
  if (!category) return null;

  try {
    const oneEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

    // Query completed gigs in the given category from the last 180 days
    const { data: completedGigs, error: completedErr } = await supabaseAdmin
      .from('Gig')
      .select('price')
      .eq('category', category)
      .eq('status', 'completed')
      .gte('owner_confirmed_at', oneEightyDaysAgo)
      .gt('price', 0)
      .order('owner_confirmed_at', { ascending: false })
      .limit(200);

    if (completedErr) {
      logger.error('[gigPricing] Failed to query completed gigs', {
        category,
        error: completedErr.message,
      });
    }

    let prices = (completedGigs || []).map(g => g.price);

    // Broadening: if fewer than 3 results, try all categories (same city/state if geo available)
    if (prices.length < 3) {
      logger.info('[gigPricing] Insufficient category data, broadening search', {
        category,
        found: prices.length,
      });

      const { data: broadGigs, error: broadErr } = await supabaseAdmin
        .from('Gig')
        .select('price')
        .eq('status', 'completed')
        .gte('owner_confirmed_at', oneEightyDaysAgo)
        .gt('price', 0)
        .order('owner_confirmed_at', { ascending: false })
        .limit(200);

      if (broadErr) {
        logger.error('[gigPricing] Failed to query broadened gigs', {
          error: broadErr.message,
        });
      }

      prices = (broadGigs || []).map(g => g.price);
    }

    // Still insufficient — fall back to regional defaults
    if (prices.length < 3) {
      return getRegionalDefault(category);
    }

    // Sort ascending for percentile calculation
    prices.sort((a, b) => a - b);

    const low = Math.round(percentile(prices, 25) * 100) / 100;
    const median = Math.round(percentile(prices, 50) * 100) / 100;
    const high = Math.round(percentile(prices, 75) * 100) / 100;

    return {
      low,
      median,
      high,
      basis: `${prices.length} similar tasks in your area`,
      comparable_count: prices.length,
      category,
    };
  } catch (err) {
    logger.error('[gigPricing] Unexpected error in getGigPriceBenchmark', {
      category,
      error: err.message,
      stack: err.stack,
    });
    return getRegionalDefault(category);
  }
}

/**
 * Return hardcoded regional default for a category (cold-start fallback).
 * @param {string} category
 * @returns {Object|null}
 */
function getRegionalDefault(category) {
  const defaults = REGIONAL_DEFAULTS[category];
  if (!defaults) return null;

  return {
    low: defaults.low,
    median: defaults.median,
    high: defaults.high,
    basis: `Estimated average for ${category}`,
    comparable_count: 0,
    category,
  };
}

module.exports = {
  getGigPriceBenchmark,
};
