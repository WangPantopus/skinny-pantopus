// ============================================================
// JOB: Expire Listings
// Archives active listings whose expires_at has passed.
// Runs every 15 minutes.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

async function expireListings() {
  const now = new Date().toISOString();

  const { data: expired, error } = await supabaseAdmin
    .from('Listing')
    .update({
      status: 'archived',
      archived_at: now,
      updated_at: now,
    })
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lt('expires_at', now)
    .select('id, user_id, layer, listing_type, home_id, is_address_attached');

  if (error) {
    logger.error('[expireListings] Failed to archive expired listings', { error: error.message });
    return;
  }

  const count = expired ? expired.length : 0;
  if (count === 0) return;

  logger.info('[expireListings] Archived expired listings', { count });

  // Decrement inventory slot counts for address-attached listings
  const attachedListings = (expired || []).filter(l => l.home_id && l.is_address_attached);
  for (const listing of attachedListings) {
    try {
      const { data: slot } = await supabaseAdmin
        .from('ListingInventorySlot')
        .select('id, active_count')
        .eq('home_id', listing.home_id)
        .eq('layer', listing.layer)
        .single();

      if (slot && slot.active_count > 0) {
        await supabaseAdmin
          .from('ListingInventorySlot')
          .update({ active_count: slot.active_count - 1, updated_at: now })
          .eq('id', slot.id);
      }
    } catch (err) {
      logger.warn('[expireListings] Failed to decrement inventory slot', {
        error: err.message,
        listingId: listing.id,
        homeId: listing.home_id,
      });
    }
  }
}

module.exports = expireListings;
