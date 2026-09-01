#!/usr/bin/env node

/**
 * Identity Firewall migration smoke checks.
 *
 * Read-only checks for the schema added by:
 *   - backend/database/migrations/128_identity_firewall_personas.sql
 *   - backend/database/migrations/129_identity_firewall_hardening.sql
 *   - backend/database/migrations/130_identity_firewall_followers_broadcast_analytics.sql
 *   - backend/database/migrations/131_identity_firewall_rls_safe_views.sql
 *   - supabase/migrations/20260505000001_identity_firewall_personas.sql
 *   - supabase/migrations/20260505000002_identity_firewall_hardening.sql
 *   - supabase/migrations/20260506000001_identity_firewall_followers_broadcast_analytics.sql
 *   - supabase/migrations/20260506000002_identity_firewall_rls_safe_views.sql
 *
 * Usage:
 *   node backend/scripts/identity-firewall-migration-smoke.js --preflight
 *   node backend/scripts/identity-firewall-migration-smoke.js
 *   node backend/scripts/identity-firewall-migration-smoke.js --both
 *
 * Connection:
 *   IDENTITY_FIREWALL_DATABASE_URL, DATABASE_URL, SUPABASE_DB_URL, POSTGRES_URL,
 *   POSTGRESQL_URL, or PGHOST/PGDATABASE/PGUSER/PGPASSWORD.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Migration 132 (P0.1) replaces PersonaFollow with a SQL view over the new
// PersonaMembership table. The required-table list tracks the canonical
// storage; PersonaFollow is asserted to exist as a view via REQUIRED_VIEWS.
//
// P0.7 audit follow-up: also covers the P0.6 (Notification.context),
// P0.8 (FeatureFlag), and P0.2 (LocalProfileDisplayNameMigrationP02
// snapshot) tables / columns. Operators can run this script after each
// migration batch to confirm the schema matches expectations.
const REQUIRED_TABLES = [
  'LocalProfile',
  'PublicPersona',
  'AudienceIdentity',
  'PersonaMembership',
  'IdentityBridgeSetting',
  'BroadcastChannel',
  'BroadcastMessage',
  'IdentityAuditLog',
  // P0.8 — feature flag rollout gate.
  'FeatureFlag',
  // P0.2 — display-name migration audit snapshot. Survives one rollout
  // window after the email job runs; operators may drop it after that.
  'LocalProfileDisplayNameMigrationP02',
];

const REQUIRED_COLUMNS = {
  LocalProfile: [
    'id',
    'user_id',
    'handle',
    'handle_normalized',
    'display_name',
    'avatar_url',
    'bio',
    'tagline',
    'public_city',
    'public_state',
    'public_neighborhood',
    'show_verified_resident_badge',
    'show_home_affiliation',
    'show_neighborhood',
    'show_gig_history',
    'profile_visibility',
    'search_visibility',
    'created_at',
    'updated_at',
  ],
  PublicPersona: [
    'id',
    'user_id',
    'handle',
    'handle_normalized',
    'display_name',
    'avatar_url',
    'banner_url',
    'bio',
    'public_links',
    'category',
    'audience_label',
    'audience_mode',
    'professional_category',
    'credential_status',
    'organization_name',
    'organization_affiliation_status',
    'status',
    'follower_count',
    'post_count',
    'broadcast_enabled',
    'is_searchable',
    'created_at',
    'updated_at',
  ],
  AudienceIdentity: [
    'id',
    'user_id',
    'public_persona_id',
    'handle',
    'handle_normalized',
    'display_name',
    'avatar_url',
    'status',
    'source',
    'created_at',
    'updated_at',
  ],
  // PersonaMembership is the canonical storage after migration 132.
  // Phase 0 keeps the legacy PersonaFollow columns alongside the new
  // audience-side identity columns (fan_handle, etc.); PR 1 prunes legacy
  // columns once the tier ladder lands.
  PersonaMembership: [
    'id',
    'persona_id',
    'user_id',
    'tier_id',
    'audience_identity_id',
    'fan_handle',
    'fan_handle_normalized',
    'fan_display_name',
    'fan_avatar_url',
    'status',
    'relationship_type',
    'source',
    'notification_level',
    'public_visibility',
    'approved_by_user_id',
    'approved_at',
    'joined_at',
    'created_at',
    'updated_at',
  ],
  // PersonaFollow is now a view over PersonaMembership; column shape preserved
  // for backwards-compatible reads.
  PersonaFollow: [
    'id',
    'persona_id',
    'follower_user_id',
    'relationship_type',
    'status',
    'source',
    'notification_level',
    'public_visibility',
    'approved_by_user_id',
    'approved_at',
    'created_at',
    'updated_at',
  ],
  IdentityBridgeSetting: [
    'id',
    'user_id',
    'persona_id',
    'show_persona_on_local',
    'show_local_on_persona',
    'bridge_label',
    'created_at',
    'updated_at',
  ],
  BroadcastChannel: [
    'id',
    'persona_id',
    'title',
    'description',
    'status',
    'created_at',
    'updated_at',
  ],
  BroadcastMessage: [
    'id',
    'channel_id',
    'persona_id',
    'author_user_id',
    'body',
    'media',
    'visibility',
    'status',
    'delivered_count',
    'read_count',
    'published_at',
    'created_at',
    'updated_at',
  ],
  IdentityAuditLog: [
    'id',
    'actor_user_id',
    'target_user_id',
    'persona_id',
    'action',
    'target_type',
    'target_id',
    'metadata',
    'created_at',
  ],
  Post: [
    'author_user_id',
    'identity_context_type',
    'identity_context_id',
    'broadcast_channel_id',
    'target_tier_rank',
    'delivered_count',
    'read_count',
  ],
  UserPrivacySettings: [
    'user_id',
    'search_visibility',
    'findable_by_name',
    'findable_by_email',
    'findable_by_phone',
  ],
  // P0.6 — notification firewall context column.
  Notification: [
    'context',
  ],
  // P0.8 — feature flag rollout gate.
  FeatureFlag: [
    'id',
    'flag_name',
    'enabled_globally',
    'enabled_for_internal_team',
    'beta_user_ids',
    'description',
    'created_at',
    'updated_at',
  ],
  // P0.2 — display-name migration audit snapshot.
  LocalProfileDisplayNameMigrationP02: [
    'id',
    'local_profile_id',
    'user_id',
    'previous_display_name',
    'new_display_name',
    'user_email',
    'user_username',
    'matched_field',
    'migrated_at',
    'email_sent_at',
    'email_failed_at',
  ],
};

const REQUIRED_ENUM_VALUES = {
  post_as_type: ['persona'],
  post_audience: ['public'],
};

const REQUIRED_RLS_TABLES = [
  'LocalProfile',
  'PublicPersona',
  'AudienceIdentity',
  // PersonaMembership replaces PersonaFollow as the RLS-protected base table.
  'PersonaMembership',
  'IdentityBridgeSetting',
  'BroadcastChannel',
  'BroadcastMessage',
  'IdentityAuditLog',
];

const REQUIRED_SAFE_VIEWS = [
  'PublicLocalProfileView',
  'PublicAudienceProfileView',
  'PublicBroadcastMessageView',
  // After migration 132 the PersonaFollow name is a SQL view over
  // PersonaMembership for backwards-compatible reads.
  'PersonaFollow',
];

const REVOKED_LEGACY_FEED_RPCS = [
  'public.get_neighborhood_feed(uuid,integer,integer)',
  'public.get_neighborhood_feed(uuid,integer,integer,text,integer)',
  'public.get_neighborhood_feed_at(uuid,double precision,double precision,integer,integer,text,integer)',
  'public.get_neighborhood_feed_v2(uuid,double precision,double precision,integer,integer,text,integer,text[])',
  'public.get_posts_in_bounds(uuid,double precision,double precision,double precision,double precision,integer,text)',
];

function loadEnvFile(filePath, env = process.env) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && env[key] == null) env[key] = value;
  }
}

function loadLocalEnv() {
  loadEnvFile(path.resolve(__dirname, '../../.env'));
  loadEnvFile(path.resolve(__dirname, '../.env'));
  loadEnvFile(path.resolve(__dirname, '../.env.dev'));
}

function parseArgs(argv) {
  const args = new Set(argv);
  if (args.has('--help') || args.has('-h')) {
    return { help: true, mode: 'post', json: false };
  }
  const mode = args.has('--both')
    ? 'both'
    : args.has('--preflight')
      ? 'preflight'
      : 'post';
  return {
    help: false,
    mode,
    json: args.has('--json'),
  };
}

function getSslConfig(env, connectionString) {
  const sslModeFromUrl = (() => {
    try {
      return connectionString ? new URL(connectionString).searchParams.get('sslmode') : null;
    } catch {
      return null;
    }
  })();
  const sslMode = env.PGSSLMODE || sslModeFromUrl;
  if (sslMode === 'disable') return false;
  if (sslMode === 'require' || sslMode === 'no-verify') return { rejectUnauthorized: false };
  try {
    const host = connectionString ? new URL(connectionString).hostname : env.PGHOST;
    if (host && /\.supabase\.(co|com)$/.test(host)) return { rejectUnauthorized: false };
  } catch {
    // fall through
  }
  return undefined;
}

function resolveDatabaseConfig(env = process.env) {
  const connectionString =
    env.IDENTITY_FIREWALL_DATABASE_URL ||
    env.DATABASE_URL ||
    env.SUPABASE_DB_URL ||
    env.POSTGRES_URL ||
    env.POSTGRESQL_URL ||
    env.POSTGRES_PRISMA_URL;

  if (connectionString) {
    const ssl = getSslConfig(env, connectionString);
    return ssl === undefined ? { connectionString } : { connectionString, ssl };
  }

  if (env.PGHOST && env.PGDATABASE && env.PGUSER) {
    const config = {
      host: env.PGHOST,
      port: env.PGPORT ? Number(env.PGPORT) : undefined,
      database: env.PGDATABASE,
      user: env.PGUSER,
      password: env.PGPASSWORD,
    };
    const ssl = getSslConfig(env, null);
    return ssl === undefined ? config : { ...config, ssl };
  }

  return null;
}

function addResult(results, status, name, details = {}) {
  results.push({ status, name, details });
}

function summarizeRows(rows, max = 5) {
  return rows.slice(0, max);
}

async function tableExists(client, tableName) {
  const { rows } = await client.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public."${tableName}"`]);
  return rows[0]?.exists === true;
}

async function typeExists(client, typeName) {
  const { rows } = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
         AND t.typname = $1
     ) AS exists`,
    [typeName],
  );
  return rows[0]?.exists === true;
}

async function runPreflightChecks(client) {
  const results = [];
  for (const table of ['User', 'Post', 'UserPrivacySettings']) {
    const exists = await tableExists(client, table);
    addResult(results, exists ? 'pass' : 'fail', `base table exists: ${table}`);
  }

  for (const typeName of Object.keys(REQUIRED_ENUM_VALUES)) {
    const exists = await typeExists(client, typeName);
    addResult(results, exists ? 'pass' : 'fail', `base enum exists: ${typeName}`);
  }

  const { rows: collisions } = await client.query(`
    WITH derived AS (
      SELECT
        "id"::text AS user_id,
        COALESCE(NULLIF("username", ''), 'user-' || replace("id"::text, '-', '')) AS handle,
        lower(COALESCE(NULLIF("username", ''), 'user-' || replace("id"::text, '-', ''))) AS handle_normalized
      FROM "public"."User"
    )
    SELECT
      handle_normalized,
      count(*)::int AS collision_count,
      array_agg(user_id ORDER BY user_id) AS user_ids,
      array_agg(handle ORDER BY user_id) AS handles
    FROM derived
    GROUP BY handle_normalized
    HAVING count(*) > 1
    ORDER BY collision_count DESC, handle_normalized
    LIMIT 20
  `);
  addResult(
    results,
    collisions.length === 0 ? 'pass' : 'warn',
    'LocalProfile backfill normalized handle collision report',
    collisions.length === 0 ? {} : { collisions: summarizeRows(collisions) },
  );

  return results;
}

async function runPostMigrationChecks(client) {
  const results = [];

  const { rows: tableRows } = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [REQUIRED_TABLES],
  );
  const foundTables = new Set(tableRows.map((row) => row.table_name));
  const missingTables = REQUIRED_TABLES.filter((table) => !foundTables.has(table));
  addResult(
    results,
    missingTables.length === 0 ? 'pass' : 'fail',
    'Identity Firewall tables exist',
    missingTables.length === 0 ? { tables: REQUIRED_TABLES } : { missingTables },
  );

  const { rows: viewRows } = await client.query(
    `SELECT table_name
     FROM information_schema.views
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [REQUIRED_SAFE_VIEWS],
  );
  const foundViews = new Set(viewRows.map((row) => row.table_name));
  const missingViews = REQUIRED_SAFE_VIEWS.filter((view) => !foundViews.has(view));
  addResult(
    results,
    missingViews.length === 0 ? 'pass' : 'fail',
    'Identity Firewall safe public views exist',
    missingViews.length === 0 ? { views: REQUIRED_SAFE_VIEWS } : { missingViews },
  );

  const { rows: rlsRows } = await client.query(
    `SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = ANY($1::text[])`,
    [REQUIRED_RLS_TABLES],
  );
  const rlsByTable = new Map(rlsRows.map((row) => [row.table_name, row.rls_enabled === true]));
  const missingRls = REQUIRED_RLS_TABLES.filter((table) => rlsByTable.get(table) !== true);
  addResult(
    results,
    missingRls.length === 0 ? 'pass' : 'fail',
    'Identity Firewall RLS enabled on protected tables',
    missingRls.length === 0 ? { tables: REQUIRED_RLS_TABLES } : { missingRls },
  );

  const { rows: legacyRpcGrantRows } = await client.query(
    `WITH required(signature) AS (
       SELECT unnest($1::text[])
     ),
     resolved AS (
       SELECT signature, to_regprocedure(signature) AS function_oid
       FROM required
     )
     SELECT
       signature,
       function_oid::text AS resolved_signature,
       has_function_privilege('anon', function_oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', function_oid, 'EXECUTE') AS authenticated_execute
     FROM resolved
     WHERE function_oid IS NOT NULL`,
    [REVOKED_LEGACY_FEED_RPCS],
  );
  const exposedLegacyRpcs = legacyRpcGrantRows.filter((row) => row.anon_execute || row.authenticated_execute);
  addResult(
    results,
    exposedLegacyRpcs.length === 0 ? 'pass' : 'fail',
    'legacy feed RPC execute grants revoked from browser roles',
    exposedLegacyRpcs.length === 0
      ? { checked: legacyRpcGrantRows.map((row) => row.resolved_signature) }
      : { exposedLegacyRpcs: summarizeRows(exposedLegacyRpcs) },
  );

  const requiredColumnTables = Object.keys(REQUIRED_COLUMNS);
  const { rows: columnRows } = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [requiredColumnTables],
  );
  const columnsByTable = new Map();
  for (const row of columnRows) {
    if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, new Set());
    columnsByTable.get(row.table_name).add(row.column_name);
  }
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const actual = columnsByTable.get(table) || new Set();
    const missing = columns.filter((column) => !actual.has(column));
    addResult(
      results,
      missing.length === 0 ? 'pass' : 'fail',
      `required columns exist: ${table}`,
      missing.length === 0 ? {} : { missingColumns: missing },
    );
  }

  for (const [typeName, requiredValues] of Object.entries(REQUIRED_ENUM_VALUES)) {
    const { rows } = await client.query(
      `SELECT e.enumlabel
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
         AND t.typname = $1`,
      [typeName],
    );
    const values = new Set(rows.map((row) => row.enumlabel));
    const missing = requiredValues.filter((value) => !values.has(value));
    addResult(
      results,
      missing.length === 0 ? 'pass' : 'fail',
      `enum values exist: ${typeName}`,
      missing.length === 0 ? { requiredValues } : { missingValues: missing },
    );
  }

  try {
    const { rows } = await client.query(`
      SELECT
        'persona'::"public"."post_as_type" AS post_as,
        'public'::"public"."post_audience" AS audience
    `);
    addResult(results, 'pass', 'post_as=persona and audience=public cast successfully', rows[0]);
  } catch (error) {
    addResult(results, 'fail', 'post_as=persona and audience=public cast successfully', { error: error.message });
  }

  const { rows: backfillRows } = await client.query(`
    SELECT
      (SELECT count(*)::int FROM "public"."User") AS user_count,
      (SELECT count(*)::int FROM "public"."LocalProfile") AS local_profile_count,
      (
        SELECT count(*)::int
        FROM "public"."User" u
        WHERE NOT EXISTS (
          SELECT 1 FROM "public"."LocalProfile" lp WHERE lp."user_id" = u."id"
        )
      ) AS users_missing_local_profile
  `);
  const backfill = backfillRows[0] || {};
  addResult(
    results,
    Number(backfill.users_missing_local_profile || 0) === 0 ? 'pass' : 'fail',
    'LocalProfile backfill covered every User row',
    backfill,
  );

  const { rows: postIdentityRows } = await client.query(`
    SELECT
      count(*)::int AS post_count,
      count(*) FILTER (WHERE "author_user_id" IS NULL)::int AS missing_author_user_id,
      count(*) FILTER (WHERE "identity_context_type" IS NULL)::int AS missing_identity_context_type,
      count(*) FILTER (WHERE "identity_context_id" IS NULL)::int AS missing_identity_context_id
    FROM "public"."Post"
  `);
  const postIdentity = postIdentityRows[0] || {};
  const missingPostContext =
    Number(postIdentity.missing_author_user_id || 0) +
    Number(postIdentity.missing_identity_context_type || 0) +
    Number(postIdentity.missing_identity_context_id || 0);
  addResult(
    results,
    missingPostContext === 0 ? 'pass' : 'warn',
    'existing Post rows have identity context backfilled',
    postIdentity,
  );

  // After migration 132 the source CHECK constraint moves to PersonaMembership.
  const { rows: sourceConstraintRows } = await client.query(`
    SELECT pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'PersonaMembership'
      AND c.conname = 'PersonaMembership_source_check'
  `);
  const sourceDefinition = sourceConstraintRows[0]?.definition || '';
  addResult(
    results,
    sourceDefinition.includes('follow_request') ? 'pass' : 'fail',
    'PersonaMembership source constraint allows follow_request',
    { definition: sourceDefinition },
  );

  const { rows: indexRows } = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'PublicPersona_one_active_per_user'
  `);
  addResult(
    results,
    indexRows.length === 1 ? 'pass' : 'fail',
    'PublicPersona one-active-per-user unique index exists',
  );

  const { rows: personaRows } = await client.query(`
    SELECT
      count(*)::int AS persona_count,
      count(*) FILTER (WHERE "status" = 'active')::int AS active_persona_count
    FROM "public"."PublicPersona"
  `);
  addResult(results, 'info', 'PublicPersona count after migration', personaRows[0] || {});

  return results;
}

function printHelp() {
  console.log(`
Identity Firewall migration smoke checks

Usage:
  node backend/scripts/identity-firewall-migration-smoke.js [--post|--preflight|--both] [--json]

Modes:
  --preflight  Check base schema and handle collisions before applying migrations.
  --post       Check Identity Firewall tables, enum values, columns, and backfill. Default.
  --both       Run preflight and post-migration checks.

Connection env:
  IDENTITY_FIREWALL_DATABASE_URL, DATABASE_URL, SUPABASE_DB_URL, POSTGRES_URL,
  POSTGRESQL_URL, POSTGRES_PRISMA_URL, or PGHOST/PGDATABASE/PGUSER/PGPASSWORD.
`);
}

function printResults(results, json = false) {
  if (json) {
    console.log(JSON.stringify({ results }, null, 2));
    return;
  }

  for (const result of results) {
    const label = result.status.toUpperCase().padEnd(4);
    const details = Object.keys(result.details || {}).length > 0
      ? ` ${JSON.stringify(result.details)}`
      : '';
    console.log(`[${label}] ${result.name}${details}`);
  }

  const counts = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});
  console.log(`\nSummary: ${counts.pass || 0} pass, ${counts.warn || 0} warn, ${counts.fail || 0} fail, ${counts.info || 0} info`);
}

async function run(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  loadLocalEnv();
  const dbConfig = resolveDatabaseConfig(env);
  if (!dbConfig) {
    console.error('Missing database connection env. Set IDENTITY_FIREWALL_DATABASE_URL or DATABASE_URL.');
    return 2;
  }

  const client = new Client(dbConfig);
  await client.connect();
  try {
    const allResults = [];
    if (args.mode === 'preflight' || args.mode === 'both') {
      allResults.push({ status: 'info', name: 'running preflight checks', details: {} });
      allResults.push(...await runPreflightChecks(client));
    }
    if (args.mode === 'post' || args.mode === 'both') {
      allResults.push({ status: 'info', name: 'running post-migration checks', details: {} });
      allResults.push(...await runPostMigrationChecks(client));
    }
    printResults(allResults, args.json);
    return allResults.some((result) => result.status === 'fail') ? 1 : 0;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  run().then((code) => process.exit(code)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  REQUIRED_COLUMNS,
  REQUIRED_ENUM_VALUES,
  REVOKED_LEGACY_FEED_RPCS,
  REQUIRED_RLS_TABLES,
  REQUIRED_SAFE_VIEWS,
  REQUIRED_TABLES,
  getSslConfig,
  loadEnvFile,
  parseArgs,
  resolveDatabaseConfig,
  runPreflightChecks,
  runPostMigrationChecks,
};
