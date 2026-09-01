// Stripe Connect Express integration for the audience-profile feature.
//
// Audience Profile design v2 §6.3 (Stripe receipt firewall), §8.1 (Connect
// account model), §17 #7 (Stripe Connect Express receipt-rendering
// verification — source-side audit complete in P2.8; live verification
// pending in docs/stripe-receipt-verification-2026-05-08.md). This module:
//
//   * Ensures a persona owner has a Connect Express account with persona-
//     aware business_profile (display_name → receipt merchant name; the
//     handle → statement descriptor PANTOPUS *@HANDLE).
//   * Creates / refreshes onboarding account links.
//   * Reads onboarding status (charges_enabled / details_submitted /
//     payouts_enabled).
//   * Syncs paid tiers (rank ≥ 2) to Stripe Prices on the connected
//     account. Prices are immutable: a price change creates a new Price
//     and atomically swaps stripe_price_id on the tier row. Existing
//     subscriptions stay on their old price until renewal (P1.13's
//     subscription_schedule logic owns that).
//
// Stripe Subscriptions, Checkout, webhooks: NOT here. P1.9 owns those.
//
// The existing stripeService.js (gigs / marketplace) exposes
// `createConnectAccount(userId, userData)` and `createAccountLink(...)` —
// we wrap those rather than duplicating Connect bootstrap. The names
// `ensureExpressAccount` / `createOnboardingLink` referenced in the
// design doc map to those methods, with the persona-aware
// business_profile applied here.

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const stripeService = require('../stripe/stripeService');
const { getStripeClient } = require('../stripe/getStripeClient');

const STATEMENT_DESCRIPTOR_PREFIX = 'PANTOPUS *@';
const STATEMENT_DESCRIPTOR_MAX_LENGTH = 22;

// Audience-profile design v2 §6.3: Stripe statement descriptors are
// limited to 22 chars. The persona handle — never the creator's legal
// name — appears on the fan's card statement.
function buildStatementDescriptor(personaHandle) {
  const remaining = STATEMENT_DESCRIPTOR_MAX_LENGTH - STATEMENT_DESCRIPTOR_PREFIX.length;
  const handle = String(personaHandle || '').slice(0, remaining).toUpperCase();
  return `${STATEMENT_DESCRIPTOR_PREFIX}${handle}`.slice(0, STATEMENT_DESCRIPTOR_MAX_LENGTH);
}

// Read the StripeAccount row for the persona owner and project the
// onboarding-status fields the dashboard cares about. Pure DB read.
async function getOnboardingStatus(persona) {
  if (!persona?.user_id) return { hasAccount: false, ready: false };
  const { data: account } = await supabaseAdmin
    .from('StripeAccount')
    .select('stripe_account_id, charges_enabled, payouts_enabled, details_submitted, verification_status')
    .eq('user_id', persona.user_id)
    .maybeSingle();
  if (!account) {
    return { hasAccount: false, ready: false };
  }
  return {
    hasAccount: true,
    ready: !!(account.charges_enabled && account.details_submitted),
    chargesEnabled: !!account.charges_enabled,
    payoutsEnabled: !!account.payouts_enabled,
    detailsSubmitted: !!account.details_submitted,
    verificationStatus: account.verification_status || null,
  };
}

// P2.9 / §17 #8 — per-persona support email. We expose
// `support+{handle}@<domain>` only when ops has provisioned the
// inbound SES (or equivalent) routing for that domain via the
// PERSONA_SUPPORT_EMAIL_DOMAIN env var. Until then, Stripe falls back
// to the connected account's account-level support email, so fans
// always reach a working address — never a black hole.
//
// See docs/persona-support-email-feasibility.md for the rollout gate.
function buildPersonaSupportEmail(handle) {
  if (!handle) return null;
  const domain = process.env.PERSONA_SUPPORT_EMAIL_DOMAIN;
  if (!domain) return null;
  // Stripe's support_email validator rejects characters outside the
  // local-part RFC. Persona handles are already constrained to
  // [a-z0-9_.-] elsewhere; re-assert here as defense-in-depth.
  if (!/^[a-zA-Z0-9_.-]+$/.test(handle)) return null;
  return `support+${handle}@${domain}`;
}

