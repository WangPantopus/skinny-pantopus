/**
 * Saved-search alert fan-out (P6).
 *
 * When a gig is posted (classic `POST /api/gigs` or magic-post), match it
 * against every notifiable `GigSavedSearch` and notify the owners whose
 * criteria it satisfies. Fire-and-forget from the creation paths — a
 * fan-out failure must never fail the post.
 *
 * Matching dimensions (NULL = unconstrained): category (exact, case-
 * insensitive), price window, schedule_type, pay_type, keyword (substring
 * of title/description), and haversine distance within radius_miles of
 * the saved center. Per-search alerts are throttled to one per
 * `THROTTLE_MINUTES` via `last_notified_at`.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const { createBulkNotifications } = require('./notificationService');
const logger = require('../utils/logger');

const THROTTLE_MINUTES = 30;
const EARTH_RADIUS_MILES = 3958.8;

function haversineMiles(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** True when `search` row's criteria all pass for `gig`. */
function matches(search, gig, gigLat, gigLon) {
  if (search.category && String(search.category).toLowerCase() !== String(gig.category || '').toLowerCase()) {
    return false;
  }
  const price = gig.price == null ? null : Number(gig.price);
  if (search.min_price != null && (price == null || price < Number(search.min_price))) return false;
  if (search.max_price != null && (price == null || price > Number(search.max_price))) return false;
  if (search.schedule_type && search.schedule_type !== gig.schedule_type) return false;
  if (search.pay_type && search.pay_type !== gig.pay_type) return false;
  if (search.search) {
    const needle = String(search.search).toLowerCase();
    const haystack = `${gig.title || ''} ${gig.description || ''}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  const radius = Number(search.radius_miles) || 5;
  return haversineMiles(search.latitude, search.longitude, gigLat, gigLon) <= radius;
}

/**
 * Match + notify. `gig` is the freshly inserted row; `coords` the exact
 * posting coordinates `{latitude, longitude}` (approx coords are fine).
 * Never throws.
 */
async function alertMatchingSavedSearches(gig, coords) {
  try {
    if (!gig?.id || !coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
      return { notified: 0 };
    }

    // Bounding-box prefilter (1° lat ≈ 69 mi); precise haversine below.
    const maxRadiusDeg = 100 / 69;
    const { data: candidates, error } = await supabaseAdmin
      .from('GigSavedSearch')
      .select('*')
      .eq('notify', true)
      .neq('user_id', gig.user_id || gig.created_by)
      .gte('latitude', coords.latitude - maxRadiusDeg)
      .lte('latitude', coords.latitude + maxRadiusDeg)
      .limit(500);
    if (error || !candidates?.length) return { notified: 0 };

    const throttleCutoff = Date.now() - THROTTLE_MINUTES * 60 * 1000;
    const hits = candidates.filter(
      (s) =>
        (!s.last_notified_at || new Date(s.last_notified_at).getTime() < throttleCutoff) &&
        matches(s, gig, coords.latitude, coords.longitude)
    );
    if (!hits.length) return { notified: 0 };

    // One alert per user per gig even when several of their searches hit.
    const byUser = new Map();
    for (const hit of hits) {
      if (!byUser.has(hit.user_id)) byUser.set(hit.user_id, hit);
    }

    await createBulkNotifications(
      [...byUser.values()].map((hit) => ({
        userId: hit.user_id,
        type: 'gig_saved_search_match',
        title: 'New task matches your saved search',
        body: hit.name ? `${hit.name}: ${gig.title}` : gig.title,
        icon: 'search',
        link: `/gigs/${gig.id}`,
        contextType: 'gig',
        contextId: gig.id,
        metadata: { gig_id: gig.id, saved_search_id: hit.id },
      }))
    );

    await supabaseAdmin
      .from('GigSavedSearch')
      .update({ last_notified_at: new Date().toISOString() })
      .in('id', hits.map((h) => h.id));

    logger.info('Saved-search alerts sent', { gigId: gig.id, notified: byUser.size });
    return { notified: byUser.size };
  } catch (err) {
    logger.error('Saved-search fan-out failed', { gigId: gig?.id, error: err.message });
    return { notified: 0 };
  }
}

module.exports = { alertMatchingSavedSearches, matches, haversineMiles };
