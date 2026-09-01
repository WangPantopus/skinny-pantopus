/**
 * Neighborhood Pulse Composer
 *
 * Composes a rich Neighborhood Pulse by combining data from multiple sources:
 *   - Property intelligence (ATTOM API)
 *   - Air quality (AirNow API)
 *   - Weather alerts (NOAA API)
 *   - Seasonal context (deterministic PNW engine)
 *   - Neighborhood profile (Census ACS, Walk Score, FEMA)
 *   - Local service providers (seeded business directory)
 *   - Community signals (placeholder for future)
 *
 * The Pulse always has content. Even with zero community data, property +
 * seasonal + environmental signals provide a rich cold-start experience.
 * Individual source failures are logged but never fail the entire Pulse.
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const propertyIntelligenceService = require('./propertyIntelligenceService');
const neighborhoodProfileService = require('./neighborhoodProfileService');
const seededBusinessService = require('./seededBusinessService');
const { getSeasonalContext } = require('./seasonalEngine');
const noaa = require('../external/noaa');
const airNow = require('../external/airNow');

// ── Greeting ───────────────────────────────────────────────────────────────

/**
 * Time-of-day aware greeting.
 * @param {Date} [now]
 * @returns {string}
 */
function buildGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Signal builders ────────────────────────────────────────────────────────

/**
 * Build an air quality signal from the AirNow result.
 * @param {{ aqi: object|null, source: string, fetchedAt: string|null }} aqiResult
 * @returns {object|null}
 */
function buildAqiSignal(aqiResult) {
  if (!aqiResult || !aqiResult.aqi) return null;

  const aqi = aqiResult.aqi;
  const isElevated = aqi.aqi > 100;

  return {
    signal_type: 'air_quality',
    priority: isElevated ? 9 : 3,
    title: isElevated
      ? `Air quality alert: AQI ${aqi.aqi} (${aqi.category})`
      : `Air quality is ${(aqi.category || 'good').toLowerCase()}`,
    detail: isElevated
      ? `AQI ${aqi.aqi} — ${aqi.category}. ${aqi.pollutant} is the primary pollutant. Consider limiting outdoor activity.`
      : `AQI ${aqi.aqi} — no concerns today.`,
    icon: 'wind',
    color: isElevated ? 'red' : 'green',
  };
}

/**
 * Build weather signals from NOAA alerts.
 * @param {{ alerts: object[], source: string, fetchedAt: string }} alertsResult
 * @returns {object[]}
 */
function buildWeatherSignals(alertsResult) {
  if (!alertsResult || !alertsResult.alerts || alertsResult.alerts.length === 0) {
    return [];
  }

  return alertsResult.alerts.map((alert) => {
    const isCritical = alert.severity === 'extreme' || alert.severity === 'severe';
    return {
      signal_type: 'weather',
      priority: isCritical ? 10 : 2,
      title: alert.headline || alert.event,
      detail: `NOAA: ${alert.description || alert.headline}`,
      icon: 'cloud-rain',
      color: isCritical ? 'red' : 'blue',
    };
  });
}

/**
 * Build a seasonal suggestion signal.
 * @param {object} seasonalCtx  From seasonalEngine.getSeasonalContext()
 * @returns {object}
 */
function buildSeasonalSignal(seasonalCtx) {
  const hasHomeTip = !!seasonalCtx.home_specific_tip;
  return {
    signal_type: 'seasonal_suggestion',
    priority: hasHomeTip ? 7 : 6,
    title: seasonalCtx.seasonal_tip
      ? seasonalCtx.seasonal_tip.split('.')[0]
      : `${seasonalCtx.primary_season} season`,
    detail: seasonalCtx.home_specific_tip || seasonalCtx.seasonal_tip || '',
    icon: 'leaf',
    color: 'amber',
    actions: seasonalCtx.first_action_nudge ? [
      {
        type: 'create_gig',
        label: seasonalCtx.first_action_nudge.prompt.split('?')[0] + '?',
        route: '/gig-v2/new',
      },
    ] : [],
  };
}

/**
 * Build a local services signal from seeded business counts.
 * @param {{ total: number, by_category: Record<string, number> }|null} bizCounts
 * @returns {object|null}
 */
function buildLocalServicesSignal(bizCounts) {
  if (!bizCounts || bizCounts.total === 0) return null;

  // Build a "top categories" string from the top 2-3 categories
  const sorted = Object.entries(bizCounts.by_category)
    .sort((a, b) => b[1] - a[1]);
  const topN = sorted.slice(0, 3);
  const topCategories = topN
    .map(([cat, count]) => `${count} ${cat.toLowerCase()}`)
    .join(', ');

  return {
    signal_type: 'local_services',
    priority: 4,
    title: `${bizCounts.total} local service providers nearby`,
    detail: `${topCategories} and more within 5 miles of your home. Post a gig to get offers.`,
    icon: 'briefcase',
    color: 'blue',
    actions: [
      { type: 'create_gig', label: 'Post a gig', route: '/gig-v2/new' },
    ],
  };
}

