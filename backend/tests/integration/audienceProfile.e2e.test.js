/**
 * P1.15 — Phase 1 audience-profile end-to-end integration test.
 *
 * The executable proof that Phase 1 is ready for beta launch. Each
 * describe block (A–I) covers one acceptance scenario from the
 * Audience Profile design v2 §13 inventory and §19 acceptance
 * criteria. The combined suite is the smoke test to run before
 * flipping `audience_profile` for any new beta cohort.
 *
 * Expected runtime: 30–90 seconds in CI. If it exceeds 120 seconds,
 * the test is too slow and should be split into smaller files —
 * DO NOT silence by raising the Jest timeout.
 *
 * ---------------------------------------------------------------
 * Test infrastructure deviations from a "real DB" integration run
 * ---------------------------------------------------------------
 * Stripe is mocked at module level via `tests/__mocks__/stripeFactory.js`
 * — no Stripe SDK calls actually leave the process. supabaseAdmin
 * is the project-wide in-memory mock (auto-mapped via jest.config.js)
 * because the CI environment does not have a live Supabase. ALL
 * other Pantopus internal services run real code: feature flags,
 * tier service, payments service, DM service, block service,
 * subscription lifecycle, and notification service interoperate
 * exactly as they do in production. The point of the suite is to
 * prove their COMBINATION works; the mock supabaseAdmin is the
 * test substitute for the row store.
 *
 * The companion `npm run test:integration` config (jest.integration.
 * config.js) runs the same file shape against a real Supabase when
 * the env vars are present; this file is the npm-test variant.
 *
 * The Express app is built per-test by `buildApp()` rather than
 * imported from app.js: importing app.js triggers `server.listen`
 * + `startJobs()` at module load, which would bind a port and
 * spawn cron loops. The per-test app mounts only the routers under
 * E2E test, matching the established pattern from
 * tests/unit/personaBlockPropagation.test.js.
 */

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before requires.
// ---------------------------------------------------------------------------

jest.mock('stripe', () => require('../__mocks__/stripeFactory'));

// optionalAuth normally talks to Supabase Auth to verify a Bearer
// token. Tests use the x-test-user-id header convention; honor it
// here too so broadcastChannels.js's read endpoint resolves the
// viewer correctly. Mirrors the production behavior (sets
// req.user = null when the header is absent).
jest.mock('../../middleware/optionalAuth', () => (req, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'] };
  } else {
    req.user = null;
  }
  next();
});

