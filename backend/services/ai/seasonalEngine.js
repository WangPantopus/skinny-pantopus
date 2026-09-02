/**
 * Seasonal Intelligence Engine — national, by climate region.
 *
 * A deterministic service (no AI/LLM calls, no external APIs, no DB queries)
 * that returns seasonal context based on the current date, the home's
 * climate region, and optional home characteristics. Critical for the
 * cold-start Pulse and the Hub briefing — useful, honest content with zero
 * community data.
 *
 * It shipped Pacific-Northwest-only and failed closed everywhere else. It
 * now resolves one of twelve climate regions from the home's state (or,
 * failing that, coarse coordinates), runs the month-based base calendar
 * everywhere minus the seasons that do not apply to a region, layers the
 * region's own seasons on top (hurricane, tornado, monsoon, heat,
 * wildfire, winter storm, pollen), and serves tip copy that never claims
 * a statistic about somewhere the home is not. The original PNW copy is
 * kept verbatim for the PNW.
 */

// ── Climate regions ─────────────────────────────────────────────────────

const REGION_BY_STATE = {
  WA: 'pacific_northwest', OR: 'pacific_northwest', ID: 'pacific_northwest',
  CA: 'california',
  AZ: 'southwest', NM: 'southwest', NV: 'southwest', UT: 'southwest',
  CO: 'mountain', MT: 'mountain', WY: 'mountain',
  ND: 'northern_plains', SD: 'northern_plains', NE: 'northern_plains', KS: 'northern_plains',
  MN: 'upper_midwest', WI: 'upper_midwest', MI: 'upper_midwest', IA: 'upper_midwest',
  IL: 'ohio_valley', IN: 'ohio_valley', OH: 'ohio_valley', KY: 'ohio_valley', WV: 'ohio_valley', MO: 'ohio_valley', TN: 'ohio_valley',
  NY: 'northeast', NJ: 'northeast', PA: 'northeast', CT: 'northeast', RI: 'northeast', MA: 'northeast', VT: 'northeast',
  NH: 'northeast', ME: 'northeast', MD: 'northeast', DE: 'northeast', DC: 'northeast',
  VA: 'southeast', NC: 'southeast', SC: 'southeast', GA: 'southeast', FL: 'southeast', AL: 'southeast',
  TX: 'south_central', OK: 'south_central', AR: 'south_central', LA: 'south_central', MS: 'south_central',
  AK: 'alaska',
  HI: 'hawaii',
};

/**
 * Region config: which BASE seasons do not apply, and which regional
 * seasons overlay the base calendar (with their months, 0-indexed).
 */
const REGIONS = {
  pacific_northwest: { label: 'Pacific Northwest', exclude: [], overlays: {} },
  california: {
    label: 'California',
    exclude: ['smoke_season', 'winter_ice'],
    overlays: { wildfire_season: [5, 6, 7, 8, 9], heat_season: [5, 6, 7, 8], winter_storm_season: [10, 11, 0, 1, 2] },
  },
  southwest: {
    label: 'Southwest',
    exclude: ['smoke_season'],
    overlays: { heat_season: [4, 5, 6, 7, 8], monsoon_season: [5, 6, 7, 8], wildfire_season: [4, 5] },
  },
  mountain: {
    label: 'Mountain West',
    exclude: ['smoke_season'],
    overlays: { wildfire_season: [5, 6, 7, 8], blizzard_season: [10, 11, 0, 1, 2] },
  },
  northern_plains: {
    label: 'Northern Plains',
    exclude: ['smoke_season'],
    overlays: { tornado_season: [3, 4, 5, 6], blizzard_season: [10, 11, 0, 1, 2] },
  },
  upper_midwest: {
    label: 'Upper Midwest',
    exclude: ['smoke_season'],
    overlays: { tornado_season: [3, 4, 5, 6], blizzard_season: [10, 11, 0, 1, 2] },
  },
  ohio_valley: {
    label: 'Ohio Valley',
    exclude: ['smoke_season'],
    overlays: { tornado_season: [2, 3, 4, 5], heat_season: [5, 6, 7] },
  },
  northeast: {
    label: 'Northeast',
    exclude: ['smoke_season'],
    overlays: { hurricane_season: [7, 8, 9], winter_storm_season: [10, 11, 0, 1, 2] },
  },
  southeast: {
    label: 'Southeast',
    exclude: ['smoke_season'],
    overlays: { hurricane_season: [5, 6, 7, 8, 9, 10], heat_season: [5, 6, 7, 8], pollen_season: [2, 3, 4], tornado_season: [2, 3, 4] },
  },
  south_central: {
    label: 'South Central',
    exclude: ['smoke_season'],
    overlays: { tornado_season: [2, 3, 4, 5], hurricane_season: [5, 6, 7, 8, 9, 10], heat_season: [5, 6, 7, 8], pollen_season: [2, 3] },
  },
  alaska: {
    label: 'Alaska',
    exclude: ['smoke_season', 'summer_dry'],
    overlays: { freeze_season: [9, 10, 11, 0, 1, 2, 3], wildfire_season: [5, 6, 7] },
  },
  hawaii: {
    label: 'Hawaii',
    exclude: ['winter_ice', 'smoke_season'],
    overlays: { hurricane_season: [5, 6, 7, 8, 9, 10] },
  },
};

