// Subscription lifecycle service for paid persona memberships.
//
// Audience Profile design v2 §7.3 (period mechanics) + §11.6 (fan
// cancel/downgrade UX). Drives:
//   * Mid-period upgrades — Stripe subscriptions.update with
//     proration_behavior: 'create_prorations'. New tier capabilities
//     take effect immediately.
//   * Mid-period downgrades — Stripe subscriptionSchedules with two
//     phases. Fan retains current tier through current_period_end,
//     then drops to the new tier. PersonaMembership.scheduled_tier_
//     change_id captures the pending change for UI display.
//   * Cancel at period end — Stripe subscriptions.update with
//     cancel_at_period_end: true. Free Followers cancel immediately
//     (no Stripe to talk to).
//   * Refund issuance — Stripe refunds.create against the latest
//     invoice's charge. Used by the SLA-missed refund-request flow.
//
// Sequential supabase reads only (no nested select) — same pattern
// as the rest of this codebase: the test mock doesn't parse Supabase
// nested-select syntax, and the service is more portable when each
// dependency is fetched explicitly.

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { getStripeClient } = require('../stripe/getStripeClient');

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

// Load a membership row + its persona + tier in three sequential
// reads. Returns null when the membership doesn't exist; does NOT
// filter on status (callers may want to operate on past_due, etc.).
async function getMembershipWithStripe(membershipId) {
  if (!membershipId) return null;
  const { data: membership } = await supabaseAdmin
    .from('PersonaMembership')
    .select('*')
    .eq('id', membershipId)
    .maybeSingle();
  if (!membership) return null;

  let persona = null;
  if (membership.persona_id) {
    const { data: p } = await supabaseAdmin
      .from('PublicPersona')
      .select('id, user_id, handle, display_name')
      .eq('id', membership.persona_id)
      .maybeSingle();
    persona = p || null;
  }

  let tier = null;
  if (membership.tier_id) {
    const { data: t } = await supabaseAdmin
      .from('PersonaTier')
      .select('id, rank, name, price_cents, currency, billing_interval, stripe_price_id, msg_threads_per_period, creator_can_initiate_dm, reply_policy')
      .eq('id', membership.tier_id)
      .maybeSingle();
    tier = t || null;
  }

  return { ...membership, persona, tier };
}

// Look up the tier by (persona_id, rank). Used for the route layer's
// "give me the rank-3 tier on this persona" lookup.
async function getTierByRank(personaId, rank) {
  if (!personaId || !rank) return null;
  const { data } = await supabaseAdmin
    .from('PersonaTier')
    .select('id, rank, name, price_cents, currency, billing_interval, stripe_price_id, status')
    .eq('persona_id', personaId)
    .eq('rank', rank)
    .maybeSingle();
  return data || null;
}

// Look up the connected Stripe account id for the persona owner. The
// account row is keyed by user_id (gigs / marketplace share it).
async function getStripeAccountId(personaUserId) {
  if (!personaUserId) return null;
  const { data } = await supabaseAdmin
    .from('StripeAccount')
    .select('stripe_account_id')
    .eq('user_id', personaUserId)
    .maybeSingle();
  return data?.stripe_account_id || null;
}

// ---------------------------------------------------------------------------
// Lifecycle operations
// ---------------------------------------------------------------------------