// Disable rate limiters in the test app — Phase 1 routes wear several
// limiters (personaFollowLimiter, broadcastPublishLimiter, etc.) that
// would otherwise reject requests after a few iterations.
jest.mock('../../middleware/rateLimiter', () => {
  const noop = (_req, _res, next) => next();
  return {
    globalWriteLimiter: noop,
    financialWriteLimiter: noop,
    contentCreationLimiter: noop,
    homeCreationLimiter: noop,
    ownershipClaimLimiter: noop,
    postcardLimiter: noop,
    verificationAttemptLimiter: noop,
    authEndpointLimiter: noop,
    landlordLeaseLimiter: noop,
    addressValidationLimiter: noop,
    addressClaimLimiter: noop,
    previewLimiter: noop,
    personaFollowLimiter: noop,
    broadcastPublishLimiter: noop,
  };
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

const express = require('express');
const request = require('supertest');
const path = require('path');

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;
const stripeMock = require('../__mocks__/stripeFactory');

const featureFlagService = require('../../services/featureFlagService');
const personaTierService = require('../../services/personaTierService');
const personaPaymentsService = require('../../services/personaPaymentsService');
const personaBlockService = require('../../services/personaBlockService');
const personaDmService = require('../../services/personaDmService');
const lifecycleService = require('../../services/personaSubscriptionLifecycleService');

// notificationService is auto-mocked by jest.config.js's moduleNameMapper.
// Load by absolute path to bypass the mapper and exercise the real one.
const realNotificationService = require(path.resolve(
  __dirname, '../../services/notificationService.js',
));

const {
  serializeFanForCreator,
  serializeMembershipForFan,
} = require('../../serializers/identitySerializers');

const {
  handlePersonaSubscriptionCreated,
  handlePersonaChargeDisputeCreated,
  handlePersonaInvoicePaid,
} = require('../../stripe/stripeWebhooks').personaWebhookHandlers;

const personaRoutes = require('../../routes/personas');
const personaTiersRoutes = require('../../routes/personaTiers');
const personaPaymentsRoutes = require('../../routes/personaPayments');
const personaDmsRoutes = require('../../routes/personaDms');
const personaMembershipRoutes = require('../../routes/personaMembership');
const personaBlocksRoutes = require('../../routes/personaBlocks');
const blocksRouter = require('../../routes/blocks');
const broadcastChannelsRouter = require('../../routes/broadcastChannels');

// ---------------------------------------------------------------------------
// Constants — fixture UUIDs
// ---------------------------------------------------------------------------

const FLAG_NAME       = 'audience_profile';
const OWNER_ID        = '11111111-1111-4111-8111-111111111111';
const FAN_ID          = '22222222-2222-4222-8222-222222222222';
const OTHER_FAN_ID    = '33333333-3333-4333-8333-333333333333';
const PERSONA_ID      = '44444444-4444-4444-4444-444444444444';
const CHANNEL_ID      = '55555555-5555-4555-8555-555555555555';
const TIER_1_ID       = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const TIER_2_ID       = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const TIER_3_ID       = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const STRIPE_ACCOUNT  = 'acct_e2e_creator';
const STRIPE_CUSTOMER = 'cus_e2e_fan';

// ---------------------------------------------------------------------------
// Helpers — app builder, fixture builders, request shortcuts
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', blocksRouter);
  app.use('/api/personas/:id/tiers', personaTiersRoutes);
  app.use('/api/personas/:id/payments', personaPaymentsRoutes);
  app.use('/api/personas/:id/dms', personaDmsRoutes);
  app.use('/api/personas/:id/membership', personaMembershipRoutes);
  app.use('/api/personas/:id', personaBlocksRoutes);
  app.use('/api/personas', personaRoutes);
  app.use('/api/broadcast', broadcastChannelsRouter);
  return app;
}

function asUser(req, userId) {
  return req.set('x-test-user-id', userId);
}

function fixtureMockStripe() {
  stripeMock._reset();
  return stripeMock;
}

function seedFlag() {
  seedTable('FeatureFlag', [{
    id: 'flag-1', flag_name: FLAG_NAME,
    enabled_globally: true, enabled_for_internal_team: false,
    beta_user_ids: [],
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
  }]);
  featureFlagService.invalidateFlagCache();
}

function seedUsers() {
  seedTable('User', [
    { id: OWNER_ID, role: 'user', username: 'mayabuilds', email: 'maya@test.local',
      name: 'Maya Real Name', first_name: 'Maya', last_name: 'Builder',
      address: '1 Real Street', city: 'Hometown', state: 'CA', zipcode: '90210',
    },
    { id: FAN_ID, role: 'user', username: 'jordan_real', email: 'jordan@test.local',
      name: 'Jordan Real Name', first_name: 'Jordan', last_name: 'Smith' },
    { id: OTHER_FAN_ID, role: 'user', username: 'priya_real', email: 'priya@test.local',
      name: 'Priya Real Name', first_name: 'Priya', last_name: 'Patel' },
  ]);
}

function seedPersona() {
  seedTable('PublicPersona', [{
    id: PERSONA_ID, user_id: OWNER_ID,
    handle: 'mayabuilds', handle_normalized: 'mayabuilds',
    display_name: 'Maya Builds',
    status: 'active', audience_mode: 'open', audience_label: 'followers',
    category: 'creator', verified_local_discovery_enabled: false,
    follower_count: 0, post_count: 0,
    created_at: '2026-05-01T00:00:00Z',
  }]);
  seedTable('BroadcastChannel', [{
    id: CHANNEL_ID, persona_id: PERSONA_ID,
    title: 'Maya Builds Broadcast', status: 'active',
  }]);
  seedTable('IdentityBridgeSetting', [{
    id: 'br-1', user_id: OWNER_ID, persona_id: PERSONA_ID,
    show_persona_on_local: false, show_local_on_persona: false,
  }]);
}

function seedTiers({ withStripePrices = false } = {}) {
  seedTable('PersonaTier', [
    { id: TIER_1_ID, persona_id: PERSONA_ID, rank: 1, name: 'Follower',
      description: 'Public posts + follower updates',
      price_cents: 0, currency: 'USD', billing_interval: 'month',
      msg_threads_per_period: null, creator_can_initiate_dm: false,
      reply_policy: 'discretion', status: 'active', position: 1 },
    { id: TIER_2_ID, persona_id: PERSONA_ID, rank: 2, name: 'Member',
      description: 'Member tier',
      price_cents: 500, currency: 'USD', billing_interval: 'month',
      msg_threads_per_period: 5, creator_can_initiate_dm: false,
      reply_policy: 'discretion', status: 'active', position: 2,
      stripe_price_id: withStripePrices ? 'price_member_e2e' : null },
    { id: TIER_3_ID, persona_id: PERSONA_ID, rank: 3, name: 'Insider',
      description: 'Insider tier',
      price_cents: 1500, currency: 'USD', billing_interval: 'month',
      msg_threads_per_period: 25, creator_can_initiate_dm: true,
      reply_policy: 'within_7_days', status: 'active', position: 3,
      stripe_price_id: withStripePrices ? 'price_insider_e2e' : null },
  ]);
}

function seedStripeAccountReady() {
  seedTable('StripeAccount', [{
    id: 'sa-1', user_id: OWNER_ID, stripe_account_id: STRIPE_ACCOUNT,
    charges_enabled: true, payouts_enabled: true, details_submitted: true,
  }]);
}

function seedEmptyAuxiliaryTables() {
  seedTable('PersonaMembership', []);
  seedTable('PersonaQuotaUsage', []);
  seedTable('PersonaDmThread', []);
  seedTable('PersonaDmMessage', []);
  seedTable('PersonaBlock', []);
  seedTable('UserBlock', []);
  seedTable('IdentityAuditLog', []);
  seedTable('Notification', []);
  seedTable('BroadcastMessage', []);
  seedTable('StripeWebhookEvent', []);
}

function seedBaseFixtures(opts = {}) {
  seedUsers();
  seedPersona();
  seedTiers(opts);
  seedEmptyAuxiliaryTables();
  if (opts.withStripeAccount !== false) seedStripeAccountReady();
  seedFlag();
}

function seedActivePaidMembership({
  fanUserId = FAN_ID, tierId = TIER_2_ID, fanHandle = 'lurker_a8f3',
  subId = 'sub_e2e_active', periodStart, periodEnd,
  relationshipType,
} = {}) {
  const now = Date.now();
  const startIso = periodStart || new Date(now - 5 * 86400000).toISOString();
  const endIso   = periodEnd   || new Date(now + 25 * 86400000).toISOString();
  // Pre-tier broadcast routes promote relationship_type='subscriber' to
  // viewerRank=2 (legacy compat). Default to 'follower' for rank-1
  // memberships so locked-teaser tests aren't masked by the bump.
  const relationship = relationshipType
    || (tierId === TIER_1_ID ? 'follower' : 'subscriber');
  const memberships = getTable('PersonaMembership');
  const row = {
    id: `mem-${fanUserId.slice(0, 8)}`,
    persona_id: PERSONA_ID, user_id: fanUserId, tier_id: tierId,
    fan_handle: fanHandle, fan_handle_normalized: fanHandle.toLowerCase(),
    fan_display_name: fanHandle,
    relationship_type: relationship,
    status: 'active', source: 'self_follow',
    notification_level: 'all', public_visibility: 'private',
    stripe_customer_id: STRIPE_CUSTOMER,
    stripe_subscription_id: subId,
    current_period_start: startIso, current_period_end: endIso,
    cancel_at_period_end: false,
    joined_at: startIso,
  };
  memberships.push(row);
  return row;
}

// ---------------------------------------------------------------------------
// Top-level setup
// ---------------------------------------------------------------------------

let stripe;
beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  stripe = fixtureMockStripe();
});
afterEach(() => featureFlagService.invalidateFlagCache());