/**
 * Coarse coordinate fallback for callers that have no state code. Bands
 * are deliberately rough — a home row always carries `state`, which wins.
 */
function regionFromCoords(lat, lng) {
  if (lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154) return 'hawaii';
  if (lat > 51 && (lng < -129 || lng > 170)) return 'alaska';
  if (lat < 24 || lat > 50 || lng < -125 || lng > -66) return null; // not the contiguous US
  if (lng < -114) return lat >= 42 ? 'pacific_northwest' : 'california';
  if (lng < -102) return lat >= 37 ? 'mountain' : 'southwest';
  if (lng < -94) return lat >= 37 ? 'northern_plains' : 'south_central';
  if (lng < -84) {
    if (lat >= 41.5) return 'upper_midwest';
    if (lat >= 36.5) return 'ohio_valley';
    return lng < -88 ? 'south_central' : 'southeast';
  }
  return lat >= 39.5 ? 'northeast' : 'southeast';
}

/**
 * Resolve the climate region for a home. The state code is authoritative;
 * coordinates are the fallback; with neither we do not know and say so.
 * @param {{ state?: string, latitude?: number, longitude?: number }} options
 * @returns {string|null}
 */
function resolveClimateRegion(options = {}) {
  const state = typeof options.state === 'string' ? options.state.trim().toUpperCase() : '';
  if (state && REGION_BY_STATE[state]) return REGION_BY_STATE[state];
  const latitude = Number(options.latitude);
  const longitude = Number(options.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return regionFromCoords(latitude, longitude);
}

/** Kept for callers that only ask "do we know where this is?" */
function isSupportedSeasonalRegion(options = {}) {
  return resolveClimateRegion(options) != null;
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

// ── Default copy for the base seasons outside the PNW ──────────────────────
// Same shape as SEASONAL_TIPS, no local statistics: nothing here claims a
// number about a place. The PNW keeps its own copy above.

const DEFAULT_TIPS = {
  winter_ice: [
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt < 1990,
      tip: 'Freeze season. Protect outdoor faucets and exposed pipes, and keep de-icing supplies handy.',
      homeTip: 'Your {{year}} home may have original plumbing. Pipe insulation and heat tape prevent costly freeze damage.',
    },
    { tip: 'Freeze season. Protect outdoor faucets and exposed pipes, and keep de-icing supplies handy.', homeTip: null },
  ],
  spring_cleanup: [
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt < 1990,
      tip: 'Spring cleanup season: gutters, pressure washing, and yard cleanup are the top residential jobs right now.',
      homeTip: "Your {{year}} home's gutters and siding take the most wear over winter; a spring check catches small problems early.",
    },
    { tip: 'Spring cleanup season: gutters, pressure washing, and yard cleanup are the top residential jobs right now.', homeTip: null },
  ],
  early_summer: [
    { tip: 'Early summer is the window for outdoor projects: decks, paint, and landscaping before the heat peaks.', homeTip: null },
  ],
  summer_dry: [
    { tip: 'Peak summer: water early in the morning, watch for local watering restrictions, and keep AC filters fresh.', homeTip: null },
  ],
  smoke_season: [
    { tip: 'Wildfire smoke can reach far from any fire. Check the AQI on hazy days and run HVAC on recirculate with a good filter.', homeTip: null },
  ],
  fall_prep: [
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt < 1990,
      tip: 'Fall is gutter season: clear gutters and downspouts before the first hard rains, and have the furnace checked.',
      homeTip: 'Your {{year}} home likely has original gutters. A professional cleaning before the rains prevents water damage.',
    },
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt >= 2010,
      tip: 'Fall prep season is here. Even newer homes need gutter cleaning and downspout checks before winter.',
      homeTip: 'Your newer home may have gutter guards, but they still need clearing. Leaves and debris accumulate fast in fall.',
    },
    { tip: 'Fall is gutter season: clear gutters and downspouts before the first hard rains, and have the furnace checked.', homeTip: null },
  ],
  holiday_season: [
    { tip: 'Package theft peaks in December. Consider coordinating with neighbors for delivery watching.', homeTip: null },
  ],
};

