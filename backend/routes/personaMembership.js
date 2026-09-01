// Fan membership lifecycle routes.
//
// Audience Profile design v2 §7.3 (period mechanics) + §11.6 (fan
// cancel/downgrade UX). All routes are addressed by persona id (the
// fan's own membership on that persona). Owner cannot operate on
// these endpoints — the persona owner manages tier definitions
// (P1.5) and fan moderation (P1.14), but only the fan themselves
// can cancel / change tier on their own subscription.
//
// Mount path: /api/personas/:id/membership
// UUID-gate pattern matches personaTiers / personaPayments / personaDms
// so handle-shaped URLs fall through to the public personas router.

const express = require('express');
const Joi = require('joi');
const router = express.Router({ mergeParams: true });

const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const requireFeatureFlag = require('../middleware/requireFeatureFlag');
const logger = require('../utils/logger');
const { writeIdentityAuditLog } = require('../utils/identityAudit');
const lifecycleService = require('../services/personaSubscriptionLifecycleService');
const dmService = require('../services/personaDmService');
const {
  serializeMembershipForFan,
} = require('../serializers/identitySerializers');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.use((req, _res, next) => {
  if (!UUID_RE.test(req.params.id || '')) return next('router');
  return next();
});

router.use(verifyToken, requireFeatureFlag('audience_profile'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Load the calling fan's own membership on the persona (with persona
// + tier joined via the lifecycle service's helper). 404s if no
// membership exists OR the membership is in a terminal state.
async function loadOwnMembership(req, res, { allowTerminal = false } = {}) {
  const personaId = req.params.id;

  const { data: row } = await supabaseAdmin
    .from('PersonaMembership')
    .select('id')
    .eq('persona_id', personaId)
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }

  const membership = await lifecycleService.getMembershipWithStripe(row.id);
  if (!membership) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  if (!allowTerminal && ['canceled', 'expired'].includes(membership.status)) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return membership;
}

// Compute lightweight quota state for the membership-for-fan
// serializer. Only msg_threads is meaningful pre-v1.1; video_calls
// limit/used always come back null/0 until P10.
async function computeQuotaState(membership) {
  if (!membership) return { msgThreadsLimit: null, msgThreadsUsed: 0, videoCallsLimit: null, videoCallsUsed: 0 };
  const msg = await dmService.getMsgThreadQuota(membership);
  return {
    msgThreadsLimit: msg.limit,
    msgThreadsUsed: msg.used,
    videoCallsLimit: null,
    videoCallsUsed: 0,
  };
}

async function hasExistingRefundRequest(membershipId, reason) {
  if (!membershipId || !reason) return false;
  const { data, error } = await supabaseAdmin
    .from('IdentityAuditLog')
    .select('id, metadata')
    .eq('action', 'persona_membership.refund_requested')
    .eq('target_type', 'PersonaMembership')
    .eq('target_id', membershipId);
  if (error) throw error;
  return (data || []).some((row) => row?.metadata?.reason === reason);
}

async function respondWithMembership(res, membership) {
  const fresh = await lifecycleService.getMembershipWithStripe(membership.id);
  const quota = await computeQuotaState(fresh);
  return res.json({
    membership: serializeMembershipForFan({ ...fresh, quota }),
  });
}

// ---------------------------------------------------------------------------
// GET /membership — fan's own membership view
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const membership = await loadOwnMembership(req, res, { allowTerminal: true });
  if (!membership) return;
  return respondWithMembership(res, membership);
});

// ---------------------------------------------------------------------------
// POST /membership/upgrade { tier_rank }
// ---------------------------------------------------------------------------
const tierChangeSchema = Joi.object({
  tier_rank: Joi.number().integer().min(1).max(4).required(),
});

router.post('/upgrade', validate(tierChangeSchema), async (req, res) => {
  const membership = await loadOwnMembership(req, res);
  if (!membership) return;

  const targetTier = await lifecycleService.getTierByRank(
    membership.persona_id, req.body.tier_rank,
  );
  if (!targetTier || targetTier.status !== 'active') {
    return res.status(404).json({ error: 'Target tier not available' });
  }

  try {
    await lifecycleService.upgrade(membership, targetTier);
  } catch (err) {
    logger.warn('persona_membership.upgrade_failed', {
      membershipId: membership.id, error: err.message,
    });
    return res.status(400).json({ error: err.message });
  }

  await writeIdentityAuditLog({
    req,
    actorUserId: req.user.id,
    targetUserId: membership.persona?.user_id,
    personaId: membership.persona_id,
    action: 'persona_membership.upgrade',
    targetType: 'PersonaMembership',
    targetId: membership.id,
    metadata: {
      from_tier_rank: membership.tier?.rank,
      to_tier_rank: targetTier.rank,
    },
  });

  return respondWithMembership(res, membership);
});

// ---------------------------------------------------------------------------
// POST /membership/downgrade { tier_rank }
// Schedules at period_end via subscriptionSchedule.
// ---------------------------------------------------------------------------
router.post('/downgrade', validate(tierChangeSchema), async (req, res) => {
  const membership = await loadOwnMembership(req, res);
  if (!membership) return;

  const targetTier = await lifecycleService.getTierByRank(
    membership.persona_id, req.body.tier_rank,
  );
  if (!targetTier || targetTier.status !== 'active') {
    return res.status(404).json({ error: 'Target tier not available' });
  }

  try {
    await lifecycleService.downgrade(membership, targetTier);
  } catch (err) {
    logger.warn('persona_membership.downgrade_failed', {
      membershipId: membership.id, error: err.message,
    });
    return res.status(400).json({ error: err.message });
  }

  await writeIdentityAuditLog({
    req,
    actorUserId: req.user.id,
    targetUserId: membership.persona?.user_id,
    personaId: membership.persona_id,
    action: 'persona_membership.downgrade_scheduled',
    targetType: 'PersonaMembership',
    targetId: membership.id,
    metadata: {
      from_tier_rank: membership.tier?.rank,
      to_tier_rank: targetTier.rank,
      effective: 'period_end',
    },
  });

  return respondWithMembership(res, membership);
});

