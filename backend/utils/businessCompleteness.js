/**
 * Business Profile Completeness Calculator
 *
 * Computes a 0-100 score based on weighted factors and stores it
 * on BusinessProfile.profile_completeness for discovery ranking.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('./logger');

// Entity types that use donation items instead of standard catalog items
const DONATION_ENTITY_TYPES = new Set(['religious_org', 'nonprofit_501c3']);

// Entity types that can substitute service_area for geocoded location
const SERVICE_AREA_ENTITY_TYPES = new Set(['home_service', 'sole_proprietor']);

/**
 * Calculate profile completeness for a business (0-100).
 *
 * Scoring rubric (sums to 100):
 *   Name exists (always true at creation):              +5
 *   Description >= 50 chars:                            +15
 *   Logo file ID set:                                   +9
 *   Banner file ID set:                                 +8
 *   At least 1 active location with coordinates
 *     (or service_area for eligible types):             +15
 *   At least 1 BusinessHours row:                       +10
 *   At least 1 active catalog item
 *     (donation items for religious/nonprofit):         +10
 *   Public phone or public email set:                   +10
 *   Categories array non-empty:                          +5
 *   Website or social_links has >= 1 key:                +5
 *   User.tagline set and non-empty:                      +3
 *   Verification tier:                                  +5 to +15
 *     self_attested: +5, document_verified: +10, government_verified: +15
 */
async function calculateProfileCompleteness(businessUserId) {
  try {
    const [profileResult, locationsResult, userResult] = await Promise.all([
      supabaseAdmin
        .from('BusinessProfile')
        .select('description, logo_file_id, banner_file_id, categories, public_phone, public_email, website, social_links, verification_status, business_type, service_area')
        .eq('business_user_id', businessUserId)
        .single(),
      supabaseAdmin
        .from('BusinessLocation')
        .select('id, location')
        .eq('business_user_id', businessUserId)
        .eq('is_active', true),
      supabaseAdmin
        .from('User')
        .select('tagline')
        .eq('id', businessUserId)
        .single(),
    ]);

    const profile = profileResult.data;
    const locations = locationsResult.data || [];
    const user = userResult.data;

    if (!profile) {
      logger.warn('calculateProfileCompleteness: no profile found', { businessUserId });
      return 0;
    }

    // Entity-type-aware catalog query
    const isDonationType = DONATION_ENTITY_TYPES.has(profile.business_type);
    let catalogQuery = supabaseAdmin
      .from('BusinessCatalogItem')
      .select('id', { count: 'exact', head: true })
      .eq('business_user_id', businessUserId)
      .eq('status', 'active');

    if (isDonationType) {
      catalogQuery = catalogQuery.eq('kind', 'donation');
    }

    const catalogResult = await catalogQuery;
    const catalogCount = catalogResult.count || 0;

    // Check if any location has hours
    let hasHours = false;
    if (locations.length > 0) {
      const locationIds = locations.map((l) => l.id);
      const { count: hoursCount } = await supabaseAdmin
        .from('BusinessHours')
        .select('id', { count: 'exact', head: true })
        .in('location_id', locationIds);
      hasHours = (hoursCount || 0) > 0;
    }

    let score = 0;

    // Name exists (always true at creation): +5
    score += 5;

    // Description >= 50 chars: +15
    if (profile.description && profile.description.length >= 50) score += 15;

    // Logo: +9
    if (profile.logo_file_id) score += 9;

    // Banner: +8
    if (profile.banner_file_id) score += 8;

    // Location: +15
    // Service area types can substitute a non-empty service_area for geocoded location
    const hasGeocodedLocation = locations.some((l) => l.location !== null);
    const isServiceAreaType = SERVICE_AREA_ENTITY_TYPES.has(profile.business_type);
    const hasServiceArea = profile.service_area && typeof profile.service_area === 'object' &&
      ((Array.isArray(profile.service_area) && profile.service_area.length > 0) ||
       (!Array.isArray(profile.service_area) && Object.keys(profile.service_area).length > 0));

    if (hasGeocodedLocation || (isServiceAreaType && hasServiceArea)) {
      score += 15;
    }

    // At least 1 hours row: +10
    if (hasHours) score += 10;

    // At least 1 active catalog item (donation for eligible types): +10
    if (catalogCount > 0) score += 10;

    // Public contact (phone or email): +10
    if (profile.public_phone || profile.public_email) score += 10;

    // Categories non-empty: +5
    if (Array.isArray(profile.categories) && profile.categories.length > 0) score += 5;

    // Website or social_links has at least 1 key: +5
    const hasSocialLinks = profile.social_links && typeof profile.social_links === 'object' && Object.keys(profile.social_links).length > 0;
    if (profile.website || hasSocialLinks) score += 5;

    // Tagline set and non-empty: +3
    if (user?.tagline && user.tagline.trim().length > 0) score += 3;

    // Verification tier scoring (up to +15)
    const verStatus = profile.verification_status;
    if (verStatus === 'government_verified') score += 15;
    else if (verStatus === 'document_verified') score += 10;
    else if (verStatus === 'self_attested') score += 5;
    // unverified or null: +0

    return Math.min(score, 100);
  } catch (err) {
    logger.error('calculateProfileCompleteness failed', { businessUserId, error: err.message });
    return 0;
  }
}

/**
 * Calculate and persist profile completeness to the database.
 * Returns the computed score.
 */
async function calculateAndStoreCompleteness(businessUserId) {
  const score = await calculateProfileCompleteness(businessUserId);

  const { error } = await supabaseAdmin
    .from('BusinessProfile')
    .update({ profile_completeness: score })
    .eq('business_user_id', businessUserId);

  if (error) {
    logger.error('Failed to store profile_completeness', { businessUserId, score, error: error.message });
  }

  return score;
}

module.exports = {
  calculateProfileCompleteness,
  calculateAndStoreCompleteness,
};
