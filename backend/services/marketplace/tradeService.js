/**
 * tradeService.js — Trade / swap proposal system for marketplace listings.
 *
 * Manages the full trade lifecycle: propose, respond (accept/decline),
 * complete, and cancel. All mutations notify relevant parties via
 * notificationService.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const notificationService = require('../notificationService');

// ─── Helpers ─────────────────────────────────────────────────

async function fetchTrade(tradeId) {
  const { data, error } = await supabaseAdmin
    .from('ListingTrade')
    .select('*')
    .eq('id', tradeId)
    .single();

  if (error || !data) {
    const err = new Error('Trade not found');
    err.status = 404;
    throw err;
  }
  return data;
}

// ─── Public API ──────────────────────────────────────────────

// Put listings held by this accept attempt (pending_pickup) back on sale when it can't finish.
// A failed rollback is logged, since the caller is already failing.
async function releaseHeldListings(listingIds) {
  if (!listingIds || listingIds.length === 0) return;
  const { error } = await supabaseAdmin
    .from('Listing')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .in('id', listingIds)
    .eq('status', 'pending_pickup');
  if (error) logger.error('trade.release_listings_error', { error: error.message, listingIds });
}

async function proposeTrade({ targetListingId, proposerId, offeredListingIds, message, cashSupplement }) {
  // 1. Fetch target listing — verify active and open to trades
  const { data: targetListing, error: listingErr } = await supabaseAdmin
    .from('Listing')
    .select('id, user_id, title, status, open_to_trades')
    .eq('id', targetListingId)
    .single();

  if (listingErr || !targetListing) {
    const err = new Error('Target listing not found');
    err.status = 404;
    throw err;
  }
  if (targetListing.status !== 'active') {
    const err = new Error('Target listing is not active');
    err.status = 400;
    throw err;
  }
  if (!targetListing.open_to_trades) {
    const err = new Error('Target listing is not open to trades');
    err.status = 400;
    throw err;
  }

  const targetUserId = targetListing.user_id;

  // 2. Reject self-trades
  if (proposerId === targetUserId) {
    const err = new Error('Cannot trade with yourself');
    err.status = 400;
    throw err;
  }

  // 3. Verify all offered listings exist, are active, and owned by proposer
  if (!offeredListingIds || offeredListingIds.length === 0) {
    const err = new Error('Must offer at least one listing');
    err.status = 400;
    throw err;
  }

  const { data: offeredListings, error: offeredErr } = await supabaseAdmin
    .from('Listing')
    .select('id')
    .in('id', offeredListingIds)
    .eq('user_id', proposerId)
    .eq('status', 'active');

  if (offeredErr) {
    const err = new Error('Failed to verify offered listings');
    err.status = 500;
    throw err;
  }
  if (!offeredListings || offeredListings.length !== offeredListingIds.length) {
    const err = new Error('One or more offered listings are invalid');
    err.status = 400;
    throw err;
  }

  // 4. Insert trade
  const { data: trade, error: insertErr } = await supabaseAdmin
    .from('ListingTrade')
    .insert({
      target_listing_id: targetListingId,
      target_user_id: targetUserId,
      offered_listing_ids: offeredListingIds,
      proposer_id: proposerId,
      message: message || null,
      cash_supplement: cashSupplement || 0,
      status: 'proposed',
    })
    .select()
    .single();

  if (insertErr) {
    logger.error('trade.propose.insert_error', { error: insertErr.message });
    throw new Error(`Failed to create trade: ${insertErr.message}`);
  }

  // 5. Notify target user (non-blocking)
  const { data: proposerProfile } = await supabaseAdmin
    .from('User')
    .select('display_name')
    .eq('id', proposerId)
    .single();

  const proposerName = proposerProfile?.display_name || 'Someone';
  notificationService.createNotification({
    userId: targetUserId,
    type: 'listing_trade_proposed',
    title: 'Trade proposal',
    body: `${proposerName} wants to trade for your ${targetListing.title}`,
    link: `/listing/${targetListingId}`,
    metadata: { tradeId: trade.id, listingId: targetListingId },
  }).catch(err => logger.warn('trade.propose.notification_error', { error: err.message }));

  return { trade };
}

async function respondToTrade({ tradeId, targetUserId, action }) {
  if (action !== 'accept' && action !== 'decline') {
    const err = new Error('Action must be accept or decline');
    err.status = 400;
    throw err;
  }

  const trade = await fetchTrade(tradeId);

  if (trade.target_user_id !== targetUserId) {
    const err = new Error('Only the target user can respond to this trade');
    err.status = 403;
    throw err;
  }
  if (trade.status !== 'proposed') {
    const err = new Error('Trade is no longer pending');
    err.status = 400;
    throw err;
  }

  if (action === 'accept') {
    // Hold every listing in the trade first: active -> pending_pickup (the listing_status enum has no
    // 'reserved'). Only active listings match, so a listing already promised elsewhere stops the accept, and a
    // failed write fails it instead of leaving the listings on sale.
    const listingIds = [trade.target_listing_id, ...(trade.offered_listing_ids || [])];
    const { data: held, error: holdErr } = await supabaseAdmin
      .from('Listing')
      .update({ status: 'pending_pickup', updated_at: new Date().toISOString() })
      .in('id', listingIds)
      .eq('status', 'active')
      .select('id');

    if (holdErr) throw new Error(`Failed to hold the trade's listings: ${holdErr.message}`);
    if (!held || held.length !== listingIds.length) {
      await releaseHeldListings((held || []).map(l => l.id));
      const err = new Error('A listing in this trade is no longer available');
      err.status = 409;
      throw err;
    }

    // Update trade status
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('ListingTrade')
      .update({ status: 'accepted', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', tradeId)
      .select()
      .single();

    if (updateErr) {
      await releaseHeldListings(listingIds);
      throw new Error(`Failed to accept trade: ${updateErr.message}`);
    }

    // Notify proposer (non-blocking)
    notificationService.createNotification({
      userId: trade.proposer_id,
      type: 'listing_trade_accepted',
      title: 'Trade accepted!',
      body: 'Your trade proposal has been accepted',
      link: `/listing/${trade.target_listing_id}`,
      metadata: { tradeId: trade.id },
    }).catch(err => logger.warn('trade.accept.notification_error', { error: err.message }));

    return { trade: updated };
  }

  // Decline
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('ListingTrade')
    .update({ status: 'declined', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', tradeId)
    .select()
    .single();

  if (updateErr) throw new Error(`Failed to decline trade: ${updateErr.message}`);

  // Notify proposer (non-blocking)
  notificationService.createNotification({
    userId: trade.proposer_id,
    type: 'listing_trade_declined',
    title: 'Trade declined',
    body: 'Your trade proposal was declined',
    link: `/listing/${trade.target_listing_id}`,
    metadata: { tradeId: trade.id },
  }).catch(err => logger.warn('trade.decline.notification_error', { error: err.message }));

  return { trade: updated };
}

async function completeTrade({ tradeId, userId }) {
  const trade = await fetchTrade(tradeId);

  if (trade.proposer_id !== userId && trade.target_user_id !== userId) {
    const err = new Error('Only trade participants can complete a trade');
    err.status = 403;
    throw err;
  }
  if (trade.status !== 'accepted') {
    const err = new Error('Trade must be accepted before completing');
    err.status = 400;
    throw err;
  }

  // Update trade status
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('ListingTrade')
    .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', tradeId)
    .select()
    .single();

  if (updateErr) throw new Error(`Failed to complete trade: ${updateErr.message}`);

  // Mark every listing in the trade as gone: 'sold' (the listing_status enum has no 'traded').
  const tradedIds = [trade.target_listing_id, ...(trade.offered_listing_ids || [])];
  const now = new Date().toISOString();
  const { error: soldErr } = await supabaseAdmin
    .from('Listing')
    .update({ status: 'sold', sold_at: now, updated_at: now })
    .in('id', tradedIds);

  if (soldErr) {
    const { error: revertErr } = await supabaseAdmin
      .from('ListingTrade')
      .update({ status: 'accepted', completed_at: null, updated_at: new Date().toISOString() })
      .eq('id', tradeId);
    if (revertErr) logger.error('trade.complete.revert_error', { error: revertErr.message, tradeId });
    throw new Error(`Failed to mark the trade's listings sold: ${soldErr.message}`);
  }

  // Notify both parties (non-blocking)
  const otherUserId = userId === trade.proposer_id ? trade.target_user_id : trade.proposer_id;
  [userId, otherUserId].forEach(uid => {
    notificationService.createNotification({
      userId: uid,
      type: 'transaction_review_prompt',
      title: 'Trade completed!',
      body: 'Leave a review for your trade partner',
      link: `/listing/${trade.target_listing_id}`,
      metadata: { tradeId: trade.id },
    }).catch(err => logger.warn('trade.complete.notification_error', { error: err.message }));
  });

  return { trade: updated };
}

async function cancelTrade({ tradeId, userId }) {
  const trade = await fetchTrade(tradeId);

  if (trade.proposer_id !== userId) {
    const err = new Error('Only the proposer can cancel a trade');
    err.status = 403;
    throw err;
  }
  if (trade.status !== 'proposed') {
    const err = new Error('Only proposed trades can be cancelled');
    err.status = 400;
    throw err;
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('ListingTrade')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', tradeId)
    .select()
    .single();

  if (updateErr) throw new Error(`Failed to cancel trade: ${updateErr.message}`);

  // A proposed trade owns no listing hold. A listing may now be held for a different accepted
  // trade or offer, so cancelling this proposal must leave every listing's status unchanged.

  return { trade: updated };
}

module.exports = {
  proposeTrade,
  respondToTrade,
  completeTrade,
  cancelTrade,
};
