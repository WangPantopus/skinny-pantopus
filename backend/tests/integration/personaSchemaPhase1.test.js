/**
 * Integration test for migration 137 (P1.2):
 * PersonaQuotaUsage + PersonaBlock + AdminAccessLog.
 *
 * Covers the 6 schema invariants enumerated in the P1.2 prompt plus a few
 * cheap sanity checks against the design v2 §5.3 / §6.5 column shape.
 *
 * Connects directly via pg (mirrors backend/scripts/identity-firewall-migration-smoke.js
 * and backend/tests/integration/personaTier.migration.test.js).
 *
 * Skips gracefully if no DB connection env var is present.
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

const SUFFIX = 'p1.2-' + Math.random().toString(36).slice(2, 8);

describeIfDb('migration 137 — PersonaQuotaUsage / PersonaBlock / AdminAccessLog', () => {
  let client;

  beforeAll(async () => {
    client = new Client(dbConfig);
    await client.connect();
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  beforeEach(async () => {
    await client.query('BEGIN');
  });
  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  // -------------------------------------------------------------------------
  // Cheap sanity checks: each table exists with the columns and constraints
  // claimed by the design doc.
  // -------------------------------------------------------------------------
  test('all three tables exist in the public schema', async () => {
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('PersonaQuotaUsage','PersonaBlock','AdminAccessLog')`,
    );
    const names = new Set(rows.map((r) => r.table_name));
    expect(names.has('PersonaQuotaUsage')).toBe(true);
    expect(names.has('PersonaBlock')).toBe(true);
    expect(names.has('AdminAccessLog')).toBe(true);
  });

  test('AdminAccessLog.target_user_id deliberately has NO foreign key', async () => {
    const { rows } = await client.query(
      `SELECT tc.constraint_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.constraint_schema = kcu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'AdminAccessLog'
          AND kcu.column_name = 'target_user_id'`,
    );
    expect(rows).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // PersonaQuotaUsage constraint tests.
  // -------------------------------------------------------------------------
  test('PersonaQuotaUsage with period_end <= period_start violates the period_order_check', async () => {
    const ctx = await seedMembership(client, SUFFIX + '_q1');
    await client.query('SAVEPOINT before_violation');
    await expect(
      client.query(
        `INSERT INTO "public"."PersonaQuotaUsage"
            (membership_id, period_start, period_end, capability)
         VALUES ($1, '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z', 'msg_thread')`,
        [ctx.membershipId],
      ),
    ).rejects.toThrow(/PersonaQuotaUsage_period_order_check|check constraint/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation');

    await client.query('SAVEPOINT before_violation2');
    await expect(
      client.query(
        `INSERT INTO "public"."PersonaQuotaUsage"
            (membership_id, period_start, period_end, capability)
         VALUES ($1, '2026-06-15T00:00:00Z', '2026-06-01T00:00:00Z', 'msg_thread')`,
        [ctx.membershipId],
      ),
    ).rejects.toThrow(/PersonaQuotaUsage_period_order_check|check constraint/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation2');
  });

  test('PersonaQuotaUsage with capability = "invalid" violates the capability_check', async () => {
    const ctx = await seedMembership(client, SUFFIX + '_q2');
    await client.query('SAVEPOINT before_violation');
    await expect(
      client.query(
        `INSERT INTO "public"."PersonaQuotaUsage"
            (membership_id, period_start, period_end, capability)
         VALUES ($1, '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z', 'invalid')`,
        [ctx.membershipId],
      ),
    ).rejects.toThrow(/PersonaQuotaUsage_capability_check|check constraint/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation');
  });

  test('PersonaQuotaUsage accepts msg_thread and video_call capabilities', async () => {
    const ctx = await seedMembership(client, SUFFIX + '_q3');
    await client.query(
      `INSERT INTO "public"."PersonaQuotaUsage"
          (membership_id, period_start, period_end, capability)
       VALUES ($1, '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z', 'msg_thread'),
              ($1, '2026-06-01T00:00:00Z', '2026-07-01T00:00:00Z', 'video_call')`,
      [ctx.membershipId],
    );
    const { rows } = await client.query(
      `SELECT capability FROM "public"."PersonaQuotaUsage"
        WHERE membership_id = $1 ORDER BY capability`,
      [ctx.membershipId],
    );
    expect(rows.map((r) => r.capability)).toEqual(['msg_thread', 'video_call']);
  });

  // -------------------------------------------------------------------------
  // PersonaBlock UNIQUE + source check tests.
  // -------------------------------------------------------------------------
  test('two PersonaBlock rows with the same (persona_id, blocked_user_id) violate the UNIQUE constraint', async () => {
    const ctx = await seedPersonaAndUser(client, SUFFIX + '_b1');
    await client.query(
      `INSERT INTO "public"."PersonaBlock"
          (persona_id, blocked_user_id, reason, source)
       VALUES ($1, $2, 'first block', 'persona_owner_action')`,
      [ctx.personaId, ctx.fanUserId],
    );

    await client.query('SAVEPOINT before_violation');
    await expect(
      client.query(
        `INSERT INTO "public"."PersonaBlock"
            (persona_id, blocked_user_id, reason, source)
         VALUES ($1, $2, 'duplicate', 'persona_owner_action')`,
        [ctx.personaId, ctx.fanUserId],
      ),
    ).rejects.toThrow(/PersonaBlock_persona_user_key|duplicate key|unique/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation');
  });

  test('PersonaBlock.source is restricted to the four allowed values', async () => {
    const ctx = await seedPersonaAndUser(client, SUFFIX + '_b2');
    await client.query('SAVEPOINT before_violation');
    await expect(
      client.query(
        `INSERT INTO "public"."PersonaBlock"
            (persona_id, blocked_user_id, source)
         VALUES ($1, $2, 'mystery_source')`,
        [ctx.personaId, ctx.fanUserId],
      ),
    ).rejects.toThrow(/PersonaBlock_source_check|check constraint/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation');
  });

  // -------------------------------------------------------------------------
  // AdminAccessLog scope check + append-only trigger.
  // -------------------------------------------------------------------------
  test('AdminAccessLog with scope = "moderator_invalid" violates the scope_check', async () => {
    const ctx = await seedAdmin(client, SUFFIX + '_a1');
    await client.query('SAVEPOINT before_violation');
    await expect(
      client.query(
        `INSERT INTO "public"."AdminAccessLog"
            (admin_user_id, action, scope, reason_category, reason_text)
         VALUES ($1, 'cross_context_lookup', 'moderator_invalid', 'safety_review',
                 'verifying invariant')`,
        [ctx.adminId],
      ),
    ).rejects.toThrow(/AdminAccessLog_scope_check|check constraint/i);
    await client.query('ROLLBACK TO SAVEPOINT before_violation');
  });

  test('UPDATE on an AdminAccessLog row is rejected by the append-only trigger', async () => {
    const ctx = await seedAdmin(client, SUFFIX + '_a2');
    const { rows: ins } = await client.query(
      `INSERT INTO "public"."AdminAccessLog"
          (admin_user_id, action, scope, reason_category, reason_text)
       VALUES ($1, 'cross_context_lookup', 'moderator_full', 'safety_review',
               'tracking original action')
       RETURNING id`,
      [ctx.adminId],
    );
    const logId = ins[0].id;

    await client.query('SAVEPOINT before_update');
    await expect(
      client.query(
        `UPDATE "public"."AdminAccessLog" SET reason_text = 'edited' WHERE id = $1`,
        [logId],
      ),
    ).rejects.toThrow(/append-only/i);
    await client.query('ROLLBACK TO SAVEPOINT before_update');
  });

  test('DELETE on an AdminAccessLog row is rejected by the append-only trigger', async () => {
    const ctx = await seedAdmin(client, SUFFIX + '_a3');
    const { rows: ins } = await client.query(
      `INSERT INTO "public"."AdminAccessLog"
          (admin_user_id, action, scope, reason_category)
       VALUES ($1, 'membership_view', 'moderator_audience', 'fraud_investigation')
       RETURNING id`,
      [ctx.adminId],
    );
    const logId = ins[0].id;

    await client.query('SAVEPOINT before_delete');
    await expect(
      client.query(
        `DELETE FROM "public"."AdminAccessLog" WHERE id = $1`,
        [logId],
      ),
    ).rejects.toThrow(/append-only/i);
    await client.query('ROLLBACK TO SAVEPOINT before_delete');
  });
});

// ─────────────────────────────────────────────────────────────────
// Local seed helpers.
// ─────────────────────────────────────────────────────────────────

async function insertUser(client, suffix) {
  const { rows } = await client.query(
    `INSERT INTO "public"."User"
        (id, username, email, name, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $1 || '@p1schema.test',
             'P1.2 Schema User', now(), now())
     RETURNING id`,
    [suffix],
  );
  return rows[0].id;
}

async function insertPersona(client, userId, handle) {
  const { rows } = await client.query(
    `INSERT INTO "public"."PublicPersona"
        (id, user_id, handle, handle_normalized, display_name,
         audience_mode, status, follower_count, post_count,
         created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, lower($2), 'P1.2 Test Persona',
             'open', 'active', 0, 0, now(), now())
     RETURNING id`,
    [userId, handle],
  );
  return rows[0].id;
}

async function insertRank1Tier(client, personaId) {
  const { rows } = await client.query(
    `INSERT INTO "public"."PersonaTier"
        (persona_id, rank, name, price_cents,
         msg_threads_per_period, creator_can_initiate_dm,
         reply_policy, position)
     VALUES ($1, 1, 'Follower', 0, NULL, false, 'discretion', 1)
     ON CONFLICT (persona_id, rank) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [personaId],
  );
  return rows[0].id;
}

async function insertMembership(client, personaId, fanUserId, tierId) {
  const handle = 'fan_' + Math.random().toString(36).slice(2, 10);
  const { rows } = await client.query(
    `INSERT INTO "public"."PersonaMembership"
        (persona_id, user_id, tier_id, fan_handle, fan_handle_normalized,
         status, relationship_type, source, notification_level,
         public_visibility)
     VALUES ($1, $2, $3, $4, lower($4),
             'active', 'follower', 'self_follow', 'all', 'private')
     RETURNING id`,
    [personaId, fanUserId, tierId, handle],
  );
  return rows[0].id;
}

async function seedMembership(client, suffix) {
  const ownerId = await insertUser(client, suffix + '_owner');
  const fanUserId = await insertUser(client, suffix + '_fan');
  const personaId = await insertPersona(client, ownerId, suffix + 'h');
  const tierId = await insertRank1Tier(client, personaId);
  const membershipId = await insertMembership(client, personaId, fanUserId, tierId);
  return { ownerId, fanUserId, personaId, tierId, membershipId };
}

async function seedPersonaAndUser(client, suffix) {
  const ownerId = await insertUser(client, suffix + '_owner');
  const fanUserId = await insertUser(client, suffix + '_fan');
  const personaId = await insertPersona(client, ownerId, suffix + 'h');
  return { ownerId, fanUserId, personaId };
}

async function seedAdmin(client, suffix) {
  const adminId = await insertUser(client, suffix + '_admin');
  return { adminId };
}