// Apply persona-aware business profile + statement descriptor to a
// connected account. Audience-profile §6.3 + §17 #7 (P2.8 verification)
// + §17 #8 (P2.9 per-persona support email):
//   * business_profile.name             = persona display_name (NOT legal name)
//   * business_profile.url              = https://pantopus.com/@HANDLE (public business URL)
//   * business_profile.support_url      = same persona profile page (Stripe shows this on receipts)
//   * business_profile.support_email    = support+HANDLE@<domain>  (P2.9, env-gated)
//   * business_profile.product_description = a one-sentence persona description for Stripe Radar
//   * settings.payments.statement_descriptor = "PANTOPUS *@HANDLE"
//
// Live-Stripe verification (the Step 1 transaction) is tracked in
// docs/stripe-receipt-verification-2026-05-08.md.
async function applyPersonaBusinessProfile(stripeAccountId, persona) {
  const stripe = getStripeClient();
  const handle = persona.handle ? String(persona.handle) : null;
  const personaUrl = handle ? `https://pantopus.com/@${handle}` : undefined;
  const displayName = persona.display_name || handle || 'Pantopus creator';
  const supportEmail = buildPersonaSupportEmail(handle);
  const businessProfile = {
    name: displayName,
    url: personaUrl,
    support_url: personaUrl,
    product_description: handle
      ? `Updates and member-only content from @${handle} on Pantopus.`
      : 'Updates and member-only content from a Pantopus creator.',
  };
  if (supportEmail) {
    // Only set when the per-persona inbound routing is live (env-gated)
    // — see docs/persona-support-email-feasibility.md §3.
    businessProfile.support_email = supportEmail;
  }
  try {
    await stripe.accounts.update(stripeAccountId, {
      business_profile: businessProfile,
      settings: {
        payments: {
          statement_descriptor: buildStatementDescriptor(persona.handle),
        },
      },
    });
  } catch (err) {
    logger.warn('persona_payments.business_profile_update_failed', {
      stripeAccountId, personaId: persona.id, error: err.message,
    });
    // Non-fatal — onboarding can proceed; a reconcile pass picks this up later.
  }
}

// Ensure the persona owner has a Connect Express account, then apply
// the persona-aware business profile. Re-uses an existing StripeAccount
// row when present (e.g. from gigs/marketplace) so KYC isn't redone.
//
// Returns the StripeAccount row (with `stripe_account_id`).
async function ensureConnectAccountForPersona(persona) {
  if (!persona?.user_id) {
    throw new Error('persona.user_id required to bootstrap Connect account');
  }

  // Look up an existing row first; createConnectAccount returns
  // success: false if one exists, but we still want the account_id so
  // we can apply the persona business profile to it.
  const { data: existing } = await supabaseAdmin
    .from('StripeAccount')
    .select('user_id, stripe_account_id')
    .eq('user_id', persona.user_id)
    .maybeSingle();

  let stripeAccountId = existing?.stripe_account_id || null;

  if (!stripeAccountId) {
    const { data: user } = await supabaseAdmin
      .from('User')
      .select('email')
      .eq('id', persona.user_id)
      .maybeSingle();
    const result = await stripeService.createConnectAccount(persona.user_id, {
      email: user?.email,
    });
    if (result?.success) {
      stripeAccountId = result.stripeAccountId;
    } else if (result?.accountId) {
      // Race: another caller created it concurrently.
      stripeAccountId = result.accountId;
    }
  }

  if (!stripeAccountId) {
    throw new Error('Could not create or fetch Stripe Connect account');
  }

  await applyPersonaBusinessProfile(stripeAccountId, persona);

  // Return the freshest row (whether existing or newly inserted).
  const { data: refreshed } = await supabaseAdmin
    .from('StripeAccount')
    .select('user_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted')
    .eq('user_id', persona.user_id)
    .maybeSingle();
  return refreshed || { user_id: persona.user_id, stripe_account_id: stripeAccountId };
}

// Wrap stripeService.createAccountLink with persona-flavored return URLs.
// The wizard's Step 3 (P1.6) provides ?step=stripe&done=1 / &refresh=1.
async function createOnboardingLinkForPersona(persona, { webBaseUrl } = {}) {
  const base = webBaseUrl || process.env.WEB_BASE_URL || 'https://pantopus.com';
  const result = await stripeService.createAccountLink(
    persona.user_id,
    `${base}/app/audience/setup?step=stripe&done=1`,
    `${base}/app/audience/setup?step=stripe&refresh=1`,
  );
  if (!result?.success) {
    throw new Error(result?.error || 'Could not create Stripe onboarding link');
  }
  return { url: result.url, expiresAt: result.expiresAt };
}

