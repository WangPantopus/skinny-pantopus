/**
 * Pacific Northwest Seasonal Intelligence Engine
 *
 * A deterministic service (no AI/LLM calls, no external APIs, no DB queries)
 * that returns seasonal context based on the current date, region, and
 * optional home characteristics. Critical for the cold-start Pulse —
 * provides useful, personalised content with zero community data.
 *
 * Target region: Clark County WA + Portland Metro OR.
 */

const SUPPORTED_REGIONS = [
  // Vancouver, WA centroid — Clark County, Washington (not other U.S. Clark Counties).
  { label: 'Clark County, WA', lat: 45.6387, lng: -122.6615, radius_meters: 30_000 },
  { label: 'Portland Metro', lat: 45.5152, lng: -122.6784, radius_meters: 30_000 },
];

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isSupportedSeasonalRegion(options = {}) {
  const latitude = Number(options.latitude);
  const longitude = Number(options.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }

  return SUPPORTED_REGIONS.some((region) =>
    haversineMeters(latitude, longitude, region.lat, region.lng) <= region.radius_meters
  );
}

// ── Seasonal Calendar ──────────────────────────────────────────────────────

/**
 * PNW seasonal calendar. Months are 0-indexed (0 = January).
 * Seasons can overlap — the engine returns ALL active seasons.
 */
const SEASONS = {
  winter_ice: {
    months: [11, 0, 1],             // Dec, Jan, Feb
    label: 'Winter Ice Season',
    urgency: 'high',
  },
  spring_cleanup: {
    months: [2, 3],                 // Mar, Apr
    label: 'Spring Cleanup',
    urgency: 'moderate',
  },
  early_summer: {
    months: [4, 5],                 // May, Jun
    label: 'Early Summer',
    urgency: 'low',
  },
  summer_dry: {
    months: [6, 7],                 // Jul, Aug
    label: 'Summer & Smoke Season',
    urgency: 'moderate',
  },
  smoke_season: {
    months: [6, 7, 8],             // Jul, Aug, Sep
    label: 'Smoke Season',
    urgency: 'high',
  },
  fall_prep: {
    months: [8, 9, 10],            // Sep, Oct, Nov
    label: 'Fall Prep & Gutter Season',
    urgency: 'moderate',
  },
  holiday_season: {
    months: [10, 11],              // Nov, Dec
    label: 'Holiday Season',
    urgency: 'low',
  },
};

// ── Seasonal Tips ──────────────────────────────────────────────────────────

/**
 * Tips are ordered by specificity — the engine picks the first matching tip.
 * Each tip has an optional `condition` function that receives home context.
 * If no condition, the tip is the generic fallback for that season.
 */
