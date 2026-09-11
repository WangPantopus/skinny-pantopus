#!/usr/bin/env node
// Local disposable PostgreSQL only; no credentials or provider calls.
// node scripts/db/test-payment-method-concurrency.cjs CONTAINER DATABASE_contract
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const [container, database] = process.argv.slice(2);
if (!container || !/^[a-z0-9_]+_contract$/.test(database || '')) {
  throw new Error('Pass a local Docker container and disposable DATABASE_contract');
}
let connections = 0;
function query(sql) {
  connections += 1;
  const child = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database,
    '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']);
  let output = '', errors = '', readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  ready.catch(() => {});
  child.stdout.on('data', (data) => {
    output += data;
    if (output.includes('PAYMENT_CONTRACT_READY\n')) readyResolve();
  });
  child.stderr.on('data', (data) => { errors += data; });
  const done = new Promise((resolve, reject) => {
    child.on('error', (error) => { readyReject(error); reject(error); });
    child.on('close', (code) => {
      if (code !== 0) {
        const error = new Error(`Local SQL contract failed (${code}): ${errors.trim()}`);
        readyReject(error); reject(error);
      } else { readyResolve(); resolve(output.trim()); }
    });
  });
  child.stdin.end(`SET lock_timeout='5s'; SET statement_timeout='10s';\n${sql}`);
  return { ready, done };
}
const user = 'eef20000-0000-4000-8000-000000000001';
const details = `'${JSON.stringify({ payment_method_type: 'card', card_brand: 'visa', card_last4: '4242' })}'::jsonb`;
const save = (id) => `SELECT public.save_payment_method('${user}','cus_concurrent','pm_concurrent${id}',${details});`;
const choose = (id) => `SELECT public.set_default_payment_method('${user}',(SELECT id FROM public."PaymentMethod" WHERE stripe_payment_method_id='pm_concurrent${id}'));`;
const hold = (sql) => `BEGIN; ${sql} SELECT 'PAYMENT_CONTRACT_READY'; SELECT pg_sleep(0.5); COMMIT;`;
async function overlap(first, following) {
  const leader = query(hold(first));
  await leader.ready;
  const followers = following.map((sql) => query(sql).done);
  return Promise.all([leader.done, ...followers]);
}
async function preference() {
  return query(`SELECT stripe_payment_method_id FROM public."PaymentMethod" WHERE user_id='${user}' AND is_default IS TRUE;`).done;
}
(async () => {
  let created = false;
  try {
    await query(`BEGIN;
      INSERT INTO auth.users(id,email) VALUES('${user}','card-concurrency@example.invalid');
      INSERT INTO public."User"(id,email,username,name,stripe_customer_id)
      VALUES('${user}','card-concurrency@example.invalid','card_concurrency','Card concurrency',NULL); COMMIT;`).done;
    created = true;
    await assert.rejects(query(`BEGIN; SELECT public.bind_payment_customer('${user}','cus_rollback'); SELECT 1/0; COMMIT;`).done);
    assert.equal(await query(`SELECT count(*) FROM public."User" WHERE id='${user}' AND stripe_customer_id IS NULL;`).done, '1');
    const customers = await overlap(`SELECT public.bind_payment_customer('${user}','cus_concurrent');`, [
      `SELECT public.bind_payment_customer('${user}','cus_loser');`,
    ]);
    assert.equal(JSON.parse(customers[1]).customer_id, 'cus_concurrent');
    await overlap(save('A'), [save('B'), save('C'), save('D')]);
    assert.equal(await preference(), 'pm_concurrentA');
    assert.equal(await query(`SELECT count(*) FROM public."PaymentMethod" WHERE user_id='${user}';`).done, '4');
    await overlap(choose('B'), [save('A'), save('A')]);
    assert.equal(await preference(), 'pm_concurrentB');
    const removal = `SELECT public.begin_payment_method_removal('${user}',(SELECT id FROM public."PaymentMethod" WHERE stripe_payment_method_id='pm_concurrentA'));`;
    const denied = await overlap(removal, [save('A')]);
    assert.equal(JSON.parse(denied[1]).error, 'REMOVED');
    await overlap("SELECT public.complete_payment_method_removal('pm_concurrentA');", [save('A'), choose('C')]);
    assert.equal(await preference(), 'pm_concurrentC');
    const early = await overlap("SELECT public.complete_payment_method_removal('pm_concurrentUnknown');", [save('Unknown')]);
    assert.equal(JSON.parse(early[1]).error, 'REMOVED');
    await assert.rejects(query(`BEGIN; ${choose('B')} SELECT 1/0; COMMIT;`).done);
    assert.equal(await preference(), 'pm_concurrentC');
    await query(choose('B')).done;
    assert.equal(await preference(), 'pm_concurrentB');
    const blocker = query(`BEGIN; SELECT id FROM public."User" WHERE id='${user}' FOR UPDATE;
      SELECT 'PAYMENT_CONTRACT_READY'; SELECT pg_sleep(5.5); COMMIT;`);
    await blocker.ready;
    await assert.rejects(query(choose('C')).done, /lock timeout/);
    await blocker.done;
    assert.equal(await preference(), 'pm_concurrentB');
    await query(choose('C')).done;
    assert.equal(await preference(), 'pm_concurrentC');
    console.log(`Payment method concurrency passed across ${connections} PostgreSQL connections: first cards, explicit preference, replay/removal, early detach, rollback and retry.`);
  } finally {
    if (created) {
      await query(`BEGIN; DELETE FROM auth.users WHERE id='${user}';
        DELETE FROM public."PaymentMethodRemoval" WHERE stripe_payment_method_id='pm_concurrentUnknown' AND user_id IS NULL; COMMIT;`).done;
    }
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
