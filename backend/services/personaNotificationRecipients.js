const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// Shared by Beacon broadcasts and persona-authored posts. A temporary mute
// suppresses notifications, not access to updates in the feed or Following.
async function getPersonaNotificationRecipientIds(
  persona,
  visibility,
  targetRank = null,
  now = Date.now(),
) {
  if (!persona?.id) return [];
  const { data, error } = await supabaseAdmin
    .from('PersonaMembership')
    .select(
      'user_id, relationship_type, notification_level, tier_id, muted_until',
    )
    .eq('persona_id', persona.id)
    .in('status', ['active', 'past_due'])
    .neq('notification_level', 'none');
  if (error) {
    logger.warn('persona.notification_recipients.error', {
      error: error.message,
      personaId: persona.id,
    });
    return [];
  }
  let memberships = (data || []).filter(
    (m) =>
      m.user_id &&
      m.user_id !== persona.user_id &&
      (!m.muted_until || new Date(m.muted_until).getTime() <= now),
  );
  if (!memberships.length) return [];

  // Query failures must not disclose a restricted update in a notification.
  const { data: blocks, error: blockError } = await supabaseAdmin
    .from('PersonaBlock')
    .select('blocked_user_id')
    .eq('persona_id', persona.id)
    .in(
      'blocked_user_id',
      memberships.map((m) => m.user_id),
    );
  if (blockError) {
    logger.warn('persona.notification_recipients.block_error', {
      error: blockError.message,
      personaId: persona.id,
    });
    return [];
  }
  const blocked = new Set((blocks || []).map((b) => b.blocked_user_id));
  memberships = memberships.filter((m) => !blocked.has(m.user_id));

  if (visibility === 'tier_or_above' || visibility === 'subscribers') {
    const requiredRank =
      visibility === 'subscribers' ? 2 : Number(targetRank || 1);
    const tierIds = [
      ...new Set(memberships.map((m) => m.tier_id).filter(Boolean)),
    ];
    const rankByTierId = new Map();
    if (tierIds.length) {
      const { data: tiers, error: tierError } = await supabaseAdmin
        .from('PersonaTier')
        .select('id, rank')
        .in('id', tierIds);
      if (tierError) {
        logger.warn('persona.notification_recipients.tier_error', {
          error: tierError.message,
          personaId: persona.id,
        });
        return [];
      }
      (tiers || []).forEach((tier) =>
        rankByTierId.set(tier.id, Number(tier.rank || 0)),
      );
    }
    memberships = memberships.filter((m) => {
      // Active legacy followers without a tier retain free-follow access;
      // pre-tier subscribers retain the historical Member rank only.
      const rank = Math.max(
        Number(rankByTierId.get(m.tier_id) || 0),
        m.relationship_type === 'subscriber' ? 2 : 1,
      );
      return rank >= requiredRank;
    });
  }
  return [...new Set(memberships.map((m) => m.user_id))];
}

module.exports = { getPersonaNotificationRecipientIds };