const SEASONAL_TIPS = {
  winter_ice: [
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt < 1990,
      tip: 'Portland/Vancouver averages 3–5 ice events per winter. Homes built before 1990 may have vulnerable pipes — consider insulation.',
      homeTip: 'Your {{year}} home may have original plumbing. Pipe insulation and heat tape can prevent costly freeze damage.',
    },
    {
      condition: (ctx) => ctx.homePropertyType === 'condo' || ctx.homePropertyType === 'townhouse',
      tip: 'Ice season is here. Shared walkways and driveways need de-icing — coordinate with neighbors for supplies.',
      homeTip: 'Your condo/townhouse community may benefit from shared de-icing supplies. Post a gig to get walkways treated.',
    },
    {
      tip: 'Portland/Vancouver averages 3–5 ice events per winter. Keep de-icing supplies handy and protect outdoor pipes.',
      homeTip: null,
    },
  ],
  spring_cleanup: [
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt < 1990,
      tip: 'Spring cleanup season starts now. Moss removal, gutter flush, and pressure washing are the top needs in Clark County, WA.',
      homeTip: 'Your {{year}} home likely has significant moss buildup after winter. Roof moss treatment now prevents damage later.',
    },
    {
      tip: 'Spring cleanup season is here. Moss removal, gutter flush, and pressure washing are the top residential needs in Clark County, WA.',
      homeTip: null,
    },
  ],
  early_summer: [
    {
      condition: (ctx) => ctx.homePropertyType === 'house' || ctx.homePropertyType === 'single_family',
      tip: 'Summer watering restrictions typically begin in July. Your lawn needs 1–1.5 inches of water per week.',
      homeTip: 'Time to prep your yard for summer — lawn care, garden maintenance, and sprinkler checks.',
    },
    {
      tip: 'Early summer is perfect for outdoor projects. Deck repairs, painting, and landscaping before the heat peaks.',
      homeTip: null,
    },
  ],
  summer_dry: [
    {
      tip: 'Summer watering restrictions typically begin in July. HEPA filters help during smoke events — check AQI daily.',
      homeTip: null,
    },
  ],
  smoke_season: [
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt < 2000,
      tip: 'Wildfire smoke season peaks in August. HEPA filters and sealed windows help. Check AQI daily.',
      homeTip: 'Older homes like yours ({{year}}) may have drafty windows that let smoke in. Consider temporary sealing or air purifier rental.',
    },
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt >= 2010,
      tip: 'Wildfire smoke season peaks in August. Your newer home likely has better sealing — run HVAC with a good filter.',
      homeTip: 'Your newer home has better air sealing. Keep windows closed and run your HVAC on recirculate during smoke events.',
    },
    {
      tip: 'Wildfire smoke season peaks August–September. HEPA filters and sealed windows help. Check AQI daily.',
      homeTip: null,
    },
  ],
  fall_prep: [
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt < 1990,
      tip: 'October is peak gutter season in Clark County, WA. Homes built before 1990 typically need annual gutter cleaning.',
      homeTip: 'Your {{year}} home likely has original gutters. Consider scheduling professional cleaning before the November rains.',
    },
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt >= 2010,
      tip: 'Fall prep season is here. Even newer homes need gutter cleaning and downspout checks before winter rains.',
      homeTip: 'Your newer home may have gutter guards, but they still need clearing. Leaves and debris accumulate fast in fall.',
    },
    {
      tip: 'Fall is gutter season in the Pacific Northwest. Clean gutters before November rains to prevent water damage.',
      homeTip: null,
    },
  ],
  holiday_season: [
    {
      tip: 'Package theft peaks in December. Consider coordinating with neighbors for delivery watching.',
      homeTip: null,
    },
  ],
};

// ── Gig Suggestions ────────────────────────────────────────────────────────

const SEASONAL_GIG_SUGGESTIONS = {
  winter_ice: {
    categories: ['Handyman', 'Cleaning'],
    nudge: {
      prompt: 'Ice season is here. Need help with de-icing or snow removal? Post a gig — it takes 30 seconds.',
      gig_category: 'Handyman',
      gig_title_suggestion: 'De-icing and snow removal needed',
    },
  },
  spring_cleanup: {
    categories: ['Gardening', 'Cleaning', 'Handyman'],
    nudge: {
      prompt: 'Spring cleanup time! Need moss removal, pressure washing, or yard work? Post a gig — it takes 30 seconds.',
      gig_category: 'Cleaning',
      gig_title_suggestion: 'Spring pressure washing and moss removal',
    },
  },
  early_summer: {
    categories: ['Gardening', 'Handyman', 'Moving'],
    nudge: {
      prompt: 'Summer project season! Need help with yard work, painting, or deck repairs? Post a gig — it takes 30 seconds.',
      gig_category: 'Gardening',
      gig_title_suggestion: 'Lawn care and yard maintenance',
    },
  },
  summer_dry: {
    categories: ['Gardening', 'Handyman'],
    nudge: {
      prompt: 'Need help with watering, sprinkler repair, or summer yard care? Post a gig — it takes 30 seconds.',
      gig_category: 'Gardening',
      gig_title_suggestion: 'Sprinkler system check and yard watering',
    },
  },
  smoke_season: {
    categories: ['Handyman', 'Cleaning'],
    nudge: {
      prompt: 'Smoke season is here. Need a HEPA filter installed or windows sealed? Post a gig — it takes 30 seconds.',
      gig_category: 'Handyman',
      gig_title_suggestion: 'Air filter replacement and window sealing',
    },
  },
  fall_prep: {
    categories: ['Gardening', 'Handyman', 'Cleaning'],
    nudge: {
      prompt: 'Need your gutters cleaned before the rain? Post a gig — it takes 30 seconds.',
      gig_category: 'Handyman',
      gig_title_suggestion: 'Gutter cleaning needed',
    },
  },
  holiday_season: {
    categories: ['Handyman', 'Pet Care', 'Cleaning'],
    nudge: {
      prompt: 'Holiday season! Need help with decorations, house sitting, or a deep clean? Post a gig — it takes 30 seconds.',
      gig_category: 'Handyman',
      gig_title_suggestion: 'Holiday light installation',
    },
  },
};

// ── Season Priority (for picking the primary season) ───────────────────────

