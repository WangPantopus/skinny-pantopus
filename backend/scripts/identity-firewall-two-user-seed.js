#!/usr/bin/env node

/**
 * Seed a two-user Identity Firewall fixture for live/staging privacy testing.
 *
 * Usage:
 *   IDENTITY_FIREWALL_DATABASE_URL='postgres://...' npm run seed:identity-firewall:two-user -- --confirm
 *
 * Safety:
 *   This writes to the configured database. It refuses to run unless --confirm is present
 *   or IDENTITY_FIREWALL_ALLOW_SEED=true is set.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

function parseArgs(argv) {
  const args = new Set(argv);
  return {
    confirm: args.has('--confirm') || process.env.IDENTITY_FIREWALL_ALLOW_SEED === 'true',
    json: args.has('--json'),
    prefix: process.env.IDENTITY_FIREWALL_SEED_PREFIX || 'ifw_seed',
  };
}

async function upsertUser(client, { email, username, name, city, state, bio }) {
  const { rows } = await client.query(
    `INSERT INTO "public"."User" (
       "email", "username", "name", "first_name", "last_name", "verified", "city", "state", "bio", "profile_visibility"
     )
     VALUES ($1, $2, $3, split_part($3, ' ', 1), split_part($3, ' ', 2), true, $4, $5, $6, 'public')
     ON CONFLICT ("username") DO UPDATE SET
       "email" = EXCLUDED."email",
       "name" = EXCLUDED."name",
       "first_name" = EXCLUDED."first_name",
       "last_name" = EXCLUDED."last_name",
       "verified" = true,
       "city" = EXCLUDED."city",
       "state" = EXCLUDED."state",
       "bio" = EXCLUDED."bio",
       "updated_at" = now()
     RETURNING "id", "username", "email"`,
    [email, username, name, city, state, bio],
  );
  return rows[0];
}

async function upsertLocalProfile(client, { userId, handle, displayName, bio, city, state }) {
  const { rows } = await client.query(
    `INSERT INTO "public"."LocalProfile" (
       "user_id", "handle", "handle_normalized", "display_name", "bio", "tagline",
       "public_city", "public_state", "show_verified_resident_badge", "show_gig_history"
     )
     VALUES ($1, $2, lower($2), $3, $4, 'Verified Resident', $5, $6, true, true)
     ON CONFLICT ("user_id") DO UPDATE SET
       "handle" = EXCLUDED."handle",
       "handle_normalized" = EXCLUDED."handle_normalized",
       "display_name" = EXCLUDED."display_name",
       "bio" = EXCLUDED."bio",
       "tagline" = EXCLUDED."tagline",
       "public_city" = EXCLUDED."public_city",
       "public_state" = EXCLUDED."public_state",
       "updated_at" = now()
     RETURNING "id", "handle"`,
    [userId, handle, displayName, bio, city, state],
  );
  return rows[0];
}

async function seed() {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  if (!args.confirm) {
    throw new Error('Refusing to write seed data without --confirm or IDENTITY_FIREWALL_ALLOW_SEED=true.');
  }

  const dbConfig = resolveDatabaseConfig();
  if (!dbConfig) {
    throw new Error('No database connection found. Set IDENTITY_FIREWALL_DATABASE_URL or PGHOST/PGDATABASE/PGUSER.');
  }

  const prefix = args.prefix.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const ownerUsername = `${prefix}_owner`;
  const followerUsername = `${prefix}_follower`;
  const personaHandle = `${prefix}_audience`;

  const client = new Client(dbConfig);
  await client.connect();
  try {
    await client.query('BEGIN');

    const owner = await upsertUser(client, {
      email: `${ownerUsername}@example.test`,
      username: ownerUsername,
      name: 'Identity Owner',
      city: 'Seattle',
      state: 'WA',
      bio: 'Seed owner private/local account.',
    });
    const follower = await upsertUser(client, {
      email: `${followerUsername}@example.test`,
      username: followerUsername,
      name: 'Identity Follower',
      city: 'Portland',
      state: 'OR',
      bio: 'Seed follower local account.',
    });
    const ownerLocal = await upsertLocalProfile(client, {
      userId: owner.id,
      handle: `${prefix}_local`,
      displayName: 'Seed Local Identity',
      bio: 'Local-only seed profile.',
      city: 'Seattle',
      state: 'WA',
    });
    const followerLocal = await upsertLocalProfile(client, {
      userId: follower.id,
      handle: `${prefix}_neighbor`,
      displayName: 'Seed Follower Local',
      bio: 'Follower local profile used for owner review.',
      city: 'Portland',
      state: 'OR',
    });

    const { rows: personaRows } = await client.query(
      `INSERT INTO "public"."PublicPersona" (
         "user_id", "handle", "handle_normalized", "display_name", "bio",
         "public_links", "category", "audience_label", "audience_mode",
         "status", "follower_count", "post_count", "broadcast_enabled"
       )
       VALUES ($1, $2, lower($2), 'Seed Audience Profile', 'Audience-only seed profile for privacy testing.',
         '[{"label":"Seed Site","url":"https://example.test/identity-firewall"}]'::jsonb,
         'creator', 'followers', 'open', 'active', 1, 1, true)
       ON CONFLICT ("handle_normalized") DO UPDATE SET
         "display_name" = EXCLUDED."display_name",
         "bio" = EXCLUDED."bio",
         "public_links" = EXCLUDED."public_links",
         "category" = EXCLUDED."category",
         "audience_label" = EXCLUDED."audience_label",
         "audience_mode" = EXCLUDED."audience_mode",
         "status" = 'active',
         "follower_count" = 1,
         "post_count" = 1,
         "broadcast_enabled" = true,
         "updated_at" = now()
       RETURNING "id", "handle"`,
      [owner.id, personaHandle],
    );
    const persona = personaRows[0];

    await client.query(
      `INSERT INTO "public"."IdentityBridgeSetting" (
         "user_id", "persona_id", "show_persona_on_local", "show_local_on_persona"
       )
       VALUES ($1, $2, false, false)
       ON CONFLICT ("user_id", "persona_id") DO UPDATE SET
         "show_persona_on_local" = false,
         "show_local_on_persona" = false,
         "updated_at" = now()`,
      [owner.id, persona.id],
    );

    const { rows: channelRows } = await client.query(
      `INSERT INTO "public"."BroadcastChannel" ("persona_id", "title", "description", "status")
       VALUES ($1, 'Seed Audience Broadcast', 'One-way seed broadcast channel.', 'active')
       ON CONFLICT ("persona_id") DO UPDATE SET
         "title" = EXCLUDED."title",
         "description" = EXCLUDED."description",
         "status" = 'active',
         "updated_at" = now()
       RETURNING "id"`,
      [persona.id],
    );
    const channel = channelRows[0];

    // PersonaMembership is the canonical follow/membership table after
    // migration 132. fan_handle is generated randomly so the audience-side
    // identity is never derived from the personal-side User.username.
    const fanHandle = `fan_${require('crypto').randomBytes(4).toString('hex')}`;
    await client.query(
      `INSERT INTO "public"."PersonaMembership" (
         "persona_id", "user_id", "tier_id",
         "fan_handle", "fan_handle_normalized",
         "relationship_type", "status", "source",
         "notification_level", "public_visibility", "approved_by_user_id", "approved_at"
       )
       VALUES (
         $1, $2, NULL,
         $4, lower($4),
         'follower', 'active', 'self_follow',
         'all', 'visible_to_owner', $3, now()
       )
       ON CONFLICT ("persona_id", "user_id") DO UPDATE SET
         "relationship_type" = 'follower',
         "status" = 'active',
         "source" = 'self_follow',
         "notification_level" = 'all',
         "public_visibility" = 'visible_to_owner',
         "approved_by_user_id" = EXCLUDED."approved_by_user_id",
         "approved_at" = now(),
         "updated_at" = now()`,
      [persona.id, follower.id, owner.id, fanHandle],
    );

    await client.query(
      `DELETE FROM "public"."Post"
       WHERE "author_user_id" = $1
         AND "content" LIKE $2`,
      [owner.id, `[Identity Firewall seed:${prefix}]%`],
    );
    await client.query(
      `INSERT INTO "public"."Post" (
         "user_id", "author_user_id", "content", "post_type", "visibility", "visibility_scope",
         "post_as", "audience", "identity_context_type", "identity_context_id"
       )
       VALUES
       ($1, $1, $2, 'general', 'followers', 'followers', 'persona', 'followers', 'persona', $3),
       ($1, $1, $4, 'general', 'neighborhood', 'neighborhood', 'personal', 'nearby', 'local', $5)`,
      [
        owner.id,
        `[Identity Firewall seed:${prefix}] audience-only post visible to PersonaFollow audience.`,
        persona.id,
        `[Identity Firewall seed:${prefix}] local-only nearby post that must not appear on the Audience Profile.`,
        ownerLocal.id,
      ],
    );

    await client.query(
      `DELETE FROM "public"."BroadcastMessage"
       WHERE "channel_id" = $1
         AND "body" LIKE $2`,
      [channel.id, `[Identity Firewall seed:${prefix}]%`],
    );
    await client.query(
      `INSERT INTO "public"."BroadcastMessage" (
         "channel_id", "persona_id", "author_user_id", "body", "visibility", "status",
         "delivered_count", "read_count"
       )
       VALUES ($1, $2, $3, $4, 'followers', 'published', 1, 0)`,
      [
        channel.id,
        persona.id,
        owner.id,
        `[Identity Firewall seed:${prefix}] one-way broadcast visible to active persona followers.`,
      ],
    );

    await client.query('COMMIT');

    const result = {
      owner: { userId: owner.id, username: owner.username, localHandle: ownerLocal.handle },
      follower: { userId: follower.id, username: follower.username, localHandle: followerLocal.handle },
      persona: { id: persona.id, handle: persona.handle, publicPath: `/@${persona.handle}` },
      checks: {
        ownerIdentityCenter: '/app/identity',
        localProfile: `/local/${ownerLocal.handle}`,
        audienceProfile: `/@${persona.handle}`,
        expectedPrivacy: 'Follower should see persona posts and broadcasts only; local posts, gigs, listings, home info, reviews, and connections stay hidden.',
      },
    };
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('[PASS] Identity Firewall two-user seed created');
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exitCode = 1;
});
