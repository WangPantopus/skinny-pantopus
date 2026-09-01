/**
 * Chat Redaction Background Job
 *
 * Permanently redacts soft-deleted chat messages whose retention period
 * has expired. Replaces message text with '[deleted message]' and clears
 * attachments. Processes in batches to avoid large transactions.
 *
 * Replaces the synchronous per-request redaction that previously ran on
 * every message fetch (GET /rooms/:roomId/messages and
 * GET /conversations/:otherUserId/messages).
 *
 * Runs hourly at :30.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const REDACTED_MESSAGE = '[deleted message]';
const BATCH_SIZE = 200;
const DEFAULT_RETENTION_DAYS = Math.max(parseInt(process.env.CHAT_DELETED_REDACT_DAYS || '180', 10) || 180, 1);

// Per-room retention overrides from CHAT_ROOM_RETENTION_DAYS env var
// Format: JSON object { "roomId": days, ... }
const ROOM_RETENTION_OVERRIDES = (() => {
  try {
    const parsed = JSON.parse(process.env.CHAT_ROOM_RETENTION_DAYS || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    for (const [roomId, days] of Object.entries(parsed)) {
      const n = Math.max(parseInt(days, 10) || 0, 0);
      if (n > 0) out[String(roomId)] = n;
    }
    return out;
  } catch {
    return {};
  }
})();

async function chatRedactionJob() {
  let totalRedacted = 0;

  // 1. Handle rooms with custom retention periods first
  for (const [roomId, retentionDays] of Object.entries(ROOM_RETENTION_OVERRIDES)) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('ChatMessage')
      .update({ message: REDACTED_MESSAGE, attachments: [] })
      .eq('room_id', roomId)
      .eq('deleted', true)
      .lt('deleted_at', cutoff)
      .neq('message', REDACTED_MESSAGE)
      .select('id');

    if (error) {
      logger.error('[chatRedaction] Error redacting room with override', {
        roomId,
        retentionDays,
        error: error.message,
      });
    } else if (data && data.length > 0) {
      totalRedacted += data.length;
      logger.info('[chatRedaction] Redacted messages in override room', {
        roomId,
        count: data.length,
        retentionDays,
      });
    }
  }

  // 2. Batch-process all other expired deleted messages using the default retention
  const defaultCutoff = new Date(Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const overrideRoomIds = Object.keys(ROOM_RETENTION_OVERRIDES);

  let hasMore = true;
  while (hasMore) {
    // Find candidates: deleted, past cutoff, not yet redacted, not in override rooms
    let query = supabaseAdmin
      .from('ChatMessage')
      .select('id')
      .eq('deleted', true)
      .lt('deleted_at', defaultCutoff)
      .neq('message', REDACTED_MESSAGE)
      .order('deleted_at', { ascending: true })
      .limit(BATCH_SIZE);

    // Exclude rooms with custom retention (already handled above)
    if (overrideRoomIds.length > 0) {
      // PostgREST doesn't support NOT IN directly, so we use .not('room_id', 'in', ...)
      query = query.not('room_id', 'in', `(${overrideRoomIds.join(',')})`);
    }

    const { data: candidates, error: findErr } = await query;

    if (findErr) {
      logger.error('[chatRedaction] Error finding candidates', { error: findErr.message });
      break;
    }

    if (!candidates || candidates.length === 0) {
      hasMore = false;
      break;
    }

    const ids = candidates.map((c) => c.id);
    const { error: updateErr } = await supabaseAdmin
      .from('ChatMessage')
      .update({ message: REDACTED_MESSAGE, attachments: [] })
      .in('id', ids);

    if (updateErr) {
      logger.error('[chatRedaction] Error redacting batch', { error: updateErr.message, batchSize: ids.length });
      break;
    }

    totalRedacted += ids.length;

    // If we got fewer than BATCH_SIZE, we're done
    if (ids.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  if (totalRedacted > 0) {
    logger.info('[chatRedaction] Completed', { totalRedacted });
  } else {
    logger.debug('[chatRedaction] No messages to redact');
  }
}

module.exports = chatRedactionJob;