const SEASON_PRIORITY = [
  'smoke_season',
  'winter_ice',
  'fall_prep',
  'spring_cleanup',
  'summer_dry',
  'early_summer',
  'holiday_season',
];

// ── Engine ─────────────────────────────────────────────────────────────────

/**
 * Resolve a tip template string that may contain dynamic references.
 * Tip templates use function references like `${ctx => ctx.homeYearBuilt}`
 * which are stored as actual functions in the data. This function evaluates
 * the `tip` or `homeTip` field, which may be a string or contain embedded
 * function calls for dynamic values.
 *
 * @param {string|null} template
 * @param {object} ctx
 * @returns {string|null}
 */
function resolveTip(template, ctx) {
  if (!template) return null;
  return template.replace(/\{\{year\}\}/g, String(ctx.homeYearBuilt || ''));
}

/**
 * Find the best matching tip for a season + home context.
 *
 * @param {string} seasonKey
 * @param {object} ctx  { homeYearBuilt, homePropertyType }
 * @returns {{ tip: string, homeTip: string|null }}
 */
function findBestTip(seasonKey, ctx) {
  const tips = SEASONAL_TIPS[seasonKey];
  if (!tips || tips.length === 0) {
    return { tip: '', homeTip: null };
  }

  for (const entry of tips) {
    if (entry.condition && !entry.condition(ctx)) continue;
    return {
      tip: resolveTip(entry.tip, ctx),
      homeTip: resolveTip(entry.homeTip, ctx),
    };
  }

  // Fallback to last (generic) tip
  const last = tips[tips.length - 1];
  return {
    tip: resolveTip(last.tip, ctx),
    homeTip: resolveTip(last.homeTip, ctx),
  };
}

/**
 * Get the seasonal context for a given date and home.
 *
 * @param {object} [options]
 * @param {Date}   [options.date]             Defaults to now
 * @param {number} [options.latitude]         Informational for v1 (PNW-only)
 * @param {number} [options.longitude]        Informational for v1 (PNW-only)
 * @param {number} [options.homeYearBuilt]    Enables home-age-specific tips
 * @param {string} [options.homePropertyType] e.g. 'house', 'condo', 'townhouse'
 * @returns {SeasonalContext}
 */
function getSeasonalContext(options = {}) {
  const date = options.date || new Date();
  const month = date.getMonth(); // 0-indexed
  const hasCoords = options.latitude != null && options.longitude != null;
  const isRelevantRegion = !hasCoords || isSupportedSeasonalRegion(options);

  if (!isRelevantRegion) {
    return {
      active_seasons: [],
      primary_season: null,
      seasonal_tip: null,
      suggested_gig_categories: [],
      home_specific_tip: null,
      urgency: 'low',
      first_action_nudge: null,
      is_relevant_region: false,
    };
  }

  const ctx = {
    homeYearBuilt: options.homeYearBuilt || null,
    homePropertyType: options.homePropertyType || null,
  };

  // 1. Find all active seasons for this month
  const activeSeasons = [];
  for (const [key, season] of Object.entries(SEASONS)) {
    if (season.months.includes(month)) {
      activeSeasons.push(key);
    }
  }

  // 2. Pick primary season by priority
  const primarySeason = SEASON_PRIORITY.find(s => activeSeasons.includes(s)) || activeSeasons[0] || 'early_summer';

  // 3. Get the best tip for the primary season
  const { tip, homeTip } = findBestTip(primarySeason, ctx);

  // 4. Get gig suggestions for the primary season
  const gigSuggestion = SEASONAL_GIG_SUGGESTIONS[primarySeason] || SEASONAL_GIG_SUGGESTIONS.early_summer;

  // 5. Determine overall urgency (take highest from active seasons)
  const urgencyRank = { high: 3, moderate: 2, low: 1 };
  let maxUrgency = 'low';
  for (const key of activeSeasons) {
    const u = SEASONS[key].urgency;
    if ((urgencyRank[u] || 0) > (urgencyRank[maxUrgency] || 0)) {
      maxUrgency = u;
    }
  }

  return {
    active_seasons: activeSeasons,
    primary_season: primarySeason,
    seasonal_tip: tip,
    suggested_gig_categories: gigSuggestion.categories,
    home_specific_tip: homeTip,
    urgency: maxUrgency,
    first_action_nudge: gigSuggestion.nudge,
    is_relevant_region: true,
  };
}

module.exports = { getSeasonalContext, isSupportedSeasonalRegion, SEASONS, SEASONAL_TIPS };