// One Stripe Product per persona; all paid tiers are Prices on that
// Product. Found by metadata.persona_id; created on demand otherwise.
// All API calls are scoped to the connected account via { stripeAccount }.
async function ensurePersonaProduct(persona, stripeAccountId) {
  const stripe = getStripeClient();
  let existing = { data: [] };
  try {
    existing = await stripe.products.search({
      query: `metadata['persona_id']:'${persona.id}'`,
    }, { stripeAccount: stripeAccountId });
  } catch (err) {
    // products.search requires the search-index API; fall through to create.
    logger.warn('persona_payments.product_search_failed', {
      personaId: persona.id, error: err.message,
    });
  }
  if (existing?.data && existing.data.length > 0) return existing.data[0];

  return stripe.products.create({
    name: `${persona.display_name || persona.handle} (Pantopus)`,
    metadata: {
      persona_id: persona.id,
      persona_handle: persona.handle,
    },
  }, { stripeAccount: stripeAccountId });
}

// Create a new Stripe Price for a paid tier and atomically swap
// stripe_price_id on the PersonaTier row. Idempotent at the call-site
// level: callers should compare price_cents before calling. Prices are
// immutable in Stripe; we never update an existing one.
//
// Returns the (re-fetched) PersonaTier row, or the original tier if
// sync was skipped.
async function syncTierToStripePrice(tier, persona, stripeAccountId) {
  if (!tier) return tier;
  if (tier.rank === 1) return tier;        // free tier never has a Price
  if (!stripeAccountId) {
    logger.info('persona_payments.tier_sync_skipped_no_account', { tierId: tier.id });
    return tier;
  }
  if (!tier.price_cents || tier.price_cents <= 0) {
    logger.info('persona_payments.tier_sync_skipped_no_price', { tierId: tier.id });
    return tier;
  }

  const stripe = getStripeClient();
  const product = await ensurePersonaProduct(persona, stripeAccountId);
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: tier.price_cents,
    // Stripe expects lowercase ISO 4217. The DB column is text and may
    // be stored uppercase; normalize here.
    currency: String(tier.currency || 'usd').toLowerCase(),
    recurring: { interval: tier.billing_interval || 'month' },
    metadata: {
      persona_id: persona.id,
      persona_tier_id: tier.id,
      persona_tier_rank: String(tier.rank),
    },
  }, { stripeAccount: stripeAccountId });

  const { data: updated, error } = await supabaseAdmin
    .from('PersonaTier')
    .update({
      stripe_price_id: price.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tier.id)
    .select()
    .maybeSingle();

  if (error) {
    logger.error('persona_payments.tier_price_persist_error', {
      tierId: tier.id, priceId: price.id, error: error.message,
    });
    throw error;
  }

  logger.info('persona_payments.tier_synced', {
    tierId: tier.id, priceId: price.id,
  });
  return updated || tier;
}

// Backfill every active paid tier when the connected account first
// becomes ready. Called from the account.updated webhook when
// charges_enabled flips false→true (see stripeWebhooks.js).
async function syncAllPaidTiers(personaId) {
  const { data: persona } = await supabaseAdmin
    .from('PublicPersona')
    .select('id, user_id, handle, display_name')
    .eq('id', personaId)
    .maybeSingle();
  if (!persona) return [];

  const status = await getOnboardingStatus(persona);
  if (!status.ready) {
    logger.info('persona_payments.sync_deferred_not_ready', { personaId });
    return [];
  }

  const { data: account } = await supabaseAdmin
    .from('StripeAccount')
    .select('stripe_account_id')
    .eq('user_id', persona.user_id)
    .maybeSingle();
  if (!account?.stripe_account_id) return [];

  const { data: tiers } = await supabaseAdmin
    .from('PersonaTier')
    .select('*')
    .eq('persona_id', personaId)
    .gte('rank', 2)
    .eq('status', 'active');

  const synced = [];
  for (const tier of tiers || []) {
    try {
      const next = await syncTierToStripePrice(tier, persona, account.stripe_account_id);
      synced.push(next);
    } catch (err) {
      logger.warn('persona_payments.bulk_sync_tier_failed', {
        tierId: tier.id, error: err.message,
      });
    }
  }
  return synced;
}

// Dispatch hook for personaTierService.updateTier — called fire-and-
// forget after a successful tier price change. Callers should NOT block
// the user-visible update on Stripe: a Stripe failure logs a warning,
// the next save (or the manual sync route in P1.13) reconciles.
async function syncTierIfReady(tierId) {
  const { data: tier } = await supabaseAdmin
    .from('PersonaTier')
    .select('*')
    .eq('id', tierId)
    .maybeSingle();
  if (!tier) return null;
  if (tier.rank === 1) return tier;

  const { data: persona } = await supabaseAdmin
    .from('PublicPersona')
    .select('id, user_id, handle, display_name')
    .eq('id', tier.persona_id)
    .maybeSingle();
  if (!persona) return tier;

  const status = await getOnboardingStatus(persona);
  if (!status.ready) return tier;

  const { data: account } = await supabaseAdmin
    .from('StripeAccount')
    .select('stripe_account_id')
    .eq('user_id', persona.user_id)
    .maybeSingle();
  if (!account?.stripe_account_id) return tier;

  return syncTierToStripePrice(tier, persona, account.stripe_account_id);
}