// ── Regional seasons (overlays) ────────────────────────────────────────────
// Facts only: season dates are the NWS / NOAA definitions; the advice is
// the standard preparedness guidance, with no invented local numbers.

const OVERLAYS = {
  hurricane_season: {
    label: 'Hurricane Season',
    urgency: 'high',
    priority: 1,
    tips: [
      {
        condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt < 2000,
        tip: 'Atlantic hurricane season runs June 1 to November 30 and peaks in September. Know your evacuation zone and keep a week of water and medication.',
        homeTip: 'Older roofs and windows fail first in high wind. Hurricane straps, shutters, and a garage-door brace are the highest-value upgrades for your {{year}} home.',
      },
      {
        tip: 'Atlantic hurricane season runs June 1 to November 30 and peaks in September. Know your evacuation zone, keep a week of water and medication, and photograph your home for insurance before a storm is named.',
        homeTip: null,
      },
    ],
    gigs: { categories: ['Handyman', 'Cleaning'], nudge: 'Post a task to clear gutters and secure loose outdoor items before the September peak.' },
  },
  tornado_season: {
    label: 'Tornado Season',
    urgency: 'high',
    priority: 2,
    tips: [
      {
        tip: 'Tornado season peaks in spring. Know your safe room — the lowest interior room with no windows — and keep weather alerts on overnight.',
        homeTip: null,
      },
    ],
    gigs: { categories: ['Handyman'], nudge: 'Post a task to trim dead limbs and secure anything in the yard that could become a projectile.' },
  },
  monsoon_season: {
    label: 'Monsoon Season',
    urgency: 'moderate',
    priority: 4,
    tips: [
      {
        tip: 'The Southwest monsoon runs June 15 to September 30: flash floods and dust storms arrive fast. Never drive through a flooded wash, and clear roof drains before the first storms.',
        homeTip: null,
      },
    ],
    gigs: { categories: ['Handyman', 'Cleaning'], nudge: 'Post a task to clear roof drains and scuppers before the monsoon storms.' },
  },
  heat_season: {
    label: 'Extreme Heat Season',
    urgency: 'high',
    priority: 3,
    tips: [
      {
        condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt < 1990,
        tip: 'Extreme heat is the deadliest weather in the United States. Check on older neighbors, keep AC filters fresh, and know the nearest cooling center.',
        homeTip: 'Older homes lose cool air through attic and duct leaks; an attic insulation and duct-seal check pays back fastest for your {{year}} home.',
      },
      {
        tip: 'Extreme heat is the deadliest weather in the United States. Check on older neighbors, keep AC filters fresh, and know the nearest cooling center.',
        homeTip: null,
      },
    ],
    gigs: { categories: ['Handyman', 'Cleaning'], nudge: 'Post a task for an AC filter change and a window-shade install before the next heat wave.' },
  },
  wildfire_season: {
    label: 'Wildfire Season',
    urgency: 'high',
    priority: 2,
    tips: [
      {
        tip: 'Wildfire season: keep the first five feet around the house free of dry vegetation, clear needles from the roof and gutters, and check the AQI on smoke days.',
        homeTip: null,
      },
    ],
    gigs: { categories: ['Gardening', 'Cleaning'], nudge: 'Post a task to clear brush and roof debris from the home ignition zone.' },
  },
  winter_storm_season: {
    label: 'Winter Storm Season',
    urgency: 'moderate',
    priority: 5,
    tips: [
      {
        tip: 'Winter storm season: clear gutters before the rains, know where your water shutoff is, and keep a flashlight and a charged battery pack by the door.',
        homeTip: null,
      },
    ],
    gigs: { categories: ['Handyman', 'Cleaning'], nudge: 'Post a task to clear gutters and check the sump pump before the first big storm.' },
  },
  blizzard_season: {
    label: 'Blizzard Season',
    urgency: 'high',
    priority: 3,
    tips: [
      {
        tip: 'Blizzard season: insulate exposed pipes, keep the furnace filter fresh, and have sand or salt ready before the first storm.',
        homeTip: null,
      },
    ],
    gigs: { categories: ['Handyman'], nudge: 'Post a task for snow removal or a furnace check before the first storm.' },
  },
  freeze_season: {
    label: 'Deep-Freeze Season',
    urgency: 'high',
    priority: 3,
    tips: [
      {
        tip: 'Deep-freeze season: heat tape on exposed lines, engine block heaters plugged in, and a carbon monoxide alarm tested.',
        homeTip: null,
      },
    ],
    gigs: { categories: ['Handyman'], nudge: 'Post a task to winterize exposed plumbing before the first hard freeze.' },
  },
  pollen_season: {
    label: 'Pollen Season',
    urgency: 'low',
    priority: 6,
    tips: [
      {
        tip: 'Pollen season: change HVAC filters monthly, keep windows closed on high-count mornings, and check the daily pollen forecast.',
        homeTip: null,
      },
    ],
    gigs: { categories: ['Cleaning'], nudge: 'Post a task for a filter change and a pressure wash once the pollen settles.' },
  },
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
function findBestTip(seasonKey, ctx, table = SEASONAL_TIPS) {
  const tips = table[seasonKey];
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

  // Region-specific COPY requires knowing the region. Without a state or
  // coordinates we do not know it and must not claim it, so the tips fail
  // closed; the month-based season calendar still runs everywhere.
  const region = resolveClimateRegion(options);
  const regionCfg = region ? REGIONS[region] : null;
  const inRegion = regionCfg != null;

  const ctx = {
    homeYearBuilt: options.homeYearBuilt || null,
    homePropertyType: options.homePropertyType || null,
  };

  // 1. Base seasons active this month, minus the ones that do not apply here
  const excluded = new Set(regionCfg ? regionCfg.exclude : []);
  const activeSeasons = [];
  for (const [key, season] of Object.entries(SEASONS)) {
    if (season.months.includes(month) && !excluded.has(key)) {
      activeSeasons.push(key);
    }
  }

  // 2. The region's own seasons on top
  const overlayActive = regionCfg
    ? Object.entries(regionCfg.overlays).filter(([, months]) => months.includes(month)).map(([key]) => key)
    : [];
  const regionalSeason = overlayActive.slice().sort((a, b) => OVERLAYS[a].priority - OVERLAYS[b].priority)[0] || null;

  // 3. Primary base season by priority — always a base key, so every
  //    consumer of `primary_season` (checklist, health score) keeps working
  const primarySeason = SEASON_PRIORITY.find((k) => activeSeasons.includes(k)) || activeSeasons[0] || 'early_summer';

  // 4. Copy: the PNW keeps its own; everywhere else gets the number-free
  //    default; an active regional season outranks the base tip
  const baseTips = region === 'pacific_northwest' ? SEASONAL_TIPS : DEFAULT_TIPS;
  const base = findBestTip(primarySeason, ctx, baseTips);
  const overlay = regionalSeason ? findBestTip(regionalSeason, ctx, { [regionalSeason]: OVERLAYS[regionalSeason].tips }) : null;
  // No base season genuinely active this month (Hawaii in January) and no
  // regional season either → no copy, rather than a fallback's copy.
  const baseIsActive = activeSeasons.includes(primarySeason);
  const tip = overlay && overlay.tip ? overlay.tip : (baseIsActive ? base.tip : null);
  const homeTip = overlay && overlay.tip ? overlay.homeTip : (baseIsActive ? base.homeTip : null);

  // 5. Gig suggestions follow the same choice
  const gigSuggestion = regionalSeason
    ? OVERLAYS[regionalSeason].gigs
    : (SEASONAL_GIG_SUGGESTIONS[primarySeason] || SEASONAL_GIG_SUGGESTIONS.early_summer);

  // 6. Urgency: the highest across everything active
  const urgencyRank = { high: 3, moderate: 2, low: 1 };
  let maxUrgency = 'low';
  for (const key of activeSeasons) {
    const u = SEASONS[key].urgency;
    if ((urgencyRank[u] || 0) > (urgencyRank[maxUrgency] || 0)) maxUrgency = u;
  }
  for (const key of overlayActive) {
    const u = OVERLAYS[key].urgency;
    if ((urgencyRank[u] || 0) > (urgencyRank[maxUrgency] || 0)) maxUrgency = u;
  }

  return {
    active_seasons: [...activeSeasons, ...overlayActive],
    primary_season: primarySeason,
    regional_season: regionalSeason,
    region,
    region_label: regionCfg ? regionCfg.label : null,
    seasonal_tip: inRegion ? tip : null,
    suggested_gig_categories: inRegion && tip ? gigSuggestion.categories : [],
    home_specific_tip: inRegion ? homeTip : null,
    urgency: maxUrgency,
    first_action_nudge: inRegion && tip ? gigSuggestion.nudge : null,
    is_relevant_region: inRegion,
  };
}

module.exports = {
  getSeasonalContext,
  isSupportedSeasonalRegion,
  resolveClimateRegion,
  SEASONS,
  SEASONAL_TIPS,
  DEFAULT_TIPS,
  OVERLAYS,
  REGIONS,
  REGION_BY_STATE,
};
