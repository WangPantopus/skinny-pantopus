/**
 * Integration test for migration 136 (P1.1):
 * PersonaTier + PersonaMembership extension.
 *
 * Verifies the post-migration schema, constraints, view filter, and the
 * backfill outcome described in
 *   docs/audience-profile-tier-ladder-design-2026-05-08-v2.md §5.3, §6.4, §7.1
 * and the migration file
 *   backend/database/migrations/136_persona_tier_and_membership_extension.sql
 *
 * Connects directly via pg (mirrors backend/scripts/identity-firewall-migration-smoke.js)
 * so we can exercise the SQL-level constraints. Uses a transaction that is
 * rolled back at the end of every test, so no persistent state is created.
 *
 * Skips gracefully if no DB connection env var is present, so this file is
 * safe to include in `npm test` runs without a live DB.
 */

const { Client } = require('pg');

function resolveConnectionConfig(env = process.env) {
  const connectionString =
    env.IDENTITY_FIREWALL_DATABASE_URL ||
    env.DATABASE_URL ||
    env.SUPABASE_DB_URL ||
    env.POSTGRES_URL ||
    env.POSTGRESQL_URL ||
    env.POSTGRES_PRISMA_URL;

  if (connectionString) return { connectionString };

  if (env.PGHOST && env.PGDATABASE && env.PGUSER) {
    return {
      host: env.PGHOST,
      port: env.PGPORT ? Number(env.PGPORT) : undefined,
      database: env.PGDATABASE,
      user: env.PGUSER,
      password: env.PGPASSWORD,
    };
  }
  return null;
}

const dbConfig = resolveConnectionConfig();
const describeIfDb = dbConfig ? describe : describe.skip;

const PERSONA_OWNER_USER = 'p1.1-owner-' + Math.random().toString(36).slice(2, 10);
const PERSONA_HANDLE = 'p1tier' + Math.random().toString(36).slice(2, 10);

