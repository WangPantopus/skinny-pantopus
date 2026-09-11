#!/usr/bin/env node
// Actual production HTTP/services/SQL with synthetic auth and no providers.
const assert = require('node:assert/strict');
const f = require('./home-bill-comparison-http-fixture.cjs')(process.argv[2]);
const { home, actor, sql, q } = f;
let server, initialized = false;
async function main() {
  try {
    const { current, previous } = f.setup(); initialized = true;
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/homes/${home}`;
    const request = async (suffix, method = 'GET', body) => {
      const response = await fetch(base+suffix, { method, headers: { 'content-type': 'application/json', 'x-fixture-actor': actor },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
      return { status: response.status, body: await response.json(), headers: response.headers };
    };
    let r = await request('/bill-trends'); assert.equal(r.status, 200, JSON.stringify(f.diagnostics));
    assert.match(r.headers.get('cache-control'), /private, no-store/);
    assert.deepEqual(r.body.bills_by_type.electric, { months: [previous,current], amounts: [210.25,142.50] });
    assert.deepEqual(r.body.benchmarks.electric, { months: [current], avg_amounts: [104.70], household_count: 10 });
    assert.deepEqual(r.body.available_currencies, ['CAD','USD']); assert.equal(r.body.currency, 'USD');
    r = await request('/bill-trends?currency=CAD'); assert.equal(r.status, 200);
    assert.deepEqual(r.body.bills_by_type.electric, { months: [current], amounts: [999.99] }); assert.deepEqual(r.body.benchmarks, {});
    r = await request('/bill-trends?currency=invalid'); assert.equal(r.status, 400);
    console.log('PASS: same-currency fractional household/month totals, chronological periods, thresholds and explicit invalid currency');
    r = await request('/intelligence?sections=bill_benchmark'); assert.equal(r.status, 200);
    const section = body => body.groups.flatMap(g => g.sections).find(s => s.id === 'bill_benchmark');
    const data = section(r.body).data; assert(data, JSON.stringify(f.diagnostics));
    assert.equal(data.your_amount, 142.50); assert.equal(data.band_low, 104.70); assert.equal(data.band_high, 104.70);
    assert.equal(data.comparison_pct, 36); assert.match(data.period, /1 matching month/);
    console.log('PASS: Place compares matching calendar months in major USD units; unmatched own month does not change the comparison');
    sql(`UPDATE public."Home" SET map_center_lat=NULL,map_center_lng=NULL WHERE id=${q(home)};`);
    r = await request('/intelligence?sections=bill_benchmark'); assert.equal(section(r.body).data.your_amount, 142.50);
    sql(`UPDATE public."Home" SET location=NULL WHERE id=${q(home)};`);
    r = await request('/intelligence?sections=bill_benchmark'); assert.equal(section(r.body).status, 'unavailable');
    sql(`UPDATE public."Home" SET map_center_lat=0,map_center_lng=0 WHERE id=${q(home)};`);
    r = await request('/intelligence?sections=bill_benchmark'); assert.equal(section(r.body).data.your_amount, 142.50);
    console.log('PASS: authoritative geometry, genuinely absent location and valid zero-coordinate fallback agree with SQL');
    f.failNextRpc('get_home_bill_comparison', true); r = await request('/bill-trends'); assert.equal(r.status, 503); assert(!('benchmarks' in r.body));
    f.failNextRpc('get_home_bill_comparison'); r = await request('/intelligence?sections=bill_benchmark'); assert.equal(section(r.body).status, 'error'); assert.equal(section(r.body).data, null);
    r = await request('/settings','PATCH',{ preferences: { bill_benchmark_opt_in: false } }); assert.equal(r.status, 200);
    r = await request('/bill-trends'); assert.equal(r.body.bill_benchmark_opt_in, false); assert.equal(r.body.benchmarks.electric.insufficient_data, true); assert.equal(r.body.benchmarks.electric.needed, 1); assert(!('avg_amounts' in r.body.benchmarks.electric));
    assert.deepEqual(r.body.bills_by_type.electric.amounts, [210.25,142.50]);
    r = await request('/settings','PATCH',{ preferences: { bill_benchmark_opt_in: true } }); assert.equal(r.status, 200);
    r = await request('/bill-trends'); assert.deepEqual(r.body.benchmarks.electric.avg_amounts, [104.70]);
    console.log('PASS: RPC failures are unavailable and real settings opt-out/restore changes peer eligibility immediately without changing personal totals');
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'finance.view',false);`);
    r = await request('/bill-trends'); assert.equal(r.status, 403);
    r = await request('/intelligence?sections=bill_benchmark'); assert.equal(r.status, 200); assert.equal(section(r.body).data.your_amount, null);
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    r = await request('/intelligence?sections=bill_benchmark'); assert.equal(r.status, 403);
    console.log('PASS: current finance and revoked Home authority remain enforced through the new SQL snapshot');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { f.cleanup(); console.log('PASS: exact current bill HTTP fixtures cleaned'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
