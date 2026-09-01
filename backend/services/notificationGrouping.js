/**
 * Notification feed grouping utility.
 *
 * Audience Profile design v2 §6.2: the in-app feed groups by
 * (related_entity_type, related_entity_id, context) — never by user_id
 * across contexts. Two notifications about the same entity collapse only
 * when they share the same context. A personal-context notification and an
 * audience-context notification with the same user_id NEVER group, even if
 * they happen to reference the same row id.
 *
 * The current notifications route (backend/routes/notifications.js) is a
 * flat list and does not group. This utility documents and tests the
 * intended grouping rule so Phase 1 can opt in (audience-side feed,
 * grouped views in the inbox tab, etc.) without re-deriving the privacy
 * invariant.
 */

const { CONTEXTS } = require('./notificationTemplateRegistry');

function normalizeContext(value) {
  return CONTEXTS.includes(value) ? value : 'personal';
}

function relatedEntityKey(notif) {
  const md = notif.metadata || {};
  // Common ids across the notify functions in notificationService.js.
  const candidates = [
    ['gig', md.gig_id],
    ['listing', md.listing_id],
    ['home', md.home_id || notif.home_id],
    ['mailbox', md.mailbox_id],
    ['membership', md.membership_id],
    ['follow', md.follow_id],
    ['persona', md.persona_id],
    ['task', md.task_id],
    ['claim', md.claim_id],
    // Fallback to the notification's own related_entity_* columns if a
    // future schema adds them; otherwise null.
    ['related', notif.related_entity_id],
  ];
  for (const [type, id] of candidates) {
    if (id) return { type, id: String(id) };
  }
  // No groupable entity → group by type + the notification's own id so each
  // such notification appears as its own row.
  return { type: notif.type || 'other', id: String(notif.id) };
}

/**
 * Group notifications using the (user_id, context, related_entity) tuple
 * as the group key. Notifications from different contexts NEVER share a
 * group, even when their related entity matches.
 *
 * Returns an array of group objects in input order:
 *   {
 *     key: 'user-123|personal|gig|abc-123',
 *     userId: 'user-123',
 *     context: 'personal',
 *     entityType: 'gig',
 *     entityId: 'abc-123',
 *     count: 3,
 *     latest: <newest notification>,
 *     notifications: [<n1>, <n2>, <n3>],
 *   }
 *
 * @param {Array} notifications  rows in newest-first order (the way the
 *                               existing route returns them).
 */
function groupNotifications(notifications) {
  if (!Array.isArray(notifications)) return [];
  const groups = new Map();
  const order = [];
  for (const notif of notifications) {
    if (!notif) continue;
    const userId = notif.user_id || '';
    const context = normalizeContext(notif.context);
    const { type, id } = relatedEntityKey(notif);
    const key = `${userId}|${context}|${type}|${id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        userId,
        context,
        entityType: type,
        entityId: id,
        count: 0,
        latest: notif,
        notifications: [],
      });
      order.push(key);
    }
    const group = groups.get(key);
    group.notifications.push(notif);
    group.count = group.notifications.length;
    // `latest` always points at the newest notification — assume input is
    // newest-first; otherwise replace if the new row has a later created_at.
    if (
      !group.latest.created_at
      || (notif.created_at && new Date(notif.created_at) > new Date(group.latest.created_at))
    ) {
      group.latest = notif;
    }
  }
  return order.map((k) => groups.get(k));
}

module.exports = {
  groupNotifications,
  relatedEntityKey,
  normalizeContext,
};