// Mid-period upgrade. Audience-profile §7.3:
//   * Stripe subscription_update with proration_behavior=create_prorations.
//   * New tier's capabilities take effect immediately.
//   * Quota for the new tier is granted at full amount for the
//     remainder of the current period (we don't pro-rate quotas).
async function upgrade(membership, newTier) {
  if (!membership || !newTier) throw new Error('upgrade requires membership + newTier');
  if (!membership.tier) throw new Error('Membership has no current tier');
  if (newTier.rank <= membership.tier.rank) {
    throw new Error('Use downgrade for same-rank or lower changes');
  }
  if (!membership.stripe_subscription_id) {
    throw new Error('Membership has no Stripe subscription to upgrade');
  }
  if (!newTier.stripe_price_id) {
    throw new Error('Target tier has no Stripe Price configured');
  }

  const stripeAccountId = await getStripeAccountId(membership.persona?.user_id);
  if (!stripeAccountId) throw new Error('Connected Stripe account not found for persona owner');

  const stripe = getStripeClient();
  const opts = { stripeAccount: stripeAccountId };

  // Read the current subscription to grab the line item id we need
  // to swap.
  const subscription = await stripe.subscriptions.retrieve(
    membership.stripe_subscription_id, opts,
  );
  const itemId = subscription?.items?.data?.[0]?.id;
  if (!itemId) {
    throw new Error('Stripe subscription has no line item to update');
  }

  await stripe.subscriptions.update(membership.stripe_subscription_id, {
    items: [{ id: itemId, price: newTier.stripe_price_id }],
    proration_behavior: 'create_prorations',
    metadata: { persona_tier_id: newTier.id },
  }, opts);

  // Optimistic local update — the customer.subscription.updated
  // webhook will overwrite this once it lands, but the fan sees the
  // new tier label immediately.
  await supabaseAdmin
    .from('PersonaMembership')
    .update({
      tier_id: newTier.id,
      scheduled_tier_change_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.id);

  logger.info('persona_lifecycle.upgrade', {
    membershipId: membership.id,
    fromRank: membership.tier.rank,
    toRank: newTier.rank,
  });
}

// Scheduled period-end downgrade. Audience-profile §7.3:
//   * Stripe subscriptionSchedules.create from_subscription so the
//     schedule wraps the live subscription.
//   * subscriptionSchedules.update with two phases:
//       phase 1 = current tier through current_period_end
//       phase 2 = new tier starting at current_period_end
//     Both proration_behavior=none.
//   * Fan retains current tier capabilities through period_end, then
//     drops automatically when the schedule advances.
//   * scheduled_tier_change_id records the pending change for UI.
async function downgrade(membership, newTier) {
  if (!membership || !newTier) throw new Error('downgrade requires membership + newTier');
  if (!membership.tier) throw new Error('Membership has no current tier');
  if (newTier.rank >= membership.tier.rank) {
    throw new Error('Use upgrade for same-rank or higher changes');
  }
  if (!membership.stripe_subscription_id) {
    throw new Error('Membership has no Stripe subscription to downgrade');
  }

  const stripeAccountId = await getStripeAccountId(membership.persona?.user_id);
  if (!stripeAccountId) throw new Error('Connected Stripe account not found for persona owner');

  const stripe = getStripeClient();
  const opts = { stripeAccount: stripeAccountId };

  const subscription = await stripe.subscriptions.retrieve(
    membership.stripe_subscription_id, opts,
  );

  // Bind a schedule to the live subscription if one isn't already
  // attached. Stripe disallows two schedules per subscription so we
  // re-use the existing one when present.
  let scheduleId = subscription.schedule;
  if (!scheduleId) {
    const created = await stripe.subscriptionSchedules.create({
      from_subscription: subscription.id,
    }, opts);
    scheduleId = created.id;
  }

  // Re-shape phases: keep what's there as phase 1 (clipped to
  // current_period_end), append phase 2 with the new tier's price.
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId, opts);
  const existingPhases = (schedule.phases || []).map((p) => ({
    items: (p.items || []).map((it) => ({
      price: typeof it.price === 'string' ? it.price : it.price?.id,
      quantity: it.quantity,
    })),
    start_date: p.start_date,
    end_date: p.end_date,
    proration_behavior: 'none',
  }));
  if (existingPhases.length === 0) {
    // Defensive fallback: if Stripe returned no phases (test fixtures,
    // unusual states), seed a single phase from the live subscription.
    const itemId = subscription?.items?.data?.[0]?.id;
    const itemPrice = subscription?.items?.data?.[0]?.price?.id
      || (membership.tier?.stripe_price_id);
    existingPhases.push({
      items: [{ price: itemPrice, quantity: 1 }],
      start_date: subscription.current_period_start || Math.floor(Date.now() / 1000),
      end_date: subscription.current_period_end,
      proration_behavior: 'none',
    });
    void itemId;
  } else {
    existingPhases[existingPhases.length - 1].end_date = subscription.current_period_end;
  }
  existingPhases.push({
    items: [{ price: newTier.stripe_price_id, quantity: 1 }],
    proration_behavior: 'none',
    iterations: 1,
  });

  await stripe.subscriptionSchedules.update(scheduleId, {
    phases: existingPhases,
    end_behavior: 'release',
  }, opts);

  await supabaseAdmin
    .from('PersonaMembership')
    .update({
      scheduled_tier_change_id: newTier.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.id);

  logger.info('persona_lifecycle.downgrade_scheduled', {
    membershipId: membership.id,
    fromRank: membership.tier.rank,
    toRank: newTier.rank,
    scheduleId,
  });
}

// Cancel at period end. Audience-profile §7.3:
//   * Free Follower (no Stripe subscription) cancels immediately.
//   * Paid memberships flip cancel_at_period_end on Stripe; status
//     stays 'active' until subscription.deleted webhook fires after
//     period_end.
async function cancelAtPeriodEnd(membership) {
  if (!membership) throw new Error('cancelAtPeriodEnd requires membership');

  if (!membership.stripe_subscription_id) {
    // Free tier: terminal status now.
    await supabaseAdmin
      .from('PersonaMembership')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.id);
    logger.info('persona_lifecycle.cancel_immediate_free', {
      membershipId: membership.id,
    });
    return { immediate: true };
  }

  const stripeAccountId = await getStripeAccountId(membership.persona?.user_id);
  if (!stripeAccountId) throw new Error('Connected Stripe account not found for persona owner');

  const stripe = getStripeClient();
  await stripe.subscriptions.update(membership.stripe_subscription_id, {
    cancel_at_period_end: true,
  }, { stripeAccount: stripeAccountId });

  await supabaseAdmin
    .from('PersonaMembership')
    .update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.id);

  logger.info('persona_lifecycle.cancel_at_period_end', {
    membershipId: membership.id,
  });
  return { immediate: false, scheduledFor: membership.current_period_end };
}

