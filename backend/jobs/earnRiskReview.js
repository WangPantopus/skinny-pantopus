// ============================================================
// EARN RISK REVIEW JOB
// Periodic review of risk sessions and earn behavior:
// - Calculates rolling risk scores per user
// - Transitions users through risk tiers (normal → pending_review → under_review → suspended)
// - Auto-lifts suspensions after expiry
// - Flags suspicious patterns for admin review
// Runs every 15 minutes.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// Risk thresholds (match backend route calculateRiskScore)
const RISK_THRESHOLDS = {
  normal: { max: 29 },
  pending_review: { min: 30, max: 59 },
  under_review: { min: 60, max: 84 },
  suspended: { min: 85 },
};

async function earnRiskReview() {
  logger.info('[EarnRisk] Starting risk review job');

  // 1. Auto-lift expired suspensions
  const now = new Date().toISOString();
  const { data: expiredSuspensions } = await supabaseAdmin
    .from('EarnSuspension')
    .select('id, user_id')
    .eq('status', 'active')
    .lt('expires_at', now);

  let lifted = 0;
  for (const suspension of (expiredSuspensions || [])) {
    try {
      await supabaseAdmin
        .from('EarnSuspension')
        .update({ status: 'expired' })
        .eq('id', suspension.id);

      // Clear user's suspension flag
      await supabaseAdmin
        .from('User')
        .update({ earn_suspended_until: null })
        .eq('id', suspension.user_id);

      await supabaseAdmin.from('MailEvent').insert({
        event_type: 'earn_suspension_lifted',
        user_id: suspension.user_id,
        metadata: { suspension_id: suspension.id },
      });

      lifted++;
    } catch (err) {
      logger.error('[EarnRisk] Error lifting suspension', {
        suspensionId: suspension.id,
        error: err.message,
      });
    }
  }

  if (lifted > 0) {
    logger.info(`[EarnRisk] Lifted ${lifted} expired suspensions`);
  }

  // 2. Review active risk sessions from last 15 minutes
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: recentSessions } = await supabaseAdmin
    .from('EarnRiskSession')
    .select('user_id, risk_score, risk_flags')
    .gte('updated_at', fifteenMinAgo);

  if (!recentSessions || recentSessions.length === 0) {
    logger.info('[EarnRisk] No recent risk sessions to review');
    return;
  }

  // Group by user and get max risk score
  const userRisks = {};
  for (const session of recentSessions) {
    if (!userRisks[session.user_id] || session.risk_score > userRisks[session.user_id].maxScore) {
      userRisks[session.user_id] = {
        maxScore: session.risk_score,
        flags: session.risk_flags || [],
      };
    }
  }

  let reviewed = 0;
  let flagged = 0;

  for (const [userId, risk] of Object.entries(userRisks)) {
    try {
      const { maxScore, flags } = risk;

      // Determine action based on score
      let action = 'normal';
      if (maxScore >= RISK_THRESHOLDS.suspended.min) {
        action = 'suspended';
      } else if (maxScore >= RISK_THRESHOLDS.under_review.min) {
        action = 'under_review';
      } else if (maxScore >= RISK_THRESHOLDS.pending_review.min) {
        action = 'pending_review';
      }

      if (action === 'suspended') {
        // Check if already suspended
        const { count: existingSuspension } = await supabaseAdmin
          .from('EarnSuspension')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'active');

        if (existingSuspension === 0) {
          // Create suspension
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          await supabaseAdmin.from('EarnSuspension').insert({
            user_id: userId,
            reason: `Risk score ${maxScore} exceeded threshold. Flags: ${flags.join(', ')}`,
            risk_score: maxScore,
            expires_at: expiresAt,
            status: 'active',
          });

          await supabaseAdmin
            .from('User')
            .update({ earn_suspended_until: expiresAt })
            .eq('id', userId);

          await supabaseAdmin.from('MailEvent').insert({
            event_type: 'earn_suspended',
            user_id: userId,
            metadata: { risk_score: maxScore, flags, expires_at: expiresAt },
          });

          flagged++;
          logger.warn('[EarnRisk] User suspended', { userId, riskScore: maxScore, flags });
        }
      } else if (action === 'under_review' || action === 'pending_review') {
        // Log review event for admin dashboard
        await supabaseAdmin.from('MailEvent').insert({
          event_type: 'earn_risk_flagged',
          user_id: userId,
          metadata: {
            risk_score: maxScore,
            action,
            flags,
          },
        });
        flagged++;
      }

      reviewed++;
    } catch (err) {
      logger.error('[EarnRisk] Error reviewing user risk', {
        userId,
        error: err.message,
      });
    }
  }

  logger.info(`[EarnRisk] Complete: ${reviewed} users reviewed, ${flagged} flagged/suspended, ${lifted} suspensions lifted`);
}

module.exports = earnRiskReview;
