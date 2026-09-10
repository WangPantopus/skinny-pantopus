#!/usr/bin/env node
// Local disposable PostgreSQL only; no credentials or provider calls.
// node scripts/db/test-paid-gig-wallet-concurrency.cjs CONTAINER DATABASE_contract
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
    if (output.includes('WALLET_CONTRACT_READY\n')) readyResolve();
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
const payer = 'aaf70000-0000-4000-8000-000000000001';
const worker = 'aaf70000-0000-4000-8000-000000000002';
const admin = 'aaf70000-0000-4000-8000-000000000003';
const gig = 'aaf70000-0000-4000-8000-000000000101';
const payment = 'aaf70000-0000-4000-8000-000000000301';
const requestId = 'aaf70000-0000-4000-8000-000000000401';
const reserve = (actor = payer, mode = 'payer') => `SELECT public.reserve_payment_refund('${payment}','${requestId}','${actor}','${mode}',300,'other',NULL,public.refund_payment_snapshot(p),'refund') FROM public."Payment" p WHERE p.id='${payment}';`;
const settle = `SELECT public.settle_paid_gig_wallet_income('${payment}',public.refund_payment_snapshot(p)) FROM public."Payment" p WHERE id='${payment}';`;
const record = (id, amount, request = null) => `SELECT public.record_payment_refund_receipts('${payment}',public.refund_payment_snapshot(p),jsonb_build_array(jsonb_build_object(
 'id','${id}','intentId','pi_wallet_race','chargeId','ch_wallet_race','currency','usd','amountCents',${amount},
 'status','succeeded','requestId',${request ? `'${request}'` : 'NULL'},'createdAt',now()))) FROM public."Payment" p WHERE id='${payment}';`;
const hold = sql => `BEGIN; ${sql} SELECT 'WALLET_CONTRACT_READY'; SELECT pg_sleep(0.5); COMMIT;`;
async function overlap(first, following) {
  const leader = query(hold(first)); await leader.ready;
  return Promise.all([leader.done, ...following.map(sql => query(sql).done)]);
}
const financialCleanup = `
 DELETE FROM public."PaymentWalletSettlement" WHERE payment_id='${payment}';
 DELETE FROM public."Refund" WHERE payment_id='${payment}';
 DELETE FROM public."PaymentRefundReceipt" WHERE payment_id='${payment}';
 DELETE FROM public."PaymentRefundRequest" WHERE payment_id='${payment}';
 DELETE FROM public."PaymentRefundRecovery" WHERE payment_id='${payment}';
 DELETE FROM public."WalletTransaction" WHERE payment_id='${payment}';
 DELETE FROM public."Wallet" WHERE user_id IN ('${payer}','${worker}','${admin}');`;
const reset = `BEGIN; ${financialCleanup}
 UPDATE public."Payment" SET payment_status='captured_hold',dispute_id=NULL,refunded_amount=0,
  transfer_status=NULL,transfer_completed_at=NULL,cooling_off_ends_at=now()-interval '1 day' WHERE id='${payment}';
 UPDATE public."Gig" SET user_id='${payer}',owner_confirmed_at=now()-interval '3 days' WHERE id='${gig}'; COMMIT;`;
