#!/usr/bin/env node
// Production Place route/composer/serializer/helper, real local PostgreSQL.
// Only bill_benchmark is requested; every provider dependency is disabled.
const assert = require('node:assert/strict');
const f = require('./home-residency-review-http-fixture.cjs')(process.argv[2], { summary: true, place: true });
const { home, actor, sql, q, id } = f;
let server, initialized = false;
async function main() {
  try {
    f.setup(); initialized = true;
    assert.equal(sql(`SELECT count(*) FROM public."BillBenchmark" WHERE geohash='s00000' AND bill_type='electric';`), '0');
    sql(`BEGIN; UPDATE public."Home" SET map_center_lat=0,map_center_lng=0 WHERE id=${q(home)};
      INSERT INTO public."BillBenchmark"(id,geohash,bill_type,month,year,avg_amount_cents,household_count)
        VALUES(${q(id(810))},'s00000','electric',1,2026,20000,12);
      INSERT INTO public."HomeBill"(id,home_id,created_by,bill_type,amount,currency,status,period_start)
        VALUES(${q(id(811))},${q(home)},${q(actor)},'electric',142.50,'USD','paid','2026-01-01'); COMMIT;`);
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/homes/${home}/intelligence?sections=bill_benchmark`;
    const request = async () => {
      const response = await fetch(url, { headers: { 'x-fixture-actor': actor }, signal: AbortSignal.timeout(20000) });
      const body = await response.json();
      return { status: response.status, body, section: body.groups?.flatMap(g => g.sections).find(s => s.id === 'bill_benchmark') };
    };
    let r = await request(); assert.equal(r.status, 200, JSON.stringify(f.diagnostics)); assert.equal(r.section.status, 'ready');
    const beforeOwn = f.queryCalls.filter(t => t === 'HomeBill').length;
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'finance.view',false);`);
    r = await request(); assert.equal(r.status, 200); assert.equal(r.section.data.your_amount, null);
    assert.equal(f.queryCalls.filter(t => t === 'HomeBill').length, beforeOwn);
    console.log('PASS: denied finance does not query own bills or expose a personal comparison; peer aggregates remain available');
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`);
    f.failNextQuery('HomeBill'); r = await request(); assert.equal(r.status, 200); assert.equal(r.section.status, 'error'); assert.equal(r.section.data, null);
    f.failNextQuery('BillBenchmark'); r = await request(); assert.equal(r.section.status, 'error'); assert.equal(r.section.data, null);
    console.log('PASS: own/peer database errors remain explicit section errors without comparison data');
    sql(`UPDATE public."Home" SET map_center_lat=null,map_center_lng=null WHERE id=${q(home)};`);
    const beforeMissing = f.queryCalls.filter(t => ['BillBenchmark','HomeBill'].includes(t)).length;
    r = await request(); assert.equal(r.section.status, 'unavailable'); assert.equal(r.section.data, null);
    assert.equal(f.queryCalls.filter(t => ['BillBenchmark','HomeBill'].includes(t)).length, beforeMissing);
    sql(`UPDATE public."Home" SET map_center_lat=0,map_center_lng=0 WHERE id=${q(home)};`);
    console.log('PASS: missing coordinates do not become a comparison for 0,0; explicit real zero coordinates remain valid');
    const before = f.queryCalls.filter(t => ['BillBenchmark','HomeBill'].includes(t)).length;
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'home.view',false);`);
    r = await request(); assert.equal(r.status, 403); assert.equal(f.queryCalls.filter(t => ['BillBenchmark','HomeBill'].includes(t)).length, before);
    console.log('PASS: denied Home view blocks the whole Place read before financial queries; amount correctness remains separate');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) {
      sql(`BEGIN; DELETE FROM public."HomeBill" WHERE id=${q(id(811))}; DELETE FROM public."BillBenchmark" WHERE id=${q(id(810))}; COMMIT;`);
      f.cleanup(); console.log('PASS: exact Place bill fixtures cleaned');
    }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
