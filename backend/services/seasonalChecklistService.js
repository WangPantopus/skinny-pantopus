/**
 * Seasonal Checklist Service
 *
 * Generates and manages per-home seasonal maintenance checklists.
 * Items are defined statically per season and conditionally filtered
 * based on home characteristics (type, age). Once generated for a
 * home + season + year, items are persisted in HomeSeasonalChecklistItem
 * and returned on subsequent calls (idempotent).
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { getSeasonalContext } = require('./ai/seasonalEngine');

// ── Checklist definitions per season ─────────────────────────────────────────
// Each item may have an optional `condition(home)` function. If present, the
// item is only included when the condition returns true.

const SEASON_CHECKLISTS = {
  spring_cleanup: [
    { item_key: 'gutter_cleaning', title: 'Clean gutters and downspouts', description: 'Remove debris from winter. Check for damage.', gig_category: 'Cleaning', gig_title: 'Gutter cleaning needed', sort: 1 },
    { item_key: 'moss_removal', title: 'Remove roof and walkway moss', description: 'Moss damages roofing. Treat early.', gig_category: 'Cleaning', gig_title: 'Roof moss removal', sort: 2, condition: (home) => home.home_type === 'house' },
    { item_key: 'pressure_washing', title: 'Pressure wash siding and driveway', description: 'Winter grime buildup.', gig_category: 'Cleaning', gig_title: 'Pressure washing needed', sort: 3 },
    { item_key: 'hvac_filter', title: 'Replace HVAC filter', description: 'Change to spring/summer filter.', gig_category: 'Handyman', gig_title: 'HVAC filter replacement', sort: 4 },
  ],

  fall_prep: [
    { item_key: 'gutter_cleaning', title: 'Clean gutters before rain season', gig_category: 'Cleaning', gig_title: 'Gutter cleaning needed', sort: 1 },
    { item_key: 'furnace_inspection', title: 'Inspect and service furnace', gig_category: 'Handyman', gig_title: 'Furnace inspection and service', sort: 2 },
    { item_key: 'weatherstripping', title: 'Check and replace weatherstripping', gig_category: 'Handyman', gig_title: 'Weatherstripping replacement', sort: 3 },
    { item_key: 'leaf_removal', title: 'Clear yard of fallen leaves', gig_category: 'Gardening', gig_title: 'Leaf removal and yard cleanup', sort: 4, condition: (home) => home.home_type === 'house' },
    { item_key: 'roof_inspection', title: 'Visual roof inspection', description: 'Check for missing shingles, damage.', gig_category: 'Handyman', gig_title: 'Roof inspection', sort: 5, condition: (home) => home.year_built && home.year_built < 2000 },
  ],

  winter_ice: [
    { item_key: 'pipe_insulation', title: 'Insulate exposed pipes', gig_category: 'Handyman', gig_title: 'Pipe insulation for winter', sort: 1 },
    { item_key: 'deicing_supplies', title: 'Stock de-icing supplies', description: 'Salt, sand, ice scraper.', sort: 2 },
    { item_key: 'emergency_kit', title: 'Check emergency supplies', description: 'Flashlights, batteries, water.', sort: 3 },
  ],

  summer_dry: [
    { item_key: 'sprinkler_check', title: 'Test sprinkler system', gig_category: 'Gardening', gig_title: 'Sprinkler system check', sort: 1, condition: (home) => home.home_type === 'house' },
    { item_key: 'ac_service', title: 'Service air conditioning', gig_category: 'Handyman', gig_title: 'AC service and filter change', sort: 2 },
    { item_key: 'deck_maintenance', title: 'Inspect and treat deck', gig_category: 'Handyman', gig_title: 'Deck staining and repair', sort: 3 },
  ],

  early_summer: [
    { item_key: 'lawn_care', title: 'First mow and edge of the season', description: 'Set mower blade high for spring growth.', gig_category: 'Gardening', gig_title: 'Lawn mowing and edging', sort: 1, condition: (home) => home.home_type === 'house' },
    { item_key: 'exterior_paint_check', title: 'Inspect exterior paint and caulking', description: 'Touch up before summer heat.', gig_category: 'Handyman', gig_title: 'Exterior paint touch-up', sort: 2 },
    { item_key: 'window_cleaning', title: 'Clean windows inside and out', description: 'Best done before summer pollen.', gig_category: 'Cleaning', gig_title: 'Window cleaning', sort: 3 },
  ],

  smoke_season: [
    { item_key: 'hepa_filter', title: 'Install or replace HEPA air filter', description: 'Essential for wildfire smoke protection.', gig_category: 'Handyman', gig_title: 'HEPA filter installation', sort: 1 },
    { item_key: 'seal_windows', title: 'Seal gaps around windows and doors', description: 'Prevent smoke infiltration.', gig_category: 'Handyman', gig_title: 'Window and door sealing', sort: 2, condition: (home) => home.year_built && home.year_built < 2000 },
    { item_key: 'check_aqi_setup', title: 'Set up AQI alerts on your phone', description: 'Monitor air quality daily during smoke events.', sort: 3 },
  ],

  holiday_season: [
    { item_key: 'light_installation', title: 'Install holiday lights safely', description: 'Check cords for damage. Use outdoor-rated lights.', gig_category: 'Handyman', gig_title: 'Holiday light installation', sort: 1 },
    { item_key: 'deep_clean', title: 'Deep clean before holiday guests', description: 'Kitchen, bathrooms, guest rooms.', gig_category: 'Cleaning', gig_title: 'Holiday deep cleaning', sort: 2 },
    { item_key: 'package_security', title: 'Set up package theft prevention', description: 'Delivery instructions, camera, neighbor coordination.', sort: 3 },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch home characteristics needed for condition filtering.
 * Tries PropertyIntelligenceCache first, falls back to Home table.
 */