// Pantopus platform fee on persona subscriptions. Audience-profile §8.1
// ("Pantopus charges a 10% platform fee via application_fee_percent").
// Set on the subscription, not the Price, so all paid tiers share it
// without manual configuration.
const PERSONA_PLATFORM_FEE_PCT = 10;

// Build a Stripe Checkout session for a paid persona subscription.
// Audience-profile §8.2 Plan A: web-only. The session redirects to
// /@<handle>?welcome=1 on success and ?canceled=1 on cancel — both
// public URLs that work for unauthenticated returns.
//
// The handshake metadata (fan_handle, fan_display_name, fan_avatar_url)
// rides on subscription_data.metadata so the
// customer.subscription.created webhook can build the PersonaMembership
// row server-side without trusting the client. metadata.fan_user_id
// is the trust anchor. audience_identity_id links the paid membership to
// the user's single Beacon-facing identity.
async function createCheckoutSession({ persona, tier, fanUserId, handshake }) {
  if (!persona || !tier) throw new Error('persona and tier required');
  if (tier.rank < 2) throw new Error('Free tier does not require Checkout');

  const status = await getOnboardingStatus(persona);
  if (!status.ready) {
    throw new Error('Creator has not finished Stripe onboarding');
  }

  let priceId = tier.stripe_price_id;
  if (!priceId) {
    // Lazy backfill: try to sync now. Real users hit this when the
    // creator updated a price between persona setup and this fan's
    // attempt to subscribe.
    const synced = await syncAllPaidTiers(persona.id);
    const refreshed = synced.find((t) => t.id === tier.id);
    priceId = refreshed?.stripe_price_id || null;
  }
  if (!priceId) throw new Error('Tier has no Stripe Price');

  const { data: account } = await supabaseAdmin
    .from('StripeAccount')
    .select('stripe_account_id')
    .eq('user_id', persona.user_id)
    .maybeSingle();
  if (!account?.stripe_account_id) {
    throw new Error('Connected account missing for persona owner');
  }

  // P2.11a + audience-profile §8.2 — these URLs are universal links
  // back to the persona profile page. iOS Associated Domains
  // (applinks:pantopus.com) and Android App Links route them into the
  // mobile app on devices that have it; everywhere else they open the
  // web profile page (which renders the same welcome state). The
  // mobile handshake screen reads ?welcome=1 / ?canceled=1 and
  // surfaces the matching banner.
  // See docs/audience-profile-deep-link-decision-2026-05-08.md for
  // the full rationale + the operator-side device-config runbook.
  const baseUrl = process.env.WEB_BASE_URL || 'https://pantopus.com';
  const successUrl = `${baseUrl}/@${persona.handle}?welcome=1`;
  const cancelUrl  = `${baseUrl}/@${persona.handle}?canceled=1`;

  const safeHandshake = handshake || {};
  const metadata = {
    persona_id: persona.id,
    persona_tier_id: tier.id,
    persona_tier_rank: String(tier.rank),
    fan_user_id: fanUserId,
    audience_identity_id: safeHandshake.audience_identity_id || '',
    fan_handle: safeHandshake.fan_handle || '',
    fan_display_name: safeHandshake.fan_display_name || '',
    fan_avatar_url: safeHandshake.fan_avatar_url || '',
  };

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      application_fee_percent: PERSONA_PLATFORM_FEE_PCT,
      metadata,
    },
    payment_method_types: ['card'],
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Don't set customer_email: the fan's billing identity stays at
    // Stripe; the creator never sees it. (Stripe collects email at
    // checkout for receipt delivery.)
    metadata,
  }, { stripeAccount: account.stripe_account_id });

  return { url: session.url, sessionId: session.id };
}

module.exports = {
  STATEMENT_DESCRIPTOR_MAX_LENGTH,
  PERSONA_PLATFORM_FEE_PCT,
  buildStatementDescriptor,
  buildPersonaSupportEmail,
  ensureConnectAccountForPersona,
  applyPersonaBusinessProfile,
  createOnboardingLinkForPersona,
  getOnboardingStatus,
  ensurePersonaProduct,
  syncTierToStripePrice,
  syncAllPaidTiers,
  syncTierIfReady,
  createCheckoutSession,
};
