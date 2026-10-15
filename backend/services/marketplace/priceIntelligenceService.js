/** Local price suggestions from comparable public records. No national fallback. */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { haversineMiles } = require('../../utils/geo');
const { applyLocationPrivacy, widenRadiusMeters } = require('../marketplace/locationPrivacy');

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

async function getPriceSuggestion({ category, latitude, longitude, radiusMiles = 10, condition }) {
  // Missing/invalid geography is not permission to query a national sample.
  if (!category || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
    || !Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 100) return null;
  try {
    const { data, error } = await supabaseAdmin.rpc('local_price_comparables', {
      p_kind: 'listing', p_category: category, p_lat: latitude, p_lng: longitude,
      p_radius_meters: widenRadiusMeters(radiusMiles * 1609.344),
      p_condition: condition || null,
    });
    if (error) throw error;
    // Use the public point even for owners. Changing the query radius must
    // never turn aggregate counts into a probe for someone's hidden address.
    const comparable = (data || []).filter((row) => {
      const shown = applyLocationPrivacy(row, null);
      if (!Number.isFinite(shown.latitude) || !Number.isFinite(shown.longitude)) return false;
      const distance = haversineMiles(latitude, longitude, shown.latitude, shown.longitude);
      return distance <= radiusMiles && (row.visibility_scope !== 'radius'
        || (Number.isFinite(Number(row.radius_miles)) && distance <= Number(row.radius_miles)));
    });
    if (comparable.length < 3) return null;
    const prices = comparable.map(row => Number(row.price)).filter(p => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
    if (prices.length < 3) return null;
    return {
      low: Math.round(percentile(prices, 25) * 100) / 100,
      median: Math.round(percentile(prices, 50) * 100) / 100,
      high: Math.round(percentile(prices, 75) * 100) / 100,
      basis: `${prices.length} ${condition ? condition + ' ' : ''}${category} listing prices within ${radiusMiles} ${radiusMiles === 1 ? 'mile' : 'miles'} (${comparable.filter(row => row.status === 'sold').length} sold, ${comparable.filter(row => row.status === 'active').length} active); asking prices, not confirmed sale prices`,
      comparable_count: prices.length,
      category,
      radius_miles: radiusMiles,
      geographic_scope: 'requested_radius',
    };
  } catch (err) {
    logger.warn('[getPriceSuggestion] Local comparisons unavailable', { error: err.message });
    return null;
  }
}

module.exports = { getPriceSuggestion };
