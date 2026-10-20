/**
 * listingBlocks.js — Profile blocks (UserBlock) in listing interactions.
 *
 * Two people across a block, in either direction, can't reach each other
 * through a listing, as gig bids are refused (routes/gigs.js): no inquiry,
 * offer, trade or question, and no deal moves forward (counter, accept,
 * complete, answer, address reveal). Either person can still back out:
 * decline, withdraw or cancel. Every refusal has the same message, so it
 * never says who blocked whom.
 */

const blockService = require('../blockService');

const REFUSED = "This action isn't available for this listing.";
const UNAVAILABLE = 'This listing could not be checked right now. Please try again.';

function refusal(status, message) {
  return Object.assign(new Error(message), { status, listingBlockRefusal: true });
}

/**
 * Throws a 403 refusal when the two people are across a block, or a 503 one
 * when the block list can't be read (never "not blocked" on a failed read).
 */
async function assertListingInteractionAllowed(userId, otherUserId) {
  let blocked;
  try {
    blocked = await blockService.isBlocked(userId, otherUserId);
  } catch {
    throw refusal(503, UNAVAILABLE);
  }
  if (blocked) throw refusal(403, REFUSED);
}

module.exports = { assertListingInteractionAllowed };
