#!/usr/bin/env node
// Production Home summary HTTP/helper/services against owned PostgreSQL.
// Auth and property-provider responses are synthetic; no paid provider calls.
const assert = require('node:assert/strict');
const path = require('node:path');
const f = require('./home-residency-review-http-fixture.cjs')(process.argv[2], { summary: true });
const { home, actor, sql, q, id } = f;
let server, initialized = false, extra = false;
const second = id(800), item = id(801), foreignItem = id(802), availableItem = id(803);
async function main() {
  try {
    f.setup(); initialized = true;
    const season = require(path.resolve(__dirname, '../../backend/services/ai/seasonalEngine')).getSeasonalContext({}).primary_season;
    sql(`BEGIN;
      INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES(${q(second)},${q(f.users[5])},'Private foreign summary fixture','Test','WA','98607');
      INSERT INTO public."HomeSeasonalChecklistItem"(id,home_id,season_key,year,item_key,title)
        VALUES(${q(item)},${q(home)},${q(season)},extract(year FROM now()),'fixture','Current seasonal item'),
          (${q(foreignItem)},${q(second)},${q(season)},extract(year FROM now()),'fixture','Foreign seasonal item'),
          (${q(availableItem)},${q(home)},${q(season)},extract(year FROM now()),'fixture_second','Second seasonal item'); COMMIT;`);
    extra = true;
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/homes/${home}`;
    const request = async (suffix, method = 'GET', body) => {
      const r = await fetch(base + suffix, { method, headers: { 'content-type': 'application/json', 'x-fixture-actor': actor },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
      return { status: r.status, body: await r.json() };
    };
    let r = await request('/health-score?force=true'); assert.equal(r.status, 200); assert.equal(typeof r.body.score, 'number');
    f.failNextQuery('HomeBill'); r = await request('/health-score?force=true'); assert.equal(r.status, 503); assert(!('score' in r.body));
    f.failNextQuery('HomeDocument', true); r = await request('/health-score?force=true'); assert.equal(r.status, 503);
    const beforeBills = f.queryCalls.filter(t => t === 'HomeBill').length;
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'finance.view',false);`);
    r = await request('/health-score'); assert.equal(r.status, 403); assert(!('score' in r.body));
    assert.equal(f.queryCalls.filter(t => t === 'HomeBill').length, beforeBills);
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`);
    console.log('PASS: current health, database/transport failure, and denied finance before score/cache access');

    r = await request('/seasonal-checklist'); assert.equal(r.status, 200); assert.equal(r.body.items.length, 2);
    f.failNextQuery('HomeSeasonalChecklistItem'); r = await request('/seasonal-checklist'); assert.equal(r.status, 503); assert(!('items' in r.body));
    f.failNextQuery('HomeSeasonalChecklistItem'); r = await request('/seasonal-checklist/history'); assert.equal(r.status, 503);
    r = await request(`/seasonal-checklist/${foreignItem}`, 'PATCH', { status: 'completed' }); assert.equal(r.status, 404);
    assert.equal(sql(`SELECT status FROM public."HomeSeasonalChecklistItem" WHERE id=${q(foreignItem)};`), 'pending');
    r = await request(`/seasonal-checklist/${item}`, 'PATCH', { status: 'hired' }); assert.equal(r.status, 400);
    f.loseNextReply(); r = await request(`/seasonal-checklist/${item}`, 'PATCH', { status: 'completed' }); assert.equal(r.status, 503);
    const original = sql(`SELECT to_jsonb(i)::text FROM public."HomeSeasonalChecklistItem" i WHERE id=${q(item)};`);
    r = await request('/seasonal-checklist'); assert.equal(r.body.items.find(i => i.id === item).status, 'completed');
    r = await request(`/seasonal-checklist/${item}`, 'PATCH', { status: 'completed' }); assert.equal(r.status, 200);
    assert.equal(sql(`SELECT to_jsonb(i)::text FROM public."HomeSeasonalChecklistItem" i WHERE id=${q(item)};`), original);
    assert.equal(sql(`SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=${q(home)} AND action='home_checklist_updated';`), '1');
    r = await request(`/seasonal-checklist/${item}`, 'PATCH', { status: 'skipped' }); assert.equal(r.status, 409);
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    r = await request(`/seasonal-checklist/${availableItem}`, 'PATCH', { status: 'completed' }); assert.equal(r.status, 403);
    assert.equal(sql(`SELECT status FROM public."HomeSeasonalChecklistItem" WHERE id=${q(availableItem)};`), 'pending');
    sql(`UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    console.log('PASS: real current checklist/history failure, foreign item denial, schema, lost reply, current recovery, exact repeat and revoked write');

    r = await request('/timeline'); assert.equal(r.status, 200); assert.equal(r.body.items.length, 1);
    f.failNextQuery('HomeAuditLog'); r = await request('/timeline'); assert.equal(r.status, 503); assert(!('items' in r.body));
    const beforeAudit = f.queryCalls.filter(t => t === 'HomeAuditLog').length;
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'members.manage',false);`);
    r = await request('/timeline'); assert.equal(r.status, 403);
    assert.equal(f.queryCalls.filter(t => t === 'HomeAuditLog').length, beforeAudit);
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`);
    f.setPropertyResult({ profile: null, source: 'error' }); r = await request('/property-value'); assert.equal(r.status, 503);
    f.setPropertyResult({ profile: null, source: 'fallback' }); r = await request('/property-value'); assert.equal(r.status, 200); assert.equal(r.body.source, 'unavailable');
    console.log('PASS: timeline follows audit authority, query failure stays unavailable, property error differs from absence without provider calls');

    r = await request('/bill-trends'); assert.equal(r.status, 200, JSON.stringify(f.diagnostics)); assert.equal(r.body.bill_benchmark_opt_in, false);
    f.failNextRpc('get_home_bill_comparison'); r = await request('/bill-trends'); assert.equal(r.status, 503); assert(!('bill_benchmark_opt_in' in r.body));
    f.failNextRpc('get_home_bill_comparison', true); r = await request('/bill-trends'); assert.equal(r.status, 503); assert(!('bills_by_type' in r.body));
    r = await request('/settings', 'PATCH', { preferences: { bill_benchmark_opt_in: true } }); assert.equal(r.status, 200);
    r = await request('/bill-trends'); assert.equal(r.body.bill_benchmark_opt_in, true);
    r = await request('/settings', 'PATCH', { preferences: { bill_benchmark_opt_in: 'invalid' } }); assert.equal(r.status, 400);
    r = await request('/bill-trends'); assert.equal(r.body.bill_benchmark_opt_in, true);
    f.loseNextReply(); r = await request('/settings', 'PATCH', { preferences: { bill_benchmark_opt_in: false } }); assert.equal(r.status, 503);
    r = await request('/bill-trends'); assert.equal(r.body.bill_benchmark_opt_in, false);
    f.failNextQuery('HomePreference', true); r = await request('/settings'); assert.equal(r.status, 503); assert(!('preferences' in r.body));
    console.log('PASS: current bill preference, database/transport failure, persisted opt-in, uncommitted failure and lost committed opt-out recovery');
    r = await request('/settings', 'PATCH', { trash_day: 'Monday', preferences: { notifications: { bills: false, mail: true } } }); assert.equal(r.status, 200);
    r = await request('/settings'); assert.equal(r.status, 200); assert.equal(r.body.home.trash_day, 'Monday'); assert.deepEqual(r.body.preferences.notifications, { bills: false, mail: true }); assert.equal(r.body.preferences.bill_benchmark_opt_in, false);
    r = await request('/settings', 'PATCH', { trash_day: 'Friday', preferences: { bill_benchmark_opt_in: 'yes' } }); assert.equal(r.status, 400);
    r = await request('/settings'); assert.equal(r.body.home.trash_day, 'Monday');
    sql(`DELETE FROM public."HomeSeasonalChecklistItem" WHERE home_id=${q(home)};`);
    f.failNextQuery('PropertyIntelligenceCache'); r = await request('/seasonal-checklist'); assert.equal(r.status, 503); assert(!('items' in r.body));
    r = await request('/seasonal-checklist'); assert.equal(r.status, 200, JSON.stringify(f.diagnostics)); assert(r.body.items.length > 0);
    const generated = r.body.items.map(item => item.id);
    r = await request('/seasonal-checklist'); assert.deepEqual(r.body.items.map(item => item.id), generated);
    console.log('PASS: atomic settings preserve unrelated preferences; context failure is unavailable and actual first checklist generation persists stable items');
    assert.equal(sql(`SELECT count(*) FROM public."BillBenchmark" WHERE geohash='s00000' AND bill_type='fixture_summary';`), '0');
    sql(`BEGIN; UPDATE public."Home" SET location=ST_SetSRID(ST_MakePoint(0,0),4326) WHERE id=${q(home)};
      INSERT INTO public."BillBenchmark"(id,geohash,bill_type,month,year,avg_amount_cents,household_count) VALUES
        (${q(id(804))},'s00000','fixture_summary',1,1901,100,4),(${q(id(805))},'s00000','fixture_summary',2,1901,200,12); COMMIT;`);
    r = await request('/bill-trends'); assert.equal(r.status, 200, JSON.stringify(f.diagnostics));
    assert.deepEqual(r.body.benchmarks, {});
    f.failNextRpc('get_home_bill_comparison'); r = await request('/bill-trends'); assert.equal(r.status, 503); assert(!('benchmarks' in r.body));
    console.log('PASS: legacy cached rows remain stored but never enter current comparisons; snapshot failure remains unavailable');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (extra) sql(`BEGIN; DELETE FROM public."BillBenchmark" WHERE id IN (${[id(804),id(805)].map(q)}); DELETE FROM public."HomeSeasonalChecklistItem" WHERE home_id IN (${[home, second].map(q)}); DELETE FROM public."Home" WHERE id=${q(second)}; COMMIT;`);
    if (initialized) { f.cleanup(); console.log('PASS: exact summary HTTP fixtures cleaned'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
