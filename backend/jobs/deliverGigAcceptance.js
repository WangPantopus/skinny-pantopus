const db = require('../config/supabaseAdmin');
const { deliverStoredGigNotification } = require('../services/notificationService');
const logger = require('../utils/logger');

async function call(name, args = {}) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error('Acceptance delivery storage unavailable');
  return data;
}

// One event is leased just before sending, so a batch cannot age out in a queue.
// Unknown transport outcomes may retry the same notification ID (at least once).
// Assignment, current preferences and current token ownership are rechecked.
async function deliverGigAcceptance() {
  let processed = 0;
  while (processed < 25) {
    const event = await call('claim_gig_acceptance_delivery');
    if (!event) break;
    const args = { p_id: event.id, p_lease_id: event.lease_id };
    let outcome = 'retry';
    let errorCode = null;
    try {
      const current = await call('read_gig_acceptance_delivery', args);
      if (!current || current.error) throw new Error('Acceptance delivery lease unavailable');
      if (!current.eligible) outcome = 'suppressed';
      else {
        const receipt = await deliverStoredGigNotification(current.notification);
        outcome = receipt.unresolvedCount > 0 ? 'retry' : receipt.suppressed ? 'suppressed' : 'done';
        if (outcome === 'retry') errorCode = 'provider_outcome_unknown';
      }
    } catch {
      errorCode = 'delivery_unavailable';
    }
    const saved = await call('finish_gig_acceptance_delivery', { ...args, p_outcome: outcome, p_error: errorCode });
    if (saved !== true) throw new Error('Acceptance delivery receipt not saved');
    processed += 1;
  }
  if (processed) logger.info('Processed durable gig acceptance notifications', { count: processed });
  return { processed };
}
module.exports = deliverGigAcceptance;