async function getHomeContext(homeId) {
  // Try cache first for richer data
  const { data: cached, error: cacheError } = await supabaseAdmin
    .from('PropertyIntelligenceCache')
    .select('profile')
    .eq('home_id', homeId)
    .maybeSingle();

  if (cacheError) throw new Error('Current home characteristics could not be loaded.');
  if (cached?.profile) {
    return {
      home_type: cached.profile.property_type || null,
      year_built: cached.profile.year_built || null,
    };
  }

  // Fall back to Home table
  const { data: home, error: homeError } = await supabaseAdmin
    .from('Home')
    .select('home_type, year_built')
    .eq('id', homeId)
    .maybeSingle();

  if (homeError || !home) throw new Error('Current home characteristics could not be loaded.');
  return {
    home_type: home?.home_type || null,
    year_built: home?.year_built || null,
  };
}

/**
 * Filter checklist definitions through their condition functions.
 */
function filterItems(definitions, homeContext) {
  return definitions.filter(item => {
    if (!item.condition) return true;
    return item.condition(homeContext);
  });
}

// ── Season succession (for carryover logic) ─────────────────────────────────
// Maps each season to its immediate predecessor in the calendar cycle.
const PREVIOUS_SEASON = {
  spring_cleanup: { key: 'winter_ice',     yearOffset: 0 },
  early_summer:   { key: 'spring_cleanup', yearOffset: 0 },
  summer_dry:     { key: 'early_summer',   yearOffset: 0 },
  smoke_season:   { key: 'summer_dry',     yearOffset: 0 },
  fall_prep:      { key: 'smoke_season',   yearOffset: 0 },
  holiday_season: { key: 'fall_prep',      yearOffset: 0 },
  winter_ice:     { key: 'holiday_season', yearOffset: 0 },  // Dec→Nov same year; Jan/Feb→prev year handled below
};

/**
 * Resolve the previous season key and year for carryover lookup.
 */
