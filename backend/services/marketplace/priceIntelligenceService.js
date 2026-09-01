/**
 * priceIntelligenceService.js — Price intelligence for marketplace listings.
 * Provides price suggestions based on recently sold and active items
 * in the same category.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

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
 * Get price suggestion based on similar items in the same category.
 *
 * @param {Object} params
 * @param {string} params.category - Listing category
 * @param {number} [params.latitude] - User latitude (unused in MVP — proximity filtering Phase 3)
 * @param {number} [params.longitude] - User longitude (unused in MVP)
 * @param {number} [params.radiusMiles=10] - Search radius (unused in MVP)
 * @param {string} [params.title] - Listing title (unused in MVP — semantic matching Phase 3)
 * @param {string} [params.condition] - Item condition (unused in MVP)
 * @returns {Object|null} { low, median, high, basis, comparable_count } or null if insufficient data
 */
async function getPriceSuggestion({ category, latitude, longitude, radiusMiles = 10, title, condition }) {
  if (!category) return null;

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Query recently sold items in the same category
  const { data: soldItems, error: soldErr } = await supabaseAdmin
    .from('Listing')
    .select('price')
    .eq('status', 'sold')
    .eq('category', category)
    .gte('sold_at', ninetyDaysAgo)
    .not('price', 'is', null)
    .gt('price', 0)
    .order('sold_at', { ascending: false })
    .limit(100);

  if (soldErr) {
    logger.error('[priceIntelligence] Failed to query sold items', {
      category,
      error: soldErr.message,
    });
  }

  // Query active items in the same category
  const { data: activeItems, error: activeErr } = await supabaseAdmin
    .from('Listing')
    .select('price')
    .eq('status', 'active')
    .eq('category', category)
    .not('price', 'is', null)
    .gt('price', 0)
    .limit(100);

  if (activeErr) {
    logger.error('[priceIntelligence] Failed to query active items', {
      category,
      error: activeErr.message,
    });
  }

  // Combine and sort all prices
  const prices = [
    ...(soldItems || []).map(i => i.price),
    ...(activeItems || []).map(i => i.price),
  ].sort((a, b) => a - b);

  // Insufficient data
  if (prices.length < 3) return null;

  const low = Math.round(percentile(prices, 25) * 100) / 100;
  const median = Math.round(percentile(prices, 50) * 100) / 100;
  const high = Math.round(percentile(prices, 75) * 100) / 100;

  return {
    low,
    median,
    high,
    basis: `${prices.length} similar items in your area`,
    comparable_count: prices.length,
  };
}

module.exports = {
  getPriceSuggestion,
};
