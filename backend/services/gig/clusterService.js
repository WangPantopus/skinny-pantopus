// ============================================================
// clusterService — Groups active gigs by category and detects
// near-duplicate titles within each category.
//
// Exports:
//   getGigClusters({ lat, lng, radiusMeters, limit })
//   getStackedGigs(category, { lat, lng, radiusMeters })
// ============================================================

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { jaccardSimilarity, normalizeTitle } = require('./jaccardUtils');

// ─── Constants ──────────────────────────────────────────────

const DEFAULT_RADIUS_METERS = 40234; // ~25 miles
const DEFAULT_CLUSTER_LIMIT = 6;
const STACK_SIMILARITY_THRESHOLD = 0.6;

// ─── getGigClusters ─────────────────────────────────────────
//
// Query all active gigs within radius, group by category, and
// return aggregated cluster metadata sorted by count desc.

async function getGigClusters({
  lat,
  lng,
  radiusMeters = DEFAULT_RADIUS_METERS,
  limit = DEFAULT_CLUSTER_LIMIT,
  gigs: inputGigs,
  excludeUserId,
} = {}) {
  let gigs = Array.isArray(inputGigs) ? [...inputGigs] : null;

  if (!gigs && (lat == null || lng == null)) {
    return [];
  }

  if (!gigs) {
    // Use the existing spatial RPC to fetch open gigs nearby
    const { data, error } = await supabaseAdmin.rpc('find_gigs_nearby_v2', {
      user_lat: lat,
      user_lon: lng,
      p_radius_meters: radiusMeters,
      p_category: null,
      p_min_price: null,
      p_max_price: null,
      p_search: null,
      p_sort: 'newest',
      p_limit: 500, // fetch a generous batch for clustering
      p_offset: 0,
      p_include_remote: false,
      gig_status: 'open',
    });

    if (error) {
      logger.error('[clusterService] getGigClusters RPC error:', error.message);
      return [];
    }

    gigs = data || [];
  }

  if (!gigs || gigs.length === 0) return [];

  if (excludeUserId) {
    gigs = gigs.filter((gig) => String(gig?.user_id || '') !== String(excludeUserId));
  }

  if (gigs.length === 0) return [];

  // Group by category
  const byCategory = {};
  for (const gig of gigs) {
    const cat = gig.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(gig);
  }

  // Build cluster metadata for categories with 2+ gigs
  const clusters = [];
  for (const [category, catGigs] of Object.entries(byCategory)) {
    if (catGigs.length < 2) continue;

    const prices = catGigs.map((g) => parseFloat(g.price)).filter((p) => Number.isFinite(p));
    const distances = catGigs
      .map((g) => parseFloat(g.distance_meters))
      .filter((d) => Number.isFinite(d));
    const dates = catGigs
      .map((g) => g.created_at)
      .filter(Boolean)
      .sort()
      .reverse();

    clusters.push({
      category,
      count: catGigs.length,
      price_min: prices.length ? Math.min(...prices) : null,
      price_max: prices.length ? Math.max(...prices) : null,
      price_avg: prices.length
        ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
        : null,
      nearest_distance: distances.length ? Math.min(...distances) : null,
      newest_at: dates[0] || null,
      representative_title: catGigs.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )[0].title,
    });
  }

  // Sort by count desc, take top N
  clusters.sort((a, b) => b.count - a.count);
  return clusters.slice(0, limit);
}

// ─── getStackedGigs ─────────────────────────────────────────
//
// Within a single category, group near-duplicate titles into
// "stacks" using word-token Jaccard similarity with union-find.

async function getStackedGigs(category, { lat, lng, radiusMeters = DEFAULT_RADIUS_METERS } = {}) {
  if (!category || lat == null || lng == null) {
    return [];
  }

  const { data: gigs, error } = await supabaseAdmin.rpc('find_gigs_nearby_v2', {
    user_lat: lat,
    user_lon: lng,
    p_radius_meters: radiusMeters,
    p_category: category,
    p_min_price: null,
    p_max_price: null,
    p_search: null,
    p_sort: 'newest',
    p_limit: 200,
    p_offset: 0,
    p_include_remote: false,
    gig_status: 'open',
  });

  if (error) {
    logger.error('[clusterService] getStackedGigs RPC error:', error.message);
    return [];
  }

  if (!gigs || gigs.length === 0) return [];

  // Normalize titles and tokenize
  const normalized = gigs.map((g) => ({
    gig: g,
    tokens: normalizeTitle(g.title),
  }));

  // Union-find for grouping similar titles
  const parent = gigs.map((_, i) => i);

  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]; // path compression
      i = parent[i];
    }
    return i;
  }

  function union(i, j) {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  }

  // Pairwise comparison — O(n²) but n is bounded (~200 per category)
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const sim = jaccardSimilarity(normalized[i].tokens, normalized[j].tokens);
      if (sim >= STACK_SIMILARITY_THRESHOLD) {
        union(i, j);
      }
    }
  }

  // Group by root
  const groups = {};
  for (let i = 0; i < gigs.length; i++) {
    const root = find(i);
    if (!groups[root]) groups[root] = [];
    groups[root].push(gigs[i]);
  }

  // Build stack results
  const stacks = [];
  for (const members of Object.values(groups)) {
    // Sort members by newest first
    members.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const prices = members.map((g) => parseFloat(g.price)).filter((p) => Number.isFinite(p));
    const distances = members
      .map((g) => parseFloat(g.distance_meters))
      .filter((d) => Number.isFinite(d));

    if (members.length >= 2) {
      stacks.push({
        stack_id: `stack_${members[0].id}`,
        representative_title: members[0].title,
        count: members.length,
        price_min: prices.length ? Math.min(...prices) : null,
        price_max: prices.length ? Math.max(...prices) : null,
        nearest_distance: distances.length ? Math.min(...distances) : null,
        newest_at: members[0].created_at,
        gig_ids: members.map((g) => g.id),
      });
    } else {
      // Singleton — return as individual gig
      stacks.push({
        stack_id: null,
        representative_title: members[0].title,
        count: 1,
        price_min: prices[0] ?? null,
        price_max: prices[0] ?? null,
        nearest_distance: distances[0] ?? null,
        newest_at: members[0].created_at,
        gig_ids: [members[0].id],
      });
    }
  }

  // Sort: stacks first (by count desc), then singletons (by newest)
  stacks.sort((a, b) => {
    if (a.count > 1 && b.count <= 1) return -1;
    if (a.count <= 1 && b.count > 1) return 1;
    if (a.count !== b.count) return b.count - a.count;
    return new Date(b.newest_at) - new Date(a.newest_at);
  });

  return stacks;
}

module.exports = { getGigClusters, getStackedGigs };
