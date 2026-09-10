#!/usr/bin/env node
// Local disposable PostgreSQL only; no credentials or provider calls.
// node scripts/db/test-paid-gig-concurrency.cjs CONTAINER DATABASE_contract
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
    if (output.includes('PAID_GIG_CONTRACT_READY\n')) readyResolve();
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
const payer = 'aae20000-0000-4000-8000-000000000001';
const worker = 'aae20000-0000-4000-8000-000000000002';
const other = 'aae20000-0000-4000-8000-000000000003';
const gig = 'aae20000-0000-4000-8000-000000000101';
const bid = 'aae20000-0000-4000-8000-000000000201';
const otherBid = 'aae20000-0000-4000-8000-000000000202';
const freeBid = 'aae20000-0000-4000-8000-000000000203';
const payment = 'aae20000-0000-4000-8000-000000000301';
const begin = (b = bid) => `SELECT public.begin_paid_gig_acceptance('${gig}','${b}','${payer}');`;
const free = `SELECT public.accept_free_gig_bid('${gig}','${freeBid}','${payer}');`;
const finalize = `SELECT public.finalize_paid_gig_acceptance('${gig}','${bid}','${payer}','${payment}');`;
const hold = (sql) => `BEGIN; ${sql} SELECT 'PAID_GIG_CONTRACT_READY'; SELECT pg_sleep(0.5); COMMIT;`;
async function overlap(first, following) {
  const leader = query(hold(first)); await leader.ready;
  return Promise.all([leader.done, ...following.map((sql) => query(sql).done)]);
}
const json = async (sql) => JSON.parse(await query(sql).done);
(async () => {
  let created = false;
  try {
    await query(`BEGIN;
      INSERT INTO auth.users(id,email) VALUES('${payer}','paid-concurrency-payer@example.invalid'),
        ('${worker}','paid-concurrency-worker@example.invalid'),('${other}','paid-concurrency-other@example.invalid');
      INSERT INTO public."User"(id,email,username,name,stripe_customer_id)
      SELECT id,email,'paid_concurrency_'||right(id::text,1),'Paid concurrency','cus_concurrency'||right(id::text,1)
      FROM auth.users WHERE id IN ('${payer}','${worker}','${other}');
      INSERT INTO public."Gig"(id,user_id,created_by,title,description,price)
      VALUES('${gig}','${payer}','${payer}','Paid concurrency','Synthetic contract',20);
      INSERT INTO public."GigBid"(id,gig_id,user_id,bid_amount)
      VALUES('${bid}','${gig}','${worker}',12.50),('${otherBid}','${gig}','${other}',13.50),
        ('${freeBid}','${gig}','${other}',0); COMMIT;`).done;
    created = true;
    await assert.rejects(query(`BEGIN; ${begin()} SELECT 1/0; COMMIT;`).done);
    assert.equal(await query(`SELECT count(*) FROM public."GigPaymentAcceptance" WHERE gig_id='${gig}';`).done, '0');
    assert.equal(await query(`SELECT status FROM public."GigBid" WHERE id='${bid}';`).done, 'pending');
    const admitted = await overlap(begin(), [begin(), begin(otherBid), free]);
    const attempt = JSON.parse(admitted[0].split('\n')[0]).attempt;
    assert.equal(JSON.parse(admitted[1]).attempt.id, attempt.id);
    assert.equal(JSON.parse(admitted[2]).error, 'CONFLICT');
    assert.equal(JSON.parse(admitted[3]).error, 'CONFLICT');
    assert.equal(await query(`SELECT count(*) FROM public."GigPaymentAcceptance" WHERE gig_id='${gig}';`).done, '1');
    // Even service-role siblings that forgot a CAS cannot mutate reserved terms.
    const held = query(hold(begin())); await held.ready;
    await Promise.all([
      assert.rejects(query(`UPDATE public."GigBid" SET bid_amount=99 WHERE id='${bid}';`).done, /active payment checkout/),
      assert.rejects(query(`DELETE FROM public."GigBid" WHERE id='${bid}';`).done, /active payment checkout/),
      assert.rejects(query(`UPDATE public."Gig" SET status='cancelled' WHERE id='${gig}';`).done, /active payment checkout/),
    ]);
    await held.done;
    await query(`INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
      stripe_customer_id,stripe_payment_intent_id,payment_status,authorization_expires_at,metadata)
      VALUES('${payment}','${gig}','${payer}','${worker}',1250,1250,188,1062,'cus_concurrency1','pi_concurrency1','authorized',now()+interval '1 day',
      jsonb_build_object('acceptance_attempt_id','${attempt.id}'));
      SELECT public.bind_paid_gig_acceptance('${attempt.id}','${payment}');`).done;
    const cancel = `SELECT public.cancel_paid_gig_acceptance('${gig}','${bid}','${payer}');`;
    const cancelWins = await overlap(cancel, [finalize, begin(otherBid)]);
    assert.equal(JSON.parse(cancelWins[1]).error, 'PAYMENT_NOT_AUTHORIZED');
    assert.equal(JSON.parse(cancelWins[2]).error, 'CONFLICT');
    assert.equal(await query(`SELECT status FROM public."Gig" WHERE id='${gig}';`).done, 'open');
    // Restore only this synthetic cancellation fence, to exercise finalization
    // separately; provider cancellation is covered by the service/SQL contracts.
    await query(`UPDATE public."GigPaymentAcceptance" SET state='pending' WHERE id='${attempt.id}';`).done;
    const assigned = await overlap(finalize, [finalize, finalize, free]);
    assert.equal(JSON.parse(assigned[1]).reused, true); assert.equal(JSON.parse(assigned[2]).reused, true);
    assert.equal(JSON.parse(assigned[3]).error, 'CONFLICT');
    assert.equal(await query(`SELECT count(*) FROM public."GigBid" WHERE gig_id='${gig}' AND status='accepted';`).done, '1');
    await query(`UPDATE public."Gig" SET status='completed',worker_completed_at=now() WHERE id='${gig}';`).done;
    const prepare = `SELECT public.prepare_paid_gig_capture('${payment}');`;
    await overlap(prepare, [prepare, prepare, prepare]);
    assert.equal(await query(`SELECT capture_attempts FROM public."Payment" WHERE id='${payment}';`).done, '4');
    const record = `SELECT public.record_paid_gig_capture('${payment}','pi_concurrency1','ch_concurrency1',1250,'cus_concurrency1','usd');`;
    const captured = await overlap(record, [record, record]);
    const receipt = JSON.parse(captured[0].split('\n')[0]).payment;
    assert.equal(JSON.parse(captured[1]).reused, true); assert.equal(JSON.parse(captured[2]).reused, true);
    assert.equal(JSON.parse(captured[1]).payment.captured_at, receipt.captured_at);
    assert.equal(JSON.parse(captured[2]).payment.cooling_off_ends_at, receipt.cooling_off_ends_at);
    await assert.rejects(query(`BEGIN; UPDATE public."Gig" SET owner_confirmed_at=now() WHERE id='${gig}'; SELECT 1/0; COMMIT;`).done);
    assert.equal(await query(`SELECT owner_confirmed_at IS NULL FROM public."Gig" WHERE id='${gig}';`).done, 't');
    console.log(`Paid-gig acceptance/capture concurrency passed (${connections} local PostgreSQL connections).`);
  } finally {
    if (created) await query(`BEGIN;
      DELETE FROM public."GigPaymentAcceptance" WHERE gig_id='${gig}';
      UPDATE public."Gig" SET payment_id=NULL WHERE id='${gig}';
      DELETE FROM public."Payment" WHERE id='${payment}';
      DELETE FROM public."Gig" WHERE id='${gig}';
      DELETE FROM public."User" WHERE id IN ('${payer}','${worker}','${other}');
      DELETE FROM auth.users WHERE id IN ('${payer}','${worker}','${other}'); COMMIT;`).done;
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