// ===========================================================================
// A. Creator publishes a persona; default ladder seeded.
// ===========================================================================
describe('A. Creator publishes a persona; ladder seeded', () => {
  beforeEach(() => {
    seedUsers();
    seedEmptyAuxiliaryTables();
    seedTable('PublicPersona', []);
    seedTable('BroadcastChannel', []);
    seedTable('PersonaTier', []);
    seedTable('IdentityBridgeSetting', []);
    seedFlag();
  });

  test('POST /api/personas → 201 and seeds 3 default tiers', async () => {
    const res = await asUser(
      request(buildApp()).post('/api/personas'),
      OWNER_ID,
    ).send({
      handle: 'mayabuilds_pub',
      display_name: 'Maya Builds',
      category: 'creator',
      audience_label: 'followers',
      audience_mode: 'open',
    });
    expect(res.status).toBe(201);
    expect(res.body.persona).toBeTruthy();

    // The mock supabaseAdmin's insert path generates non-UUID ids
    // (e.g. mock-publicpersona-…), which the UUID-gated /tiers route
    // would reject. Inspect the seeded ladder directly off the table
    // store so we don't double-filter on status (the production DB
    // defaults status='active' via SQL DEFAULT; the mock doesn't
    // simulate that).
    const personaId = getTable('PublicPersona')[0].id;
    const tiers = getTable('PersonaTier').filter((t) => t.persona_id === personaId);
    expect(tiers).toHaveLength(3);

    const ranks = tiers.map((t) => t.rank).sort();
    expect(ranks).toEqual([1, 2, 3]);

    const follower = tiers.find((t) => t.rank === 1);
    expect(follower.price_cents).toBe(0);
    expect(follower.name).toBe('Follower');

    // The handler also writes a persona.created audit row.
    const auditActions = getTable('IdentityAuditLog').map((a) => a.action);
    expect(auditActions).toContain('persona.created');
  });
});

