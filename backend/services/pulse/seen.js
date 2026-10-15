'use strict';
const db = require('../../config/supabaseAdmin');

const columnFor = view => view === 'following' ? 'pulse_following_seen_at' : 'pulse_nearby_seen_at';
async function lastSeen(userId, view) {
  const column = columnFor(view);
  const { data, error } = await db.from('UserFeedPreference').select(column).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.[column] || null;
}
async function advance(userId, view, through) {
  const { data, error } = await db.rpc('pulse_advance_feed_seen', {
    p_user_id: userId, p_view: view, p_through: through,
  });
  if (error) throw error;
  return { ok: true, through: data };
}
module.exports = { lastSeen, advance };
