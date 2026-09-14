#!/usr/bin/env node
// Real Home HTTP/IAM/services and owned PostgreSQL; controlled malformed query
// replies exercise unavailable/recovery states without touching hosted data.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const f = require('./home-residency-review-http-fixture.cjs')(process.argv[2], { summary: true, dashboard: true });
const { actor, home, sql, q, id } = f;
const health = require(path.resolve(__dirname, '../../backend/services/homeHealthService'));
let server, initialized = false;
async function request(force = true) {
  const r = await fetch(`http://127.0.0.1:${server.address().port}/api/homes/${home}/health-score${force ? '?force=true' : ''}`, {
    headers: { 'x-fixture-actor': actor }, signal: AbortSignal.timeout(30000),
  });
  assert.match(r.headers.get('cache-control'), /no-store/);
  return { status: r.status, body: await r.json() };
}
async function current(expectedBills = 20, force = true) {
  const r = await request(force);
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.body.breakdown.bills.score, expectedBills);
  assert.equal(r.body.score, Object.values(r.body.breakdown).reduce((sum, part) => sum + part.score, 0));
  return r.body;
}
async function bad(table, result, predicate) {
  health.invalidateHealthScoreCache(home);
  f.interceptNextQuery(table, result, predicate);
  const r = await request();
  assert.equal(r.status, 503, JSON.stringify({ table, ...r }));
  assert.deepEqual(Object.keys(r.body).sort(), ['code', 'error']);
  assert.equal(r.body.code, 'HOME_HEALTH_UNAVAILABLE');
  // A failed computation did not populate cache; the next ordinary read
  // actually re-queries the repaired source and succeeds.
  const before = f.queryCalls.filter(t => t === table).length;
  await current(20, false);
  assert(f.queryCalls.filter(t => t === table).length > before);
}
async function main() {
  try {
    f.setup(); initialized = true;
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    await current();
    sql(`INSERT INTO public."HomeBill"(id,home_id,created_by,bill_type,provider_name,amount,currency,status,due_date)
      VALUES(${q(id(940))},${q(home)},${q(actor)},'electric','Overdue electric',42.50,'USD','overdue',CURRENT_DATE-1);`);
    const single = await current(10);
    assert(single.breakdown.bills.issues.some(issue => issue.includes('Overdue electric')));
    sql(`INSERT INTO public."HomeBill"(id,home_id,created_by,bill_type,provider_name,amount,currency,status,due_date)
      VALUES(${q(id(941))},${q(home)},${q(actor)},'water','Overdue water',12.25,'USD','overdue',CURRENT_DATE-2);`);
    await current(0);
    sql(`UPDATE public."HomeBill" SET status='paid' WHERE home_id=${q(home)};`);
    await current();
    sql(`UPDATE public."HomeBill" SET status='due',due_date=CURRENT_DATE-1 WHERE id=${q(id(940))};`);
    await current(10);
    sql(`UPDATE public."HomeBill" SET due_date=CURRENT_DATE+2 WHERE id=${q(id(940))};`);
    await current();
    console.log('PASS: explicit overdue, multiple overdue, paid restoration, past due and future bills produce coherent actual scores');

    sql(`UPDATE public."HomeBill" SET status='overdue',provider_name='' WHERE id=${q(id(940))};
      UPDATE public."User" SET profile_picture_url=' ' WHERE id=${q(actor)};`);
    const cleared = await current(10);
    assert.deepEqual(cleared.breakdown.bills.issues, ['electric bill is overdue']);
    assert.equal(cleared.breakdown.household.score, 5);
    sql(`UPDATE public."HomeBill" SET status='paid' WHERE home_id=${q(home)};
      UPDATE public."User" SET profile_picture_url=NULL WHERE id=${q(actor)};`);
    await current();
    console.log('PASS: cleared optional provider/avatar text remains usable without inventing a household photo');

    const sources = [
      ['HomeIssue'], ['HomeBill'], ['HomeSeasonalChecklistItem'], ['HomeEmergency'],
      ['HomeOccupancy', detail => detail.columns.includes('AS "user"')],
    ];
    for (const [table, predicate] of sources) {
      for (const data of [null, {}, [null], [{}]]) {
        await bad(table, () => ({ data, error: null }), predicate);
      }
    }
    for (const count of [null, -1, 1.5, '3']) {
      await bad('HomeDocument', () => ({ data: null, count, error: null }));
    }
    console.log('PASS: all five row dimensions and document counts reject malformed success replies, stay uncached, and recover');

    const coordinates = detail => detail.columns.includes('map_center_lat');
    for (const data of [null, {}, { map_center_lat: 91, map_center_lng: 0 }, { map_center_lat: 0, map_center_lng: 'invalid' }]) {
      await bad('Home', () => ({ data, error: null }), coordinates);
    }
    await bad('Home', () => ({ data: null, error: { message: 'Controlled Home query failure' } }), coordinates);
    await bad('Home', () => { throw new Error('Controlled Home transport failure'); }, coordinates);
    console.log('PASS: missing/malformed Home coordinates, query failure and transport failure stay unavailable and recover');
    await current();
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
      sql(`UPDATE public."HomeBill" SET status='overdue',due_date=CURRENT_DATE-1 WHERE id=${q(id(940))};`);
      await current(10);
      sql(`UPDATE public."HomeBill" SET status='paid' WHERE home_id=${q(home)};`);
      await current();
      console.log('PASS: actual Supabase SDK/PostgREST dimension data, explicit overdue bill and paid restoration');
    }
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { f.cleanup(); console.log('PASS: exact Home health data HTTP fixture SQL cleanup'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
