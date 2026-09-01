/**
 * businessSignalService.js
 * Generates neighborhood signals for business events (e.g. first publish).
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { ENTITY_TYPE_LABELS } = require('../utils/businessConstants');

/**
 * Generate a "new_business" signal when a business publishes for the first time.
 * Idempotent: skips if a new_business signal already exists for this businessId.
 */
async function generateNewBusinessSignal(businessId) {
  try {
    // Idempotency check — don't create duplicate signals
    const { data: existing } = await supabaseAdmin
      .from('NeighborhoodSignalCache')
      .select('id')
      .eq('signal_type', 'new_business')
      .eq('data->>business_id', businessId)
      .maybeSingle();

    if (existing) {
      logger.info('New business signal already exists, skipping', { businessId });
      return;
    }

    // Fetch business name and entity type
    const { data: bizUser } = await supabaseAdmin
      .from('User')
      .select('id, name, username')
      .eq('id', businessId)
      .single();

    if (!bizUser) {
      logger.warn('generateNewBusinessSignal: business user not found', { businessId });
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('business_type')
      .eq('business_user_id', businessId)
      .single();

    // Fetch primary location for city/neighborhood (no street address)
    const { data: location } = await supabaseAdmin
      .from('BusinessLocation')
      .select('city, state, location')
      .eq('business_user_id', businessId)
      .eq('is_primary', true)
      .eq('is_active', true)
      .maybeSingle();

    const entityType = profile?.business_type || 'for_profit';
    const entityLabel = ENTITY_TYPE_LABELS[entityType] || 'Business';
    const areaName = location
      ? [location.city, location.state].filter(Boolean).join(', ')
      : 'your neighborhood';

    // Build place_key from city for geographic scoping
    const placeKey = location?.city
      ? `city:${location.city.toLowerCase().replace(/\s+/g, '_')}`
      : null;

    const { error } = await supabaseAdmin
      .from('NeighborhoodSignalCache')
      .insert({
        signal_type: 'new_business',
        priority: 6,
        title: `${bizUser.name} just joined your neighborhood`,
        detail: `${entityLabel} in ${areaName}`,
        data: {
          business_id: businessId,
          business_username: bizUser.username,
          business_name: bizUser.name,
          entity_type: entityType,
          deep_link: `/business/${bizUser.username}`,
        },
        place_key: placeKey,
        privacy_level: 'public',
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
      });

    if (error) {
      logger.error('Failed to insert new business signal', { error: error.message, businessId });
    } else {
      logger.info('New business signal created', { businessId, name: bizUser.name });
    }
  } catch (err) {
    logger.error('generateNewBusinessSignal error', { error: err.message, businessId });
  }
}

module.exports = { generateNewBusinessSignal };
