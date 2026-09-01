/**
 * P1.4 — personaTierService unit tests.
 *
 * Audience Profile design v2 §7.1 (default ladder), §10 (tier CRUD).
 *
 * The prompt suggested tests/integration/, but the existing integration
 * runner is excluded from `npm test`. Service-with-mocked-DB tests live
 * under tests/unit/ in this codebase (see
 * personaFollowMembershipMigration.test.js for the same pattern). The
 * tests below exercise the service against the in-memory supabaseAdmin
 * mock and run on every PR via the default jest config.
 */

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { seedTable, getTable, resetTables } = supabaseAdmin;

// jest.config.js auto-redirects ../config/supabaseAdmin to the mock.
const personaTierService = require('../../services/personaTierService');

const PERSONA_ID = '11111111-1111-1111-1111-111111111111';
const PERSONA_ID_B = '22222222-2222-2222-2222-222222222222';
const FAN_ID = '33333333-3333-3333-3333-333333333333';

beforeEach(() => {
  resetTables();
});

// ---------------------------------------------------------------------------
// DEFAULT_LADDER export.
// ---------------------------------------------------------------------------
describe('DEFAULT_LADDER', () => {
  test('matches the v1.0 ladder spec from design v2 §7.1', () => {
    const ladder = personaTierService.DEFAULT_LADDER;
    expect(ladder).toHaveLength(3);
    expect(ladder.map((t) => t.rank)).toEqual([1, 2, 3]);
    expect(ladder[0]).toMatchObject({
      rank: 1,
      name: 'Follower',
      price_cents: 0,
      msg_threads_per_period: null,
      creator_can_initiate_dm: false,
      reply_policy: 'discretion',
    });
    expect(ladder[1]).toMatchObject({
      rank: 2,
      name: 'Member',
      price_cents: 500,
      msg_threads_per_period: 5,
      creator_can_initiate_dm: false,
      reply_policy: 'discretion',
    });
    expect(ladder[2]).toMatchObject({
      rank: 3,
      name: 'Insider',
      price_cents: 1500,
      msg_threads_per_period: 25,
      creator_can_initiate_dm: true,
      reply_policy: 'within_7_days',
    });
  });

  test('does NOT include rank 4 (Direct / video calls reserved for v1.1)', () => {
    expect(personaTierService.DEFAULT_LADDER.map((t) => t.rank)).not.toContain(4);
  });

  test('is deeply frozen (cannot be mutated)', () => {
    expect(Object.isFrozen(personaTierService.DEFAULT_LADDER)).toBe(true);
    expect(Object.isFrozen(personaTierService.DEFAULT_LADDER[0])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ensureDefaultLadder.
// ---------------------------------------------------------------------------
describe('ensureDefaultLadder', () => {
  test('seeds exactly 3 tiers with ranks 1, 2, 3 on a fresh persona', async () => {
    seedTable('PersonaTier', []);
    const result = await personaTierService.ensureDefaultLadder(PERSONA_ID);

    expect(result).toHaveLength(3);
    expect(result.map((t) => t.rank).sort()).toEqual([1, 2, 3]);

    const stored = getTable('PersonaTier').filter((t) => t.persona_id === PERSONA_ID);
    expect(stored).toHaveLength(3);
    expect(stored.map((t) => t.rank).sort()).toEqual([1, 2, 3]);

    const rank2 = stored.find((t) => t.rank === 2);
    expect(rank2).toMatchObject({
      persona_id: PERSONA_ID,
      name: 'Member',
      price_cents: 500,
      position: 2,
    });
  });

  test('is idempotent — calling twice creates no duplicates', async () => {
    seedTable('PersonaTier', []);
    await personaTierService.ensureDefaultLadder(PERSONA_ID);
    const result = await personaTierService.ensureDefaultLadder(PERSONA_ID);

    expect(result).toHaveLength(3);
    expect(getTable('PersonaTier').filter((t) => t.persona_id === PERSONA_ID))
      .toHaveLength(3);
  });

  test('only seeds the missing ranks when some tiers already exist', async () => {
    seedTable('PersonaTier', [{
      id: 'tier-existing-1', persona_id: PERSONA_ID, rank: 1,
      name: 'Custom Free', price_cents: 0, status: 'active',
      msg_threads_per_period: null, creator_can_initiate_dm: false,
      reply_policy: 'discretion', position: 1,
    }]);

    const result = await personaTierService.ensureDefaultLadder(PERSONA_ID);

    expect(result).toHaveLength(3);
    const ranks = getTable('PersonaTier')
      .filter((t) => t.persona_id === PERSONA_ID)
      .map((t) => t.rank).sort();
    expect(ranks).toEqual([1, 2, 3]);

    // The existing custom rank-1 tier was preserved, not replaced.
    const rank1 = getTable('PersonaTier').find(
      (t) => t.persona_id === PERSONA_ID && t.rank === 1,
    );
    expect(rank1.name).toBe('Custom Free');
  });

  test('does not affect other personas when seeding', async () => {
    seedTable('PersonaTier', []);
    await personaTierService.ensureDefaultLadder(PERSONA_ID);
    await personaTierService.ensureDefaultLadder(PERSONA_ID_B);

    expect(getTable('PersonaTier').filter((t) => t.persona_id === PERSONA_ID))
      .toHaveLength(3);
    expect(getTable('PersonaTier').filter((t) => t.persona_id === PERSONA_ID_B))
      .toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// listTiers.
// ---------------------------------------------------------------------------
describe('listTiers', () => {
  beforeEach(() => {
    seedTable('PersonaTier', [
      { id: 't1', persona_id: PERSONA_ID, rank: 1, name: 'Follower',
        price_cents: 0, status: 'active', position: 1 },
      { id: 't2', persona_id: PERSONA_ID, rank: 2, name: 'Member',
        price_cents: 500, status: 'active', position: 2 },
      { id: 't3', persona_id: PERSONA_ID, rank: 3, name: 'Insider',
        price_cents: 1500, status: 'hidden', position: 3 },
      // Different persona — must not appear in results.
      { id: 't4', persona_id: PERSONA_ID_B, rank: 1, name: 'Other',
        price_cents: 0, status: 'active', position: 1 },
    ]);
  });

  test('returns only active tiers by default', async () => {
    const tiers = await personaTierService.listTiers(PERSONA_ID);
    expect(tiers).toHaveLength(2);
    expect(tiers.map((t) => t.rank).sort()).toEqual([1, 2]);
    expect(tiers.every((t) => t.status === 'active')).toBe(true);
  });

  test('returns hidden + active tiers when includeHidden=true', async () => {
    const tiers = await personaTierService.listTiers(PERSONA_ID, { includeHidden: true });
    expect(tiers).toHaveLength(3);
    expect(tiers.map((t) => t.rank).sort()).toEqual([1, 2, 3]);
  });

  test('scopes results to the requested persona', async () => {
    const tiers = await personaTierService.listTiers(PERSONA_ID, { includeHidden: true });
    expect(tiers.every((t) => t.persona_id === PERSONA_ID)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateTier.
// ---------------------------------------------------------------------------
describe('updateTier', () => {
  beforeEach(() => {
    seedTable('PersonaTier', [
      { id: 'tier-2', persona_id: PERSONA_ID, rank: 2, name: 'Member',
        description: 'Original description', price_cents: 500,
        msg_threads_per_period: 5, creator_can_initiate_dm: false,
        reply_policy: 'discretion', status: 'active',
        currency: 'USD', billing_interval: 'month', position: 2,
        stripe_price_id: 'price_seeded_already' },
    ]);
  });

  test('updates allowed fields (name, description, price_cents, msg_threads_per_period, reply_policy)', async () => {
    const updated = await personaTierService.updateTier('tier-2', PERSONA_ID, {
      name: 'Renamed Tier',
      description: 'Updated description',
      price_cents: 700,
      msg_threads_per_period: 10,
      reply_policy: 'within_3_days',
    });
    expect(updated).toMatchObject({
      id: 'tier-2',
      persona_id: PERSONA_ID,
      rank: 2,
      name: 'Renamed Tier',
      description: 'Updated description',
      price_cents: 700,
      msg_threads_per_period: 10,
      reply_policy: 'within_3_days',
    });
  });

  test('also updates creator_can_initiate_dm and position when provided', async () => {
    const updated = await personaTierService.updateTier('tier-2', PERSONA_ID, {
      creator_can_initiate_dm: true,
      position: 5,
    });
    expect(updated.creator_can_initiate_dm).toBe(true);
    expect(updated.position).toBe(5);
  });

  test('ignores forbidden keys (persona_id, rank, stripe_price_id, status)', async () => {
    const updated = await personaTierService.updateTier('tier-2', PERSONA_ID, {
      persona_id: 'should-be-ignored',
      rank: 99,
      stripe_price_id: 'price_attacker_value',
      status: 'archived',
      currency: 'EUR',
      billing_interval: 'year',
    });
    // updateTier returned null because no allow-listed fields were supplied
    // — every key in `updates` was forbidden.
    expect(updated).toBeNull();
    const stored = getTable('PersonaTier').find((t) => t.id === 'tier-2');
    expect(stored.persona_id).toBe(PERSONA_ID);
    expect(stored.rank).toBe(2);
    expect(stored.stripe_price_id).toBe('price_seeded_already');
    expect(stored.status).toBe('active');
    expect(stored.currency).toBe('USD');
    expect(stored.billing_interval).toBe('month');
  });

  test('mixing allowed + forbidden keys writes only the allowed ones', async () => {
    const updated = await personaTierService.updateTier('tier-2', PERSONA_ID, {
      name: 'Allowed change',
      stripe_price_id: 'price_attacker_value',
      rank: 99,
    });
    expect(updated.name).toBe('Allowed change');
    expect(updated.rank).toBe(2);
    expect(updated.stripe_price_id).toBe('price_seeded_already');
  });

  test('returns null for an empty updates object', async () => {
    const result = await personaTierService.updateTier('tier-2', PERSONA_ID, {});
    expect(result).toBeNull();
  });

  test('does not mutate a tier when persona_id does not match', async () => {
    seedTable('PersonaTier', [
      { id: 'tier-x', persona_id: PERSONA_ID, rank: 2, name: 'Original',
        price_cents: 500, status: 'active' },
    ]);
    const result = await personaTierService.updateTier(
      'tier-x',
      'wrong-persona',
      { name: 'Hijacked' },
    );
    expect(result).toBeNull();
    const stored = getTable('PersonaTier').find((t) => t.id === 'tier-x');
    expect(stored.name).toBe('Original');
  });
});

// ---------------------------------------------------------------------------
// setTierVisibility.
// ---------------------------------------------------------------------------
describe('setTierVisibility', () => {
  beforeEach(() => {
    seedTable('PersonaTier', [
      { id: 'tier-1', persona_id: PERSONA_ID, rank: 1, name: 'Follower',
        price_cents: 0, status: 'active' },
      { id: 'tier-2', persona_id: PERSONA_ID, rank: 2, name: 'Member',
        price_cents: 500, status: 'active' },
      { id: 'tier-3', persona_id: PERSONA_ID, rank: 3, name: 'Insider',
        price_cents: 1500, status: 'active' },
    ]);
  });

  test('rejects an attempt to hide rank 1 (free Follower must always be active)', async () => {
    await expect(
      personaTierService.setTierVisibility('tier-1', PERSONA_ID, 'hidden'),
    ).rejects.toThrow(/free Follower tier cannot be hidden/);

    const stored = getTable('PersonaTier').find((t) => t.id === 'tier-1');
    expect(stored.status).toBe('active');
  });

  test('rejects archiving rank 1 too', async () => {
    await expect(
      personaTierService.setTierVisibility('tier-1', PERSONA_ID, 'archived'),
    ).rejects.toThrow(/free Follower tier cannot be hidden/);
  });

  test('allows setting rank 1 to active (no-op-ish but legal)', async () => {
    const result = await personaTierService.setTierVisibility('tier-1', PERSONA_ID, 'active');
    expect(result.status).toBe('active');
  });

  test('hides rank 2 successfully', async () => {
    const result = await personaTierService.setTierVisibility('tier-2', PERSONA_ID, 'hidden');
    expect(result.status).toBe('hidden');
    expect(getTable('PersonaTier').find((t) => t.id === 'tier-2').status).toBe('hidden');
  });

  test('archives rank 3 successfully', async () => {
    const result = await personaTierService.setTierVisibility('tier-3', PERSONA_ID, 'archived');
    expect(result.status).toBe('archived');
  });

  test('rejects an unknown status string', async () => {
    await expect(
      personaTierService.setTierVisibility('tier-2', PERSONA_ID, 'deleted'),
    ).rejects.toThrow(/Invalid tier status/);
  });

  test('returns null when the tier does not belong to the persona', async () => {
    const result = await personaTierService.setTierVisibility(
      'tier-2',
      'different-persona',
      'hidden',
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// tierHasActiveMembers.
// ---------------------------------------------------------------------------
describe('tierHasActiveMembers', () => {
  test('returns true when an active membership references the tier', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-1', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: 'tier-2',
      fan_handle: 'fan_aaaa', fan_handle_normalized: 'fan_aaaa',
      status: 'active',
    }]);
    expect(await personaTierService.tierHasActiveMembers('tier-2')).toBe(true);
  });

  test('returns true for past_due and canceled_pending memberships', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-pd', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: 'tier-2',
      fan_handle: 'fan_pd', fan_handle_normalized: 'fan_pd',
      status: 'past_due',
    }]);
    expect(await personaTierService.tierHasActiveMembers('tier-2')).toBe(true);

    seedTable('PersonaMembership', [{
      id: 'mem-cp', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: 'tier-2',
      fan_handle: 'fan_cp', fan_handle_normalized: 'fan_cp',
      status: 'canceled_pending',
    }]);
    expect(await personaTierService.tierHasActiveMembers('tier-2')).toBe(true);
  });

  test('returns false when no membership references the tier', async () => {
    seedTable('PersonaMembership', []);
    expect(await personaTierService.tierHasActiveMembers('tier-2')).toBe(false);
  });

  test('returns false when only terminal-status memberships reference the tier', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-exp', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: 'tier-2',
      fan_handle: 'fan_exp', fan_handle_normalized: 'fan_exp',
      status: 'expired',
    }, {
      id: 'mem-can', persona_id: PERSONA_ID, user_id: 'other-fan', tier_id: 'tier-2',
      fan_handle: 'fan_can', fan_handle_normalized: 'fan_can',
      status: 'canceled',
    }]);
    expect(await personaTierService.tierHasActiveMembers('tier-2')).toBe(false);
  });

  test('returns false when the membership references a different tier', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-other', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: 'tier-other',
      fan_handle: 'fan_other', fan_handle_normalized: 'fan_other',
      status: 'active',
    }]);
    expect(await personaTierService.tierHasActiveMembers('tier-2')).toBe(false);
  });
});