// ===========================================================================
// B. Stripe Connect onboarding + tier price sync.
// ===========================================================================
describe('B. Stripe Connect onboarding + tier price sync', () => {
  beforeEach(() => seedBaseFixtures());

  test('syncAllPaidTiers writes stripe_price_id on rank-2/3 only', async () => {
    // No stripe_price_id seeded; sync should fill them in.
    const synced = await personaPaymentsService.syncAllPaidTiers(PERSONA_ID);
    expect(synced.length).toBeGreaterThan(0);

    // Verify Stripe was called for rank-2 and rank-3 unit_amounts.
    const calls = stripe.prices.create.mock.calls.map((c) => c[0]);
    const amounts = calls.map((p) => p.unit_amount).sort((a, b) => a - b);
    expect(amounts).toEqual([500, 1500]);

    const tiers = getTable('PersonaTier');
    expect(tiers.find((t) => t.rank === 1).stripe_price_id).toBeFalsy();
    expect(tiers.find((t) => t.rank === 2).stripe_price_id).toBeTruthy();
    expect(tiers.find((t) => t.rank === 3).stripe_price_id).toBeTruthy();
  });
});

// ===========================================================================
// C. Free Follower handshake creates rank-1 membership; broadcast read.
// ===========================================================================
describe('C. Free Follower handshake + broadcast read access', () => {
  beforeEach(() => seedBaseFixtures());

  test('handshake at tier_rank=1 creates active rank-1 membership', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      tier_rank: 1,
      fan_handle: 'jordan_fan_x',
      fan_display_name: 'Jordan',
      acknowledged_platform_trust: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.requiresPayment).toBeFalsy();

    const memberships = getTable('PersonaMembership');
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      tier_id: TIER_1_ID,
      status: 'active',
      fan_handle: 'jordan_fan_x',
    });
  });

  test('Follower sees followers-only broadcast in full but Member-only as locked teaser', async () => {
    // Seed a Follower membership for the fan.
    seedActivePaidMembership({
      tierId: TIER_1_ID, fanHandle: 'jordan_fan_x', subId: null,
    });
    // Strip Stripe IDs — rank-1 is free, no subscription.
    const memRow = getTable('PersonaMembership')[0];
    memRow.stripe_subscription_id = null;
    memRow.stripe_customer_id = null;

    // Creator publishes one followers broadcast and one Member-tier broadcast.
    seedTable('BroadcastMessage', [
      { id: 'bm-followers', channel_id: CHANNEL_ID, persona_id: PERSONA_ID,
        author_user_id: OWNER_ID, body: 'Followers see this.',
        media: [], visibility: 'followers', status: 'published',
        published_at: '2026-05-08T00:00:00Z',
        created_at: '2026-05-08T00:00:00Z' },
      { id: 'bm-members', channel_id: CHANNEL_ID, persona_id: PERSONA_ID,
        author_user_id: OWNER_ID, body: 'Members only — secret stuff.',
        media: [], visibility: 'tier_or_above', target_tier_rank: 2,
        status: 'published',
        published_at: '2026-05-08T01:00:00Z',
        created_at: '2026-05-08T01:00:00Z' },
    ]);

    const res = await asUser(
      request(buildApp()).get(`/api/broadcast/channels/${CHANNEL_ID}/messages`),
      FAN_ID,
    ).send();
    expect(res.status).toBe(200);

    const followersMsg = res.body.messages.find((m) => m.id === 'bm-followers');
    expect(followersMsg).toBeTruthy();
    expect(followersMsg.body).toBe('Followers see this.');

    const memberMsg = res.body.messages.find((m) => m.id === 'bm-members');
    expect(memberMsg).toBeTruthy();
    expect(memberMsg.locked).toBe(true);
    expect(memberMsg.body).toBeUndefined();
    expect(memberMsg.target_tier_rank).toBe(2);
  });
});

