/**
 * listingOfferService.js — Structured offer / counter-offer system
 * for marketplace listings.
 *
 * Manages the full offer lifecycle: create, counter, accept, decline,
 * withdraw, complete, and expire. All mutations notify relevant parties
 * via notificationService.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const notificationService = require('../notificationService');

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Fetch an offer by id with basic validation.
 * Throws a structured error object on failure.
 */
async function fetchOffer(offerId) {
  const { data, error } = await supabaseAdmin
    .from('ListingOffer')
    .select('*')
    .eq('id', offerId)
    .single();

  if (error || !data) {
    const err = new Error('Offer not found');
    err.status = 404;
    throw err;
  }
  return data;
}

/**
 * Fetch a user's display name for notification bodies.
 */
async function getUserName(userId) {
  const { data } = await supabaseAdmin
    .from('User')
    .select('first_name, last_name, username')
    .eq('id', userId)
    .single();

  if (!data) return 'Someone';
  if (data.first_name) return data.first_name;
  if (data.username) return data.username;
  return 'Someone';
}

// ─── createOffer ─────────────────────────────────────────────

async function createOffer({ listingId, buyerId, amount, message }) {
  // 1. Fetch listing and validate
  const { data: listing, error: listingErr } = await supabaseAdmin
    .from('Listing')
    .select('id, user_id, title, status, active_offer_count')
    .eq('id', listingId)
    .single();

  if (listingErr || !listing) {
    const err = new Error('Listing not found');
    err.status = 404;
    throw err;
  }

  if (listing.status !== 'active') {
    const err = new Error('Listing is not accepting offers');
    err.status = 409;
    throw err;
  }

  if (buyerId === listing.user_id) {
    const err = new Error('You cannot make an offer on your own listing');
    err.status = 400;
    throw err;
  }

  // 2. Check for duplicate active offer
  const { data: existing } = await supabaseAdmin
    .from('ListingOffer')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .in('status', ['pending', 'accepted', 'countered'])
    .maybeSingle();

  if (existing) {
    const err = new Error('You already have an active offer on this listing');
    err.status = 409;
    throw err;
  }

  // 3. Insert offer
  const { data: offer, error: insertErr } = await supabaseAdmin
    .from('ListingOffer')
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: listing.user_id,
      amount: amount != null ? Number(amount) : null,
      message: message || null,
      status: 'pending',
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })
    .select('*')
    .single();

  if (insertErr) {
    logger.error('Failed to insert listing offer', { error: insertErr.message, listingId, buyerId });
    throw insertErr;
  }

  // 4. Increment active_offer_count
  await supabaseAdmin
    .from('Listing')
    .update({ active_offer_count: (listing.active_offer_count || 0) + 1 })
    .eq('id', listingId);

  // 5. Notify seller
  const buyerName = await getUserName(buyerId);
  const amountText = amount != null ? `$${amount}` : 'interest';
  notificationService.createNotification({
    userId: listing.user_id,
    type: 'listing_offer_received',
    title: `New offer on ${listing.title}`,
    body: `${buyerName} offered ${amountText}`,
    icon: '💰',
    link: `/listing/${listingId}`,
    metadata: { listingId, offerId: offer.id },
  }).catch((err) => {
    logger.warn('Offer notification failed (non-blocking)', { error: err.message });
  });

  return { offer };
}

// ─── counterOffer ────────────────────────────────────────────