// Issue a refund against the latest invoice's charge. amountCents is
// optional — Stripe defaults to a full refund if not provided.
// Returns the Stripe refund object or null when there's no chargeable
// invoice (shouldn't happen in practice, defensive guard).
async function issueRefund(membership, { amountCents, reason } = {}) {
  if (!membership) throw new Error('issueRefund requires membership');
  if (!membership.stripe_subscription_id) return null;
  // Guard against an accidental full refund. Stripe treats an omitted
  // amount as "refund the full charge"; callers that explicitly compute
  // zero remaining value must not fall through to that behavior.
  if (amountCents != null && amountCents <= 0) return null;

  const stripeAccountId = await getStripeAccountId(membership.persona?.user_id);
  if (!stripeAccountId) throw new Error('Connected Stripe account not found for persona owner');

  const stripe = getStripeClient();
  const opts = { stripeAccount: stripeAccountId };

  const subscription = await stripe.subscriptions.retrieve(
    membership.stripe_subscription_id, opts,
  );
  if (!subscription?.latest_invoice) return null;

  const invoice = await stripe.invoices.retrieve(subscription.latest_invoice, opts);
  if (!invoice?.charge) return null;

  const refundPayload = {
    charge: invoice.charge,
    reason: 'requested_by_customer',
    metadata: { pantopus_reason: reason || 'fan_request' },
  };
  if (amountCents != null) {
    refundPayload.amount = Math.round(amountCents);
  }
  const refund = await stripe.refunds.create(refundPayload, opts);

  logger.info('persona_lifecycle.refund_issued', {
    membershipId: membership.id,
    refundId: refund?.id,
    amountCents: refundPayload.amount || 'full',
    reason: refundPayload.metadata.pantopus_reason,
  });
  return refund;
}

// Compute the prorated refund amount for a fan whose current period
// has remaining days. Returns 0 when the period is already over.
function computeProratedRefundCents(membership) {
  if (!membership?.tier?.price_cents) return 0;
  if (!membership.current_period_start || !membership.current_period_end) return 0;
  const start = new Date(membership.current_period_start).getTime();
  const end   = new Date(membership.current_period_end).getTime();
  const now   = Date.now();
  if (end <= now || end <= start) return 0;
  const totalMs = end - start;
  const remainingMs = end - now;
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs));
  return Math.round(membership.tier.price_cents * fraction);
}

// Hard cancel — block-cascade path uses this. Stripe
// subscriptions.cancel is immediate (no period-end grace), distinct
// from the user-initiated cancelAtPeriodEnd in §11.6. Idempotent
// against "already canceled" / "no such subscription" errors so a
// retry from the cascade is harmless.
async function cancelSubscriptionImmediately(membership) {
  if (!membership?.stripe_subscription_id) return;
  const stripeAccountId = await getStripeAccountId(membership.persona?.user_id);
  if (!stripeAccountId) {
    throw new Error('Connected Stripe account not found for persona owner');
  }
  const stripe = getStripeClient();
  try {
    await stripe.subscriptions.cancel(
      membership.stripe_subscription_id,
      {},
      { stripeAccount: stripeAccountId },
    );
  } catch (err) {
    const message = String(err?.message || '');
    if (/already.*canceled|No such subscription/i.test(message)) return;
    throw err;
  }
  logger.info('persona_lifecycle.cancel_immediate', {
    membershipId: membership.id,
  });
}

module.exports = {
  getMembershipWithStripe,
  getTierByRank,
  getStripeAccountId,
  upgrade,
  downgrade,
  cancelAtPeriodEnd,
  cancelSubscriptionImmediately,
  issueRefund,
  computeProratedRefundCents,
};
