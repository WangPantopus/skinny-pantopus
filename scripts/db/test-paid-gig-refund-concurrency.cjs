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
    if (output.includes('REFUND_CONTRACT_READY\n')) readyResolve();
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
const payer = 'aaf20000-0000-4000-8000-000000000001';
const worker = 'aaf20000-0000-4000-8000-000000000002';
const admin = 'aaf20000-0000-4000-8000-000000000003';
const gig = 'aaf20000-0000-4000-8000-000000000101';
const payment = 'aaf20000-0000-4000-8000-000000000301';
const requestId = 'aaf20000-0000-4000-8000-000000000401';
const second = 'aaf20000-0000-4000-8000-000000000402';
const reserve = (r = requestId, actor = payer, mode = 'payer') => `SELECT public.reserve_payment_refund('${payment}','${r}','${actor}','${mode}',300,'other',NULL,public.refund_payment_snapshot(p),'refund') FROM public."Payment" p WHERE p.id='${payment}';`;
const credit = `SELECT public.wallet_credit('${worker}',850,'gig_income',NULL,'${payment}','${gig}','${payer}',NULL,'refund-race-income');`;
const hold = sql => `BEGIN; ${sql} SELECT 'REFUND_CONTRACT_READY'; SELECT pg_sleep(0.5); COMMIT;`;
async function overlap(first, following) {
  const leader = query(hold(first)); await leader.ready;
  return Promise.all([leader.done, ...following.map(sql => query(sql).done)]);
}
const reset = `DELETE FROM public."PaymentRefundRequest" WHERE payment_id='${payment}'; UPDATE public."Payment" SET payment_status='captured_hold' WHERE id='${payment}';`;
(async () => {
  let created = false;
  try {
    await query(`BEGIN;
      INSERT INTO auth.users(id,email) VALUES('${payer}','refund-race-payer@example.invalid'),('${worker}','refund-race-worker@example.invalid'),('${admin}','refund-race-admin@example.invalid');
      INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,'refund_race_'||right(id::text,1),'Refund race',CASE WHEN id='${admin}' THEN 'admin' ELSE 'user' END FROM auth.users WHERE id IN ('${payer}','${worker}','${admin}');
      INSERT INTO public."Gig"(id,user_id,created_by,title,description,price) VALUES('${gig}','${payer}','${payer}','Refund race','Synthetic',10);
      INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
        stripe_customer_id,stripe_payment_intent_id,stripe_charge_id,payment_status)
      VALUES('${payment}','${gig}','${payer}','${worker}',1000,1000,150,850,'cus_refundrace','pi_refundrace','ch_refundrace','captured_hold');
      COMMIT;`).done;
    created = true;
    const admitted = await overlap(reserve(), [reserve(), reserve(second)]);
    assert.equal(JSON.parse(admitted[1]).reused, true);
    assert.equal(JSON.parse(admitted[2]).error, 'REFUND_ACTIVE');
    assert.equal(await query(`SELECT count(*) FROM public."PaymentRefundRequest" WHERE payment_id='${payment}';`).done, '1');
    await query(reset).done;
    const reserved = query(hold(reserve())); await reserved.ready;
    await assert.rejects(query(credit).done, /refund or dispute/); await reserved.done;
    assert.equal(await query(`SELECT count(*) FROM public."WalletTransaction" WHERE payment_id='${payment}';`).done, '0');
    await query(reset).done;
    const credited = await overlap(credit, [reserve()]);
    assert.equal(JSON.parse(credited[1]).error, 'SUPPORT_REQUIRED');
    // Admin revocation committed while claim waits must defeat fresh admission.
    await query(reserve(requestId, admin, 'admin')).done;
    const revoked = await overlap(`UPDATE public."User" SET role='user' WHERE id='${admin}';`, [
      `SELECT public.claim_payment_refund('${requestId}','${admin}','admin',gen_random_uuid());`,
    ]);
    assert.equal(JSON.parse(revoked[1]).error, 'FORBIDDEN');
    await query(`UPDATE public."User" SET role='admin' WHERE id='${admin}';`).done;
    const claim = `SELECT public.claim_payment_refund('${requestId}','${admin}','admin',gen_random_uuid());`;
    const disputed = await overlap(`UPDATE public."Payment" SET payment_status='disputed',dispute_id='dp_refundrace' WHERE id='${payment}';`, [claim]);
    assert.equal(JSON.parse(disputed[1]).error, 'DISPUTED');
    await query(`UPDATE public."Payment" SET payment_status='refund_pending',dispute_id=NULL WHERE id='${payment}';`).done;
    const claims = await overlap(claim, [claim, claim]);
    assert.equal(JSON.parse(claims[0].split('\n')[0]).claimed, true);
    assert.equal(JSON.parse(claims[1]).claimed, false); assert.equal(JSON.parse(claims[2]).claimed, false);
    const record = `SELECT public.record_payment_refund_receipts('${payment}',public.refund_payment_snapshot(p),jsonb_build_array(jsonb_build_object(
      'id','re_refundrace','intentId','pi_refundrace','chargeId','ch_refundrace','currency','usd','amountCents',300,
      'status','succeeded','requestId','${requestId}','createdAt',now()))) FROM public."Payment" p WHERE id='${payment}';`;
    await overlap(record, [record, record]);
    assert.equal(await query(`SELECT refunded_amount FROM public."Payment" WHERE id='${payment}';`).done, '300');
    assert.equal(await query(`SELECT count(*) FROM public."WalletTransaction" WHERE payment_id='${payment}' AND direction='debit';`).done, '1');
    assert.equal(await query(`SELECT balance FROM public."Wallet" WHERE user_id='${worker}';`).done, '595');
    console.log(`Refund concurrency passed (${connections} local PostgreSQL connections).`);
  } finally {
    if (created) await query(`BEGIN;
      DELETE FROM public."Refund" WHERE payment_id='${payment}';
      DELETE FROM public."PaymentRefundReceipt" WHERE payment_id='${payment}';
      DELETE FROM public."PaymentRefundRequest" WHERE payment_id='${payment}';
      DELETE FROM public."PaymentRefundRecovery" WHERE payment_id='${payment}';
      DELETE FROM public."WalletTransaction" WHERE payment_id='${payment}';
      DELETE FROM public."Wallet" WHERE user_id IN ('${payer}','${worker}','${admin}');
      DELETE FROM public."Payment" WHERE id='${payment}'; DELETE FROM public."Gig" WHERE id='${gig}';
      DELETE FROM public."User" WHERE id IN ('${payer}','${worker}','${admin}');
      DELETE FROM auth.users WHERE id IN ('${payer}','${worker}','${admin}'); COMMIT;`).done;
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
