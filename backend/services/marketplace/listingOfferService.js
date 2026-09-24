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
const { PAYMENT_STATES } = require('../../stripe/paymentStateMachine');
const stripeService = require('../../stripe/stripeService');

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

// Safe display state for the buyer's existing checkout. Intent creation still
// revalidates identity, amount, listing and payment terms in routes/pays.js.
async function buyerCheckoutSummary({ offer, listing, buyerId }) {
  if (offer.buyer_id !== buyerId || offer.status !== 'accepted') return undefined;
  const amount = Math.round(Number(offer.amount) * 100);
  if (listing.is_free || listing.listing_type === 'free_item' || !Number.isSafeInteger(amount) || amount < 50) {
    return { state: 'not_payable', can_continue: false };
  }
  const unavailable = { state: 'unavailable', can_continue: false };
  if (offer.seller_id !== listing.user_id || !['active', 'pending_pickup'].includes(listing.status)) return unavailable;
  const metadata = { type: 'listing_offer_checkout', listing_id: offer.listing_id, offer_id: offer.id };
  const { data, error } = await supabaseAdmin.from('Payment')
    .select('payment_type, gig_id, payer_id, payee_id, amount_total, currency, payment_status, stripe_payment_intent_id, stripe_customer_id, metadata')
    .eq('payment_type', 'gig_payment').is('gig_id', null).contains('metadata', metadata)
    .order('created_at', { ascending: false }).limit(10);
  if (error) {
    logger.warn('Could not read listing checkout state', { offerId: offer.id });
    return unavailable;
  }
  // Same matching/ignored-state rules as resolveExistingCheckoutIntent. Never
  // choose a convenient row while another active row conflicts with the order.
  const active = (data || []).filter(payment =>
    Object.entries(metadata).every(([key, value]) => String(payment.metadata?.[key] || '') === String(value))
    && ![PAYMENT_STATES.CANCELED, 'failed'].includes(String(payment.payment_status || '').toLowerCase()));
  if (active.some(payment => String(payment.payer_id) !== String(buyerId)
      || String(payment.payee_id) !== String(offer.seller_id) || Number(payment.amount_total) !== amount)) return unavailable;
  const knownStatuses = new Set([
    PAYMENT_STATES.AUTHORIZE_PENDING, PAYMENT_STATES.AUTHORIZED, PAYMENT_STATES.AUTHORIZATION_FAILED,
    PAYMENT_STATES.CAPTURE_PENDING, PAYMENT_STATES.CAPTURED_HOLD, PAYMENT_STATES.TRANSFER_SCHEDULED,
    PAYMENT_STATES.TRANSFER_PENDING, PAYMENT_STATES.TRANSFERRED, PAYMENT_STATES.REFUND_PENDING,
    PAYMENT_STATES.REFUNDED_PARTIAL, PAYMENT_STATES.REFUNDED_FULL, PAYMENT_STATES.DISPUTED,
    'pending', 'requires_payment_method', 'requires_confirmation', 'processing', 'succeeded', 'refunded', 'partially_refunded',
  ]);
  if (active.some(payment => !knownStatuses.has(String(payment.payment_status || '').toLowerCase()))) return unavailable;
  const payment = active[0];
  if (!payment) return { state: 'ready', can_continue: true };
  const status = String(payment.payment_status || '').toLowerCase();
  const summary = (state, canContinue = false) => ({ state, can_continue: canContinue, payment_status: status });
  if (status === PAYMENT_STATES.AUTHORIZATION_FAILED) return summary('retry', true);
  if ([PAYMENT_STATES.AUTHORIZE_PENDING, 'pending', 'requires_payment_method', 'requires_confirmation'].includes(status)) {
    if (!payment.stripe_payment_intent_id) return unavailable;
    try {
      const intent = await stripeService.readListingCheckoutIntent(payment);
      if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(intent.status)) {
        return summary('pending', true);
      }
      if (intent.status === 'requires_capture') return summary('authorized');
      // A provider result cannot establish recorded settlement. Wait for the
      // existing webhook before projecting a durable paid state.
      if (['processing', 'succeeded'].includes(intent.status)) return summary('processing');
    } catch (_error) {
      logger.warn('Could not verify listing checkout state', { offerId: offer.id });
    }
    return unavailable;
  }
  if (status === PAYMENT_STATES.AUTHORIZED) return summary('authorized');
  if ([PAYMENT_STATES.CAPTURE_PENDING, 'processing'].includes(status)) return summary('processing');
  if ([PAYMENT_STATES.CAPTURED_HOLD, PAYMENT_STATES.TRANSFER_SCHEDULED, PAYMENT_STATES.TRANSFER_PENDING,
    PAYMENT_STATES.TRANSFERRED, 'succeeded'].includes(status)) return summary('paid');
  if (status === PAYMENT_STATES.REFUND_PENDING) return summary('refund_pending');
  if ([PAYMENT_STATES.REFUNDED_PARTIAL, 'partially_refunded'].includes(status)) return summary('partially_refunded');
  if ([PAYMENT_STATES.REFUNDED_FULL, 'refunded'].includes(status)) return summary('refunded');
  if (status === PAYMENT_STATES.DISPUTED) return summary('disputed');
  return unavailable;
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
    .select('status, active_offer_count')
    .eq('id', offer.listing_id)
    .single();

  if (!offerListing || offerListing.status !== 'active') {
    const err = new Error('Listing is no longer available');
    err.status = 409;
    throw err;
  }

  // 0b. Hold the listing for this buyer: active -> pending_pickup ("promised to a buyer, awaiting handoff"; the
  // listing_status enum has no 'reserved'). The update only matches an active listing, so two accepts can't both
  // win, and a failed write fails the accept instead of leaving the listing on sale.
  const { data: held, error: holdErr } = await supabaseAdmin
    .from('Listing')
    .update({ status: 'pending_pickup', active_offer_count: 0, updated_at: new Date().toISOString() })
    .eq('id', offer.listing_id)
    .eq('status', 'active')
    .select('id');

  if (holdErr) {
    logger.error('Failed to hold listing for accepted offer', { error: holdErr.message, offerId });
    throw holdErr;
  }
  if (!held || held.length === 0) {
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
    // Give the listing back so it isn't left on hold for an offer that wasn't accepted.
    const { error: releaseErr } = await supabaseAdmin
      .from('Listing')
      .update({ status: 'active', active_offer_count: offerListing.active_offer_count || 0, updated_at: new Date().toISOString() })
      .eq('id', offer.listing_id)
      .eq('status', 'pending_pickup');
    if (releaseErr) logger.error('Failed to release listing after a failed accept', { error: releaseErr.message, offerId });
    throw updateErr;
  }

  // 2. (The listing was held above, with its offer count reset: all other offers are declined next.)

  // 3. Decline all other pending offers on the same listing
  const { data: otherOffers } = await supabaseAdmin
    .from('ListingOffer')
    .select('id, buyer_id')
    .eq('listing_id', offer.listing_id)
    .in('status', ['pending', 'countered'])
    .neq('id', offerId);

  if (otherOffers && otherOffers.length > 0) {
    const otherIds = otherOffers.map((o) => o.id);
    const { error: declineErr } = await supabaseAdmin
      .from('ListingOffer')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', otherIds);
    if (declineErr) {
      // The accept stands and the listing is on hold, so these offers can no longer be accepted.
      logger.error('Failed to decline the other offers after an accept', { error: declineErr.message, offerId });
    }

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

  const { error: countErr } = await supabaseAdmin
    .from('Listing')
    .update({
      active_offer_count: Math.max((listing?.active_offer_count || 1) - 1, 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', offer.listing_id);
  if (countErr) logger.error('Failed to update the listing offer count', { error: countErr.message, offerId });

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

  const { error: countErr } = await supabaseAdmin
    .from('Listing')
    .update({
      active_offer_count: Math.max((listing?.active_offer_count || 1) - 1, 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', offer.listing_id);
  if (countErr) logger.error('Failed to update the listing offer count', { error: countErr.message, offerId });

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
  const { error: soldErr } = await supabaseAdmin
    .from('Listing')
    .update({ status: 'sold', sold_at: now, updated_at: now })
    .eq('id', offer.listing_id);

  if (soldErr) {
    logger.error('Failed to mark listing sold', { error: soldErr.message, offerId });
    const { error: revertErr } = await supabaseAdmin
      .from('ListingOffer')
      .update({ status: 'accepted', completed_at: null, updated_at: new Date().toISOString() })
      .eq('id', offerId);
    if (revertErr) logger.error('Failed to reopen offer after a failed sale', { error: revertErr.message, offerId });
    throw soldErr;
  }

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
  buyerCheckoutSummary,
  createOffer,
  counterOffer,
  acceptOffer,
  declineOffer,
  withdrawOffer,
  completeTransaction,
  expireStaleOffers,
};