/**
 * Build community density info.
 * For cold start, neighbor_count is always 0 with invite CTA.
 * @returns {object}
 */
function buildCommunityDensity() {
  // Placeholder — will be replaced by communityIntelligenceService later
  return {
    neighbor_count: 0,
    density_message: 'No Pantopus neighbors yet — be the first to post!',
    invite_cta: true,
  };
}

// ── Overall status ─────────────────────────────────────────────────────────

/**
 * Determine the overall Pulse status from signals.
 * @param {object[]} signals
 * @returns {'active'|'quiet'|'advisory'|'alert'}
 */
function determineOverallStatus(signals) {
  const maxPriority = signals.reduce((max, s) => Math.max(max, s.priority || 0), 0);
  if (maxPriority >= 10) return 'alert';
  if (maxPriority >= 7) return 'advisory';
  if (maxPriority >= 4) return 'active';
  return 'quiet';
}

// ── Summary builder ────────────────────────────────────────────────────────

/**
 * Build a short summary string from available data.
 */
function buildSummary(propertyProfile, aqiSignal, weatherSignals, seasonalCtx) {
  const parts = [];

  if (weatherSignals.length > 0) {
    parts.push(weatherSignals[0].title);
  } else {
    parts.push('Your home area is quiet');
  }

  if (aqiSignal) {
    parts.push(`AQI is ${(aqiSignal.title.includes('alert') ? 'elevated' : 'good')}`);
  }

  if (seasonalCtx.primary_season) {
    const label = seasonalCtx.seasonal_tip
      ? seasonalCtx.seasonal_tip.split('.')[0]
      : '';
    if (label) parts.push(label);
  }

  return parts.join('. ') + '.';
}

// ── Main composer ──────────────────────────────────────────────────────────

/**
 * Compose a NeighborhoodPulse for a home.
 *
 * Uses Promise.allSettled so individual source failures don't block the Pulse.
 *
 * @param {object} params
 * @param {string} params.homeId  UUID of the Home record
 * @param {string} params.userId  UUID of the requesting user
 * @returns {Promise<{ pulse: object }>}
 */
