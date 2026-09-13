#!/usr/bin/env node
// Production intelligence HTTP/IAM -> owned SQL. Auth and property-provider
// responses are controlled; no hosted database or paid provider is contacted.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const f = require('./home-residency-review-http-fixture.cjs')(process.argv[2], { summary: true, dashboard: true });
const { actor, home, sql, q } = f;
const paths = ['health-score?force=true', 'seasonal-checklist', 'seasonal-checklist/history', 'property-value'];
const property = { profile: { estimated_value: 420000, cached_at: '2026-09-11T12:00:00Z' }, source: 'cache' };
let server, initialized = false;
const occupancy = change => sql(`UPDATE public."HomeOccupancy" SET ${change} WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
const homeState = change => sql(`UPDATE public."Home" SET ${change} WHERE id=${q(home)};`);
const restore = () => {
  occupancy("is_active=true,verification_status='verified',verified_at=now(),access_start_at=NULL,access_end_at=NULL,start_at=NULL,end_at=NULL");
  homeState("security_state='normal',home_status='active'");
  sql(`UPDATE public."HomeOwner" SET owner_status='verified' WHERE home_id=${q(home)} AND subject_id=${q(actor)};
    DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`);
  f.setPropertyResult(property);
};
async function request(suffix) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes/${home}/${suffix}`, {
    headers: { 'x-fixture-actor': actor }, signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
}
function rejected(result, status) {
  assert.equal(result.status, status, JSON.stringify(result));
  assert.match(result.cache, /no-store/);
  assert.deepEqual(Object.keys(result.body).sort(), ['code', 'error']);
}
async function current() {
  for (const suffix of paths) {
    const result = await request(suffix);
    assert.equal(result.status, 200, JSON.stringify({ suffix, ...result }));
    assert.match(result.cache, /no-store/);
    if (suffix.startsWith('health')) assert(Number.isInteger(result.body.score));
    if (suffix === 'seasonal-checklist') assert(result.body.items.length > 0);
    if (suffix.endsWith('/history')) assert(result.body.checklists.length > 0);
    if (suffix === 'property-value') assert.equal(result.body.estimated_value, 420000);
  }
}
async function main() {
  try {
    f.setup(); initialized = true; restore();
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    await current();
    for (const change of ["security_state='frozen'", "security_state='frozen_silent'", "home_status='archived'", "home_status='merged'"]) {
      homeState(change);
      for (const suffix of [...paths, 'health-score']) rejected(await request(suffix), 403);
      restore();
    }
    for (const change of ["is_active=false", "verification_status='pending_doc'", "access_end_at=now()-interval '1 second'", "access_start_at=now()+interval '1 day'"]) {
      occupancy(change);
      for (const suffix of paths) rejected(await request(suffix), 403);
      restore();
    }
    for (const status of ['revoked', 'disputed']) {
      sql(`UPDATE public."HomeOwner" SET owner_status=${q(status)} WHERE home_id=${q(home)} AND subject_id=${q(actor)};`);
      for (const suffix of paths) rejected(await request(suffix), 403);
      restore();
    }
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'home.view',false);`);
    for (const suffix of paths) rejected(await request(suffix), 403);
    restore();
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'finance.view',false);`);
    rejected(await request(paths[0]), 403); restore();
    console.log('PASS: all four intelligence reads require current SQL Home state, membership, ownership and explicit grants; cache is no-store');

    for (const suffix of paths) {
      for (const reject of [false, true]) { f.failNextRpc('home_record_context', reject); rejected(await request(suffix), 503); }
    }
    f.interceptNextQuery('Home', () => ({ data: null, error: { message: 'Controlled missing current coordinates' } }),
      detail => detail.columns.includes('map_center_lat'));
    rejected(await request('seasonal-checklist'), 503);
    f.interceptNextQuery('HomeSeasonalChecklistItem', () => ({ data: null, error: null }));
    rejected(await request('seasonal-checklist/history'), 503);
    await current();
    console.log('PASS: SQL/transport and missing current season/history data fail explicitly, then recover');

    async function heldChange(suffix, table, change, expected) {
      let release, captured;
      const held = new Promise(resolve => { captured = resolve; });
      const hold = async result => { captured(); await new Promise(resolve => { release = resolve; }); return result; };
      if (table) f.interceptNextQuery(table, hold);
      else f.setPropertyResult(() => hold(property));
      const pending = request(suffix);
      let timer;
      try {
        await Promise.race([held, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Expected held ' + suffix)), 20000); })]);
        change(); release();
        rejected(await pending, expected);
      } finally { clearTimeout(timer); release?.(); await pending.catch(() => {}); }
      restore();
    }
    for (const [suffix, table] of [[paths[0], 'HomeIssue'], [paths[1], 'HomeSeasonalChecklistItem'], [paths[2], 'HomeSeasonalChecklistItem'], [paths[3], null]]) {
      await heldChange(suffix, table, () => homeState("security_state='frozen'"), 403);
      await heldChange(suffix, table, () => occupancy('is_active=false'), 403);
      await heldChange(suffix, table, () => sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'security.manage',false);`), 503);
    }
    await current();
    console.log('PASS: twelve produced/held SQL or provider results cannot bypass frozen/revoked/changed authority; current access restores');
    if (process.argv[3] && process.argv[4]) {
      assert.match(process.argv[3], /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
      let status;
      try { status = JSON.parse(execFileSync(process.argv[4], ['status', '--workdir', process.argv[3], '-o', 'json'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
      })); } catch (_) { throw new Error('Could not read the owned local Supabase configuration'); }
      assert.equal(status.API_URL, 'http://127.0.0.1:64521'); assert(typeof status.SERVICE_ROLE_KEY === 'string');
      const { createClient } = require(path.resolve(__dirname, '../../backend/node_modules/@supabase/supabase-js'));
      f.useDatabaseClient(createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
      await current();
      homeState("security_state='frozen'");
      for (const suffix of [...paths, 'health-score']) rejected(await request(suffix), 403);
      restore(); occupancy('is_active=false');
      for (const suffix of paths) rejected(await request(suffix), 403);
      restore(); await current();
      console.log('PASS: actual Supabase SDK/PostgREST current intelligence, frozen/revoked denial and restoration');
    }
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { f.cleanup(); console.log('PASS: exact intelligence authority SQL fixture cleanup'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
