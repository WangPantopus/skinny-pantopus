const supabaseAdmin = require('../config/supabaseAdmin');
const { deliverStoredHomeTaskNotification } = require('./notificationService');

async function rpc(name, args = {}) {
  const { data, error } = await supabaseAdmin.rpc(name, args);
  if (error) throw new Error('Home assignment delivery storage unavailable');
  return data;
}

/** Bounded, leased relay. Retries keep the original Notification/event identity. */
async function deliverPending(limit = 25) {
  const bound = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 25;
  const stats = { selected: 0, delivered: 0, suppressed: 0, retry: 0, leaseLost: 0 };
  for (let index = 0; index < bound; index += 1) {
    const event = await rpc('claim_home_task_assignment_delivery');
    if (!event) break;
    if (!event.id || !event.lease_id) throw new Error('Invalid assignment delivery lease');
    stats.selected += 1;
    const args = { p_id: event.id, p_lease_id: event.lease_id };
    let outcome = 'retry';
    try {
      const current = await rpc('read_home_task_assignment_delivery', args);
      if (current?.lease_lost === true) { stats.leaseLost += 1; continue; }
      if (current?.eligible === false) outcome = 'suppressed';
      else if (current?.eligible === true && typeof current.push_allowed_at_assignment === 'boolean') {
        const receipt = await deliverStoredHomeTaskNotification(current.notification, {
          pushAllowedAtAssignment: current.push_allowed_at_assignment,
        });
        if (!Number.isSafeInteger(receipt?.acceptedCount) || receipt.acceptedCount < 0
          || !Number.isSafeInteger(receipt?.unresolvedCount) || receipt.unresolvedCount < 0) {
          throw new Error('Missing assignment notification transport receipt');
        }
        outcome = receipt.unresolvedCount > 0 ? 'retry' : receipt.suppressed ? 'suppressed' : 'done';
      }
    } catch (_) { /* Unknown storage/provider outcomes retain this same delivery. */ }
    const acknowledged = await rpc('finish_home_task_assignment_delivery', { ...args, p_outcome: outcome });
    if (acknowledged !== true) stats.leaseLost += 1;
    else stats[outcome === 'done' ? 'delivered' : outcome] += 1;
  }
  return stats;
}

module.exports = { deliverPending };
