const db = require('../config/supabaseAdmin');
const { deliverStoredGigNotification } = require('../services/notificationService');
const logger = require('../utils/logger');

async function call(name, args = {}) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error('Payment delivery storage unavailable');
  return data;
}

// One event is leased just before sending, so a batch cannot age out in a queue.
// Unknown transport outcomes may retry the same notification ID (at least once).
// Exact financial proof, current preferences and current token ownership are rechecked.
async function deliverWalletSettlement() {
  let processed = 0;
  // Reuse the existing scheduler and transport for both committed event kinds.
  // Bound each queue independently so wallet traffic cannot starve tip notices.
  for (const kind of ['wallet_settlement', 'gig_tip']) {
    let claimed = 0;
    while (claimed < 25) {
      const event = await call(`claim_${kind}_delivery`);
      if (!event) break;
      const args = { p_id: event.id, p_lease_id: event.lease_id };
      let outcome = 'retry';
      let errorCode = null;
      try {
        const current = await call(`read_${kind}_delivery`, args);
        if (!current || current.error) throw new Error('Payment delivery lease unavailable');
        if (!current.eligible) outcome = 'suppressed';
        else {
          const receipt = await deliverStoredGigNotification(current.notification, kind === 'gig_tip'
            ? { pushAllowedAtCapture: current.pushAllowedAtCapture } : undefined);
          if (!Number.isSafeInteger(receipt?.acceptedCount) || receipt.acceptedCount < 0
              || !Number.isSafeInteger(receipt?.unresolvedCount) || receipt.unresolvedCount < 0) {
            throw new Error('Payment delivery transport receipt unavailable');
          }
          outcome = receipt.unresolvedCount > 0 ? 'retry' : receipt.suppressed ? 'suppressed' : 'done';
          if (outcome === 'retry') errorCode = 'provider_outcome_unknown';
        }
      } catch {
        errorCode = 'delivery_unavailable';
      }
      const saved = await call(`finish_${kind}_delivery`, { ...args, p_outcome: outcome, p_error: errorCode });
      if (saved !== true) throw new Error('Payment delivery receipt not saved');
      processed += 1;
      claimed += 1;
    }
  }
  if (processed) logger.info('Processed durable payment notifications', { count: processed });
  return { processed };
}
module.exports = deliverWalletSettlement;