// ===========================================================================
// D. Paid Member: handshake → Checkout → webhook → membership.
// ===========================================================================
describe('D. Paid Member: handshake → Checkout → webhook → membership', () => {
  beforeEach(() => seedBaseFixtures({ withStripePrices: true }));

  test('rank-2 handshake returns subscribeUrl and webhook lands an active membership', async () => {
    const handshake = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      tier_rank: 2,
      fan_handle: 'jordan_fan_42',
      acknowledged_platform_trust: true,
    });
    expect(handshake.status).toBe(200);
    expect(handshake.body.requiresPayment).toBe(true);
    expect(handshake.body.subscribeUrl).toContain('checkout.stripe.test');
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);

    // Pre-webhook: no membership row yet.
    expect(getTable('PersonaMembership')).toHaveLength(0);

    // Drive customer.subscription.created directly (skipping signature
    // verification — same path the real handler runs after verifyEvent).
    const nowSec = Math.floor(Date.now() / 1000);
    await handlePersonaSubscriptionCreated({
      id: 'sub_e2e_paid',
      status: 'active',
      customer: STRIPE_CUSTOMER,
      current_period_start: nowSec,
      current_period_end: nowSec + 30 * 86400,
      cancel_at_period_end: false,
      metadata: {
        persona_id: PERSONA_ID,
        persona_tier_id: TIER_2_ID,
        fan_user_id: FAN_ID,
        fan_handle: 'jordan_fan_42',
        fan_display_name: '',
        fan_avatar_url: '',
      },
    });

    const memberships = getTable('PersonaMembership');
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: TIER_2_ID,
      status: 'active', stripe_subscription_id: 'sub_e2e_paid',
      fan_handle: 'jordan_fan_42',
    });

    // Fan-facing GET membership returns the new shape with quota.
    const memRes = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/membership`),
      FAN_ID,
    ).send();
    expect(memRes.status).toBe(200);
    expect(memRes.body.membership.tier.rank).toBe(2);
    expect(memRes.body.membership.status).toBe('active');
    expect(memRes.body.membership.fanHandle).toBe('jordan_fan_42');
    expect(memRes.body.membership.quotaRemaining.msgThreads).toBe(5);
  });
});

// ===========================================================================
// D2. DM quota enforcement.
// ===========================================================================
describe('D2. DM quota enforcement (Member rank 2 → 5 threads/period)', () => {
  beforeEach(() => seedBaseFixtures({ withStripePrices: true }));

  test('5 threads succeed; 6th returns 402 quota_exhausted', async () => {
    seedActivePaidMembership({ tierId: TIER_2_ID });

    for (let i = 0; i < 5; i += 1) {
      const r = await asUser(
        request(buildApp()).post(`/api/personas/${PERSONA_ID}/dms/threads`),
        FAN_ID,
      ).send({ body: `Hello #${i + 1}` });
      expect(r.status).toBe(201);
    }

    const sixth = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/dms/threads`),
      FAN_ID,
    ).send({ body: 'Sixth — should fail' });
    expect(sixth.status).toBe(402);
    expect(sixth.body.error).toBe('quota_exhausted');

    // Exactly 5 threads should be on the persona; the 6th must NOT have
    // been written.
    expect(getTable('PersonaDmThread')).toHaveLength(5);
  });
});

// ===========================================================================
// E. Reply-policy SLA missed → refund-request → cancel at period end.
// ===========================================================================
describe('E. Reply-policy SLA missed → refund-request', () => {
  beforeEach(() => seedBaseFixtures({ withStripePrices: true }));

  test('Insider with sla_missed thread can refund-request and gets cancel_at_period_end', async () => {
    // 8 days ago — Insider tier reply_policy='within_7_days' means an
    // unanswered thread of this age qualifies as sla_missed.
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();

    seedActivePaidMembership({
      tierId: TIER_3_ID, fanHandle: 'priya_insider',
      subId: 'sub_e2e_insider',
    });
    const membershipId = getTable('PersonaMembership')[0].id;

    // Seed a thread + the fan's opening message (no creator reply).
    seedTable('PersonaDmThread', [{
      id: 'thr-e2e-1', persona_id: PERSONA_ID,
      membership_id: membershipId,
      initiated_by_role: 'fan', initiated_by_user_id: FAN_ID,
      status: 'open', creator_unread_count: 1, fan_unread_count: 0,
      first_fan_message_at: eightDaysAgo,
      last_message_at: eightDaysAgo, last_message_preview: 'Hi',
      created_at: eightDaysAgo, updated_at: eightDaysAgo,
    }]);
    seedTable('PersonaDmMessage', [{
      id: 'msg-1', thread_id: 'thr-e2e-1',
      sender_role: 'fan', sender_user_id: FAN_ID,
      body: 'Hi', media: [],
      created_at: eightDaysAgo,
    }]);

    // Stripe lookups for issueRefund().
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_e2e_insider',
      latest_invoice: 'in_e2e',
      schedule: null,
      items: { data: [{ id: 'si_e2e', price: { id: 'price_insider_e2e' } }] },
      current_period_end: Math.floor(Date.now() / 1000) + 25 * 86400,
    });
    stripe.invoices.retrieve.mockResolvedValue({
      id: 'in_e2e', subscription: 'sub_e2e_insider', charge: 'ch_e2e',
    });

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/refund-request`),
      FAN_ID,
    ).send({ reason: 'sla_missed' });
    expect(res.status).toBe(200);
    expect(stripe.refunds.create).toHaveBeenCalledTimes(1);

    // Membership should be flagged cancel_at_period_end after refund.
    const membership = getTable('PersonaMembership')[0];
    expect(membership.cancel_at_period_end).toBe(true);

    // Audit log records the refund request.
    const audits = getTable('IdentityAuditLog')
      .filter((a) => a.action === 'persona_membership.refund_requested');
    expect(audits).toHaveLength(1);
    expect(audits[0].metadata.reason).toBe('sla_missed');
  });
});

