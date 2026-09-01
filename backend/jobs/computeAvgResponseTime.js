/**
 * Compute Average Response Time — Nightly Cron Job
 *
 * For each business with a published profile, computes the average time
 * between ChatRoom creation and the first reply from the business user.
 * Stores the result on BusinessProfile.avg_response_minutes.
 *
 * Rules:
 *   - Only counts rooms created in the last 90 days (recency).
 *   - Skips rooms where the business sent the very first message
 *     (business-initiated chats have no "response" to measure).
 *   - Caps individual response times at 7 days (outlier guard).
 *   - Requires response time > 0 minutes (sanity).
 *
 * Runs daily at 5:00 AM UTC.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// Only look at rooms from the last 90 days
const LOOKBACK_DAYS = 90;
// Max response time to count (7 days in minutes)
const MAX_RESPONSE_MINUTES = 7 * 24 * 60;

async function computeAvgResponseTime() {
  // 1. Get all published business user IDs
  const { data: profiles, error: profileErr } = await supabaseAdmin
    .from('BusinessProfile')
    .select('business_user_id')
    .eq('is_published', true);

  if (profileErr) {
    logger.error('[computeAvgResponseTime] Error fetching profiles', { error: profileErr.message });
    return;
  }
  if (!profiles?.length) {
    logger.info('[computeAvgResponseTime] No published profiles, skipping');
    return;
  }

  const cutoffDate = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let updatedCount = 0;
  let skippedCount = 0;

  for (const { business_user_id: bizId } of profiles) {
    try {
      // 2. Get rooms this business participates in
      const { data: participations } = await supabaseAdmin
        .from('ChatParticipant')
        .select('room_id')
        .eq('user_id', bizId)
        .eq('is_active', true);

      if (!participations?.length) {
        skippedCount++;
        continue;
      }

      const roomIds = participations.map(p => p.room_id);

      // 3. Get room creation times (recent rooms only)
      const { data: rooms } = await supabaseAdmin
        .from('ChatRoom')
        .select('id, created_at')
        .in('id', roomIds)
        .gte('created_at', cutoffDate);

      if (!rooms?.length) {
        skippedCount++;
        continue;
      }

      const recentRoomIds = rooms.map(r => r.id);
      const roomCreatedMap = new Map(rooms.map(r => [r.id, new Date(r.created_at)]));

      // 4. Get all messages in these rooms, oldest first, to determine:
      //    a) who sent the first message (skip if business initiated)
      //    b) when the business first replied
      //    We fetch room_id + user_id + created_at only, limited to first 5 per room
      //    (we only need the first few to determine initiator + first biz reply).
      //    Since Supabase doesn't support per-group limits, fetch all and group in JS.
      const { data: messages } = await supabaseAdmin
        .from('ChatMessage')
        .select('room_id, user_id, created_at')
        .in('room_id', recentRoomIds)
        .eq('deleted', false)
        .order('created_at', { ascending: true });

      if (!messages?.length) {
        skippedCount++;
        continue;
      }

      // 5. Group by room: find first overall message + first business reply
      const firstMsgByRoom = new Map();       // room_id → { user_id, created_at }
      const firstBizReplyByRoom = new Map();  // room_id → created_at (Date)

      for (const msg of messages) {
        // Track the very first message in each room
        if (!firstMsgByRoom.has(msg.room_id)) {
          firstMsgByRoom.set(msg.room_id, msg);
        }
        // Track the first message from the business in each room
        if (msg.user_id === bizId && !firstBizReplyByRoom.has(msg.room_id)) {
          firstBizReplyByRoom.set(msg.room_id, new Date(msg.created_at));
        }
      }

      // 6. Compute response times
      const responseTimes = [];

      for (const [roomId, bizReplyAt] of firstBizReplyByRoom) {
        const firstMsg = firstMsgByRoom.get(roomId);

        // Skip rooms where the business sent the first message (business-initiated)
        if (!firstMsg || firstMsg.user_id === bizId) continue;

        // Response time = first business reply - first customer message
        const customerMsgAt = new Date(firstMsg.created_at);
        const diffMinutes = (bizReplyAt - customerMsgAt) / (1000 * 60);

        if (diffMinutes > 0 && diffMinutes < MAX_RESPONSE_MINUTES) {
          responseTimes.push(diffMinutes);
        }
      }

      // 7. Update BusinessProfile with the average
      if (responseTimes.length > 0) {
        const avg = Math.round(
          responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        );

        const { error: updateErr } = await supabaseAdmin
          .from('BusinessProfile')
          .update({ avg_response_minutes: avg })
          .eq('business_user_id', bizId);

        if (updateErr) {
          logger.error('[computeAvgResponseTime] Update failed', {
            businessId: bizId,
            error: updateErr.message,
          });
        } else {
          updatedCount++;
        }
      } else {
        skippedCount++;
      }
    } catch (err) {
      logger.error('[computeAvgResponseTime] Error processing business', {
        businessId: bizId,
        error: err.message,
      });
    }
  }

  logger.info('[computeAvgResponseTime] Completed', {
    totalBusinesses: profiles.length,
    updatedCount,
    skippedCount,
  });
}

module.exports = computeAvgResponseTime;
