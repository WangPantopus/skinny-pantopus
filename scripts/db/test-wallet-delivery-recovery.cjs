#!/usr/bin/env node
// Run the actual relay against a disposable local PostgreSQL database. Only
// the push transport is synthetic; no hosted database or provider is contacted.
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const [container, database] = process.argv.slice(2);
if (!container?.startsWith('supabase_db_') || !/^[a-z0-9_]+_contract$/.test(database || '')) {
  throw new Error('Pass local Supabase Docker container and disposable DATABASE_contract');
}
const root = path.resolve(__dirname, '../..');
const payer = 'aaf90000-0000-4000-8000-000000000001';
const worker = 'aaf90000-0000-4000-8000-000000000002';
const admin = 'aaf90000-0000-4000-8000-000000000003';
const gig = 'aaf90000-0000-4000-8000-000000000101';
const payment = 'aaf90000-0000-4000-8000-000000000301';
const execute = promisify(execFile);
async function sql(text) {
  const { stdout } = await execute('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', database,
    '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', `SET lock_timeout='5s'; SET statement_timeout='10s'; ${text}`]);
  return stdout.trim();
}
const allowed = new Set(['claim_wallet_settlement_delivery','read_wallet_settlement_delivery','finish_wallet_settlement_delivery']);
let loseAck = false;
const db = { rpc: async (name, args = {}) => {
  assert.ok(allowed.has(name), 'Relay used a missing or unapproved SQL operation');
  if (name === 'finish_wallet_settlement_delivery' && loseAck) { loseAck = false; throw new Error('Synthetic lost acknowledgement'); }
  const values = Object.entries(args).map(([key,value]) => {
    assert.ok(['p_id','p_lease_id','p_outcome','p_error'].includes(key));
    return `${key}=>${value == null ? 'NULL' : "'"+String(value).replaceAll("'","''")+"'"}`;
  }).join(',');
  return { data: JSON.parse(await sql(`SET ROLE service_role; SELECT to_json(public.${name}(${values}));`) || 'null') };
} };
let unknown = true;
const sent = [];
const notifications = { deliverStoredGigNotification: async note => {
  assert.equal(note.metadata.payment_id,payment);
  assert.equal(note.metadata.amount_cents,850);
  assert.ok([payer,worker].includes(note.user_id));
  assert.equal(note.link,note.user_id===worker ? '/app/wallet' : `/gigs/${gig}`);
  sent.push(note.id);
  return unknown ? { acceptedCount:0,unresolvedCount:1 } : { acceptedCount:1,unresolvedCount:0 };
} };
const replacements = new Map([
 [path.join(root,'backend/config/supabaseAdmin.js'),db],
 [path.join(root,'backend/services/notificationService.js'),notifications],
 [path.join(root,'backend/utils/logger.js'),{info(){}}],
]);
const original = Module._load;
Module._load = function(request,parent,isMain) {
 const resolved = Module._resolveFilename(request,parent,isMain);
 return replacements.has(resolved) ? replacements.get(resolved) : original.apply(this,arguments);
};
const relay = require(path.join(root,'backend/jobs/deliverWalletSettlement.js'));
Module._load = original;
const events = `SELECT d.* FROM public."PaymentWalletDelivery" d JOIN public."PaymentWalletSettlement" s ON s.id=d.settlement_id WHERE s.payment_id='${payment}'`;
(async () => {
 let created=false;
 try {
  await sql(`BEGIN;
   INSERT INTO auth.users(id,email) VALUES('${payer}','wallet-race-payer@example.invalid'),('${worker}','wallet-race-worker@example.invalid'),('${admin}','wallet-race-admin@example.invalid');
   INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,'wallet_race_'||right(id::text,1),'Wallet race',CASE WHEN id='${admin}' THEN 'admin' ELSE 'user' END FROM auth.users WHERE id IN ('${payer}','${worker}','${admin}');
   INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,worker_completed_at,owner_confirmed_at)
   VALUES('${gig}','${payer}','${payer}','Wallet race','Synthetic',10,'completed','${worker}',now()-interval '3 days',now()-interval '3 days');
   INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
    stripe_customer_id,stripe_payment_intent_id,stripe_charge_id,payment_status,captured_at,cooling_off_ends_at)
   VALUES('${payment}','${gig}','${payer}','${worker}',1000,1000,150,850,'cus_wallet_race','pi_wallet_race','ch_wallet_race','captured_hold',now()-interval '3 days',now()-interval '1 day');
   UPDATE public."Gig" SET payment_id='${payment}' WHERE id='${gig}'; COMMIT;`);
  created=true;
  await sql(`SET ROLE service_role; SELECT public.settle_paid_gig_wallet_income('${payment}',public.refund_payment_snapshot(p)) FROM public."Payment" p WHERE id='${payment}';`);
  const originalNotes=JSON.parse(await sql(`SELECT json_agg(id ORDER BY id) FROM public."Notification" WHERE metadata->>'payment_id'='${payment}';`));
  assert.equal(originalNotes.length,2);
  // Concurrent workers obtain distinct events. Simulate their process death
  // before sending, then let the actual relay reclaim the expired leases.
  const claims=await Promise.all([db.rpc('claim_wallet_settlement_delivery'),db.rpc('claim_wallet_settlement_delivery'),db.rpc('claim_wallet_settlement_delivery')]);
  const claimed=claims.map(result=>result.data).filter(Boolean);
  assert.equal(claimed.length,2);assert.equal(new Set(claimed.map(event=>event.id)).size,2);
  await sql(`UPDATE public."PaymentWalletDelivery" SET lease_until=clock_timestamp()-interval '1 second' WHERE id IN (SELECT id FROM (${events}) e);`);
  assert.deepEqual(await relay(),{processed:2});
  assert.equal(await sql(`SELECT count(*) FROM (${events}) e WHERE state='pending' AND attempts=2;`),'2');
  unknown=false;loseAck=true;
  await sql(`UPDATE public."PaymentWalletDelivery" SET retry_at=clock_timestamp()-interval '1 second' WHERE id IN (SELECT id FROM (${events}) e);`);
  await assert.rejects(relay(),/lost acknowledgement/);
  assert.equal(await sql(`SELECT count(*) FROM (${events}) e WHERE state='processing';`),'1');
  await sql(`UPDATE public."PaymentWalletDelivery" SET lease_until=clock_timestamp()-interval '1 second' WHERE id IN (SELECT id FROM (${events}) e) AND state='processing';`);
  assert.deepEqual(await relay(),{processed:2});
  assert.deepEqual(await relay(),{processed:0});
  assert.equal(await sql(`SELECT count(*) FROM (${events}) e WHERE state='done';`),'2');
  assert.deepEqual([...new Set(sent)].sort(),originalNotes.sort());
  assert.equal(sent.length,5);
  assert.equal(await sql(`SELECT count(*) FROM public."WalletTransaction" WHERE payment_id='${payment}';`),'1');
  assert.equal(await sql(`SELECT balance FROM public."Wallet" WHERE user_id='${worker}';`),'850');
  console.log('Actual wallet relay/SQL recovery passed: two stored notes, one credit, unknown transport and lost acknowledgement recover exact IDs.');
 } finally {
  if(created) await sql(`BEGIN;
   DELETE FROM public."Notification" WHERE metadata->>'payment_id'='${payment}';
   DELETE FROM public."PaymentWalletDelivery" WHERE id IN (SELECT id FROM (${events}) e);
   DELETE FROM public."PaymentWalletSettlement" WHERE payment_id='${payment}';
   DELETE FROM public."PaymentRefundRecovery" WHERE payment_id='${payment}';
   DELETE FROM public."WalletTransaction" WHERE payment_id='${payment}';
   DELETE FROM public."Wallet" WHERE user_id IN ('${payer}','${worker}','${admin}');
   UPDATE public."Gig" SET payment_id=NULL WHERE id='${gig}';
   DELETE FROM public."Payment" WHERE id='${payment}';
   DELETE FROM public."Gig" WHERE id='${gig}';
   DELETE FROM public."User" WHERE id IN ('${payer}','${worker}','${admin}');
   DELETE FROM auth.users WHERE id IN ('${payer}','${worker}','${admin}'); COMMIT;`);
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
