/**
 * Neighborhood Fact Service
 *
 * A deterministic service (NO LLM calls) that generates contextual
 * conversation starters and property tips for neighborhoods with low
 * activity. Uses property data from PropertyIntelligenceCache, seasonal
 * context from seasonalEngine, and gig counts from NeighborhoodPreview.
 *
 * All facts are deterministic — same geohash + week + year produces
 * the same output. Facts refresh weekly.
 *
 * Fact categories: property, seasonal, safety, local_resources,
 * moving, home_value, community_question
 *
 * @module neighborhoodFactService
 */

const crypto = require('crypto');
const supabaseAdmin = require('../../config/supabaseAdmin');
const { decodeGeohashBbox } = require('../../utils/geohash');
const logger = require('../../utils/logger');
const { getSeasonalContext } = require('./seasonalEngine');

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a deterministic fact ID.
 * hash(geohash + type + week + year + index)
 */
function makeFactId(geohash, type, week, year, index) {
  const raw = `${geohash}:${type}:${week}:${year}:${index}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

/**
 * Get the ISO week number of a date (1–53).
 */
function getWeekOfYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Deterministic selection from an array based on a seed string.
 * Returns `count` items from `arr` using hash-based shuffling.
 */
function deterministicPick(arr, seed, count) {
  if (arr.length === 0) return [];
  if (arr.length <= count) return [...arr];

  // Create a deterministic order from the seed
  const scored = arr.map((item, i) => {
    const h = crypto.createHash('sha256').update(`${seed}:${i}`).digest('hex');
    return { item, score: parseInt(h.slice(0, 8), 16) };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map((s) => s.item);
}

/**
 * Compute the median of a numeric array.
 */
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/**
 * Find the mode (most common value) in an array.
 */
function mode(values) {
  if (values.length === 0) return null;
  const counts = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  let best = null;
  let bestCount = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

// ── Maintenance tips keyed by decade ────────────────────────────────────

const MAINTENANCE_BY_ERA = {
  pre1960: 'foundation inspection and knob-and-tube wiring check',
  '1960s': 'roof replacement and electrical panel upgrade',
  '1970s': 'siding replacement and insulation upgrade',
  '1980s': 'roof inspection and window replacement',
  '1990s': 'HVAC tune-up and water heater replacement',
  '2000s': 'exterior paint refresh and gutter cleaning',
  '2010s': 'HVAC filter replacement and deck maintenance',
  modern: 'annual maintenance inspection',
};

function getMaintenanceItem(yearBuilt) {
  if (yearBuilt < 1960) return MAINTENANCE_BY_ERA.pre1960;
  if (yearBuilt < 1970) return MAINTENANCE_BY_ERA['1960s'];
  if (yearBuilt < 1980) return MAINTENANCE_BY_ERA['1970s'];
  if (yearBuilt < 1990) return MAINTENANCE_BY_ERA['1980s'];
  if (yearBuilt < 2000) return MAINTENANCE_BY_ERA['1990s'];
  if (yearBuilt < 2010) return MAINTENANCE_BY_ERA['2000s'];
  if (yearBuilt < 2020) return MAINTENANCE_BY_ERA['2010s'];
  return MAINTENANCE_BY_ERA.modern;
}

// ── Property type display labels ────────────────────────────────────────

const PROPERTY_TYPE_LABELS = {
  house: 'single-family',
  single_family: 'single-family',
  SFR: 'single-family',
  condo: 'condominium',
  townhouse: 'townhouse',
  duplex: 'duplex',
  multi_family: 'multi-family',
  mobile: 'manufactured',
};

function formatPropertyType(raw) {
  if (!raw) return null;
  return PROPERTY_TYPE_LABELS[raw] || raw.toLowerCase().replace(/_/g, ' ');
}

// ── Static fact templates ───────────────────────────────────────────────

/**
 * Safety tips — weather/climate-related for PNW.
 */
const SAFETY_TIPS = [
  {
    title: 'Rainy Day Prep',
    body: 'The PNW gets an average of 150 rainy days per year. Keep your gutters clear to prevent water damage.',
    source: 'PNW Safety',
    cta: 'Find gutter cleaning help',
  },
  {
    title: 'Ice Storm Safety',
    body: 'Ice storms can take down power lines and tree branches. Keep a 72-hour emergency kit with flashlights, water, and blankets.',
    source: 'PNW Safety',
    cta: 'Share tips with neighbors',
  },
  {
    title: 'Earthquake Preparedness',
    body: 'The Cascadia subduction zone is overdue for a major earthquake. Secure tall furniture and have a family plan.',
    source: 'PNW Safety',
    cta: 'Ask neighbors about preparedness',
  },
  {
    title: 'Wildfire Smoke Prep',
    body: 'Wildfire smoke season runs July\u2013September. Stock HEPA filters and check your home\'s air sealing before summer.',
    source: 'PNW Safety',
    cta: 'Find air quality help',
  },
  {
    title: 'Flood Awareness',
    body: 'Heavy rain events are increasing in the PNW. Know if your home is in a flood zone and check your sump pump.',
    source: 'PNW Safety',
  },
];

/**
 * Local resource tips — government programs, utilities, community.
 */
const LOCAL_RESOURCE_TIPS = [
  {
    title: 'Free Energy Audit',
    body: 'Clark County PUD offers energy audits for $0\u201350. Great for homes built before 2000.',
    source: 'Local Resources',
    cta: 'Learn more from neighbors',
  },
  {
    title: 'Tree Removal Permits',
    body: 'Many Clark County cities require permits before removing trees over 6\u2033 diameter. Check with your city before hiring.',
    source: 'Local Resources',
  },
  {
    title: 'Water Conservation Rebates',
    body: 'Local utilities often offer rebates for low-flow fixtures and rain barrels. Check your water district\'s website.',
    source: 'Local Resources',
    cta: 'Ask neighbors about rebates',
  },
  {
    title: 'Recycling Rules',
    body: 'Portland Metro\'s recycling rules are unique \u2014 many common items aren\'t accepted curbside. Check your hauler\'s website.',
    source: 'Local Resources',
  },
  {
    title: 'Weatherization Assistance',
    body: 'Low-income homeowners may qualify for free weatherization through Community Action agencies. Includes insulation, windows, and heating.',
    source: 'Local Resources',
    cta: 'Share with neighbors who might qualify',
  },
];

/**
 * Moving / newcomer tips.
 */
const MOVING_TIPS = [
  {
    title: 'Welcome to the PNW',
    body: 'New to the area? Portland Metro\'s recycling rules are unique \u2014 check your city\'s website for what goes where.',
    source: 'Moving Tips',
    cta: 'Introduce yourself to neighbors',
  },
  {
    title: 'PNW Driving Tip',
    body: 'Studded tires are allowed Nov 1 \u2013 Mar 31 in Oregon and Washington. Chains are required for some mountain passes.',
    source: 'Moving Tips',
  },
  {
    title: 'Utility Setup',
    body: 'New homeowners: set up accounts with your local PUD, water district, and waste hauler within the first week to avoid lapses.',
    source: 'Moving Tips',
    cta: 'Ask neighbors about local providers',
  },
  {
    title: 'Neighborhood Networks',
    body: 'The best way to find reliable contractors is through verified neighbors. Post a question \u2014 someone nearby has a recommendation.',
    source: 'Moving Tips',
    cta: 'Ask for a recommendation',
  },
];

// ── Data fetching ───────────────────────────────────────────────────────

/**
 * Query PropertyIntelligenceCache for homes matching a geohash-6 area.
 * Uses map_center_lat/lng bounding box since Home has no geohash column.
 */
async function fetchPropertyData(geohash) {
  try {
    // Decode geohash to bounding box and query by lat/lng range
    const bbox = decodeGeohashBbox(geohash);
    const { data: homes, error: homeErr } = await supabaseAdmin
      .from('Home')
      .select('id, year_built, home_type, city, state')
      .gte('map_center_lat', bbox.minLat)
      .lte('map_center_lat', bbox.maxLat)
      .gte('map_center_lng', bbox.minLng)
      .lte('map_center_lng', bbox.maxLng)
      .limit(200);

    if (homeErr || !homes || homes.length === 0) {
      return { homes: [], profiles: [] };
    }

    const homeIds = homes.map((h) => h.id);

    // Get cached property profiles for these homes
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('PropertyIntelligenceCache')
      .select('profile')
      .in('home_id', homeIds)
      .gt('expires_at', new Date().toISOString());

    if (profErr) {
      logger.warn('neighborhoodFactService: PropertyIntelligenceCache query error', { error: profErr.message });
    }

    return { homes, profiles: (profiles || []).map((p) => p.profile) };
  } catch (err) {
    logger.error('neighborhoodFactService: fetchPropertyData error', { geohash, error: err.message });
    return { homes: [], profiles: [] };
  }
}

/**
 * Get nearby gig counts from NeighborhoodPreview.
 */
async function fetchGigCounts(geohash) {
  try {
    const { data, error } = await supabaseAdmin
      .from('NeighborhoodPreview')
      .select('verified_users_count')
      .eq('geohash', geohash)
      .maybeSingle();

    if (error) {
      logger.warn('neighborhoodFactService: NeighborhoodPreview query error', { error: error.message });
      return null;
    }
    return data;
  } catch (err) {
    logger.error('neighborhoodFactService: fetchGigCounts error', { error: err.message });
    return null;
  }
}

// ── Fact generators ─────────────────────────────────────────────────────

/**
 * Generate property-based tips from aggregate property data.
 */
function generatePropertyFacts(geohash, homes, profiles, week, year) {
  const facts = [];

  // Collect year_built values from profiles (preferred) and home records (fallback)
  const yearBuiltValues = [];
  const propertyTypes = [];

  for (const p of profiles) {
    if (p.year_built) yearBuiltValues.push(p.year_built);
    if (p.property_type) propertyTypes.push(p.property_type);
  }
  // Supplement with Home table data
  for (const h of homes) {
    if (h.year_built && yearBuiltValues.length < 200) yearBuiltValues.push(h.year_built);
    if (h.home_type && propertyTypes.length < 200) propertyTypes.push(h.home_type);
  }

  // Median year built tip
  const medianYear = median(yearBuiltValues);
  if (medianYear) {
    const maintenanceItem = getMaintenanceItem(medianYear);
    facts.push({
      id: makeFactId(geohash, 'property_tip', week, year, 0),
      type: 'property_tip',
      title: `Homes Built Around ${medianYear}`,
      body: `Most homes in your area were built around ${medianYear}. Homes this age typically need ${maintenanceItem}.`,
      source: 'ATTOM',
      post_type: 'discussion',
      cta: 'Find a pro nearby',
    });

    // Pre-1990 plumbing tip
    if (medianYear < 1990) {
      facts.push({
        id: makeFactId(geohash, 'property_tip', week, year, 1),
        type: 'property_tip',
        title: 'Plumbing Check Recommended',
        body: 'Tip: Homes built before 1990 may have original plumbing. Consider a sewer scope inspection ($300\u2013500).',
        source: 'ATTOM',
        post_type: 'recommendation',
        cta: 'Ask neighbors for recommendations',
      });
    }
  }

  // Common property type tip
  const dominantType = mode(propertyTypes);
  if (dominantType) {
    const label = formatPropertyType(dominantType);
    facts.push({
      id: makeFactId(geohash, 'property_tip', week, year, 2),
      type: 'property_tip',
      title: 'Neighborhood Home Types',
      body: `Your neighborhood is primarily ${label} homes.`,
      source: 'ATTOM',
    });
  }

  return facts;
}

/**
 * Generate seasonal tips using the seasonalEngine.
 */
function generateSeasonalFacts(geohash, seasonalCtx, neighborhoodPreview, week, year) {
  const facts = [];

  // Primary seasonal tip
  const seasonLabel = seasonalCtx.active_seasons
    .map((s) => s.replace(/_/g, ' '))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    [0] || 'the current season';

  if (seasonalCtx.seasonal_tip) {
    facts.push({
      id: makeFactId(geohash, 'seasonal_tip', week, year, 0),
      type: 'seasonal_tip',
      title: `${seasonLabel} Tip`,
      body: seasonalCtx.seasonal_tip,
      source: 'PNW Seasonal',
      post_type: 'discussion',
    });
  }

  // Home-specific seasonal tip (if we have property age data)
  if (seasonalCtx.home_specific_tip) {
    facts.push({
      id: makeFactId(geohash, 'seasonal_tip', week, year, 1),
      type: 'seasonal_tip',
      title: 'Home Care Tip',
      body: seasonalCtx.home_specific_tip,
      source: 'PNW Seasonal',
      post_type: 'recommendation',
      cta: 'Post a gig for this',
    });
  }

  // Peak category tip with neighbor count
  if (seasonalCtx.suggested_gig_categories?.length > 0) {
    const topCategory = seasonalCtx.suggested_gig_categories[0];
    const neighborCount = neighborhoodPreview?.verified_users_count || 0;
    const neighborClause = neighborCount > 0
      ? ` ${neighborCount} verified neighbor${neighborCount !== 1 ? 's' : ''} nearby.`
      : '';

    facts.push({
      id: makeFactId(geohash, 'seasonal_tip', week, year, 2),
      type: 'seasonal_tip',
      title: `Peak ${topCategory} Season`,
      body: `This is peak ${topCategory.toLowerCase()} season.${neighborClause}`,
      source: 'PNW Seasonal',
      post_type: 'gig',
      cta: `Find ${topCategory.toLowerCase()} help`,
    });
  }

  return facts;
}

/**
 * Generate safety tips — deterministically pick 1 from the pool per week.
 */
function generateSafetyFacts(geohash, week, year) {
  const seed = `${geohash}:safety:${week}:${year}`;
  const picked = deterministicPick(SAFETY_TIPS, seed, 1);
  return picked.map((tip, i) => ({
    id: makeFactId(geohash, 'safety_tip', week, year, i),
    type: 'safety_tip',
    title: tip.title,
    body: tip.body,
    source: tip.source,
    post_type: 'discussion',
    cta: tip.cta || null,
  }));
}

/**
 * Generate local resource tips — pick 1 per week.
 */
function generateLocalResourceFacts(geohash, week, year) {
  const pool = [...LOCAL_RESOURCE_TIPS];
  const seed = `${geohash}:local_resource:${week}:${year}`;
  const picked = deterministicPick(pool, seed, 1);
  return picked.map((tip, i) => ({
    id: makeFactId(geohash, 'local_resource', week, year, i),
    type: 'local_resource',
    title: tip.title,
    body: tip.body,
    source: tip.source,
    post_type: 'discussion',
    cta: tip.cta || null,
  }));
}

/**
 * Generate moving / newcomer tips — pick 1 per week.
 */
function generateMovingFacts(geohash, week, year) {
  const seed = `${geohash}:moving:${week}:${year}`;
  const picked = deterministicPick(MOVING_TIPS, seed, 1);
  return picked.map((tip, i) => ({
    id: makeFactId(geohash, 'moving_tip', week, year, i),
    type: 'moving_tip',
    title: tip.title,
    body: tip.body,
    source: tip.source,
    post_type: 'discussion',
    cta: tip.cta || null,
  }));
}

/**
 * Generate home value context tips from PropertyIntelligenceCache trends.
 */
function generateHomeValueFacts(geohash, profiles, week, year) {
  const facts = [];

  // Check for zip_median_sale_price_trend across profiles
  const trends = profiles
    .map((p) => p.zip_median_sale_price_trend)
    .filter(Boolean);

  const trendMode = mode(trends);

  if (trendMode === 'up') {
    facts.push({
      id: makeFactId(geohash, 'home_value', week, year, 0),
      type: 'home_value',
      title: 'Home Values Trending Up',
      body: 'Home values in your ZIP are trending up. Good time to invest in maintenance.',
      source: 'ATTOM',
      post_type: 'discussion',
      cta: 'Find home improvement help',
    });
  } else if (trendMode === 'down') {
    facts.push({
      id: makeFactId(geohash, 'home_value', week, year, 1),
      type: 'home_value',
      title: 'Market Update',
      body: 'Home values in your area are cooling. Strategic improvements like curb appeal can help maintain value.',
      source: 'ATTOM',
      post_type: 'discussion',
      cta: 'Ask neighbors about contractors',
    });
  }

  return facts;
}

/**
 * Generate community conversation starters.
 */
function generateCommunityQuestions(geohash, homes, seasonalCtx, week, year) {
  // Build a larger pool then deterministically pick 2-3 per week
  const cities = homes.map((h) => h.city).filter(Boolean);
  const city = mode(cities) || 'your area';
  const topCategory = seasonalCtx.suggested_gig_categories?.[0] || 'home maintenance';

  const pool = [
    {
      title: `${topCategory} Recommendations`,
      body: `Has anyone used a good ${topCategory.toLowerCase()} service near ${city}?`,
      cta: 'Ask your neighbors',
    },
    {
      title: `Welcome to ${city}`,
      body: `New to ${city}? Introduce yourself! Your verified neighbors are here.`,
      cta: 'Say hello',
    },
    {
      title: 'Local Knowledge',
      body: `What's one thing you wish you knew before buying a home in ${city}?`,
      cta: 'Share your experience',
    },
    {
      title: 'Favorite Local Spot',
      body: `What's your favorite restaurant or coffee shop in ${city}? Share your go-to spots.`,
      cta: 'Share a recommendation',
    },
    {
      title: 'Neighborhood Watch',
      body: `Anyone else notice anything unusual in ${city} recently? Stay connected and look out for each other.`,
      cta: 'Start a conversation',
    },
    {
      title: 'Weekend Plans',
      body: `What are you working on this weekend? Share your home projects or local plans.`,
      cta: 'Share your plans',
    },
  ];

  const seed = `${geohash}:community:${week}:${year}`;
  const picked = deterministicPick(pool, seed, 2);

  return picked.map((q, i) => ({
    id: makeFactId(geohash, 'community_question', week, year, i),
    type: 'community_question',
    title: q.title,
    body: q.body,
    source: 'Community',
    post_type: 'discussion',
    cta: q.cta,
  }));
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Generate contextual, deterministic neighborhood facts for a geohash area.
 *
 * Same geohash + week + year always produces the same facts.
 * No LLM calls are made. Facts rotate weekly.
 *
 * @param {string} geohash  Geohash-6 prefix for the area
 * @param {object} [options]
 * @param {Date}   [options.date]  Override date (for testing determinism)
 * @returns {Promise<FactCard[]>}
 */
