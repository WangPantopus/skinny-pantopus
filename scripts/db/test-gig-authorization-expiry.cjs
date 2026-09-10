#!/usr/bin/env node
// Actual production expiry service/job and PostgreSQL; synthetic Stripe only.
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const [container, database] = process.argv.slice(2);
if (!container?.startsWith('supabase_db_') || !/^[a-z0-9_]+_contract$/.test(database || '')) throw new Error('Use local disposable DATABASE_contract');
const root = path.resolve(__dirname, '../..');
const run = promisify(execFile);
const payer='aaf90000-0000-4000-8000-000000000001',worker='aaf90000-0000-4000-8000-000000000002';
const gig='aaf90000-0000-4000-8000-000000000101',payment='aaf90000-0000-4000-8000-000000000301';
const quote = value => value == null ? 'NULL' : "'"+String(typeof value==='object'?JSON.stringify(value):value).replaceAll("'","''")+"'";
let connections=0,beforeBegin=null,beforeClaim=null,onCancel=null,loseRecord=false,loseDelivery=false;
async function sql(query) {
 connections++;
 const { stdout }=await run('docker',['exec',container,'psql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',
 `SET lock_timeout='5s'; SET statement_timeout='10s'; ${query}`]);
 return stdout.trim();
}
const allowed=new Set(['read_gig_authorization_expiry','begin_gig_authorization_expiry','claim_gig_authorization_expiry','record_gig_authorization_expiry','release_gig_expiry_lease',
 'claim_gig_expiry_delivery','read_gig_expiry_delivery','finish_gig_expiry_delivery','claim_gig_expiry_scan']);
const db={rpc:async(name,args={})=>{
 assert.ok(allowed.has(name),'Unexpected RPC');
 if(name==='begin_gig_authorization_expiry'&&beforeBegin){const hook=beforeBegin;beforeBegin=null;await hook();}
 if(name==='claim_gig_authorization_expiry'&&beforeClaim){const hook=beforeClaim;beforeClaim=null;await hook();}
 const values=Object.entries(args).map(([key,value])=>{assert.match(key,/^p_[a-z_]+$/);return `${key}=>${quote(value)}`;}).join(',');
 const data=JSON.parse(await sql(`SET ROLE service_role; SELECT coalesce(to_jsonb(public.${name}(${values})),'null'::jsonb);`));
 if(loseRecord&&name==='record_gig_authorization_expiry'){loseRecord=false;return {error:{message:'Synthetic lost receipt'}};}
 if(loseDelivery&&name==='finish_gig_expiry_delivery'){loseDelivery=false;return {error:{message:'Synthetic lost delivery acknowledgement'}};}
 return {data};
}};
let intent,charge,cancels=0,keys=[],reads=0,delivered=[];
const stripe={paymentIntents:{
 retrieve:async id=>{assert.equal(id,intent.id);reads++;return structuredClone(intent);},
 cancel:async(id,params,options)=>{
  assert.equal(id,intent.id);assert.equal(params.cancellation_reason,'abandoned');assert.match(options.idempotencyKey,/^gig-expiry:[0-9a-f-]+:pi_expiry_race$/);
  cancels++;keys.push(options.idempotencyKey);if(onCancel)await onCancel();
  intent.status='canceled';intent.amount_capturable=0;return structuredClone(intent);
 }
},charges:{retrieve:async id=>{assert.equal(id,charge.id);return structuredClone(charge);}}};
const replacements=new Map([[path.join(root,'backend/config/supabaseAdmin.js'),db],
 [path.join(root,'backend/stripe/getStripeClient.js'),{getStripeClient:()=>stripe}],
 [path.join(root,'backend/services/notificationService.js'),{deliverStoredGigNotification:async note=>{
  assert.ok(note.id);assert.equal(note.metadata.payment_id,payment);delivered.push(note.id);return {acceptedCount:1,unresolvedCount:0};
 }}]]);
