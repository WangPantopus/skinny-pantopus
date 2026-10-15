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
const { getSeasonalContext, OVERLAYS } = require('./ai/seasonalEngine');
const { invalidateHealthScoreCache } = require('./homeHealthService');

// ── Checklist definitions per season ─────────────────────────────────────────
// Each item may have an optional `condition(home)` function. If present, the
// item is only included when the condition returns true.

const SEASON_CHECKLISTS = {
  spring_cleanup: [
    { item_key: 'gutter_cleaning', title: 'Clean gutters and downspouts', description: 'Remove debris from winter. Check for damage.', gig_category: 'Cleaning', gig_title: 'Gutter cleaning needed', sort: 1 },
    { item_key: 'moss_removal', title: 'Remove roof and walkway moss', description: 'Moss damages roofing. Treat early.', gig_category: 'Cleaning', gig_title: 'Roof moss removal', sort: 2, condition: (home) => home.home_type === 'house' && ['WA', 'OR'].includes(home.state) && home.longitude != null && home.longitude < -120.5 },
    { item_key: 'pressure_washing', title: 'Pressure wash siding and driveway', description: 'Winter grime buildup.', gig_category: 'Cleaning', gig_title: 'Pressure washing needed', sort: 3 },
    { item_key: 'hvac_filter', title: 'Replace HVAC filter', description: 'Change to spring/summer filter.', gig_category: 'Handyman', gig_title: 'HVAC filter replacement', sort: 4 },
  ],

  fall_prep: [
    { item_key: 'gutter_cleaning', title: 'Clear leaves from gutters and downspouts', gig_category: 'Cleaning', gig_title: 'Gutter cleaning needed', sort: 1 },
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

// Regional campaigns reuse stable item keys so a changed selection can retain
// the household's existing completion or hired task instead of cloning it.
const emergency = SEASON_CHECKLISTS.winter_ice.find(item => item.item_key === 'emergency_kit');
const ac = SEASON_CHECKLISTS.summer_dry.find(item => item.item_key === 'ac_service');
SEASON_CHECKLISTS.freeze_season = [
  SEASON_CHECKLISTS.winter_ice[0],
  { item_key: 'furnace_inspection', title: 'Check heating before deep freezes', sort: 2 },
  { item_key: 'co_alarm', title: 'Test carbon monoxide alarms', sort: 3 }, emergency,
];
SEASON_CHECKLISTS.blizzard_season = SEASON_CHECKLISTS.winter_ice;
SEASON_CHECKLISTS.winter_storm_season = [
  { item_key: 'gutter_cleaning', title: 'Clear gutters and drainage paths', sort: 1 }, emergency,
];
SEASON_CHECKLISTS.hurricane_season = [
  { item_key: 'storm_plan', title: 'Review local storm and evacuation guidance', description: 'Check local emergency management instructions for your address.', sort: 1 },
  { item_key: 'secure_outdoors', title: 'Plan how to secure loose outdoor items', sort: 2 }, emergency,
];
SEASON_CHECKLISTS.tornado_season = [
  { item_key: 'storm_shelter', title: 'Identify a safe shelter and enable weather alerts', sort: 1 }, emergency,
];
SEASON_CHECKLISTS.heat_season = [ac,
  { item_key: 'cooling_plan', title: 'Plan a cool place to go during extreme heat', sort: 2 },
];
SEASON_CHECKLISTS.monsoon_season = [
  { item_key: 'gutter_cleaning', title: 'Clear roof drains and drainage paths', sort: 1 },
  { item_key: 'flood_plan', title: 'Review flash flood alerts and safe routes', sort: 2 }, emergency,
];
SEASON_CHECKLISTS.wildfire_season = [...SEASON_CHECKLISTS.smoke_season,
  { item_key: 'clear_dry_debris', title: 'Clear dry debris immediately around the home', sort: 4 },
];
SEASON_CHECKLISTS.pollen_season = [
  { item_key: 'hvac_filter', title: 'Check HVAC filters during pollen season', sort: 1 },
  { item_key: 'pollen_forecast', title: 'Check local pollen forecasts', sort: 2 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch home characteristics needed for condition filtering.
 * Geography always comes from Home; cached property facts may enrich type and age.
 */
async function getHomeContext(homeId) {
  const [cache, homeResult] = await Promise.all([
    supabaseAdmin.from('PropertyIntelligenceCache').select('profile').eq('home_id', homeId).maybeSingle(),
    supabaseAdmin.from('Home').select('home_type, year_built, state, map_center_lat, map_center_lng').eq('id', homeId).maybeSingle(),
  ]);
  if (homeResult.error || !homeResult.data) throw new Error('Current home geography could not be loaded.');
  const home = homeResult.data;
  const profile = cache.data?.profile;
  return {
    ...home,
    latitude: home.map_center_lat, longitude: home.map_center_lng,
    home_type: profile?.property_type || home.home_type || null,
    year_built: profile?.year_built || home.year_built || null,
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

// Match the metadata requirements of the existing native checklist readers.
// Older rows can satisfy SQL types while still being unusable checklist items.
function assertChecklistMetadata(items) {
  if (items.some(item => !item
    || typeof item.title !== 'string' || !item.title.trim()
    || typeof item.item_key !== 'string' || !item.item_key.trim()
    || !Number.isInteger(item.sort_order) || item.sort_order < 0
    || (item.completed_at != null && (typeof item.completed_at !== 'string'
      || !Number.isFinite(Date.parse(item.completed_at)))))) {
    throw new Error('Current seasonal checklist contains unavailable item metadata.');
  }
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
function getPreviousSeason(seasonKey, year, month) {
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
  const homeContext = await getHomeContext(homeId);
  const context = getSeasonalContext({ ...homeContext, date: options.date });
  seasonKey = context.checklist_season;
  year = context.year;
  if (!seasonKey) return options.includePrevious ? { items: [], carryover: [] } : [];
  const applicable = filterItems(SEASON_CHECKLISTS[seasonKey] || [], { ...homeContext, region: context.region });
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('HomeSeasonalChecklistItem').select('*').eq('home_id', homeId).eq('year', year)
    .order('sort_order', { ascending: true });
  if (fetchError || !Array.isArray(existing)) throw new Error('Current seasonal checklist could not be loaded.');

  const reusable = definition => existing.find(item => item.item_key === definition.item_key && item.season_key === seasonKey)
    || existing.find(item => item.item_key === definition.item_key && (
      ['pending', 'hired'].includes(item.status) || context.active_seasons.includes(item.season_key)
      // Regional campaigns can replace a base campaign without asking for the same work twice.
      || (OVERLAYS[seasonKey] || OVERLAYS[item.season_key])
    ));
  const retained = applicable.map(reusable).filter(Boolean);
  const missing = applicable.filter(item => !reusable(item));
  let inserted = [];
  if (missing.length) {
    const rows = missing.map(item => ({ home_id: homeId, season_key: seasonKey, year,
      item_key: item.item_key, title: item.title, description: item.description || null,
      gig_category: item.gig_category || null, gig_title_suggestion: item.gig_title || null,
      sort_order: item.sort, status: 'pending' }));
    // Existing unique key handles concurrent readers; ignoreDuplicates never
    // rewrites completed_at, status, gig links, or the history of an old row.
    const { error } = await supabaseAdmin.from('HomeSeasonalChecklistItem')
      .upsert(rows, { onConflict: 'home_id,season_key,year,item_key', ignoreDuplicates: true });
    if (error) throw new Error('The seasonal checklist could not be created.');
    const result = await supabaseAdmin.from('HomeSeasonalChecklistItem').select('*')
      .eq('home_id', homeId).eq('season_key', seasonKey).eq('year', year).in('item_key', missing.map(item => item.item_key));
    if (result.error || !Array.isArray(result.data) || result.data.length !== missing.length) throw new Error('The seasonal checklist creation could not be confirmed.');
    inserted = result.data;
  }
  // Apply current geographic definitions before presenting persisted rows.
  // Inapplicable rows remain available unchanged in checklist history.
  let items = [...retained, ...inserted].sort((a, b) => a.sort_order - b.sort_order);

  assertChecklistMetadata(items);
  items = await releaseClosedHires(homeId, items);
  // Present current regional wording without rewriting historical rows,
  // completion timestamps, or linked work.
  items = items.map(item => {
    const definition = applicable.find(candidate => candidate.item_key === item.item_key);
    return { ...item, title: definition.title, description: definition.description || null, sort_order: definition.sort };
  }).sort((a, b) => a.sort_order - b.sort_order);

  // 3. Optionally fetch incomplete items from the previous season
  if (!options.includePrevious) return items;

  const prev = getPreviousSeason(seasonKey, year, context.month - 1);
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

  assertChecklistMetadata(prevItems);
  const currentKeys = new Set(items.map(item => item.item_key));
  const applicableKeys = new Set(applicable.map(item => item.item_key));
  return { items, carryover: prevItems.filter(item => applicableKeys.has(item.item_key) && !currentKeys.has(item.item_key)) };
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
  // Query builders are thenables without .catch: wrap one so a failed request maps to 503.
  const { data, error } = await Promise.resolve(supabaseAdmin.rpc('update_home_seasonal_item', {
    p_home_id: homeId, p_actor_id: userId, p_item_id: itemId, p_status: status,
  })).catch(() => ({ data: null, error: true }));
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

const LINKABLE_TASK_STATUSES = ['open', 'assigned', 'in_progress'];

/**
 * Link the task a member just posted for a pending checklist item and mark
 * the item hired. The task must be the member's own and still open. Linking
 * the same task again is an acknowledgement, not a new change.
 *
 * @param {string} homeId  Exact requested Home
 * @param {string} itemId  UUID of the HomeSeasonalChecklistItem
 * @param {string} gigId   UUID of the posted Gig
 * @param {string} userId  UUID of the member who posted it
 * @returns {Promise<{ item: object, changed: boolean }>}  Confirmed current item; throws on unavailable or denied links
 */
async function linkGigToChecklist(homeId, itemId, gigId, userId) {
  const fail = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });
  const unavailable = () => fail(503, 'HOME_CHECKLIST_UNAVAILABLE', 'The checklist link could not be confirmed. Reload before retrying.');
  const [contextRes, itemRes, gigRes] = await Promise.all([
    supabaseAdmin.rpc('home_record_context', { p_home_id: homeId, p_user_id: userId }),
    supabaseAdmin.from('HomeSeasonalChecklistItem').select('*').eq('id', itemId).eq('home_id', homeId).maybeSingle(),
    supabaseAdmin.from('Gig').select('id, user_id, status').eq('id', gigId).maybeSingle(),
  ].map(query => Promise.resolve(query).catch(() => ({ data: null, error: true }))));
  const context = contextRes.data;
  if (contextRes.error || itemRes.error || gigRes.error || !context || typeof context.allowed !== 'boolean') throw unavailable();
  // The same current Home fence as a completion: frozen, archived and private setup contexts cannot edit.
  if (!context.allowed || context.private || !Array.isArray(context.permissions) || !context.permissions.includes('home.edit')) {
    throw fail(403, 'HOME_CHECKLIST_DENIED', 'Current permission to edit this checklist is unavailable.');
  }
  const item = itemRes.data;
  if (!item) throw fail(404, 'HOME_CHECKLIST_NOT_FOUND', 'Checklist item not found in this home.');
  const gig = gigRes.data;
  if (!gig || gig.user_id !== userId) throw fail(404, 'HOME_CHECKLIST_TASK_NOT_FOUND', 'That task was not found among your tasks.');
  if (!LINKABLE_TASK_STATUSES.includes(gig.status)) throw fail(409, 'HOME_CHECKLIST_TASK_CLOSED', 'That task is no longer open.');
  if (item.status === 'hired' && item.gig_id === gigId) return { item, changed: false };
  if (item.status === 'hired' || item.gig_id) {
    throw fail(409, 'HOME_CHECKLIST_LINKED', 'This checklist item is linked to hired help. Open the current gig before changing it.');
  }
  if (item.status !== 'pending') throw fail(409, 'HOME_CHECKLIST_CHANGED', 'This checklist item changed. Reload its current state before continuing.');

  const { data: linked, error } = await supabaseAdmin
    .from('HomeSeasonalChecklistItem')
    .update({ gig_id: gigId, status: 'hired' })
    .eq('id', itemId)
    .eq('home_id', homeId)
    .eq('status', 'pending')
    .is('gig_id', null)
    .select('*');

  if (error || !Array.isArray(linked)) {
    logger.error('Failed to link gig to checklist item', { homeId, itemId, gigId, error: error?.message || 'Missing linked row' });
    throw unavailable();
  }
  if (linked.length !== 1) throw fail(409, 'HOME_CHECKLIST_CHANGED', 'This checklist item changed. Reload its current state before continuing.');
  return { item: linked[0], changed: true };
}

/**
 * Return hired items to pending when their task was cancelled or no longer
 * exists, so the item can be done, skipped or hired again. Anything that
 * cannot be confirmed is left as it is.
 *
 * @param {string} homeId  UUID of the Home
 * @param {Array} items    Current checklist rows
 * @returns {Promise<Array>}  The rows, with released items replaced by their current state
 */
async function releaseClosedHires(homeId, items) {
  const linked = items.filter(item => item.status === 'hired' && item.gig_id);
  if (linked.length === 0) return items;

  const { data: gigs, error } = await supabaseAdmin
    .from('Gig')
    .select('id, status')
    .in('id', [...new Set(linked.map(item => item.gig_id))]);
  if (error || !Array.isArray(gigs)) {
    logger.warn('Hired checklist tasks could not be checked', { homeId, error: error?.message || 'Missing task rows' });
    return items;
  }

  const live = new Set(gigs.filter(gig => gig.status !== 'cancelled').map(gig => gig.id));
  const released = new Map();
  for (const item of linked.filter(row => !live.has(row.gig_id))) {
    const { data, error: releaseError } = await supabaseAdmin
      .from('HomeSeasonalChecklistItem')
      .update({ status: 'pending', gig_id: null })
      .eq('id', item.id)
      .eq('home_id', homeId)
      .eq('status', 'hired')
      .eq('gig_id', item.gig_id)
      .select('*');
    if (releaseError || !Array.isArray(data)) {
      logger.warn('Hired checklist item could not be released', { homeId, itemId: item.id, error: releaseError?.message || 'Missing released row' });
    } else if (data.length === 1) {
      logger.info('Released hired checklist item after its task closed', { homeId, itemId: item.id, gigId: item.gig_id });
      released.set(item.id, data[0]);
    }
  }
  if (released.size === 0) return items;
  invalidateHealthScoreCache(homeId);
  return items.map(item => released.get(item.id) || item);
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

  if (!Array.isArray(data)) throw new Error('Seasonal checklist history could not be loaded.');
  if (data.length === 0) return [];

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
      const seasonDef = SEASONS[group.seasonKey] || OVERLAYS[group.seasonKey] || {};
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

module.exports = { getOrCreateChecklist, updateChecklistItem, linkGigToChecklist, releaseClosedHires, getChecklistHistory, SEASON_CHECKLISTS };
