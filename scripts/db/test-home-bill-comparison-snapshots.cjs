#!/usr/bin/env node
// Observed overlapping SQL reads/writes, cancellation and current read recovery.
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const container = process.argv[2];
const f = require('./home-bill-comparison-http-fixture.cjs')(container);
const { sql, q, home, actor } = f;
const application = 'pantopus_bill_snapshot_contract';
const snapshot = `public.get_home_bill_comparison(${q(home)},${q(actor)},'USD')`;
const current = () => JSON.parse(sql(`SELECT ${snapshot};`));
const peer = r => r.peer_months.find(row => row.bill_type === 'electric');
let initialized = false;
async function paused() {
  // Materialized pause occurs inside the same top-level statement snapshot as
  // the STABLE RPC. Observe PgSleep before committing the competing change.
  const completion = run('docker', ['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',
    `SET application_name=${q(application)}; SET statement_timeout='10s'; WITH pause AS MATERIALIZED (SELECT pg_sleep(2)) SELECT ${snapshot} FROM pause;`], { timeout: 15000 })
    .then(r => ({ ok: true, data: JSON.parse(r.stdout.trim()) }), error => ({ ok: false, error }));
  const deadline = Date.now()+6000;
  while (sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name=${q(application)} AND wait_event='PgSleep';`) !== '1') {
    assert(Date.now() < deadline, 'Read never reached observed pause');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return { completion };
}
async function main() {
  try {
    f.setup(); initialized = true;
    let held = await paused();
    sql(`BEGIN; UPDATE public."HomePreference" SET settings='{"bill_benchmark_opt_in":false}' WHERE home_id=${q(home)};
      UPDATE public."HomeBill" SET amount=271.25 WHERE id=${q(f.bills[0])}; COMMIT;`);
    let result = await held.completion; assert(result.ok); assert.equal(peer(result.data).household_count, 10);
    assert.equal(result.data.bill_benchmark_opt_in, true); assert.equal(result.data.own_months.at(-1).amount, 142.50);
    const next = current(); assert.equal(peer(next).household_count,9); assert.equal(peer(next).avg_amount,null);
    assert.equal(next.bill_benchmark_opt_in,false); assert.equal(next.own_months.at(-1).amount,342.50);
    console.log('PASS: observed overlapping read returns one coherent prior snapshot; next read sees atomic opt-out and corrected personal totals');
    held = await paused();
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    result = await held.completion; assert(result.ok); assert.equal(result.data.ok,true);
    assert.equal(current().code,'HOME_BILLS_DENIED');
    sql(`UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    console.log('PASS: authority belongs to the statement snapshot; a read after committed revocation denies, restoration is read afresh');
    const before = sql(`SELECT md5(string_agg(to_jsonb(b)::text,'' ORDER BY id)) FROM public."HomeBill" b WHERE home_id IN (${f.homes.map(q)});`);
    held = await paused();
    assert.equal(sql(`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name=${q(application)} AND wait_event='PgSleep';`),'t');
    result = await held.completion; assert.equal(result.ok,false); assert.match(result.error.stderr,/canceling statement/);
    assert.equal(sql(`SELECT md5(string_agg(to_jsonb(b)::text,'' ORDER BY id)) FROM public."HomeBill" b WHERE home_id IN (${f.homes.map(q)});`),before);
    assert.equal(current().ok,true);
    assert.deepEqual(await require('../../backend/jobs/billBenchmarkRefresh')(), { status:'retired',calculation:'current_sql_snapshot' });
    assert.equal(sql(`SELECT md5(string_agg(to_jsonb(b)::text,'' ORDER BY id)) FROM public."HomeBill" b WHERE home_id IN (${f.homes.map(q)});`),before);
    console.log('PASS: observed query cancellation changes no bills; current retry works and retired refresh performs no writes');
  } finally {
    if (initialized) { f.cleanup(); console.log('PASS: exact snapshot fixtures cleaned'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode=1; });