const original=Module._load;
Module._load=function(request,parent,isMain){const resolved=Module._resolveFilename(request,parent,isMain);return replacements.has(resolved)?replacements.get(resolved):original.apply(this,arguments);};
const expiry=require(path.join(root,'backend/services/gigAuthorizationExpiry.js'));
Module._load=original;
const deleteOps=`DELETE FROM public."Notification" WHERE metadata->>'payment_id'='${payment}' AND metadata ? 'authorization_expiry_id';
 DELETE FROM public."GigAuthorizationExpiryDelivery" WHERE expiry_id IN(SELECT id FROM public."GigAuthorizationExpiry" WHERE payment_id='${payment}');
 DELETE FROM public."GigAuthorizationExpiry" WHERE payment_id='${payment}';
 DELETE FROM public."GigAuthorizationExpiryScan" WHERE payment_id='${payment}';
 DELETE FROM public."GigLegacyAuthorization" WHERE payment_id='${payment}';`;
async function reset() {
 await sql(`BEGIN; ${deleteOps}
 UPDATE public."Payment" SET stripe_payment_intent_id='pi_expiry_race',stripe_charge_id=NULL,payment_status='authorized',captured_at=NULL,capture_attempts=0,
 authorization_expires_at=now()+interval '7 days',dispute_id=NULL,refunded_amount=0 WHERE id='${payment}';
 UPDATE public."Gig" SET status='assigned',price=10,user_id='${payer}',accepted_by='${worker}',payment_id='${payment}',started_at=NULL,worker_completed_at=NULL,owner_confirmed_at=NULL,
 cancelled_at=NULL,cancellation_reason=NULL,payment_status='authorized' WHERE id='${gig}'; COMMIT;`);
 intent={id:'pi_expiry_race',customer:'cus_expiry_race',amount:1000,currency:'usd',capture_method:'manual',status:'requires_capture',amount_capturable:1000,amount_received:0,latest_charge:'ch_expiryrace',
  metadata:{payer_id:payer,payee_id:worker,gig_id:gig}};
 charge={id:'ch_expiryrace',payment_intent:intent.id,customer:intent.customer,amount:1000,currency:'usd',paid:true,captured:false,amount_captured:0,refunded:false,amount_refunded:0,
  payment_method_details:{type:'card',card:{capture_before:Math.floor(Date.now()/1000)+3600}}};
 cancels=0;keys=[];reads=0;delivered=[];onCancel=null;beforeBegin=null;beforeClaim=null;loseRecord=false;loseDelivery=false;
}
async function overlap(update,following) {
 const child=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1']);
 let output='',errors='',ready;const signal=new Promise(resolve=>{ready=resolve;});
 child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('EXPIRY_LOCK_READY'))ready();});child.stderr.on('data',chunk=>{errors+=chunk;});
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code?reject(new Error(errors)):resolve());});
 child.stdin.end(`BEGIN; ${update} SELECT 'EXPIRY_LOCK_READY'; SELECT pg_sleep(0.5); COMMIT;`);
 await Promise.race([signal,done]);const result=await following();await done;connections++;return result;
}
(async()=>{
 let created=false;
 try{
  await sql(`BEGIN;
   INSERT INTO auth.users(id,email) VALUES('${payer}','expiry-race-payer@example.invalid'),('${worker}','expiry-race-worker@example.invalid');
   INSERT INTO public."User"(id,email,username,name) SELECT id,email,'expiry_race_'||right(id::text,1),'Expiry race' FROM auth.users WHERE id IN('${payer}','${worker}');
   INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,scheduled_start)
   VALUES('${gig}','${payer}','${payer}','Expiry race','Synthetic',10,'assigned','${worker}',now()+interval '1 hour');
   INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,stripe_customer_id,stripe_payment_intent_id,payment_status)
   VALUES('${payment}','${gig}','${payer}','${worker}',1000,1000,150,850,'cus_expiry_race','pi_expiry_race','authorized');
   UPDATE public."Gig" SET payment_id='${payment}' WHERE id='${gig}';COMMIT;`);created=true;
  await reset();
  const financial=await sql(`SELECT public.gig_expiry_payment_snapshot(p) FROM public."Payment" p WHERE id='${payment}';`);
  onCancel=async()=>{intent.status='canceled';intent.amount_capturable=0;throw new Error('Lost provider response');};
  assert.equal((await expiry.recover(payment)).complete,true);assert.equal(cancels,1);
  assert.equal(await sql(`SELECT public.gig_expiry_payment_snapshot(p) FROM public."Payment" p WHERE id='${payment}';`),financial);
  const priorReads=reads;assert.equal((await expiry.recover(payment)).complete,true);assert.equal(reads,priorReads);
  assert.equal(await sql(`SELECT count(*) FROM public."GigAuthorizationExpiryDelivery";`),'2');
  loseDelivery=true;await assert.rejects(expiry.deliverPending(),error=>error.code==='EXPIRY_RECEIPT_UNKNOWN');
  assert.deepEqual(await expiry.deliverPending(),{delivered:1});assert.equal(new Set(delivered).size,2);

  await reset();onCancel=async()=>{throw new Error('Provider offline');};
  await assert.rejects(expiry.recover(payment),error=>error.code==='EXPIRY_PROVIDER_UNKNOWN');
  assert.equal(await sql(`SELECT status FROM public."Gig" WHERE id='${gig}';`),'assigned');
  assert.equal(await sql(`SELECT count(*) FROM public."GigAuthorizationExpiryDelivery";`),'0');
  await assert.rejects(sql(`UPDATE public."Gig" SET status='in_progress',started_at=now() WHERE id='${gig}';`),/expiry cancellation/);
  await assert.rejects(sql(`UPDATE public."Payment" SET payment_status='capture_pending',capture_attempts=1 WHERE id='${payment}';`),/expiry cancellation/);
  onCancel=null;assert.equal((await expiry.recover(payment)).complete,true);assert.equal(new Set(keys).size,1);

  await reset();loseRecord=true;
  await assert.rejects(expiry.recover(payment),error=>error.code==='EXPIRY_RECEIPT_UNKNOWN');
  assert.equal((await expiry.recover(payment)).complete,true);assert.equal(cancels,1);
  assert.equal(await sql(`SELECT count(*) FROM public."GigAuthorizationExpiryDelivery";`),'2');

  await reset();
  const progress=await overlap(`UPDATE public."Gig" SET status='in_progress',started_at=now() WHERE id='${gig}';`,()=>expiry.recover(payment));
  assert.equal(progress.operation.kind,'attention');assert.equal(cancels,0);
  assert.equal(await sql(`SELECT status FROM public."Gig" WHERE id='${gig}';`),'in_progress');
  await expiry.recover(payment);assert.equal(await sql(`SELECT count(*) FROM public."GigAuthorizationExpiryDelivery";`),'2');
  charge.payment_method_details.card.capture_before+=172800;
  assert.equal((await expiry.recover(payment)).notDue,true);
  assert.deepEqual(await expiry.deliverPending(),{delivered:0});assert.equal(delivered.length,0);

  await reset();beforeBegin=()=>sql(`UPDATE public."Gig" SET price=11 WHERE id='${gig}';`);
  await assert.rejects(expiry.recover(payment),error=>error.code==='EXPIRY_TERMS_CHANGED');assert.equal(cancels,0);

  await reset();beforeClaim=()=>sql(`UPDATE public."Payment" SET payment_status='disputed',dispute_id='dp_expiry' WHERE id='${payment}';`);
  await assert.rejects(expiry.recover(payment),error=>error.code==='EXPIRY_PAYMENT_CHANGED');assert.equal(cancels,0);
  assert.equal(await sql(`SELECT state FROM public."GigAuthorizationExpiry" WHERE payment_id='${payment}';`),'pending');
  const coldPending=await expiry.recover(payment);assert.equal(coldPending.pending,true);assert.equal(coldPending.needsReview,true);assert.equal(cancels,0);
  intent.status='canceled';intent.amount_capturable=0;
  const coldEvidence=await expiry.recover(payment);assert.equal(coldEvidence.pending,true);assert.equal(coldEvidence.operation.provider_receipt.status,'canceled');assert.equal(cancels,0);

  await reset();onCancel=()=>sql(`UPDATE public."Payment" SET payment_status='disputed',dispute_id='dp_expiry' WHERE id='${payment}';`);
  const disputed=await expiry.recover(payment);assert.equal(disputed.pending,true);assert.equal(disputed.needsReview,true);
  assert.equal(disputed.operation.provider_receipt.status,'canceled');
  assert.equal(await sql(`SELECT status FROM public."Gig" WHERE id='${gig}';`),'assigned');
  assert.equal(await sql(`SELECT count(*) FROM public."GigAuthorizationExpiryDelivery";`),'0');

  await reset();beforeClaim=async()=>{charge.payment_method_details.card.capture_before+=172800;};
  // Provider proof is read before final RPC; simulate the changed proof during the preflight provider read instead.
  beforeClaim=null;beforeBegin=async()=>{charge.payment_method_details.card.capture_before+=172800;};
  await assert.rejects(expiry.recover(payment),error=>error.code==='EXPIRY_INVALID_PROOF');assert.equal(cancels,0);

  await reset();
  let releaseCancel,enteredCancel;const entered=new Promise(resolve=>{enteredCancel=resolve;});const waiting=new Promise(resolve=>{releaseCancel=resolve;});
  onCancel=async()=>{enteredCancel();await waiting;};
  const first=expiry.recover(payment);await entered;
  await assert.rejects(expiry.recover(payment),error=>error.code==='EXPIRY_BUSY');
  await assert.rejects(sql(`UPDATE public."Gig" SET status='in_progress',started_at=now() WHERE id='${gig}';`),/expiry cancellation/);
  await assert.rejects(sql(`SELECT public.begin_legacy_gig_authorization('${gig}','${payer}');`),/expiry cancellation/);
  releaseCancel();assert.equal((await first).complete,true);assert.equal(cancels,1);

  await reset();intent.status='canceled';intent.amount_capturable=0;charge.payment_method_details.card.capture_before-=7200;
  await sql(`UPDATE public."Payment" SET payment_status='canceled' WHERE id='${payment}';`);
  const canceledCandidates=JSON.parse(await sql('SELECT public.claim_gig_expiry_scan(100);'));assert.ok(canceledCandidates.includes(payment),'Already-applied cancellation webhook cannot hide an assigned task');
  assert.equal((await expiry.recover(payment)).complete,true);assert.equal(cancels,0);
  await sql(`UPDATE public."Gig" SET user_id='${worker}' WHERE id='${gig}';`);
  assert.deepEqual(await expiry.deliverPending(),{delivered:0});assert.equal(delivered.length,0);
  console.log(`Expiry production service/SQL/provider interruption and race contracts passed (${connections} database connections).`);
 }finally{
  if(created){
   await sql(`BEGIN; ${deleteOps} UPDATE public."Gig" SET payment_id=NULL WHERE id='${gig}'; DELETE FROM public."Payment" WHERE id='${payment}'; DELETE FROM public."Gig" WHERE id='${gig}'; DELETE FROM public."User" WHERE id IN('${payer}','${worker}'); DELETE FROM auth.users WHERE id IN('${payer}','${worker}'); COMMIT;`);
   assert.equal(await sql(`SELECT (SELECT count(*) FROM public."User" WHERE id IN('${payer}','${worker}'))+(SELECT count(*) FROM auth.users WHERE id IN('${payer}','${worker}'))+(SELECT count(*) FROM public."Payment" WHERE id='${payment}')+(SELECT count(*) FROM public."Gig" WHERE id='${gig}');`),'0');
  }
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
