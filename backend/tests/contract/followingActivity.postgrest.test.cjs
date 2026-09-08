// Opt-in real query contract. Creates and removes only its own disposable
// Docker containers/network; never loads .env or an application database.
// PANTOPUS_POSTGREST_CONTRACT=1 node --test tests/contract/followingActivity.postgrest.test.cjs
const { describe, before, after, beforeEach, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { createClient } = require('@supabase/supabase-js');
const { loadFollowingActivity } = require('../../services/followingActivityService');
const { filterFollowingPosts, personaPostVisibleToViewer } = require('../../utils/personaPostVisibility');

describe('Following activity against PostgreSQL 17 / PostgREST 14', {
  skip: process.env.PANTOPUS_POSTGREST_CONTRACT !== '1',
  timeout: 120_000,
}, () => {
  const name = `pantopus-following-contract-${process.pid}-${randomUUID().slice(0, 8)}`;
  const database = `${name}-db`;
  const api = `${name}-api`;
  // PostgREST's upstream registry carries the same v14.10 image as Supabase's
  // ECR mirror, which rate-limits shared CI runners. Pin the verified digest.
  const postgrestImage = 'postgrest/postgrest:v14.10@sha256:bca3f86f69d8ef7aa1e5ee65e66ce9a20c6c147be637517a7be8399e102901d1';
  let db;
  const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 90_000 }).trim();
  const runSql = (sql) => execFileSync('docker', ['exec', '-i', database, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: sql, encoding: 'utf8', timeout: 15_000,
  });

  before(async () => {
    docker('network', 'create', name);
    docker('run', '--rm', '-d', '--name', database, '--network', name,
      '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine');
    let ready = false;
    // The image's temporary initialization server accepts Unix sockets but
    // disables TCP. Wait for the final TCP server used by PostgREST, and use
    // that same transport for fixture setup to avoid the initialization race.
    for (let attempt = 0; attempt < 60; attempt++) {
      try { docker('exec', database, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'); ready = true; break; } catch { await delay(500); }
    }
    assert.ok(ready, 'disposable PostgreSQL must become ready');
    runSql(`
      CREATE TYPE post_audience AS ENUM ('public', 'followers', 'nearby');
      CREATE TABLE "Post" (
        id uuid PRIMARY KEY, identity_context_type text NOT NULL,
        identity_context_id uuid NOT NULL, title text, content text NOT NULL,
        created_at timestamptz NOT NULL, archived_at timestamptz,
        visibility text, audience post_audience, distribution_targets text[],
        target_tier_rank integer CHECK (target_tier_rank BETWEEN 1 AND 4), post_metadata jsonb
      );
      CREATE INDEX ON "Post" (identity_context_id, target_tier_rank, created_at DESC)
        WHERE identity_context_type = 'persona' AND archived_at IS NULL;
    `);
    docker('run', '--rm', '-d', '--name', api, '--network', name,
      '-p', '127.0.0.1::3000', '-e', `PGRST_DB_URI=postgres://postgres@${database}:5432/postgres`,
      '-e', 'PGRST_DB_ANON_ROLE=postgres', postgrestImage);
    const port = docker('port', api, '3000/tcp').split(':').pop();
    const base = `http://127.0.0.1:${port}`;
    // Supabase's normal /rest/v1 prefix and auth gateway are absent here.
    // All filters/order/limits still pass through the real SDK + PostgREST.
    db = createClient(base, 'disposable-fixture-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => {
        const url = new URL(input);
        assert.equal(url.origin, base);
        url.pathname = url.pathname.replace(/^\/rest\/v1/, '');
        const headers = new Headers(init?.headers);
        headers.delete('authorization');
        headers.delete('apikey');
        return fetch(url, { ...init, headers });
      } },
    });
    ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const { error } = await db.from('Post').select('id').limit(1);
      if (!error) { ready = true; break; }
      await delay(500);
    }
    assert.ok(ready, 'disposable PostgREST must become ready');
  });

  after(() => {
    for (const container of [api, database]) {
      try { docker('rm', '-f', container); } catch { /* setup may have failed */ }
    }
    try { docker('network', 'rm', name); } catch { /* setup may have failed */ }
  });
  beforeEach(() => runSql('TRUNCATE "Post";'));

  function membership(personaId, rank = 1, extras = {}) {
    return { id: randomUUID(), persona_id: personaId, tier: { rank },
      joined_at: '2026-05-01T00:00:00Z', last_seen_at: null, ...extras };
  }
  function post(personaId, extras = {}) {
    return { id: randomUUID(), identity_context_type: 'persona', identity_context_id: personaId,
      content: 'Fixture update', title: null, visibility: 'followers', audience: 'followers',
      target_tier_rank: null, post_metadata: null, distribution_targets: [], archived_at: null,
      created_at: '2026-05-09T00:00:00Z', ...extras };
  }
  async function seed(posts) {
    const { error } = await db.from('Post').insert(posts);
    assert.ifError(error);
  }

  it('keeps a quieter Beacon visible despite 80 newer posts from another', async () => {
    const busy = randomUUID(); const quiet = randomUUID();
    const quietPost = post(quiet);
    await seed([quietPost, ...Array.from({ length: 80 }, () => post(busy, { created_at: '2026-05-10T00:00:00Z' }))]);
    const [busyResult, quietResult] = await loadFollowingActivity([membership(busy), membership(quiet)], { db });
    assert.equal(busyResult.unreadCount, 25);
    assert.equal(quietResult.unreadCount, 1);
    assert.equal(quietResult.latestPost.id, quietPost.id);
  });

  it('finds an allowed update behind 80 paid, draft, archived, and private updates', async () => {
    const personaId = randomUUID();
    const allowed = post(personaId);
    const hidden = [{ target_tier_rank: 2 }, { post_metadata: { broadcast_status: 'draft' } },
      { archived_at: '2026-05-11T00:00:00Z' }, { visibility: 'private', audience: 'nearby' }];
    await seed([allowed, ...Array.from({ length: 80 }, (_, index) => post(personaId, {
      created_at: '2026-05-10T00:00:00Z', ...hidden[index % hidden.length],
    }))]);
    const [result] = await loadFollowingActivity([membership(personaId)], { db });
    assert.equal(result.latestPost.id, allowed.id);
    assert.equal(result.unreadCount, 1);
  });

  it('matches the application visibility policy across all tiers and broadcast states', async () => {
    const personaId = randomUUID();
    const audiences = [
      { audience: 'public', visibility: 'private' }, { audience: 'nearby', visibility: 'public' },
      { audience: 'followers', visibility: 'private' }, { audience: 'nearby', visibility: 'followers' },
      { audience: 'nearby', visibility: 'private', distribution_targets: ['persona_followers'] },
      { audience: 'nearby', visibility: 'private' },
    ];
    const posts = [];
    for (const target_tier_rank of [null, 1, 2, 3, 4]) {
      for (const audience of audiences) {
        for (const broadcast_status of [null, 'published', 'draft', 'archived', 'scheduled', '', false, 0]) {
          posts.push(post(personaId, { ...audience, target_tier_rank, post_metadata: { broadcast_status } }));
        }
      }
    }
    posts.push(post(personaId, { archived_at: '2026-05-11T00:00:00Z' }),
      post(personaId, { post_metadata: {} }), post(personaId, { post_metadata: null }));
    await seed(posts);
    for (const rank of [1, 2, 3, 4]) {
      const { data, error } = await filterFollowingPosts(db.from('Post').select('*'), rank);
      assert.ifError(error);
      assert.deepEqual(data.map((row) => row.id).sort(),
        posts.filter((row) => personaPostVisibleToViewer(row, rank)).map((row) => row.id).sort(), `rank ${rank}`);
    }
  });

  it('uses joined_at until first seen and breaks timestamp ties by post ID', async () => {
    const personaId = randomUUID();
    const posts = [post(personaId, { created_at: '2026-04-30T00:00:00Z' }), post(personaId), post(personaId)];
    await seed(posts);
    const [result] = await loadFollowingActivity([membership(personaId)], { db });
    assert.equal(result.unreadCount, 2);
    assert.equal(result.latestPost.id, posts.slice(1).map((row) => row.id).sort().at(-1));
    const [seen] = await loadFollowingActivity([membership(personaId, 1, { last_seen_at: '2026-05-10T00:00:00Z' })], { db });
    assert.equal(seen.unreadCount, 0);
    assert.equal(seen.latestPost.id, result.latestPost.id);
  });

  it('preserves database timestamp order below JavaScript millisecond precision', async () => {
    const personaId = randomUUID();
    const newer = post(personaId, {
      id: '00000000-0000-4000-8000-000000000001', created_at: '2026-05-09T00:00:00.100002Z',
    });
    const older = post(personaId, {
      id: '00000000-0000-4000-8000-000000000002', created_at: '2026-05-09T00:00:00.100001Z',
    });
    await seed([older, newer]);
    const [result] = await loadFollowingActivity([membership(personaId)], { db });
    assert.equal(result.latestPost.id, newer.id);
  });
});
