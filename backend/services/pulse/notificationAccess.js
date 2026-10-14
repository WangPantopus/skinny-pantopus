'use strict';

const db = require('../../config/supabaseAdmin');

function referencesPost(notification) {
  return Boolean(notification.metadata?.post_id || notification.metadata?.plan_id
    || /^\/(?:app\/)?(?:posts|plans)\/[0-9a-fA-F-]{36}(?:\/|$)/.test(notification.link || ''));
}

// Use the same current database predicate as the inbox, before anything leaves
// the server through sockets, desktop alerts or push. Unrelated notices need no
// home lookup. Group a bulk fanout by recipient, never reuse another viewer's grants.
async function readableNotifications(notifications) {
  const groups = new Map();
  const allowed = new Set();
  for (const notification of notifications) {
    if (!referencesPost(notification)) {
      allowed.add(notification.id);
      continue;
    }
    const ids = groups.get(notification.user_id) || [];
    ids.push(notification.id);
    groups.set(notification.user_id, ids);
  }
  if (groups.size) {
    // notificationService participates in the persona lifecycle import cycle.
    const { notificationPostFilter } = require('./readAccess');
    for (const [userId, ids] of groups) {
      const filter = await notificationPostFilter(userId);
      const { data, error } = await filter(db.from('Notification').select('id')
        .eq('user_id', userId).in('id', ids));
      if (error) throw error; // The caller suppresses emission on a failed privacy check.
      for (const row of data || []) allowed.add(row.id);
    }
  }
  return notifications.filter(notification => allowed.has(notification.id));
}

module.exports = { readableNotifications };
