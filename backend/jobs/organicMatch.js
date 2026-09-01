// ============================================================
// ORGANIC MATCH ONLY
//
// This module matches local businesses to community posts based on
// proximity, neighbor work history (neighbor_count), and rating.
//
// PERMANENT RULE: No paid_boost field, no sponsored flag, no payment
// path influences ranking in this module. If you are adding a paid
// feature, create a separate module — do not modify this file.
//
// Ranking is handled by the find_businesses_nearby SQL function which
// uses the composite score: 35% neighbor count (log normalized),
// 25% distance, 20% rating, 10% profile completeness, 10% recency.
//
// If paid promotion is ever added to Pantopus, it MUST live in a
// completely separate UI unit with explicit "Sponsored" labeling,
// different visual treatment, and different position in the thread.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const MATCH_LIMIT = 5;        // Top 5 candidates (3 shown, 2 fallback)
const CACHE_SHOW_LIMIT = 3;   // Snapshot top 3 for fast initial render
const RADIUS_METERS = 8047;   // ~5 miles
const CACHE_TTL_DAYS = 7;     // Re-run match after 7 days
const MAX_POST_AGE_DAYS = 30; // Stop showing card after 30 days
const BATCH_SIZE = 50;        // Max posts per cron run

/**
 * Match businesses for a single post.
 * Can be called directly (fire-and-forget from post creation) or from cron.
 */
async function matchBusinessesForPost(postId) {
  try {
    // 1. Get the post
    const { data: post, error: postErr } = await supabaseAdmin
      .from('Post')
      .select('id, latitude, longitude, service_category, matched_business_ids, created_at')
      .eq('id', postId)
      .single();

    if (postErr || !post) {
      logger.warn('[organicMatch] Post not found', { postId, error: postErr?.message });
      return;
    }

    // Skip if no location or no service_category
    if (!post.latitude || !post.longitude || !post.service_category) return;

    // Skip if post is older than 30 days
    const postAgeDays = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (postAgeDays > MAX_POST_AGE_DAYS) return;

    // 2. Search for businesses near the post location matching the service category
    const { data: results, error: searchErr } = await supabaseAdmin.rpc(
      'find_businesses_nearby',
      {
        p_lat: post.latitude,
        p_lon: post.longitude,
        p_radius_meters: RADIUS_METERS,
        p_categories: [post.service_category],
        p_open_now_only: false,
        p_worked_nearby: false,
        p_accepts_gigs: false,
        p_new_on_pantopus: false,
        p_rating_min: null,
        p_sort: 'relevance',
        p_viewer_home_id: null,
        p_page: 1,
        p_page_size: MATCH_LIMIT,
      },
    );

    if (searchErr) {
      logger.error('[organicMatch] Search failed', { postId, error: searchErr.message });
      return;
    }

    const matches = results || [];
    if (matches.length === 0) {
      // No matches found — clear any stale data but leave IDs empty
      await supabaseAdmin
        .from('Post')
        .update({
          matched_business_ids: [],
          matched_businesses_cache: [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId);
      return;
    }

    // 3. Build IDs array (all 5) and cache snapshot (top 3)
    const matchedIds = matches.slice(0, MATCH_LIMIT).map((m) => m.business_user_id);
    const cacheSnapshot = matches.slice(0, CACHE_SHOW_LIMIT).map((m) => ({
      business_user_id: m.business_user_id,
      username: m.username,
      name: m.name,
      profile_picture_url: m.profile_picture_url || null,
      categories: m.categories || [],
      average_rating: m.average_rating != null ? parseFloat(m.average_rating) : null,
      review_count: parseInt(m.review_count, 10) || 0,
      distance_miles: m.distance_miles != null ? parseFloat(m.distance_miles) : null,
      neighbor_count: parseInt(m.neighbor_count, 10) || 0,
      is_new_business: m.is_new_business || false,
      is_open_now: m.is_open_now,
      cached_at: new Date().toISOString(),
    }));

    // 4. Write to post
    const { error: updateErr } = await supabaseAdmin
      .from('Post')
      .update({
        matched_business_ids: matchedIds,
        matched_businesses_cache: cacheSnapshot,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId);

    if (updateErr) {
      logger.error('[organicMatch] Failed to update post', { postId, error: updateErr.message });
      return;
    }

    logger.info('[organicMatch] Matched businesses for post', {
      postId,
      matchCount: matchedIds.length,
      category: post.service_category,
    });
  } catch (err) {
    logger.error('[organicMatch] Unexpected error', { postId, error: err.message });
  }
}

/**
 * Cron entry point — processes unmatched posts and refreshes stale caches.
 */
async function organicMatch() {
  const thirtyDaysAgo = new Date(Date.now() - MAX_POST_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // ── Pass 1: Match new posts that have service_category but no matches yet ──
  const { data: unmatchedPosts, error: findErr } = await supabaseAdmin
    .from('Post')
    .select('id')
    .not('service_category', 'is', null)
    .or('matched_business_ids.is.null,matched_business_ids.eq.{}')
    .gte('created_at', thirtyDaysAgo)
    .neq('is_archived', true)
    .order('created_at', { ascending: false })
    .limit(BATCH_SIZE);

  if (findErr) {
    logger.error('[organicMatch] Failed to find unmatched posts', { error: findErr.message });
  } else {
    const posts = unmatchedPosts || [];
    if (posts.length > 0) {
      logger.info('[organicMatch] Processing unmatched posts', { count: posts.length });
      for (const p of posts) {
        await matchBusinessesForPost(p.id);
      }
    }
  }

  // ── Pass 2: Refresh stale caches (older than CACHE_TTL_DAYS) ──
  const staleCutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: stalePosts, error: staleErr } = await supabaseAdmin
    .from('Post')
    .select('id')
    .not('service_category', 'is', null)
    .not('matched_business_ids', 'is', null)
    .gte('created_at', thirtyDaysAgo)
    .neq('is_archived', true)
    .lt('updated_at', staleCutoff)
    .order('updated_at', { ascending: true })
    .limit(20);

  if (staleErr) {
    logger.error('[organicMatch] Failed to find stale posts', { error: staleErr.message });
  } else {
    const stale = stalePosts || [];
    if (stale.length > 0) {
      logger.info('[organicMatch] Refreshing stale caches', { count: stale.length });
      for (const p of stale) {
        await matchBusinessesForPost(p.id);
      }
    }
  }
}

module.exports = organicMatch;
module.exports.matchBusinessesForPost = matchBusinessesForPost;
