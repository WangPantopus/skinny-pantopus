'use strict';

// Pulse posting limits (contract §5 and §2.5): one place to tune them. Windows roll.
const db = require('../../config/supabaseAdmin');

const DAY_MS = 24 * 60 * 60 * 1000;
// `targets`: the distribution a counted post has (a place page's observations are their own, S16).
const LIMITS = {
  // A Visitor starts Asks only, one a day.
  visitor_ask: { limit: 1, windowMs: DAY_MS, postType: 'ask_local', targets: ['place'] },
  // New here (a postcard is pending): two posts a day, observations included.
  new_here: { limit: 2, windowMs: DAY_MS, targets: ['place', 'place_observation'] },
  // Share: two per person in a rolling week, whatever the label.
  share: { limit: 2, windowMs: 7 * DAY_MS, postType: 'share', targets: ['place'] },
  // A Visitor's dated observation on a place page: one a day.
  visitor_observation: { limit: 1, windowMs: DAY_MS, targets: ['place_observation'] },
};
const MAX_PHOTOS = 9;
const ALERT_DEFAULT_MS = 48 * 60 * 60 * 1000;
const ALERT_MAX_MS = 14 * DAY_MS;

// The author's Place posts in a limit's window, oldest first (id breaks ties).
async function postsInWindow(userId, scope, now = Date.now()) {
  const rule = LIMITS[scope];
  let query = db.from('Post').select('id, created_at').eq('user_id', userId)
    .overlaps('distribution_targets', rule.targets)
    .gt('created_at', new Date(now - rule.windowMs).toISOString())
    .order('created_at').order('id').limit(rule.limit + 50);
  if (rule.postType) query = query.eq('post_type', rule.postType);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** null when the author may post, else the refusal body for that scope's 429. */
async function check(userId, scope, now = Date.now()) {
  const rule = LIMITS[scope];
  const rows = await postsInWindow(userId, scope, now);
  if (rows.length < rule.limit) return null;
  return { limit: rule.limit, scope,
    resets_at: new Date(Date.parse(rows[rows.length - rule.limit].created_at) + rule.windowMs).toISOString() };
}

/** After an insert: whether `postId` landed beyond the limit (two posts raced past check). */
async function exceededBy(userId, scope, postId) {
  const rows = await postsInWindow(userId, scope);
  const position = rows.findIndex(row => row.id === postId);
  return position >= LIMITS[scope].limit;
}

module.exports = { LIMITS, MAX_PHOTOS, ALERT_DEFAULT_MS, ALERT_MAX_MS, check, exceededBy };
