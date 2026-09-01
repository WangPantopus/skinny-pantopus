/**
 * savedSearchService.js — Saved search management and new-listing matching.
 *
 * Allows users to save search criteria and get notified when new listings
 * match their saved searches.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const notificationService = require('../notificationService');

// ─── Public API ──────────────────────────────────────────────

/**
 * Check a newly created listing against all saved searches with
 * notifications enabled. Non-blocking — never throws.
 */
async function matchNewListing(listing) {
  try {
    const { data: searches, error } = await supabaseAdmin
      .from('SavedSearch')
      .select('*')
      .eq('notify_new_matches', true);

    if (error || !searches) {
      logger.warn('savedSearch.match.fetch_error', { error: error?.message });
      return { matchedCount: 0 };
    }

    let matchedCount = 0;

    for (const search of searches) {
      if (!isMatch(listing, search)) continue;

      matchedCount++;

      // Notify user (non-blocking)
      notificationService.createNotification({
        userId: search.user_id,
        type: 'saved_search_match',
        title: `New match: ${listing.title}`,
        body: `A new listing matches your search "${search.label || search.query || 'saved search'}"`,
        link: `/listing/${listing.id}`,
        metadata: { listingId: listing.id, searchId: search.id },
      }).catch(err => logger.warn('savedSearch.match.notification_error', { error: err.message }));

      // Update last_matched_at
      supabaseAdmin
        .from('SavedSearch')
        .update({ last_matched_at: new Date().toISOString() })
        .eq('id', search.id)
        .then(() => {})
        .catch(err => logger.warn('savedSearch.match.update_error', { error: err.message }));
    }

    return { matchedCount };
  } catch (err) {
    logger.error('savedSearch.matchNewListing.error', { error: err.message });
    return { matchedCount: 0 };
  }
}

/**
 * Check if a listing matches a saved search's criteria.
 */
function isMatch(listing, search) {
  // Text query match (case-insensitive substring)
  if (search.query) {
    const q = search.query.toLowerCase();
    if (!(listing.title || '').toLowerCase().includes(q)) return false;
  }

  const filters = search.filters || {};

  if (filters.category && listing.category !== filters.category) return false;
  if (filters.is_free === true && !listing.is_free) return false;
  if (filters.max_price != null && listing.price > filters.max_price) return false;
  if (filters.min_price != null && listing.price < filters.min_price) return false;
  if (filters.is_wanted != null && listing.is_wanted !== filters.is_wanted) return false;

  return true;
}

async function createSavedSearch({ userId, query, filters, label }) {
  const { data: search, error } = await supabaseAdmin
    .from('SavedSearch')
    .insert({
      user_id: userId,
      query: query || null,
      filters: filters || {},
      label: label || null,
    })
    .select()
    .single();

  if (error) {
    logger.error('savedSearch.create.error', { error: error.message });
    throw new Error(`Failed to create saved search: ${error.message}`);
  }

  return { search };
}

async function getSavedSearches(userId) {
  const { data: searches, error } = await supabaseAdmin
    .from('SavedSearch')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('savedSearch.get.error', { error: error.message });
    throw new Error(`Failed to fetch saved searches: ${error.message}`);
  }

  return { searches: searches || [] };
}

async function deleteSavedSearch({ searchId, userId }) {
  const { error } = await supabaseAdmin
    .from('SavedSearch')
    .delete()
    .eq('id', searchId)
    .eq('user_id', userId);

  if (error) {
    logger.error('savedSearch.delete.error', { error: error.message });
    throw new Error(`Failed to delete saved search: ${error.message}`);
  }

  return { deleted: true };
}

module.exports = {
  matchNewListing,
  createSavedSearch,
  getSavedSearches,
  deleteSavedSearch,
};