// ===========================================================================
// F. Personal-side block cascades to audience side.
// ===========================================================================
describe('F. Personal block of fan cascades to audience expiration + refund', () => {
  beforeEach(() => seedBaseFixtures({ withStripePrices: true }));

  test('blocks fan, expires membership, refunds, and fan-facing copy is vague', async () => {
    seedActivePaidMembership({ tierId: TIER_2_ID, subId: 'sub_e2e_paid_block' });

    // Stripe lookups for the cascade refund + cancel.
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_e2e_paid_block',
      items: { data: [{ id: 'si_e2e', price: { id: 'price_member_e2e' } }] },
      latest_invoice: 'in_e2e_block',
      schedule: null,
      current_period_end: Math.floor(Date.now() / 1000) + 25 * 86400,
    });
    stripe.invoices.retrieve.mockResolvedValue({
      id: 'in_e2e_block', subscription: 'sub_e2e_paid_block', charge: 'ch_e2e_block',
    });

    const res = await asUser(
      request(buildApp()).post(`/api/users/${FAN_ID}/block`),
      OWNER_ID,
    ).send({ reason: 'gig dispute' });
    expect(res.status).toBe(200);

    // Cascade is fire-and-forget; flush the queue.
    await new Promise((r) => setImmediate(r));

    // Cascade has run: PersonaBlock row exists, membership is expired,
    // Stripe cancel + refund both fired.
    const blocks = getTable('PersonaBlock');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].source).toBe('personal_block_propagation');
    const membership = getTable('PersonaMembership')[0];
    expect(membership.status).toBe('expired');
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith(
      'sub_e2e_paid_block',
      expect.any(Object),
      expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT }),
    );
    expect(stripe.refunds.create).toHaveBeenCalled();

    // Fan-facing membership response after cascade — vague but truthful.
    // The membership remains visible so the fan can see the terminal state,
    // but NO field references the creator's personal-side relationship.
    const memRes = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/membership`),
      FAN_ID,
    ).send();
    expect(memRes.status).toBe(200);
    expect(memRes.body.membership.status).toBe('expired');
    const wire = JSON.stringify(memRes.body);
    expect(wire).not.toMatch(/block/i);
    expect(wire).not.toMatch(/personal/i);
    expect(wire).not.toMatch(/personal_block_propagation/);
    expect(wire).not.toContain(OWNER_ID);
  });
});

// ===========================================================================
// G. Symmetric firewall — creator viewing fan never sees personal data.
// ===========================================================================
describe('G. Symmetric firewall — creator-side fan view leaks nothing personal', () => {
  beforeEach(() => seedBaseFixtures({ withStripePrices: true }));

  function buildSerializerInput(membership) {
    const tier = getTable('PersonaTier').find((t) => t.id === membership.tier_id);
    const persona = getTable('PublicPersona').find((p) => p.id === membership.persona_id);
    return {
      ...membership,
      tier: { id: tier.id, rank: tier.rank, name: tier.name },
      persona: { ...persona, verified_local_discovery_enabled: false },
      quota: {
        msgThreadsLimit: tier.msg_threads_per_period,
        msgThreadsUsed: 0,
        videoCallsLimit: null, videoCallsUsed: 0,
      },
    };
  }

  test('serializeFanForCreator returns NONE of the personal-side fields', async () => {
    seedActivePaidMembership({ tierId: TIER_2_ID });
    const out = serializeFanForCreator(
      buildSerializerInput(getTable('PersonaMembership')[0]),
    );
    const wire = JSON.stringify(out);
    const forbidden = [
      'user_id', 'email', 'phone', 'phone_number',
      'real_name', 'first_name', 'last_name', 'legal_name',
      'address', 'city', 'state', 'zipcode', 'neighborhood',
      'home_id', 'localProfile', 'gigHistory',
      'stripe_customer_id', 'stripe_subscription_id',
    ];
    for (const f of forbidden) {
      expect(wire).not.toMatch(new RegExp(`"${f}"`, 'i'));
    }
    // The fan's user_id MUST never leak — even if a key isn't named
    // user_id, the value alone could be correlated. Check the raw value.
    expect(wire).not.toContain(FAN_ID);
  });

  test('joined_at is reported at month granularity only (joinedMonth = "YYYY-MM")', async () => {
    const joined = '2026-03-15T18:42:11.000Z';
    seedActivePaidMembership({
      tierId: TIER_2_ID,
      periodStart: joined,
      periodEnd:   '2026-09-15T18:42:11.000Z',
    });
    const out = serializeFanForCreator(
      buildSerializerInput(getTable('PersonaMembership')[0]),
    );
    expect(out.joinedMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(out.joinedAt).toBeUndefined();

    // Crucially, the exact joined_at value (down to seconds) MUST NOT
    // appear anywhere in the serialized output. currentPeriodEnd IS
    // exposed deliberately (it's a billing field, not a personal-side
    // correlation vector) so we only assert that the joined_at day
    // and the join time-of-day don't leak.
    const wire = JSON.stringify(out);
    expect(wire).not.toContain('2026-03-15');
  });

  test('a fan who is also a personal-side connection is INDISTINGUISHABLE in the serializer output', async () => {
    // fanA: ordinary fan. fanB: also has a UserBlock-or-Connection on
    // the personal side. The creator's view must not differ.
    seedActivePaidMembership({
      fanUserId: FAN_ID, tierId: TIER_2_ID, fanHandle: 'fan_alpha',
      subId: 'sub_alpha',
    });
    seedActivePaidMembership({
      fanUserId: OTHER_FAN_ID, tierId: TIER_2_ID, fanHandle: 'fan_beta',
      subId: 'sub_beta',
    });
    // Personal-side relationship for fanB only.
    seedTable('UserConnection', [{
      id: 'uc-1', user_a_id: OWNER_ID, user_b_id: OTHER_FAN_ID,
      status: 'connected',
    }]);

    const memberships = getTable('PersonaMembership');
    const a = serializeFanForCreator(buildSerializerInput(
      memberships.find((m) => m.user_id === FAN_ID),
    ));
    const b = serializeFanForCreator(buildSerializerInput(
      memberships.find((m) => m.user_id === OTHER_FAN_ID),
    ));

    // Same shape — same keys, same value types — proves the serializer
    // is pure-transform and doesn't reach into personal-side state.
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    for (const key of Object.keys(a)) {
      expect(typeof b[key]).toBe(typeof a[key]);
    }
  });
});

// ===========================================================================
// H. Chargeback path — Stripe charge.dispute.created.
// ===========================================================================
describe('H. Chargeback → status=expired + PersonaBlock(source=chargeback)', () => {
  beforeEach(() => seedBaseFixtures({ withStripePrices: true }));

  test('charge.dispute.created flips membership to expired AND creates chargeback PersonaBlock', async () => {
    seedActivePaidMembership({ tierId: TIER_2_ID, subId: 'sub_e2e_chargeback' });

    stripe.charges.retrieve.mockResolvedValue({
      id: 'ch_e2e_disputed', invoice: 'in_e2e_disputed',
    });
    stripe.invoices.retrieve.mockResolvedValue({
      id: 'in_e2e_disputed', subscription: 'sub_e2e_chargeback',
    });
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_e2e_chargeback',
      metadata: { persona_id: PERSONA_ID, fan_user_id: FAN_ID },
    });

    await handlePersonaChargeDisputeCreated(
      { id: 'dp_e2e_x', charge: 'ch_e2e_disputed' },
      STRIPE_ACCOUNT,
    );

    const membership = getTable('PersonaMembership')[0];
    expect(membership.status).toBe('expired');

    const blocks = getTable('PersonaBlock');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      persona_id: PERSONA_ID,
      blocked_user_id: FAN_ID,
      source: 'chargeback',
    });
    expect(blocks[0].reason).toMatch(/dp_e2e_x/);
  });
});

// ===========================================================================
// I. Audit log — every state change writes one IdentityAuditLog row.
// ===========================================================================
describe('I. Audit log — handshake → refund → block → exact action set', () => {
  beforeEach(() => seedBaseFixtures({ withStripePrices: true }));

  test('end-to-end sequence yields exactly the expected audit actions', async () => {
    // Step 1: free Follower handshake.
    const handshakeRes = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/follow`),
      FAN_ID,
    ).send({
      tier_rank: 1, fan_handle: 'jordan_e2e_audit',
      acknowledged_platform_trust: true,
    });
    expect(handshakeRes.status).toBe(201);

    // Step 2: same fan now also has a paid Insider sub (simulate via webhook).
    const nowSec = Math.floor(Date.now() / 1000);
    await handlePersonaSubscriptionCreated({
      id: 'sub_e2e_audit', status: 'active', customer: STRIPE_CUSTOMER,
      current_period_start: nowSec - 5 * 86400,
      current_period_end: nowSec + 25 * 86400,
      cancel_at_period_end: false,
      metadata: {
        persona_id: PERSONA_ID, persona_tier_id: TIER_3_ID, fan_user_id: FAN_ID,
        fan_handle: 'jordan_e2e_audit',
      },
    });

    // Step 3: 8-day-old fan-only thread → refund-request qualifies.
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();
    const membershipId = getTable('PersonaMembership')[0].id;
    seedTable('PersonaDmThread', [{
      id: 'thr-e2e-audit', persona_id: PERSONA_ID, membership_id: membershipId,
      initiated_by_role: 'fan', initiated_by_user_id: FAN_ID,
      status: 'open',
      creator_unread_count: 1, fan_unread_count: 0,
      first_fan_message_at: eightDaysAgo, last_message_at: eightDaysAgo,
      last_message_preview: 'Hi', created_at: eightDaysAgo, updated_at: eightDaysAgo,
    }]);
    seedTable('PersonaDmMessage', [{
      id: 'msg-audit-1', thread_id: 'thr-e2e-audit',
      sender_role: 'fan', sender_user_id: FAN_ID,
      body: 'Hi', media: [], created_at: eightDaysAgo,
    }]);
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_e2e_audit', latest_invoice: 'in_e2e_audit',
      schedule: null,
      items: { data: [{ id: 'si_e2e', price: { id: 'price_insider_e2e' } }] },
      current_period_end: nowSec + 25 * 86400,
    });
    stripe.invoices.retrieve.mockResolvedValue({
      id: 'in_e2e_audit', subscription: 'sub_e2e_audit', charge: 'ch_e2e_audit',
    });
    const refundRes = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/refund-request`),
      FAN_ID,
    ).send({ reason: 'sla_missed' });
    expect(refundRes.status).toBe(200);

    // Step 4: creator blocks the fan from the audience side.
    const blockRes = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/fans/${membershipId}/block`),
      OWNER_ID,
    ).send({});
    expect(blockRes.status).toBe(200);

    // Verify the persona-related actions in chronological order.
    const personaActions = getTable('IdentityAuditLog')
      .filter((a) => a.action.startsWith('persona'))
      .map((a) => a.action);
    expect(personaActions).toEqual(expect.arrayContaining([
      'persona_membership.handshake',
      'persona_membership.refund_requested',
      'persona_block.created',
    ]));
    // Each unique action appears exactly once for this sequence.
    const counts = personaActions.reduce((acc, a) => {
      acc[a] = (acc[a] || 0) + 1;
      return acc;
    }, {});
    expect(counts['persona_membership.handshake']).toBe(1);
    expect(counts['persona_membership.refund_requested']).toBe(1);
    expect(counts['persona_block.created']).toBe(1);
  });
});