async function counterOffer({ offerId, sellerId, counterAmount, counterMessage }) {
  const offer = await fetchOffer(offerId);

  if (offer.seller_id !== sellerId) {
    const err = new Error('Only the seller can counter this offer');
    err.status = 403;
    throw err;
  }

  if (offer.status !== 'pending') {
    const err = new Error('Only pending offers can be countered');
    err.status = 409;
    throw err;
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('ListingOffer')
    .update({
      status: 'countered',
      counter_amount: Number(counterAmount),
      counter_message: counterMessage || null,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', offerId)
    .select('*')
    .single();

  if (updateErr) {
    logger.error('Failed to counter offer', { error: updateErr.message, offerId });
    throw updateErr;
  }

  // Notify buyer
  const sellerName = await getUserName(sellerId);
  notificationService.createNotification({
    userId: offer.buyer_id,
    type: 'listing_offer_countered',
    title: 'Counter offer received',
    body: `${sellerName} countered with $${counterAmount}`,
    icon: '🔄',
    link: `/listing/${offer.listing_id}`,
    metadata: { listingId: offer.listing_id, offerId },
  }).catch((err) => {
    logger.warn('Counter-offer notification failed (non-blocking)', { error: err.message });
  });

  return { offer: updated };
}

// ─── acceptOffer ─────────────────────────────────────────────

async function acceptOffer({ offerId, userId }) {
  const offer = await fetchOffer(offerId);

  // Seller can accept pending offers; buyer can accept countered offers
  const isSellerAcceptingPending = offer.seller_id === userId && offer.status === 'pending';
  const isBuyerAcceptingCounter = offer.buyer_id === userId && offer.status === 'countered';

  if (!isSellerAcceptingPending && !isBuyerAcceptingCounter) {
    const err = new Error(
      offer.status === 'countered'
        ? 'Only the buyer can accept a counter-offer'
        : 'Only the seller can accept a pending offer'
    );
    err.status = 403;
    throw err;
  }

  if (offer.status !== 'pending' && offer.status !== 'countered') {
    const err = new Error('Only pending or countered offers can be accepted');
    err.status = 409;
    throw err;
  }

  // 0. Verify listing is still active
  const { data: offerListing } = await supabaseAdmin
    .from('Listing')
    .select('status')
    .eq('id', offer.listing_id)
    .single();

  if (!offerListing || (offerListing.status !== 'active' && offerListing.status !== 'reserved')) {
    const err = new Error('Listing is no longer available');
    err.status = 409;
    throw err;
  }

  // 1. Accept this offer
  // When buyer accepts a counter-offer, promote the counter_amount to the final amount
  const updateFields = {
    status: 'accepted',
    responded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (isBuyerAcceptingCounter && offer.counter_amount != null) {
    updateFields.amount = offer.counter_amount;
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('ListingOffer')
    .update(updateFields)
    .eq('id', offerId)
    .select('*')
    .single();

  if (updateErr) {
    logger.error('Failed to accept offer', { error: updateErr.message, offerId });
    throw updateErr;
  }

  // 2. Reserve the listing and reset offer count (all others will be declined)
  await supabaseAdmin
    .from('Listing')
    .update({ status: 'reserved', active_offer_count: 0, updated_at: new Date().toISOString() })
    .eq('id', offer.listing_id);

  // 3. Decline all other pending offers on the same listing
  const { data: otherOffers } = await supabaseAdmin
    .from('ListingOffer')
    .select('id, buyer_id')
    .eq('listing_id', offer.listing_id)
    .in('status', ['pending', 'countered'])
    .neq('id', offerId);

  if (otherOffers && otherOffers.length > 0) {
    const otherIds = otherOffers.map((o) => o.id);
    await supabaseAdmin
      .from('ListingOffer')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', otherIds);

    // Fetch listing title for notifications
    const { data: listing } = await supabaseAdmin
      .from('Listing')
      .select('title')
      .eq('id', offer.listing_id)
      .single();
    const listingTitle = listing?.title || 'a listing';

    // Notify each declined buyer
    for (const declined of otherOffers) {
      notificationService.createNotification({
        userId: declined.buyer_id,
        type: 'listing_offer_declined',
        title: 'Offer declined',
        body: `Your offer on ${listingTitle} was declined`,
        icon: '❌',
        link: `/listing/${offer.listing_id}`,
        metadata: { listingId: offer.listing_id, offerId: declined.id },
      }).catch((err) => {
        logger.warn('Decline notification failed (non-blocking)', { error: err.message });
      });
    }
  }

  // 4. Notify the other party
  const { data: acceptedListing } = await supabaseAdmin
    .from('Listing')
    .select('title')
    .eq('id', offer.listing_id)
    .single();

  const listingTitle = acceptedListing?.title || 'a listing';

  if (isBuyerAcceptingCounter) {
    // Buyer accepted the seller's counter — notify the seller
    const buyerName = await getUserName(offer.buyer_id);
    const acceptedAmount = offer.counter_amount != null ? ` ($${offer.counter_amount})` : '';
    notificationService.createNotification({
      userId: offer.seller_id,
      type: 'listing_offer_accepted',
      title: 'Counter offer accepted!',
      body: `${buyerName} accepted your counter offer${acceptedAmount} on ${listingTitle}`,
      icon: '✅',
      link: `/listing/${offer.listing_id}`,
      metadata: { listingId: offer.listing_id, offerId },
    }).catch((err) => {
      logger.warn('Accept notification failed (non-blocking)', { error: err.message });
    });
  } else {
    // Seller accepted the buyer's offer — notify the buyer
    notificationService.createNotification({
      userId: offer.buyer_id,
      type: 'listing_offer_accepted',
      title: 'Offer accepted!',
      body: `Your offer on ${listingTitle} was accepted`,
      icon: '✅',
      link: `/listing/${offer.listing_id}`,
      metadata: { listingId: offer.listing_id, offerId },
    }).catch((err) => {
      logger.warn('Accept notification failed (non-blocking)', { error: err.message });
    });
  }

  return { offer: updated };
}

// ─── declineOffer ────────────────────────────────────────────

async function declineOffer({ offerId, sellerId }) {
  const offer = await fetchOffer(offerId);

  if (offer.seller_id !== sellerId) {
    const err = new Error('Only the seller can decline this offer');
    err.status = 403;
    throw err;
  }

  if (offer.status !== 'pending' && offer.status !== 'countered') {
    const err = new Error('Only pending or countered offers can be declined');
    err.status = 409;
    throw err;
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('ListingOffer')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId)
    .select('*')
    .single();

  if (updateErr) {
    logger.error('Failed to decline offer', { error: updateErr.message, offerId });
    throw updateErr;
  }

  // Decrement active_offer_count
  const { data: listing } = await supabaseAdmin
    .from('Listing')
    .select('active_offer_count')
    .eq('id', offer.listing_id)
    .single();

  await supabaseAdmin
    .from('Listing')
    .update({
      active_offer_count: Math.max((listing?.active_offer_count || 1) - 1, 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', offer.listing_id);

  // Notify buyer
  const { data: listingData } = await supabaseAdmin
    .from('Listing')
    .select('title')
    .eq('id', offer.listing_id)
    .single();

  notificationService.createNotification({
    userId: offer.buyer_id,
    type: 'listing_offer_declined',
    title: 'Offer declined',
    body: `Your offer on ${listingData?.title || 'a listing'} was declined`,
    icon: '❌',
    link: `/listing/${offer.listing_id}`,
    metadata: { listingId: offer.listing_id, offerId },
  }).catch((err) => {
    logger.warn('Decline notification failed (non-blocking)', { error: err.message });
  });

  return { offer: updated };
}

// ─── withdrawOffer ───────────────────────────────────────────

async function withdrawOffer({ offerId, buyerId }) {
  const offer = await fetchOffer(offerId);

  if (offer.buyer_id !== buyerId) {
    const err = new Error('Only the buyer can withdraw this offer');
    err.status = 403;
    throw err;
  }

  if (offer.status !== 'pending' && offer.status !== 'countered') {
    const err = new Error('Only pending or countered offers can be withdrawn');
    err.status = 409;
    throw err;
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('ListingOffer')
    .update({
      status: 'withdrawn',
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId)
    .select('*')
    .single();

  if (updateErr) {
    logger.error('Failed to withdraw offer', { error: updateErr.message, offerId });
    throw updateErr;
  }

  // Decrement active_offer_count
  const { data: listing } = await supabaseAdmin
    .from('Listing')
    .select('active_offer_count')
    .eq('id', offer.listing_id)
    .single();

  await supabaseAdmin
    .from('Listing')
    .update({
      active_offer_count: Math.max((listing?.active_offer_count || 1) - 1, 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', offer.listing_id);

  return { offer: updated };
}

// ─── completeTransaction ─────────────────────────────────────

async function completeTransaction({ offerId, completedBy }) {
  const offer = await fetchOffer(offerId);

  if (offer.buyer_id !== completedBy && offer.seller_id !== completedBy) {
    const err = new Error('Only the buyer or seller can complete this transaction');
    err.status = 403;
    throw err;
  }

  if (offer.status !== 'accepted') {
    const err = new Error('Only accepted offers can be completed');
    err.status = 409;
    throw err;
  }

  const now = new Date().toISOString();

  // 1. Mark offer completed
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('ListingOffer')
    .update({
      status: 'completed',
      completed_at: now,
      updated_at: now,
    })
    .eq('id', offerId)
    .select('*')
    .single();

  if (updateErr) {
    logger.error('Failed to complete transaction', { error: updateErr.message, offerId });
    throw updateErr;
  }

  // 2. Mark listing as sold
  await supabaseAdmin
    .from('Listing')
    .update({ status: 'sold', sold_at: now, updated_at: now })
    .eq('id', offer.listing_id);

  // 3. Notify both parties to review
  const [buyerName, sellerName] = await Promise.all([
    getUserName(offer.buyer_id),
    getUserName(offer.seller_id),
  ]);

  notificationService.createNotification({
    userId: offer.buyer_id,
    type: 'transaction_review_prompt',
    title: 'Rate your experience',
    body: `How was your trade with ${sellerName}?`,
    icon: '⭐',
    link: `/listing/${offer.listing_id}`,
    metadata: { listingId: offer.listing_id, offerId, revieweeId: offer.seller_id },
  }).catch((err) => {
    logger.warn('Review prompt notification failed (non-blocking)', { error: err.message });
  });

  notificationService.createNotification({
    userId: offer.seller_id,
    type: 'transaction_review_prompt',
    title: 'Rate your experience',
    body: `How was your trade with ${buyerName}?`,
    icon: '⭐',
    link: `/listing/${offer.listing_id}`,
    metadata: { listingId: offer.listing_id, offerId, revieweeId: offer.buyer_id },
  }).catch((err) => {
    logger.warn('Review prompt notification failed (non-blocking)', { error: err.message });
  });

  return { offer: updated };
}

// ─── expireStaleOffers ───────────────────────────────────────

async function expireStaleOffers() {
  const now = new Date().toISOString();

  // 1. Find all expired pending/countered offers
  const { data: staleOffers, error: fetchErr } = await supabaseAdmin
    .from('ListingOffer')
    .select('id, listing_id, buyer_id')
    .in('status', ['pending', 'countered'])
    .lt('expires_at', now);

  if (fetchErr) {
    logger.error('Failed to fetch stale offers', { error: fetchErr.message });
    throw fetchErr;
  }

  if (!staleOffers || staleOffers.length === 0) {
    return { expiredCount: 0 };
  }

  // 2. Bulk update to expired
  const staleIds = staleOffers.map((o) => o.id);
  const { error: updateErr } = await supabaseAdmin
    .from('ListingOffer')
    .update({ status: 'expired', updated_at: now })
    .in('id', staleIds);

  if (updateErr) {
    logger.error('Failed to expire stale offers', { error: updateErr.message });
    throw updateErr;
  }

  // 3. Decrement active_offer_count per listing and notify buyers
  // Group by listing_id to batch decrements
  const listingCounts = {};
  for (const offer of staleOffers) {
    listingCounts[offer.listing_id] = (listingCounts[offer.listing_id] || 0) + 1;
  }

  for (const [listingId, count] of Object.entries(listingCounts)) {
    const { data: listing } = await supabaseAdmin
      .from('Listing')
      .select('active_offer_count, title')
      .eq('id', listingId)
      .single();

    await supabaseAdmin
      .from('Listing')
      .update({
        active_offer_count: Math.max((listing?.active_offer_count || count) - count, 0),
        updated_at: now,
      })
      .eq('id', listingId);

    // Notify each buyer whose offer on this listing expired
    const affectedBuyers = staleOffers.filter((o) => o.listing_id === listingId);
    for (const offer of affectedBuyers) {
      notificationService.createNotification({
        userId: offer.buyer_id,
        type: 'listing_offer_expired',
        title: 'Offer expired',
        body: `Your offer on ${listing?.title || 'a listing'} has expired`,
        icon: '⏰',
        link: `/listing/${listingId}`,
        metadata: { listingId, offerId: offer.id },
      }).catch((err) => {
        logger.warn('Expire notification failed (non-blocking)', { error: err.message });
      });
    }
  }

  logger.info(`Expired ${staleOffers.length} stale listing offers`);
  return { expiredCount: staleOffers.length };
}

// ─── Exports ─────────────────────────────────────────────────

module.exports = {
  createOffer,
  counterOffer,
  acceptOffer,
  declineOffer,
  withdrawOffer,
  completeTransaction,
  expireStaleOffers,
};
