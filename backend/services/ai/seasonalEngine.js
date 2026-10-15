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
 * now resolves a climate region from the home's state (or,
 * failing that, coarse coordinates), runs the month-based base calendar
 * everywhere minus the seasons that do not apply to a region, layers the
 * region's own seasons on top (hurricane, tornado, monsoon, heat,
 * wildfire, winter storm, pollen), and serves tip copy that never claims
 * a statistic about somewhere the home is not. The original PNW copy is
 * kept verbatim for the PNW, except that its sentences naming Clark County
 * or Portland/Vancouver go only to homes there.
 */

const { isInClarkCountyWA, isInOregonMetro } = require('../../utils/geo');

// ── Climate regions ─────────────────────────────────────────────────────

const { states: REGION_BY_STATE, regions: REGIONS, seasons: SEASONS, coordinate_regions: COORDINATE_REGIONS, regional_tips: REGIONAL_TIPS, overlay_regions: OVERLAY_REGIONS } = require('./seasonalClimate.json');
const { resolveHomeTimezone } = require('../../utils/timezone');

/**
 * Coarse coordinate fallback for callers that have no state code. Bands
 * are deliberately rough — a home row always carries `state`, which wins.
 */
function regionFromCoords(lat, lng) {
  return COORDINATE_REGIONS.find(area => lat >= area.lat[0] && lat <= area.lat[1]
    && lng >= area.lng[0] && lng <= area.lng[1])?.region || null;
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
  if (options.latitude == null || options.longitude == null || options.latitude === '' || options.longitude === '') return null;
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
 * Shared seasonal calendar. Months are 0-indexed (0 = January).
 * Seasons can overlap — the engine returns ALL active seasons.
 */


// ── Seasonal Tips ──────────────────────────────────────────────────────────

/**
 * Tips are ordered by specificity — the engine picks the first matching tip.
 * Each tip has an optional `condition` function that receives home context.
 * If no condition, the tip is the generic fallback for that season.
 *
 * Written for the Portland–Vancouver pilot. A tip with `where` names a place
 * and goes only to homes there (PILOT_PLACES); anywhere else in the region
 * gets the default copy for that season instead:
 *   clark_county        Clark County, Washington
 *   portland_vancouver  Clark County or Oregon Metro's district
 */
const SEASONAL_TIPS = {
  winter_ice: [
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt < 1990,
      where: 'portland_vancouver',
      tip: 'Portland/Vancouver averages 3–5 ice events per winter. Homes built before 1990 may have vulnerable pipes — consider insulation.',
      homeTip: 'Your {{year}} home may have original plumbing. Pipe insulation and heat tape can prevent costly freeze damage.',
    },
    {
      condition: (ctx) => ctx.homePropertyType === 'condo' || ctx.homePropertyType === 'townhouse',
      tip: 'Ice season is here. Shared walkways and driveways need de-icing — coordinate with neighbors for supplies.',
      homeTip: 'Your condo/townhouse community may benefit from shared de-icing supplies. Post a gig to get walkways treated.',
    },
    {
      where: 'portland_vancouver',
      tip: 'Portland/Vancouver averages 3–5 ice events per winter. Keep de-icing supplies handy and protect outdoor pipes.',
      homeTip: null,
    },
  ],
  spring_cleanup: [
    {
      condition: (ctx) => ctx.homeYearBuilt && ctx.homeYearBuilt < 1990,
      where: 'clark_county',
      tip: 'Spring cleanup season starts now. Moss removal, gutter flush, and pressure washing are the top needs in Clark County, WA.',
      homeTip: 'Your {{year}} home likely has significant moss buildup after winter. Roof moss treatment now prevents damage later.',
    },
    {
      where: 'clark_county',
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
      where: 'clark_county',
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

/**
 * Is the point in the place a `where` tip names? utils/geo tests it against
 * the official outlines; without coordinates the answer is no.
 */
const PILOT_PLACES = {
  clark_county: (lat, lng) => isInClarkCountyWA(lat, lng),
  portland_vancouver: (lat, lng) => isInClarkCountyWA(lat, lng) || isInOregonMetro(lat, lng),
};

// ── Default copy for the base seasons outside the PNW ──────────────────────
// Same shape as SEASONAL_TIPS, no local statistics: nothing here claims a
// number about a place. The PNW keeps its own copy above, and gets this
// copy where its tip names a place the home is not in.

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
    gigs: { categories: ['Handyman', 'Cleaning'], nudge: 'Post a task to clear gutters and secure loose outdoor items before a storm.' },
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
 * @returns {{ tip: string, homeTip: string|null, where: string|null }}
 */
function findBestTip(seasonKey, ctx, table = SEASONAL_TIPS) {
  const tips = table[seasonKey];
  if (!tips || tips.length === 0) {
    return { tip: '', homeTip: null, where: null };
  }

  for (const entry of tips) {
    if (entry.condition && !entry.condition(ctx)) continue;
    return {
      tip: resolveTip(entry.tip, ctx),
      homeTip: resolveTip(entry.homeTip, ctx),
      where: entry.where || null,
    };
  }

  // Fallback to last (generic) tip
  const last = tips[tips.length - 1];
  return {
    tip: resolveTip(last.tip, ctx),
    homeTip: resolveTip(last.homeTip, ctx),
    where: last.where || null,
  };
}

/**
 * Get the seasonal context for a given date and home.
 *
 * @param {object} [options]
 * @param {Date}   [options.date]             Defaults to now
 * @param {string} [options.state]            Two-letter state code; decides the region
 * @param {number} [options.latitude]         The region without a state, and whether
 * @param {number} [options.longitude]        copy naming the pilot's area applies
 * @param {number} [options.homeYearBuilt]    Enables home-age-specific tips
 * @param {string} [options.homePropertyType] e.g. 'house', 'condo', 'townhouse'
 * @returns {SeasonalContext}
 */
function getSeasonalContext(options = {}) {
  const date = options.date || new Date();
  const localParts = new Intl.DateTimeFormat('en-US', { timeZone: resolveHomeTimezone(options), year: 'numeric', month: 'numeric' }).formatToParts(date);
  const month = Number(localParts.find(part => part.type === 'month').value) - 1;
  const year = Number(localParts.find(part => part.type === 'year').value);

  // Region-specific COPY requires knowing the region. Without a state or
  // coordinates we do not know it and must not claim it, so the tips fail
  // closed; unknown geography also has no selected campaign.
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
    if (inRegion && season.months.includes(month) && !excluded.has(key)) {
      activeSeasons.push(key);
    }
  }

  // 2. The region's own seasons on top
  const overlayActive = regionCfg
    ? Object.entries(regionCfg.overlays).filter(([key, months]) => {
      if (!months.includes(month)) return false;
      const areas = OVERLAY_REGIONS[key];
      if (!areas) return true;
      if (options.latitude == null || options.longitude == null) return ['HI', 'FL', 'LA', 'MS', 'SC', 'NC'].includes(String(options.state || '').trim().toUpperCase());
      return areas.some(area => options.latitude >= area.lat[0] && options.latitude <= area.lat[1]
        && options.longitude >= area.lng[0] && options.longitude <= area.lng[1]);
    }).map(([key]) => key)
    : [];
  const regionalSeason = overlayActive.slice().sort((a, b) => OVERLAYS[a].priority - OVERLAYS[b].priority)[0] || null;

  // 3. Choose an active base campaign for copy; a regional campaign takes
  //    precedence in the returned context. No active campaign means null.
  const primarySeason = SEASON_PRIORITY.find((k) => activeSeasons.includes(k)) || activeSeasons[0] || null;

  // 4. Copy: the PNW keeps its own, unless the tip names a place the home
  //    is not in (or, with a state and no coordinates, may not be in);
  //    everywhere else gets the number-free default; an active regional
  //    season outranks the base tip
  const usesWetNorthwestCopy = region === 'pacific_northwest'
    && options.longitude != null && Number(options.longitude) < -120.5;
  const pnwBase = usesWetNorthwestCopy ? findBestTip(primarySeason, ctx, SEASONAL_TIPS) : null;
  const base = pnwBase && (!pnwBase.where || PILOT_PLACES[pnwBase.where](options.latitude, options.longitude))
    ? pnwBase
    : findBestTip(primarySeason, ctx, DEFAULT_TIPS);
  const overlay = regionalSeason ? findBestTip(regionalSeason, ctx, { [regionalSeason]: OVERLAYS[regionalSeason].tips }) : null;
  // No base season genuinely active this month (Hawaii in January) and no
  // regional season either → no copy, rather than a fallback's copy.
  const baseIsActive = activeSeasons.includes(primarySeason);
  let tip = overlay && overlay.tip ? overlay.tip : (baseIsActive ? base.tip : null);
  if (region === 'hawaii' && regionalSeason === 'hurricane_season') {
    tip = REGIONAL_TIPS.hawaii.hurricane_season[0];
  }
  const homeTip = overlay && overlay.tip ? overlay.homeTip : (baseIsActive ? base.homeTip : null);

  // 5. Gig suggestions follow the same choice
  const gigSuggestion = regionalSeason
    ? OVERLAYS[regionalSeason].gigs
    : SEASONAL_GIG_SUGGESTIONS[primarySeason];

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
    primary_season: regionalSeason || primarySeason,
    checklist_season: regionalSeason || primarySeason,
    year,
    month: month + 1,
    regional_season: regionalSeason,
    region,
    region_label: regionCfg ? regionCfg.label : null,
    seasonal_tip: inRegion ? tip : null,
    suggested_gig_categories: inRegion && tip && gigSuggestion ? gigSuggestion.categories : [],
    home_specific_tip: inRegion ? homeTip : null,
    urgency: maxUrgency,
    first_action_nudge: inRegion && tip && gigSuggestion ? gigSuggestion.nudge : null,
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
