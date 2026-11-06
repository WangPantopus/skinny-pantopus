/**
 * The words every printer's delivery updates are read in. A printer's adapter hands
 * its events over under these names, so the flows never see a printer's own vocabulary.
 */

const VENDOR_STATUS = {
  'postcard.created': 'created',
  'postcard.rendered_pdf': 'rendered',
  'postcard.rendered_thumbnails': 'rendered',
  'postcard.deleted': 'canceled',
  'postcard.delivered': 'delivered',
  'postcard.failed': 'failed',
  'postcard.rejected': 'failed',
  'postcard.re-routed': 'rerouted',
  'postcard.returned_to_sender': 'returned',
  'postcard.mailed': 'mailed',
  'postcard.in_transit': 'in_transit',
  'postcard.in_local_area': 'in_local_area',
  'postcard.international_exit': 'in_transit',
  'postcard.processed_for_delivery': 'out_for_delivery',
};
const ENDS_ATTEMPT = new Set(['returned', 'rerouted', 'failed', 'canceled']);

/** @returns {string} our status for a printer event, 'unknown' for one we don't read */
const vendorStatusFor = (eventType) => VENDOR_STATUS[eventType] || 'unknown';

/** @returns {string|null} how this event ends a card's attempt, or null when it doesn't */
function outcomeFor(eventType) {
  const status = vendorStatusFor(eventType);
  return ENDS_ATTEMPT.has(status) ? status : null;
}

/**
 * Asking a printer about a piece waits this long after our last call to it. Every send
 * gives up within a minute, so by then the printer has answered or never will.
 */
const RECONCILE_GRACE_MS = 15 * 60 * 1000;
/** A card the printer never took is sent again for this long. After that the person decides. */
const AUTO_RESEND_WINDOW_MS = 72 * 60 * 60 * 1000;
const RECONCILE_BATCH = 50;

module.exports = { vendorStatusFor, outcomeFor, RECONCILE_GRACE_MS, AUTO_RESEND_WINDOW_MS, RECONCILE_BATCH };
