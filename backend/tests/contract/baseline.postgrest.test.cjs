// Opt-in integration against a freshly replayed local canonical database.
// No .env, hosted credentials, auth mocks, user data or push providers are used.
const { describe, before, after, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { createClient } = require('@supabase/supabase-js');
const { loadFollowingActivity } = require('../../services/followingActivityService');

describe('Canonical baseline through real SDK, PostgREST JWT roles and Following service', {
  skip: process.env.PANTOPUS_BASELINE_CONTRACT !== '1', timeout: 180_000,
}, () => {
  const project = process.env.PANTOPUS_BASELINE_PROJECT || 'pantopus';
  assert.match(project, /^pantopus[a-zA-Z0-9_-]*$/);
  const database = `supabase_db_${project}`;
  const network = `supabase_network_${project}`;
  const api = `pantopus-baseline-contract-${process.pid}-${randomUUID().slice(0, 8)}`;
  const image = 'postgrest/postgrest:v14.10@sha256:bca3f86f69d8ef7aa1e5ee65e66ce9a20c6c147be637517a7be8399e102901d1';
  const secret = randomBytes(32).toString('hex');
  const owner = randomUUID(); const persona = randomUUID();
  const ids = { free: randomUUID(), member: randomUUID(), draft: randomUUID(), archived: randomUUID(), personal: randomUUID() };
  let service; let browsers; let started = false; let seeded = false;
  const docker = (...args) => {
    try { return execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
    catch { throw new Error('Local contract Docker command failed; credentials are not logged'); }
  };
  const sql = input => {
    try { return execFileSync('docker', ['exec', '-i', database, 'psql', '-X', '-U', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'],
      { input, encoding: 'utf8', timeout: 20_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
    catch { throw new Error('Local contract fixture SQL failed'); }
  };
  function token(role) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, sub: owner, exp: Math.floor(Date.now() / 1000) + 600 })}`;
    return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  }
  function client(base, role) {
    return createClient(base, token(role), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => {
        const url = new URL(input); assert.equal(url.origin, base);
        url.pathname = url.pathname.replace(/^\/rest\/v1/, '');
        const headers = new Headers(init?.headers); headers.delete('apikey');
        return fetch(url, { ...init, headers });
      } },
    });
  }
  before(async () => {
    // Refuse an existing app database even when an operator enables the test.
    assert.equal(sql('SELECT count(*) FROM public."User";'), '0', 'requires an empty canonical installation');
    assert.equal(sql("SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='Post' AND policyname='post_persona_service_only';"), '1');
    assert.equal(sql("SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('20260908234526','20260908234527');"), '2');
    docker('network', 'inspect', network);
    // Authenticator can assume only the database roles verified by PostgREST's
    // signature check; this does not test a Supabase Auth sign-in session.
    docker('run', '--rm', '-d', '--name', api, '--network', network, '-p', '127.0.0.1::3000',
      '-e', `PGRST_DB_URI=postgres://authenticator:postgres@${database}:5432/postgres`,
      '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', 'PGRST_DB_SCHEMAS=public',
      '-e', `PGRST_JWT_SECRET=${secret}`, image);
    started = true;
    const base = `http://127.0.0.1:${docker('port', api, '3000/tcp').split(':').pop()}`;
    service = client(base, 'service_role'); browsers = [client(base, 'anon'), client(base, 'authenticated')];
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { const { error } = await service.from('Post').select('id').limit(1); if (!error) { ready = true; break; } } catch {}
      await delay(500);
    }
    assert.ok(ready, 'local PostgREST must become ready');
    sql(`BEGIN;
      INSERT INTO auth.users (id,email) VALUES ('${owner}','baseline-contract@example.invalid');
      INSERT INTO public."User" (id,email,username,name)
      VALUES ('${owner}','baseline-contract@example.invalid','baseline_contract','Baseline contract');
      COMMIT;`);
    seeded = true;
    const basePost = { user_id: owner, visibility: 'public', audience: 'public',
      identity_context_type: 'persona', identity_context_id: persona, post_as: 'persona', target_tier_rank: 1,
      post_metadata: { broadcast_status: 'published' } };
    const now = Date.now();
    const rows = [
      { ...basePost, id: ids.free, content: 'Canonical free exact post', created_at: new Date(now - 4000).toISOString() },
      { ...basePost, id: ids.member, content: 'Canonical Member exact post', target_tier_rank: 2, created_at: new Date(now - 3000).toISOString() },
      { ...basePost, id: ids.draft, content: 'Canonical draft hidden', post_metadata: { broadcast_status: 'draft' }, created_at: new Date(now - 2000).toISOString() },
      { ...basePost, id: ids.archived, content: 'Canonical archive hidden', archived_at: new Date(now).toISOString(), created_at: new Date(now - 1000).toISOString() },
      { id: ids.personal, user_id: owner, content: 'Canonical ordinary public post', visibility: 'public', audience: 'public',
        identity_context_type: 'personal', post_as: 'personal', post_metadata: {}, created_at: new Date(now).toISOString() },
    ];
    const { error } = await service.from('Post').insert(rows); assert.ifError(error);
  });
  after(() => {
    try {
      if (seeded) sql(`BEGIN;
        DELETE FROM public."Notification" WHERE user_id='${owner}';
        DELETE FROM public."UserNotificationPreferences" WHERE user_id='${owner}';
        DELETE FROM public."Post" WHERE user_id='${owner}';
        DELETE FROM public."User" WHERE id='${owner}';
        DELETE FROM auth.users WHERE id='${owner}';
        COMMIT;`);
    } finally { if (started) docker('rm', '-f', api); }
  });

  it('keeps raw Beacon rows hidden from browser roles, including the owner', async () => {
    const { data, error } = await service.from('Post').select('id').eq('user_id', owner);
    assert.ifError(error); assert.equal(data.length, 5);
    for (const browser of browsers) {
      const result = await browser.from('Post').select('id,content').eq('user_id', owner);
      assert.ifError(result.error); assert.deepEqual(result.data.map(row => row.id), [ids.personal]);
    }
  });
  it('denies direct owner publication and conversion into a Beacon', async () => {
    const browser = browsers[1];
    const insert = await browser.from('Post').insert({ user_id: owner, content: 'Bypass attempt', visibility: 'public', post_as: 'persona', identity_context_type: 'persona' });
    assert.equal(insert.error?.code, '42501');
    const update = await browser.from('Post').update({ post_as: 'persona', identity_context_type: 'persona' }).eq('id', ids.personal);
    assert.equal(update.error?.code, '42501');
  });
  it('allows service maintenance RPCs and denies both browser roles', async () => {
    for (const [name, args] of [
      ['auto_archive_expired_posts', {}],
      ['get_seeder_tapering_metrics', { region_lat: 45.63, region_lng: -122.67, region_radius_meters: 1000 }],
      ['record_post_unique_view', { p_post_id: ids.personal, p_user_id: owner }],
    ]) {
      assert.ifError((await service.rpc(name, args)).error);
      for (const browser of browsers) assert.equal((await browser.rpc(name, args)).error?.code, '42501');
    }
  });
  it('runs Following service queries against the complete schema with exact tier filtering', async () => {
    for (const [rank, expectedId, unreadCount] of [[1, ids.free, 1], [2, ids.member, 2]]) {
      const [result] = await loadFollowingActivity([{ persona_id: persona, tier: { rank }, joined_at: '2026-01-01T00:00:00Z' }], { db: service });
      assert.equal(result.latestPost.id, expectedId); assert.equal(result.unreadCount, unreadCount);
      assert.equal(result.latestPost.content, rank === 1 ? 'Canonical free exact post' : 'Canonical Member exact post');
    }
  });
  it('persists one exact notification destination and rejects a retry duplicate', async () => {
    const row = { user_id: owner, type: 'broadcast', title: 'Canonical contract',
      link: `/posts/${ids.free}`, idempotency_key: `baseline-contract-${owner}` };
    assert.ifError((await service.from('Notification').insert(row)).error);
    assert.equal((await service.from('Notification').insert(row)).error?.code, '23505');
    const result = await service.from('Notification').select('link').eq('idempotency_key', row.idempotency_key);
    assert.ifError(result.error); assert.deepEqual(result.data, [{ link: row.link }]);
  });

  it('persists Beacon opt-out and restore through real PostgREST without changing another preference', async () => {
    const first = await service.from('UserNotificationPreferences').insert({ user_id: owner, gig_updates_enabled: false })
      .select('beacon_push_enabled').single();
    assert.ifError(first.error); assert.equal(first.data.beacon_push_enabled, true);
    for (const enabled of [false, true]) {
      const saved = await service.from('UserNotificationPreferences').update({ beacon_push_enabled: enabled }).eq('user_id', owner)
        .select('beacon_push_enabled,gig_updates_enabled').single();
      assert.ifError(saved.error);
      assert.deepEqual(saved.data, { beacon_push_enabled: enabled, gig_updates_enabled: false });
    }
  });
});
