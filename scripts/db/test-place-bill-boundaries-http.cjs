#!/usr/bin/env node
// Production Place route/composer/serializer/helper, real local PostgreSQL.
// Only bill_benchmark is requested; every provider dependency is disabled.
const assert = require('node:assert/strict');
const f = require('./home-bill-comparison-http-fixture.cjs')(process.argv[2]);
const { home, actor, sql, q, id } = f;
let server, initialized = false;
async function main() {
  try {
    f.setup(); initialized = true;
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
    f.failNextRpc('get_home_bill_comparison'); r = await request(); assert.equal(r.status, 200); assert.equal(r.section.status, 'error'); assert.equal(r.section.data, null);
    f.failNextRpc('get_home_bill_comparison', true); r = await request(); assert.equal(r.section.status, 'error'); assert.equal(r.section.data, null);
    console.log('PASS: returned/transport snapshot errors remain explicit section errors without comparison data');
    sql(`UPDATE public."Home" SET location=null,map_center_lat=null,map_center_lng=null WHERE id=${q(home)};`);
    const beforeMissing = f.queryCalls.filter(t => ['BillBenchmark','HomeBill'].includes(t)).length;
    r = await request(); assert.equal(r.section.status, 'unavailable'); assert.equal(r.section.data, null);
    assert.equal(f.queryCalls.filter(t => ['BillBenchmark','HomeBill'].includes(t)).length, beforeMissing);
    sql(`UPDATE public."Home" SET map_center_lat=0,map_center_lng=0 WHERE id=${q(home)};`);
    console.log('PASS: missing coordinates do not become a comparison for 0,0; explicit real zero coordinates remain valid');
    const before = f.rpcCalls.filter(name => name === 'get_home_bill_comparison').length;
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'home.view',false);`);
    r = await request(); assert.equal(r.status, 403); assert.equal(f.rpcCalls.filter(name => name === 'get_home_bill_comparison').length, before);
    console.log('PASS: denied Home view blocks the whole Place read before financial queries; current currency/month amounts are checked by the canonical bill HTTP driver');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) {
      f.cleanup(); console.log('PASS: exact Place bill fixtures cleaned');
    }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