async function generateNeighborhoodFacts(geohash, options = {}) {
  const date = options.date || new Date();
  const week = getWeekOfYear(date);
  const year = date.getFullYear();

  // 1. Fetch property data and neighborhood preview in parallel
  const [propertyResult, neighborhoodPreview] = await Promise.all([
    fetchPropertyData(geohash),
    fetchGigCounts(geohash),
  ]);

  const { homes, profiles } = propertyResult;

  // 2. Compute median year for seasonal context
  const yearBuiltValues = [];
  for (const p of profiles) {
    if (p.year_built) yearBuiltValues.push(p.year_built);
  }
  for (const h of homes) {
    if (h.year_built) yearBuiltValues.push(h.year_built);
  }
  const medianYear = median(yearBuiltValues);

  // 3. Get seasonal context (deterministic, no external calls)
  const seasonalCtx = getSeasonalContext({
    date,
    homeYearBuilt: medianYear,
  });

  // 4. Generate facts by category
  const hasPropertyData = homes.length > 0 || profiles.length > 0;

  const propertyFacts = hasPropertyData
    ? generatePropertyFacts(geohash, homes, profiles, week, year)
    : [];

  const seasonalFacts = generateSeasonalFacts(
    geohash, seasonalCtx, neighborhoodPreview, week, year,
  );

  const safetyFacts = generateSafetyFacts(geohash, week, year);

  const localResourceFacts = generateLocalResourceFacts(geohash, week, year);

  const movingFacts = generateMovingFacts(geohash, week, year);

  const homeValueFacts = hasPropertyData
    ? generateHomeValueFacts(geohash, profiles, week, year)
    : [];

  const communityQuestions = generateCommunityQuestions(
    geohash, homes, seasonalCtx, week, year,
  );

  // 5. Assemble all candidate facts
  const allCandidates = [
    ...propertyFacts,
    ...seasonalFacts,
    ...safetyFacts,
    ...localResourceFacts,
    ...homeValueFacts,
    ...movingFacts,
    ...communityQuestions,
  ];

  // 6. Deterministically select 5-8 facts with priority ordering:
  //    property > seasonal > safety > local_resources > home_value > moving > community
  //    Use weekly rotation seed to vary which facts from each category are shown
  const seed = `${geohash}:select:${week}:${year}`;
  const selected = deterministicPick(allCandidates, seed, 8);

  // Sort by type priority for display order
  const TYPE_PRIORITY = {
    property_tip: 0,
    seasonal_tip: 1,
    safety_tip: 2,
    local_resource: 3,
    home_value: 4,
    moving_tip: 5,
    community_question: 6,
  };
  const byPriority = (a, b) => (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99);
  selected.sort(byPriority);

  // Fallback: if deterministicPick returned fewer than 5, use priority-sorted candidates
  if (selected.length < 5) {
    const sorted = [...allCandidates].sort(byPriority);
    return sorted.slice(0, 8);
  }
  return selected;
}

module.exports = { generateNeighborhoodFacts };