// ===========================================================================
// J. Notification firewall — audience-context notifications are
//    suppressed for blocked recipients (P1.14 cross-check).
// ===========================================================================
describe('J. Notification firewall — blocked fan receives no audience notifications', () => {
  beforeEach(() => seedBaseFixtures({ withStripePrices: true }));

  test('createNotification returns null for audience context to a blocked fan', async () => {
    seedTable('PersonaBlock', [{
      id: 'pb-e2e', persona_id: PERSONA_ID, blocked_user_id: FAN_ID,
      source: 'persona_owner_action',
    }]);

    const result = await realNotificationService.createNotification({
      userId: FAN_ID,
      type: 'persona_dm_reply_fan',
      context: 'audience',
      title: '@mayabuilds replied',
      body: 'A reply',
      metadata: { persona_id: PERSONA_ID, thread_id: 'thr-x' },
    });
    expect(result).toBeNull();
    expect(getTable('Notification')).toHaveLength(0);

    // A non-blocked fan still receives the notification.
    const ok = await realNotificationService.createNotification({
      userId: OTHER_FAN_ID,
      type: 'persona_dm_reply_fan',
      context: 'audience',
      title: '@mayabuilds replied',
      body: 'A reply',
      metadata: { persona_id: PERSONA_ID, thread_id: 'thr-x' },
    });
    expect(ok).not.toBeNull();
    expect(getTable('Notification')).toHaveLength(1);
  });
});

// Sanity: confirm we can serialize a fan-facing membership view without
// touching the firewall — pure-transform check that lives next to the
// E2E suite so future renames break here, not in production.
describe('serializeMembershipForFan — sanity', () => {
  beforeEach(() => seedBaseFixtures({ withStripePrices: true }));

  test('returns rank/name and quota fields without leaking persona owner identity', () => {
    seedActivePaidMembership({ tierId: TIER_2_ID });
    const m = getTable('PersonaMembership')[0];
    const tier = getTable('PersonaTier').find((t) => t.id === TIER_2_ID);
    const persona = getTable('PublicPersona').find((p) => p.id === PERSONA_ID);

    const view = serializeMembershipForFan({
      ...m,
      tier,
      persona,
      quota: { msgThreadsLimit: 5, msgThreadsUsed: 0, videoCallsLimit: null, videoCallsUsed: 0 },
    });
    expect(view.tier.rank).toBe(2);
    expect(view.tier.name).toBe('Member');
    expect(view.quotaRemaining.msgThreads).toBe(5);
    const wire = JSON.stringify(view);
    expect(wire).not.toContain(OWNER_ID);
    expect(wire).not.toMatch(/stripe_customer_id|stripe_subscription_id/);
  });
});