describeIfDb('migration 136 — PersonaTier + PersonaMembership extension', () => {
  let client;

  beforeAll(async () => {
    client = new Client(dbConfig);
    await client.connect();
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  // Each test runs inside a transaction that is rolled back, so we never
  // leave residue in the shared DB. SAVEPOINTs are used inside tests that
  // deliberately exercise constraint failures (a failed statement would
  // otherwise abort the outer transaction).
  beforeEach(async () => {
    await client.query('BEGIN');
  });
  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  // -------------------------------------------------------------------------
  // 1. Schema-level expectations.
  // -------------------------------------------------------------------------
  test('PersonaTier table exists with the expected columns', async () => {
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'PersonaTier'`,
    );
    const cols = new Set(rows.map((r) => r.column_name));
    for (const c of [
      'id', 'persona_id', 'rank', 'name', 'description',
      'price_cents', 'currency', 'billing_interval',
      'msg_threads_per_period', 'video_calls_per_period',
      'video_call_duration_minutes', 'creator_can_initiate_dm',
      'reply_policy', 'status', 'stripe_price_id', 'position',
      'created_at', 'updated_at',
    ]) {
      expect(cols.has(c)).toBe(true);
    }
  });

  test('PersonaMembership has the new paid-tier columns', async () => {
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'PersonaMembership'`,
    );
    const cols = new Set(rows.map((r) => r.column_name));
    for (const c of [
      'cancel_at_period_end',
      'scheduled_tier_change_id',
      'stripe_customer_id',
      'stripe_subscription_id',
      'current_period_start',
      'current_period_end',
      'trial_end',
      'canceled_at',
      'verified_local',
      'verified_local_at',
    ]) {
      expect(cols.has(c)).toBe(true);
    }
  });

  test('PersonaMembership.migration_original_username column is dropped', async () => {
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'PersonaMembership'
          AND column_name = 'migration_original_username'`,
    );
    expect(rows).toHaveLength(0);
  });

  test('PersonaMembership.tier_id is NOT NULL and references PersonaTier', async () => {
    const { rows: notNullRows } = await client.query(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'PersonaMembership'
          AND column_name = 'tier_id'`,
    );
    expect(notNullRows).toHaveLength(1);
    expect(notNullRows[0].is_nullable).toBe('NO');

    const { rows: fkRows } = await client.query(
      `SELECT 1
         FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'PersonaMembership'
          AND constraint_name = 'PersonaMembership_tier_id_fkey'
          AND constraint_type = 'FOREIGN KEY'`,
    );
    expect(fkRows).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // 2. Backfill outcome over personas that existed at migration time.
  //    The migration's INSERT…SELECT statements are idempotent (ON CONFLICT
  //    DO NOTHING), so this test seeds a fresh persona, replays the same
  //    INSERTs, and verifies the resulting state.
  // -------------------------------------------------------------------------
  test('every PublicPersona row gets exactly 3 seeded tiers (ranks 1, 2, 3)', async () => {
    // Seed minimal user + persona for this test only.
    const userId = await insertTestUser(client, PERSONA_OWNER_USER);
    const personaId = await insertTestPersona(client, userId, PERSONA_HANDLE);

    // Replay the seeding statements from migration 136 step 2.
    await client.query(
      `INSERT INTO "public"."PersonaTier"
         ("persona_id","rank","name","description","price_cents",
          "msg_threads_per_period","creator_can_initiate_dm",
          "reply_policy","position")
       SELECT id, 1, 'Follower', 'Public posts + follower updates',
              0, NULL, false, 'discretion', 1
         FROM "public"."PublicPersona" WHERE id = $1
       ON CONFLICT ("persona_id","rank") DO NOTHING`,
      [personaId],
    );
    await client.query(
      `INSERT INTO "public"."PersonaTier"
         ("persona_id","rank","name","description","price_cents",
          "msg_threads_per_period","creator_can_initiate_dm",
          "reply_policy","position")
       SELECT id, 2, 'Member',
              'Everything in Follower, plus 5 message threads per month',
              500, 5, false, 'discretion', 2
         FROM "public"."PublicPersona" WHERE id = $1
       ON CONFLICT ("persona_id","rank") DO NOTHING`,
      [personaId],
    );
    await client.query(
      `INSERT INTO "public"."PersonaTier"
         ("persona_id","rank","name","description","price_cents",
          "msg_threads_per_period","creator_can_initiate_dm",
          "reply_policy","position")
       SELECT id, 3, 'Insider',
              'Everything in Member, plus 25 threads/month and creator can DM you back',
              1500, 25, true, 'within_7_days', 3
         FROM "public"."PublicPersona" WHERE id = $1
       ON CONFLICT ("persona_id","rank") DO NOTHING`,
      [personaId],
    );

    const { rows: tiers } = await client.query(
      `SELECT rank, name, price_cents, msg_threads_per_period,
              creator_can_initiate_dm, reply_policy
         FROM "public"."PersonaTier"
        WHERE persona_id = $1
        ORDER BY rank`,
      [personaId],
    );
    expect(tiers).toHaveLength(3);
    expect(tiers[0]).toMatchObject({
      rank: 1, name: 'Follower', price_cents: 0,
      msg_threads_per_period: null, creator_can_initiate_dm: false,
      reply_policy: 'discretion',
    });
    expect(tiers[1]).toMatchObject({
      rank: 2, name: 'Member', price_cents: 500,
      msg_threads_per_period: 5, creator_can_initiate_dm: false,
      reply_policy: 'discretion',
    });
    expect(tiers[2]).toMatchObject({
      rank: 3, name: 'Insider', price_cents: 1500,
      msg_threads_per_period: 25, creator_can_initiate_dm: true,
      reply_policy: 'within_7_days',
    });
  });

  test('PersonaMembership.tier_id backfill points at the rank-1 tier', async () => {
    const ownerId = await insertTestUser(client, PERSONA_OWNER_USER + '_b');
    const fanId = await insertTestUser(client, PERSONA_OWNER_USER + '_b_fan');
    const personaId = await insertTestPersona(client, ownerId, PERSONA_HANDLE + '_b');
    const rank1TierId = await insertTier(client, personaId, {
      rank: 1, name: 'Follower', priceCents: 0,
    });

    // Insert a membership the way migration 132 did — with NULL tier_id —
    // and replay the migration 136 backfill UPDATE.
    const { rows: m } = await client.query(
      `INSERT INTO "public"."PersonaMembership"
         (persona_id, user_id, tier_id, fan_handle, fan_handle_normalized,
          status, relationship_type, source, notification_level,
          public_visibility)
       VALUES ($1, $2, NULL, 'fan_aaaa1111', 'fan_aaaa1111',
               'active', 'follower', 'self_follow', 'all', 'private')
       RETURNING id`,
      [personaId, fanId],
    );
    const membershipId = m[0].id;

    await client.query(
      `UPDATE "public"."PersonaMembership" pm
          SET tier_id = pt.id
         FROM "public"."PersonaTier" pt
        WHERE pt.persona_id = pm.persona_id
          AND pt.rank = 1
          AND pm.tier_id IS NULL
          AND pm.id = $1`,
      [membershipId],
    );

    const { rows } = await client.query(
      `SELECT pm.tier_id, pt.rank
         FROM "public"."PersonaMembership" pm
         JOIN "public"."PersonaTier" pt ON pt.id = pm.tier_id
        WHERE pm.id = $1`,
      [membershipId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tier_id).toBe(rank1TierId);
    expect(rows[0].rank).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 3. PersonaFollow view: legacy callers see only rank-1 free followers.
  // -------------------------------------------------------------------------
  test('PersonaFollow view returns rank-1 memberships only', async () => {
    const ownerId = await insertTestUser(client, PERSONA_OWNER_USER + '_v');
    const fanFreeId = await insertTestUser(client, PERSONA_OWNER_USER + '_v_freefan');
    const fanPaidId = await insertTestUser(client, PERSONA_OWNER_USER + '_v_paidfan');
    const personaId = await insertTestPersona(client, ownerId, PERSONA_HANDLE + '_v');
    const rank1 = await insertTier(client, personaId, {
      rank: 1, name: 'Follower', priceCents: 0,
    });
    const rank2 = await insertTier(client, personaId, {
      rank: 2, name: 'Member', priceCents: 500,
      msgThreadsPerPeriod: 5,
    });

    await insertMembership(client, {
      personaId, userId: fanFreeId, tierId: rank1, fanHandleSeed: 'free',
    });
    await insertMembership(client, {
      personaId, userId: fanPaidId, tierId: rank2, fanHandleSeed: 'paid',
    });

    const { rows } = await client.query(
      `SELECT follower_user_id FROM "public"."PersonaFollow"
        WHERE persona_id = $1`,
      [personaId],
    );
    const followerIds = rows.map((r) => r.follower_user_id);
    expect(followerIds).toContain(fanFreeId);
    expect(followerIds).not.toContain(fanPaidId);
  });

  test('PersonaFollow view exposes the legacy follower_user_id column shape', async () => {
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'PersonaFollow'
        ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    expect(cols).toEqual([
      'id', 'persona_id', 'follower_user_id', 'relationship_type',
      'status', 'source', 'notification_level', 'public_visibility',
      'approved_by_user_id', 'approved_at', 'created_at', 'updated_at',
    ]);
  });

  // -------------------------------------------------------------------------
  // 4. CHECK / UNIQUE constraints.
  // -------------------------------------------------------------------------
  test('rank > 4 is rejected by PersonaTier_rank_check', async () => {
    const ownerId = await insertTestUser(client, PERSONA_OWNER_USER + '_r');
    const personaId = await insertTestPersona(client, ownerId, PERSONA_HANDLE + '_r');

    await client.query('SAVEPOINT before_violation');
    await expect(
      client.query(
        `INSERT INTO "public"."PersonaTier"
          (persona_id, rank, name, price_cents)
         VALUES ($1, 5, 'TooHigh', 1)`,
        [personaId],
      ),
    ).rejects.toThrow(/PersonaTier_rank_check|check constraint/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation');
  });

  test('duplicate (persona_id, rank=1) is rejected by the UNIQUE constraint', async () => {
    const ownerId = await insertTestUser(client, PERSONA_OWNER_USER + '_d');
    const personaId = await insertTestPersona(client, ownerId, PERSONA_HANDLE + '_d');
    await insertTier(client, personaId, { rank: 1, name: 'Follower', priceCents: 0 });

    await client.query('SAVEPOINT before_violation');
    await expect(
      client.query(
        `INSERT INTO "public"."PersonaTier"
          (persona_id, rank, name, price_cents)
         VALUES ($1, 1, 'AnotherFollower', 0)`,
        [personaId],
      ),
    ).rejects.toThrow(/PersonaTier_persona_rank_key|duplicate key|unique/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation');
  });

  test('rank=1 with price > 0 is rejected by PersonaTier_price_rank_check', async () => {
    const ownerId = await insertTestUser(client, PERSONA_OWNER_USER + '_pr1');
    const personaId = await insertTestPersona(client, ownerId, PERSONA_HANDLE + '_pr1');

    await client.query('SAVEPOINT before_violation');
    await expect(
      client.query(
        `INSERT INTO "public"."PersonaTier"
          (persona_id, rank, name, price_cents)
         VALUES ($1, 1, 'NotFreeFollower', 1)`,
        [personaId],
      ),
    ).rejects.toThrow(/PersonaTier_price_rank_check|check constraint/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation');
  });

  test('rank=2 with price = 0 is rejected by PersonaTier_price_rank_check', async () => {
    const ownerId = await insertTestUser(client, PERSONA_OWNER_USER + '_pr2');
    const personaId = await insertTestPersona(client, ownerId, PERSONA_HANDLE + '_pr2');

    await client.query('SAVEPOINT before_violation');
    await expect(
      client.query(
        `INSERT INTO "public"."PersonaTier"
          (persona_id, rank, name, price_cents)
         VALUES ($1, 2, 'AccidentallyFreeMember', 0)`,
        [personaId],
      ),
    ).rejects.toThrow(/PersonaTier_price_rank_check|check constraint/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation');
  });

  test('inserting a PersonaMembership with NULL tier_id is now rejected', async () => {
    const ownerId = await insertTestUser(client, PERSONA_OWNER_USER + '_nn');
    const fanId = await insertTestUser(client, PERSONA_OWNER_USER + '_nn_fan');
    const personaId = await insertTestPersona(client, ownerId, PERSONA_HANDLE + '_nn');

    await client.query('SAVEPOINT before_violation');
    await expect(
      client.query(
        `INSERT INTO "public"."PersonaMembership"
           (persona_id, user_id, tier_id, fan_handle, fan_handle_normalized,
            status, relationship_type, source, notification_level,
            public_visibility)
         VALUES ($1, $2, NULL, 'fan_aaaa9999', 'fan_aaaa9999',
                 'active', 'follower', 'self_follow', 'all', 'private')`,
        [personaId, fanId],
      ),
    ).rejects.toThrow(/null value|tier_id|not-null/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation');
  });
});

// ─────────────────────────────────────────────────────────────────
// Local seed helpers. Kept inline so this file is self-contained.
// ─────────────────────────────────────────────────────────────────

async function insertTestUser(client, usernameSuffix) {
  const { rows } = await client.query(
    `INSERT INTO "public"."User"
        (id, username, email, name, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $1 || '@p1tier.test', 'P1.1 Tier User',
             now(), now())
     RETURNING id`,
    [usernameSuffix],
  );
  return rows[0].id;
}

async function insertTestPersona(client, userId, handle) {
  const { rows } = await client.query(
    `INSERT INTO "public"."PublicPersona"
        (id, user_id, handle, handle_normalized, display_name,
         audience_mode, status, follower_count, post_count,
         created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, lower($2), 'P1.1 Test Persona',
             'open', 'active', 0, 0, now(), now())
     RETURNING id`,
    [userId, handle],
  );
  return rows[0].id;
}

async function insertTier(client, personaId, {
  rank, name, priceCents, msgThreadsPerPeriod = null,
  replyPolicy = 'discretion', creatorCanInitiateDm = false,
}) {
  const { rows } = await client.query(
    `INSERT INTO "public"."PersonaTier"
       (persona_id, rank, name, price_cents, msg_threads_per_period,
        creator_can_initiate_dm, reply_policy, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $2)
     RETURNING id`,
    [personaId, rank, name, priceCents, msgThreadsPerPeriod,
     creatorCanInitiateDm, replyPolicy],
  );
  return rows[0].id;
}

async function insertMembership(client, {
  personaId, userId, tierId, fanHandleSeed,
}) {
  const handle = 'fan_' + fanHandleSeed + Math.random().toString(36).slice(2, 6);
  const { rows } = await client.query(
    `INSERT INTO "public"."PersonaMembership"
       (persona_id, user_id, tier_id, fan_handle, fan_handle_normalized,
        status, relationship_type, source, notification_level,
        public_visibility)
     VALUES ($1, $2, $3, $4, lower($4),
             'active', 'follower', 'self_follow', 'all', 'private')
     RETURNING id`,
    [personaId, userId, tierId, handle],
  );
  return rows[0].id;
}