(async () => {
 let created = false;
 try {
  await query(`BEGIN;
   INSERT INTO auth.users(id,email) VALUES('${payer}','wallet-race-payer@example.invalid'),('${worker}','wallet-race-worker@example.invalid'),('${admin}','wallet-race-admin@example.invalid');
   INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,'wallet_race_'||right(id::text,1),'Wallet race',CASE WHEN id='${admin}' THEN 'admin' ELSE 'user' END FROM auth.users WHERE id IN ('${payer}','${worker}','${admin}');
   INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,worker_completed_at,owner_confirmed_at)
   VALUES('${gig}','${payer}','${payer}','Wallet race','Synthetic',10,'completed','${worker}',now()-interval '3 days',now()-interval '3 days');
   INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
    stripe_customer_id,stripe_payment_intent_id,stripe_charge_id,payment_status,captured_at,cooling_off_ends_at)
   VALUES('${payment}','${gig}','${payer}','${worker}',1000,1000,150,850,'cus_wallet_race','pi_wallet_race','ch_wallet_race','captured_hold',now()-interval '3 days',now()-interval '1 day');
   UPDATE public."Gig" SET payment_id='${payment}' WHERE id='${gig}'; COMMIT;`).done;
  created = true;
  const refundWins = await overlap(reserve(), [settle]);
  assert.ok(['PAYMENT_STATE','REFUND_ACTIVE'].includes(JSON.parse(refundWins[1]).error));
  assert.equal(await query(`SELECT count(*) FROM public."WalletTransaction" WHERE payment_id='${payment}';`).done, '0');
  await query(reset).done;
  const creditWins = await overlap(settle, [reserve(), settle, settle]);
  assert.equal(JSON.parse(creditWins[1]).error, 'SUPPORT_REQUIRED');
  assert.equal(JSON.parse(creditWins[2]).reused, true); assert.equal(JSON.parse(creditWins[3]).reused, true);
  assert.equal(await query(`SELECT count(*) FROM public."WalletTransaction" WHERE payment_id='${payment}';`).done, '1');
  await query(reset).done;
  const cooldown = await overlap(`UPDATE public."Payment" SET cooling_off_ends_at=now()+interval '1 day' WHERE id='${payment}';`, [settle]);
  assert.equal(JSON.parse(cooldown[1]).error, 'COOLING_OFF');
  await query(reset).done;
  const disputed = await overlap(`UPDATE public."Payment" SET payment_status='disputed',dispute_id='dp_wallet_race' WHERE id='${payment}';`, [settle]);
  assert.equal(JSON.parse(disputed[1]).error, 'PAYMENT_STATE');
  await query(reset).done;
  const moved = await overlap(`UPDATE public."Gig" SET user_id='${admin}' WHERE id='${gig}';`, [settle]);
  assert.equal(JSON.parse(moved[1]).error, 'GIG_TERMS_CHANGED');
  await query(reset).done;
  const unconfirmed = await overlap(`UPDATE public."Gig" SET owner_confirmed_at=NULL WHERE id='${gig}';`, [settle]);
  assert.equal(JSON.parse(unconfirmed[1]).error, 'GIG_TERMS_CHANGED');
  await query(reset).done;
  // Provider proof committed before release supplies the immutable basis.
  await query(record('re_wallet_before',300)).done;
  const residual = await overlap(settle, [settle,settle]);
  assert.equal(JSON.parse(residual[0].split('\n')[0]).settlement.amount_cents,595);
  assert.equal(await query(`SELECT balance FROM public."Wallet" WHERE user_id='${worker}';`).done,'595');
  await query(reserve(admin,'admin')).done;
  await overlap(record('re_wallet_after',300,requestId),[record('re_wallet_after',300,requestId),record('re_wallet_after',300,requestId)]);
  assert.equal(await query(`SELECT balance FROM public."Wallet" WHERE user_id='${worker}';`).done,'340');
  assert.equal(await query(`SELECT recovered_amount FROM public."PaymentRefundRecovery" WHERE payment_id='${payment}';`).done,'255');
  assert.equal(await query(`SELECT count(*) FROM public."WalletTransaction" WHERE payment_id='${payment}' AND direction='debit';`).done,'1');
 } finally {
  if (created) await query(`BEGIN; ${financialCleanup}
   UPDATE public."Gig" SET payment_id=NULL WHERE id='${gig}';
   DELETE FROM public."Payment" WHERE id='${payment}'; DELETE FROM public."Gig" WHERE id='${gig}';
   DELETE FROM public."User" WHERE id IN ('${payer}','${worker}','${admin}');
   DELETE FROM auth.users WHERE id IN ('${payer}','${worker}','${admin}'); COMMIT;`).done;
 }
 console.log(`Wallet settlement concurrency passed (${connections} local PostgreSQL connections, exact fixtures cleaned).`);
})().catch(error => { console.error(error.message); process.exitCode=1; });