// ---------------------------------------------------------------------------
// POST /membership/cancel
// Free Follower → immediate. Paid → cancel_at_period_end.
// ---------------------------------------------------------------------------
router.post('/cancel', async (req, res) => {
  const membership = await loadOwnMembership(req, res);
  if (!membership) return;

  let result;
  try {
    result = await lifecycleService.cancelAtPeriodEnd(membership);
  } catch (err) {
    logger.warn('persona_membership.cancel_failed', {
      membershipId: membership.id, error: err.message,
    });
    return res.status(400).json({ error: err.message });
  }

  await writeIdentityAuditLog({
    req,
    actorUserId: req.user.id,
    targetUserId: membership.persona?.user_id,
    personaId: membership.persona_id,
    action: 'persona_membership.cancel',
    targetType: 'PersonaMembership',
    targetId: membership.id,
    metadata: {
      tier_rank: membership.tier?.rank,
      immediate: !!result?.immediate,
      scheduled_for: result?.scheduledFor || null,
    },
  });

  return respondWithMembership(res, membership);
});

// ---------------------------------------------------------------------------
// POST /membership/refund-request
// Body: { reason: 'sla_missed' | 'period_unused', threadId? }
//   * sla_missed: at least one of the fan's threads on this persona
//     must currently be in 'sla_missed' state. Issues a prorated
//     refund for the unused portion of the period AND cancels at
//     period_end (fan retains access through current_period_end).
//   * period_unused: not yet supported — placeholder for v1.1 cancel-
//     and-refund-the-rest UX. Returns 400 in this prompt.
// ---------------------------------------------------------------------------
const refundRequestSchema = Joi.object({
  reason: Joi.string().valid('sla_missed', 'period_unused').required(),
  thread_id: Joi.string().uuid().allow(null, ''),
});

router.post('/refund-request',
  validate(refundRequestSchema),
  async (req, res) => {
    const membership = await loadOwnMembership(req, res);
    if (!membership) return;

    if (!membership.stripe_subscription_id) {
      return res.status(400).json({
        error: 'Free memberships have nothing to refund.',
        code: 'no_subscription',
      });
    }
    try {
      if (await hasExistingRefundRequest(membership.id, req.body.reason)) {
        return res.status(409).json({
          error: 'Refund already requested for this membership.',
          code: 'refund_already_requested',
        });
      }
    } catch (err) {
      logger.error('persona_membership.refund_idempotency_check_failed', {
        membershipId: membership.id, error: err.message,
      });
      return res.status(500).json({ error: 'Could not verify refund status' });
    }

    if (req.body.reason === 'sla_missed') {
      // Validate that the fan actually has an sla_missed thread on
      // this persona. Audience-profile §7.2: refund eligibility is
      // gated on the SLA contract being broken, not on the fan's
      // unilateral request.
      const { data: threads } = await supabaseAdmin
        .from('PersonaDmThread')
        .select('id')
        .eq('membership_id', membership.id);
      let qualified = false;
      for (const t of threads || []) {
        if (req.body.thread_id && t.id !== req.body.thread_id) continue;
        const status = await dmService.getReplyPolicyStatus(t.id);
        if (status?.status === 'sla_missed') {
          qualified = true;
          break;
        }
      }
      if (!qualified) {
        return res.status(400).json({
          error: 'No qualifying SLA-missed thread found.',
          code: 'no_sla_missed_thread',
        });
      }
    } else {
      // period_unused path is reserved; v1.0 only supports SLA-missed.
      return res.status(400).json({
        error: 'This refund reason is not yet supported.',
        code: 'reason_not_supported',
      });
    }

    const amountCents = lifecycleService.computeProratedRefundCents(membership);
    let refund = null;
    try {
      if (amountCents > 0) {
        refund = await lifecycleService.issueRefund(membership, {
          amountCents,
          reason: 'sla_missed_reply_policy',
        });
      }
    } catch (err) {
      logger.error('persona_membership.refund_issue_failed', {
        membershipId: membership.id, error: err.message,
      });
      return res.status(500).json({ error: 'Refund failed' });
    }

    // Cancel at period end so the fan keeps their access through the
    // window they paid for.
    try {
      await lifecycleService.cancelAtPeriodEnd(membership);
    } catch (err) {
      logger.warn('persona_membership.refund_cancel_failed', {
        membershipId: membership.id, error: err.message,
      });
    }

    await writeIdentityAuditLog({
      req,
      actorUserId: req.user.id,
      targetUserId: membership.persona?.user_id,
      personaId: membership.persona_id,
      action: 'persona_membership.refund_requested',
      targetType: 'PersonaMembership',
      targetId: membership.id,
      metadata: {
        reason: req.body.reason,
        refund_id: refund?.id || null,
        refund_amount_cents: amountCents,
        thread_id: req.body.thread_id || null,
      },
    });

    return respondWithMembership(res, membership);
  });

module.exports = router;