function getPreviousSeason(seasonKey, year) {
  const prev = PREVIOUS_SEASON[seasonKey];
  if (!prev) return null;
  let prevYear = year + (prev.yearOffset || 0);
  // winter_ice spans Dec-Feb. If we're in Jan/Feb (winter_ice), the previous
  // holiday_season was the same year's Nov-Dec. But if we just entered
  // spring_cleanup in March, winter_ice was mostly the same year (Jan-Feb)
  // or prior year (Dec). To be safe, query both current and prior year.
  if (seasonKey === 'spring_cleanup') {
    // winter_ice could be year or year-1 (Dec of prev year)
    return { key: prev.key, years: [year, year - 1] };
  }
  if (seasonKey === 'winter_ice') {
    // holiday_season is Nov-Dec, same year if month=Dec, prior year if Jan/Feb
    const month = new Date().getMonth();
    if (month <= 1) prevYear = year - 1;
    return { key: prev.key, years: [prevYear] };
  }
  return { key: prev.key, years: [prevYear] };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get or create the seasonal checklist for a home.
 * Idempotent — calling twice returns the same persisted items.
 *
 * @param {string} homeId     UUID of the Home
 * @param {string} seasonKey  e.g. 'spring_cleanup', 'fall_prep'
 * @param {number} year       e.g. 2026
 * @param {object} [options]
 * @param {boolean} [options.includePrevious]  When true, also return incomplete
 *   items from the previous season as a `carryover` array.
 * @returns {Promise<{ items: Array, carryover?: Array }>}
 */
async function getOrCreateChecklist(homeId, seasonKey, year, options = {}) {
  // 1. Check for existing items
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('HomeSeasonalChecklistItem')
    .select('*')
    .eq('home_id', homeId)
    .eq('season_key', seasonKey)
    .eq('year', year)
    .order('sort_order', { ascending: true });

  if (fetchError || !Array.isArray(existing)) {
    logger.error('Failed to fetch seasonal checklist', { homeId, seasonKey, year, error: fetchError?.message || 'Missing checklist rows' });
    throw new Error('Current seasonal checklist could not be loaded.');
  }

  let items;

  if (existing && existing.length > 0) {
    items = existing;
  } else {
    // 2. No items yet — generate from definitions
    const definitions = SEASON_CHECKLISTS[seasonKey];
    if (!definitions) {
      logger.warn('No checklist definitions for season', { seasonKey });
      items = [];
    } else {
      const homeContext = await getHomeContext(homeId);
      const applicable = filterItems(definitions, homeContext);

      if (applicable.length === 0) {
        items = [];
      } else {
        const rows = applicable.map(item => ({
          home_id: homeId,
          season_key: seasonKey,
          year,
          item_key: item.item_key,
          title: item.title,
          description: item.description || null,
          gig_category: item.gig_category || null,
          gig_title_suggestion: item.gig_title || null,
          sort_order: item.sort,
          status: 'pending',
        }));

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('HomeSeasonalChecklistItem')
          .insert(rows)
          .select('*');

        if (insertError) {
          // Handle race condition: another request may have inserted concurrently
          if (insertError.code === '23505') {
            logger.info('Seasonal checklist race — fetching existing', { homeId, seasonKey, year });
            const { data: reFetched, error: retryError } = await supabaseAdmin
              .from('HomeSeasonalChecklistItem')
              .select('*')
              .eq('home_id', homeId)
              .eq('season_key', seasonKey)
              .eq('year', year)
              .order('sort_order', { ascending: true });
            if (retryError || !Array.isArray(reFetched) || reFetched.length === 0) throw new Error('Current seasonal checklist could not be loaded after concurrent creation.');
            items = reFetched || [];
          } else {
            logger.error('Failed to insert seasonal checklist', { homeId, seasonKey, year, error: insertError.message });
            throw new Error('The seasonal checklist could not be created.');
          }
        } else {
          // Sort before returning (insert may not preserve order)
          if (!Array.isArray(inserted) || inserted.length === 0) throw new Error('The seasonal checklist creation could not be confirmed.');
          items = inserted.sort((a, b) => a.sort_order - b.sort_order);
        }
      }
    }
  }

  // 3. Optionally fetch incomplete items from the previous season
  if (!options.includePrevious) return items;

  const prev = getPreviousSeason(seasonKey, year);
  if (!prev) return { items, carryover: [] };

  const { data: prevItems, error: prevError } = await supabaseAdmin
    .from('HomeSeasonalChecklistItem')
    .select('*')
    .eq('home_id', homeId)
    .eq('season_key', prev.key)
    .in('year', prev.years)
    .eq('status', 'pending')
    .order('sort_order', { ascending: true });

  if (prevError || !Array.isArray(prevItems)) {
    logger.warn('Failed to fetch previous season carryover', { homeId, prevKey: prev.key, error: prevError?.message || 'Missing previous checklist rows' });
    throw new Error('Previous seasonal checklist items could not be loaded.');
  }

  return { items, carryover: prevItems || [] };
}

/**
 * Update a checklist item's status.
 *
 * @param {string} homeId  Exact requested Home
 * @param {string} itemId  UUID of the HomeSeasonalChecklistItem
 * @param {string} status  'completed' or 'skipped'
 * @param {string} userId  UUID of the user performing the action
 * @returns {Promise<object|null>}  Confirmed current item; throws on unavailable or denied changes
 */
async function updateChecklistItem(homeId, itemId, status, userId) {
  const { data, error } = await supabaseAdmin.rpc('update_home_seasonal_item', {
    p_home_id: homeId, p_actor_id: userId, p_item_id: itemId, p_status: status,
  }).catch(() => ({ data: null, error: true }));
  if (error || !data || typeof data.ok !== 'boolean') {
    throw Object.assign(new Error('The checklist change could not be confirmed. Reload before retrying.'), {
      code: 'HOME_CHECKLIST_UNAVAILABLE', statusCode: 503,
    });
  }
  if (!data.ok) {
    const errors = {
      HOME_CHECKLIST_INVALID: [400, 'Invalid checklist change.'],
      HOME_NOT_FOUND: [404, 'Home not found.'],
      HOME_CHECKLIST_NOT_FOUND: [404, 'Checklist item not found in this home.'],
      HOME_CHECKLIST_DENIED: [403, 'Current permission to edit this checklist is unavailable.'],
      HOME_CHECKLIST_CHANGED: [409, 'This checklist item changed. Reload its current state before continuing.'],
      HOME_CHECKLIST_LINKED: [409, 'This checklist item is linked to hired help. Open the current gig before changing it.'],
    };
    const known = errors[data.code];
    throw Object.assign(new Error(known?.[1] || 'The checklist change could not be confirmed. Reload before retrying.'), {
      code: known ? data.code : 'HOME_CHECKLIST_UNAVAILABLE', statusCode: known?.[0] || 503,
    });
  }
  if (data.item?.home_id !== homeId || data.item?.id !== itemId || data.item?.status !== status) {
    throw Object.assign(new Error('The checklist confirmation did not match this item. Reload before retrying.'), {
      code: 'HOME_CHECKLIST_UNAVAILABLE', statusCode: 503,
    });
  }
  return data.item;
}

/**
 * Link a gig to a checklist item and mark it as 'hired'.
 *
 * @param {string} itemId  UUID of the HomeSeasonalChecklistItem
 * @param {string} gigId   UUID of the created Gig
 * @returns {Promise<object|null>}  Confirmed current item; throws on unavailable or denied changes
 */
async function linkGigToChecklist(itemId, gigId) {
  const { data, error } = await supabaseAdmin
    .from('HomeSeasonalChecklistItem')
    .update({ gig_id: gigId, status: 'hired' })
    .eq('id', itemId)
    .select('*')
    .single();

  if (error) {
    logger.error('Failed to link gig to checklist item', { itemId, gigId, error: error.message });
    return null;
  }

  return data;
}

/**
 * Get all past checklists for a home, grouped by season_key + year.
 *
 * @param {string} homeId  UUID of the Home
 * @returns {Promise<Array<{ season: { key: string, label: string }, year: number, items: Array, progress: object }>>}
 */
async function getChecklistHistory(homeId) {
  const { data, error } = await supabaseAdmin
    .from('HomeSeasonalChecklistItem')
    .select('*')
    .eq('home_id', homeId)
    .order('year', { ascending: false })
    .order('sort_order', { ascending: true });

  if (error) {
    logger.error('Failed to fetch checklist history', { homeId, error: error.message });
    throw new Error('Seasonal checklist history could not be loaded.');
  }

  if (!data || data.length === 0) return [];

  // Group by season_key + year
  const groups = {};
  for (const item of data) {
    const groupKey = `${item.season_key}::${item.year}`;
    if (!groups[groupKey]) {
      groups[groupKey] = { seasonKey: item.season_key, year: item.year, items: [] };
    }
    groups[groupKey].items.push(item);
  }

  // Import SEASONS for labels (already required at top of file)
  const { SEASONS } = require('./ai/seasonalEngine');
  const SEASON_PRIORITY_ORDER = [
    'smoke_season', 'winter_ice', 'fall_prep', 'spring_cleanup',
    'summer_dry', 'early_summer', 'holiday_season',
  ];

  return Object.values(groups)
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const aPri = SEASON_PRIORITY_ORDER.indexOf(a.seasonKey);
      const bPri = SEASON_PRIORITY_ORDER.indexOf(b.seasonKey);
      return aPri - bPri;
    })
    .map(group => {
      const seasonDef = SEASONS[group.seasonKey] || {};
      const completed = group.items.filter(i =>
        i.status === 'completed' || i.status === 'skipped' || i.status === 'hired'
      ).length;
      return {
        season: { key: group.seasonKey, label: seasonDef.label || group.seasonKey },
        year: group.year,
        items: group.items,
        progress: {
          total: group.items.length,
          completed,
          percentage: group.items.length > 0 ? Math.round((completed / group.items.length) * 100) : 0,
        },
      };
    });
}

module.exports = { getOrCreateChecklist, updateChecklistItem, linkGigToChecklist, getChecklistHistory, SEASON_CHECKLISTS };
