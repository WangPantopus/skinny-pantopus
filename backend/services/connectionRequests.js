'use strict';

/**
 * Connection requests waiting on a person: the read behind GET /api/relationships/requests/pending,
 * shared with the assistant's "Needs you" (services/ai/needsYou.js). Requests from people on either
 * side of a block are left out.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const blockService = require('./blockService');

const REQUESTER_SELECT = 'id, username, name, first_name, last_name, profile_picture_url, city, state';

/**
 * Pending requests addressed to `userId`, newest first. Throws on a failed read; a block check that
 * can't be made throws with code BLOCK_CHECK_UNAVAILABLE (blockService).
 */
async function pendingReceived(userId) {
  const blockedIds = [...await blockService.blockedUserIds(userId)];
  let query = supabaseAdmin
    .from('Relationship')
    .select(`
        id, status, created_at,
        requester:requester_id (${REQUESTER_SELECT})
      `)
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (blockedIds.length) query = query.not('requester_id', 'in', `(${blockedIds.join(',')})`);
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { code: 'PENDING_READ_FAILED' });
  return data || [];
}

module.exports = { pendingReceived, REQUESTER_SELECT };