async function compose({ homeId, userId }) {
  const computedAt = new Date().toISOString();
  const partialFailures = [];

  // 1. Load the Home record for coordinates and characteristics
  const { data: home, error: homeError } = await supabaseAdmin
    .from('Home')
    .select('id, address, city, state, zipcode, year_built, sq_ft, bedrooms, bathrooms, lot_sq_ft, home_type, map_center_lat, map_center_lng')
    .eq('id', homeId)
    .maybeSingle();

  if (homeError || !home) {
    logger.warn('Pulse composer: home not found', { homeId, error: homeError?.message });
    return { error: 'HOME_NOT_FOUND' };
  }

  const lat = home.map_center_lat != null ? Number(home.map_center_lat) : null;
  const lng = home.map_center_lng != null ? Number(home.map_center_lng) : null;
  const hasCoords = lat != null && lng != null;

  // 2. Fetch all data sources in parallel (allSettled = graceful degradation)
  const addressStr = home.address ? `${home.address}, ${home.city}, ${home.state} ${home.zipcode}` : '';

  const [propertyResult, aqiResult, noaaResult, neighborhoodResult, bizCountsResult] = await Promise.allSettled([
    propertyIntelligenceService.getProfile(homeId),
    hasCoords ? airNow.fetchAQI(lat, lng) : Promise.resolve({ aqi: null, source: 'unavailable', fetchedAt: null }),
    hasCoords ? noaa.fetchAlerts(lat, lng) : Promise.resolve({ alerts: [], source: 'unavailable', fetchedAt: null }),
    hasCoords ? neighborhoodProfileService.getProfile({ latitude: lat, longitude: lng, address: addressStr }) : Promise.resolve({ profile: null, source: 'unavailable' }),
    hasCoords ? seededBusinessService.getNearbyBusinessCounts({ latitude: lat, longitude: lng }) : Promise.resolve(null),
  ]);

  // 3. Extract values, logging failures
  let propertyProfile = null;
  if (propertyResult.status === 'fulfilled' && propertyResult.value.profile) {
    propertyProfile = propertyResult.value.profile;
  } else {
    partialFailures.push('property');
    if (propertyResult.status === 'rejected') {
      logger.error('Pulse: property fetch failed', { homeId, error: propertyResult.reason?.message });
    }
  }

  let aqiData = null;
  if (aqiResult.status === 'fulfilled') {
    aqiData = aqiResult.value;
  } else {
    partialFailures.push('airnow');
    logger.error('Pulse: AQI fetch failed', { homeId, error: aqiResult.reason?.message });
  }

  let noaaData = null;
  if (noaaResult.status === 'fulfilled') {
    noaaData = noaaResult.value;
  } else {
    partialFailures.push('noaa');
    logger.error('Pulse: NOAA fetch failed', { homeId, error: noaaResult.reason?.message });
  }

  let neighborhoodProfile = null;
  if (neighborhoodResult.status === 'fulfilled' && neighborhoodResult.value.profile) {
    neighborhoodProfile = neighborhoodResult.value.profile;
  } else {
    partialFailures.push('neighborhood');
    if (neighborhoodResult.status === 'rejected') {
      logger.error('Pulse: neighborhood fetch failed', { homeId, error: neighborhoodResult.reason?.message });
    }
  }

  let bizCounts = null;
  if (bizCountsResult.status === 'fulfilled') {
    bizCounts = bizCountsResult.value;
  } else {
    partialFailures.push('seeded_businesses');
    logger.error('Pulse: seeded business counts failed', { homeId, error: bizCountsResult.reason?.message });
  }

  // 4. Seasonal context (deterministic, never fails)
  const seasonalCtx = getSeasonalContext({
    homeYearBuilt: propertyProfile?.year_built || home.year_built || null,
    homePropertyType: propertyProfile?.property_type || home.home_type || null,
  });

  // 5. Build signals
  const signals = [];

  const aqiSignal = buildAqiSignal(aqiData);
  if (aqiSignal) signals.push(aqiSignal);

  const weatherSignals = buildWeatherSignals(noaaData);
  signals.push(...weatherSignals);

  const seasonalSignal = buildSeasonalSignal(seasonalCtx);
  signals.push(seasonalSignal);

  const localServicesSignal = buildLocalServicesSignal(bizCounts);
  if (localServicesSignal) signals.push(localServicesSignal);

  // Sort by priority descending
  signals.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // 6. Build property summary for the Pulse
  const property = propertyProfile ? {
    year_built: propertyProfile.year_built,
    sqft: propertyProfile.sqft,
    estimated_value: propertyProfile.estimated_value,
    zip_median_value: propertyProfile.zip_median_value,
    property_type: propertyProfile.property_type,
  } : null;

  // 7. Build neighborhood context for the Pulse
  const neighborhood = neighborhoodProfile ? {
    median_home_value: neighborhoodProfile.median_home_value,
    median_household_income: neighborhoodProfile.median_household_income,
    median_year_built: neighborhoodProfile.median_year_built,
    walk_score: neighborhoodProfile.walk_score,
    walk_description: neighborhoodProfile.walk_description,
    transit_score: neighborhoodProfile.transit_score,
    bike_score: neighborhoodProfile.bike_score,
    flood_zone: neighborhoodProfile.flood_zone,
    flood_zone_description: neighborhoodProfile.flood_zone_description,
  } : null;

  // 8. Build sources list
  const sources = [];
  if (propertyProfile && propertyProfile.source !== 'fallback') {
    sources.push({ provider: 'ATTOM', updated_at: propertyProfile.cached_at });
  }
  if (aqiData && aqiData.fetchedAt) {
    sources.push({ provider: 'AIRNOW_AQI', updated_at: aqiData.fetchedAt });
  }
  if (noaaData && noaaData.fetchedAt) {
    sources.push({ provider: 'NOAA_ALERTS', updated_at: noaaData.fetchedAt });
  }
  if (neighborhoodProfile) {
    sources.push({ provider: 'CENSUS+WALKSCORE+FEMA', updated_at: neighborhoodProfile.cached_at });
  }

  // 9. Compose final Pulse
  const summary = buildSummary(propertyProfile, aqiSignal, weatherSignals, seasonalCtx);

  return {
    pulse: {
      greeting: buildGreeting(),
      summary,
      overall_status: determineOverallStatus(signals),
      property,
      neighborhood,
      signals,
      seasonal_context: {
        season: seasonalCtx.primary_season,
        tip: seasonalCtx.seasonal_tip,
        first_action_nudge: seasonalCtx.first_action_nudge ? {
          prompt: seasonalCtx.first_action_nudge.prompt,
          route: '/gig-v2/new',
          gig_category: seasonalCtx.first_action_nudge.gig_category || null,
          gig_title: seasonalCtx.first_action_nudge.gig_title_suggestion || null,
        } : null,
      },
      community_density: buildCommunityDensity(),
      sources,
      meta: {
        community_signals_count: 0,
        external_signals_count: signals.length,
        partial_failures: partialFailures,
        computed_at: computedAt,
      },
    },
  };
}

module.exports = {
  compose,
  // Exported for testing
  buildGreeting,
  buildAqiSignal,
  buildWeatherSignals,
  buildSeasonalSignal,
  buildLocalServicesSignal,
  buildCommunityDensity,
  determineOverallStatus,
};
