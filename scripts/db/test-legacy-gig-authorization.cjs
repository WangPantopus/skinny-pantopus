#!/usr/bin/env node
// Actual production recovery service + local PostgreSQL, synthetic Stripe only.
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const [container,database] = process.argv.slice(2);
if (!container?.startsWith('supabase_db_') || !/^[a-z0-9_]+_contract$/.test(database || '')) throw new Error('Use local disposable DATABASE_contract');
const root = path.resolve(__dirname,'../..');
const run = promisify(execFile);
const payer='aafc0000-0000-4000-8000-000000000001',worker='aafc0000-0000-4000-8000-000000000002';
const gig='aafc0000-0000-4000-8000-000000000101',payment='aafc0000-0000-4000-8000-000000000301';
const quote = value => value == null ? 'NULL' : "'"+String(typeof value==='object'?JSON.stringify(value):value).replaceAll("'","''")+"'";
let connections=0,loseReceipt=false;
async function sql(text) {
 connections++;
 const {stdout}=await run('docker',['exec',container,'psql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',
  `SET lock_timeout='5s'; SET statement_timeout='10s'; ${text}`]);
 return stdout.trim();
}
const names=new Set(['begin_legacy_gig_authorization','claim_legacy_gig_authorization','record_legacy_gig_authorization','finish_legacy_gig_auto_cancel']);
const db={rpc:async(name,args)=>{
 assert.ok(names.has(name),'Unexpected RPC');
 const values=Object.entries(args).map(([key,value])=>{assert.match(key,/^p_[a-z_]+$/);return `${key}=>${quote(value)}`;}).join(',');
 const data=JSON.parse(await sql(`SET ROLE service_role; SELECT public.${name}(${values});`));
 if(loseReceipt&&name==='record_legacy_gig_authorization'){loseReceipt=false;return {error:{message:'Synthetic lost acknowledgement'}};}
 return {data};
}};
let createCount=0,unknownCreate=false,onCancel=null;
const intents=new Map();
const stripe={charges:{retrieve:async id=>{
 const intent=[...intents.values()].find(x=>x.latest_charge===id);assert.ok(intent);
 return {id,payment_intent:intent.id,customer:intent.customer,amount:intent.amount,currency:intent.currency,
  paid:true,captured:false,refunded:false,amount_refunded:0,
  payment_method_details:{type:'card',card:{capture_before:intent.capture_before}}};
}},paymentIntents:{
 retrieve:async id=>{assert.ok(intents.has(id));return structuredClone(intents.get(id));},
 list:async args=>{assert.equal(args.customer,'cus_legacy_race');return {data:[...intents.values()].map(x=>structuredClone(x)),has_more:false};},
 create:async(args,options)=>{
  assert.match(options.idempotencyKey,/^legacy-gig-create:/);
  const prior=[...intents.values()].find(x=>x.metadata.legacy_authorization_id===args.metadata.legacy_authorization_id);
  if(prior)return structuredClone(prior);
  createCount++;const intent={...args,capture_before:Math.floor(Date.now()/1000)+3600,latest_charge:`ch_legacy${createCount}`,id:`pi_legacy_race_${createCount}`,status:'requires_action',amount_capturable:0,client_secret:'synthetic-transient-secret'};
  intents.set(intent.id,intent);
  if(unknownCreate){unknownCreate=false;throw new Error('Synthetic lost provider response');}
  return structuredClone(intent);
 },
 cancel:async id=>{const intent=intents.get(id);assert.ok(intent);if(onCancel)await onCancel(intent);intent.status='canceled';return structuredClone(intent);},
 confirm:async()=>{throw new Error('This contract must not reconfirm an active SDK challenge');},
}};
const replacements=new Map([[path.join(root,'backend/config/supabaseAdmin.js'),db],
 [path.join(root,'backend/stripe/getStripeClient.js'),{getStripeClient:()=>stripe}]]);
const original=Module._load;
Module._load=function(request,parent,isMain){const resolved=Module._resolveFilename(request,parent,isMain);return replacements.has(resolved)?replacements.get(resolved):original.apply(this,arguments);};
const {recover}=require(path.join(root,'backend/services/legacyGigAuthorization.js'));
Module._load=original;
async function overlap(update,following){
 const child=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1']);
 let output='',errors='';let ready;
 const signal=new Promise(resolve=>{ready=resolve;});
 child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('LEGACY_LOCK_READY'))ready();});
 child.stderr.on('data',chunk=>{errors+=chunk;});
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code?reject(new Error(errors)):resolve());});
 child.stdin.end(`BEGIN; ${update} SELECT 'LEGACY_LOCK_READY'; SELECT pg_sleep(0.5); COMMIT;`);
 await Promise.race([signal,done]);const result=await following();await done;connections++;return result;
}
const reset=`BEGIN; DELETE FROM public."GigLegacyAuthorization" WHERE payment_id='${payment}';
 UPDATE public."Payment" SET stripe_payment_intent_id=NULL,payment_status='ready_to_authorize',captured_at=NULL,authorization_expires_at=NULL,payment_attempted_at=NULL,payment_succeeded_at=NULL WHERE id='${payment}';
 UPDATE public."Gig" SET status='assigned',price=10,user_id='${payer}',payment_status='ready_to_authorize' WHERE id='${gig}'; COMMIT;`;
(async()=>{
 let created=false;
 try{
  await sql(`BEGIN;
   INSERT INTO auth.users(id,email) VALUES('${payer}','legacy-race-payer@example.invalid'),('${worker}','legacy-race-worker@example.invalid');
   INSERT INTO public."User"(id,email,username,name) SELECT id,email,'legacy_race_'||right(id::text,1),'Legacy race' FROM auth.users WHERE id IN ('${payer}','${worker}');
   INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,scheduled_start)
    VALUES('${gig}','${payer}','${payer}','Legacy race','Synthetic',10,'assigned','${worker}',now()+interval '1 hour');
   INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,stripe_customer_id,stripe_payment_method_id,payment_status)
    VALUES('${payment}','${gig}','${payer}','${worker}',1000,1000,150,850,'cus_legacy_race','pm_legacy_race','ready_to_authorize');
   UPDATE public."Gig" SET payment_id='${payment}',payment_status='ready_to_authorize' WHERE id='${gig}';COMMIT;`);created=true;
  unknownCreate=true;
  await assert.rejects(recover({gigId:gig,actorId:payer,mode:'resume'}),error=>error.code==='authorization_unknown');
  assert.equal(createCount,1);
  let result=await recover({gigId:gig,actorId:payer,mode:'check'});
  assert.equal(result.paymentIntentId,'pi_legacy_race_1');assert.equal(result.authorizationReady,false);assert.equal(createCount,1);
  assert.equal(await sql(`SELECT count(*) FROM public."GigLegacyAuthorization" WHERE payment_id='${payment}';`),'1');
  intents.get(result.paymentIntentId).status='requires_capture';intents.get(result.paymentIntentId).amount_capturable=1000;
  loseReceipt=true;
  await assert.rejects(recover({gigId:gig,actorId:payer,mode:'resume'}),error=>error.code==='authorization_unknown');
  result=await recover({gigId:gig,actorId:payer,mode:'resume'});
  assert.equal(result.authorizationReady,true);assert.equal(result.clientSecret,undefined);assert.equal(createCount,1);
  assert.equal((await recover({gigId:gig,scheduler:true,mode:'cancel'})).cancelled,undefined);
  assert.equal(await sql(`SELECT status FROM public."Gig" WHERE id='${gig}';`),'assigned');
  // Terminal proof permits a replacement while retaining the old intent row.
  intents.get(result.paymentIntentId).status='canceled';
  await sql(`UPDATE public."GigLegacyAuthorization" SET lease_until=clock_timestamp()-interval '1 second' WHERE payment_id='${payment}';`);
  result=await recover({gigId:gig,actorId:payer,mode:'resume'});
  assert.equal(result.paymentIntentId,'pi_legacy_race_2');assert.equal(createCount,2);
  assert.equal(await sql(`SELECT count(*) FROM public."GigLegacyAuthorization" WHERE payment_id='${payment}';`),'2');
  assert.equal(await sql(`SELECT amount_total||':'||amount_platform_fee||':'||amount_to_payee FROM public."Payment" WHERE id='${payment}';`),'1000:150:850');
  await sql(reset);intents.clear();
  const data=await db.rpc('begin_legacy_gig_authorization',{p_gig_id:gig,p_actor_id:payer});
  const args={p_gig_id:gig,p_actor_id:payer,p_attempt_id:data.data.attempt.id};
  const claims=await Promise.all([db.rpc('claim_legacy_gig_authorization',args),db.rpc('claim_legacy_gig_authorization',args)]);
  assert.equal(claims.filter(x=>x.data.error==='BUSY').length,1);assert.equal(claims.filter(x=>x.data.attempt?.lease_id).length,1);
  await sql(`UPDATE public."GigLegacyAuthorization" SET lease_until=clock_timestamp()-interval '1 second' WHERE payment_id='${payment}';`);
  const moved=await overlap(`UPDATE public."Gig" SET price=11 WHERE id='${gig}';`,()=>db.rpc('claim_legacy_gig_authorization',args));
  assert.equal(moved.data.error,'PAYMENT_CHANGED');
  await sql(`UPDATE public."Gig" SET price=10 WHERE id='${gig}';`);
  const revoked=await overlap(`UPDATE public."Gig" SET user_id='${worker}' WHERE id='${gig}';`,()=>db.rpc('claim_legacy_gig_authorization',args));
  assert.equal(revoked.data.error,'FORBIDDEN');
  await sql(`UPDATE public."Gig" SET user_id='${payer}' WHERE id='${gig}';`);
  const disputed=await overlap(`UPDATE public."Payment" SET payment_status='disputed' WHERE id='${payment}';`,()=>db.rpc('claim_legacy_gig_authorization',args));
  assert.equal(disputed.data.error,'PAYMENT_CHANGED');
  await sql(reset);intents.clear();
  result=await recover({gigId:gig,actorId:payer,mode:'resume'});
  onCancel=async intent=>{
   // SDK completes after cancellation is admitted but before its provider call
   // returns. The owner must not get ready and the worker must not start.
   intent.status='requires_capture';intent.amount_capturable=1000;
   const checked=await recover({gigId:gig,actorId:payer,mode:'check'});
   assert.equal(checked.cancellationPending,true);assert.equal(checked.authorizationReady,false);
   await assert.rejects(sql(`UPDATE public."Gig" SET status='in_progress',started_at=now() WHERE id='${gig}';`),/Authorization cancellation/);
  };
  // The competing SDK receipt advances its verification version. A late cancel
  // response cannot overwrite it; the next check proves cancellation and ends.
  await assert.rejects(recover({gigId:gig,scheduler:true,mode:'cancel'}),error=>error.code==='legacy_authorization_invalid_proof');
  onCancel=null;
  assert.equal(await sql(`SELECT status FROM public."Gig" WHERE id='${gig}';`),'assigned');
  result=await recover({gigId:gig,scheduler:true,mode:'cancel'});assert.equal(result.cancelled,true);
  await sql(reset);intents.clear();
  result=await recover({gigId:gig,actorId:payer,mode:'resume'});
  intents.get(result.paymentIntentId).status='requires_capture';intents.get(result.paymentIntentId).amount_capturable=1000;
  await recover({gigId:gig,actorId:payer,mode:'check'});
  const startFirst=await overlap(`UPDATE public."Gig" SET status='in_progress',started_at=now() WHERE id='${gig}';`,()=>db.rpc('claim_legacy_gig_authorization',{
   p_gig_id:gig,p_actor_id:null,p_attempt_id:result.authorizationAttemptId,p_scheduler:true,p_cancel:true}));
  assert.equal(startFirst.data.error,'PAYMENT_CHANGED');
  console.log(`Legacy service/SQL recovery passed: exact unknown intent, lost receipt acknowledgement, ready resume, replacement history, concurrent lease, locked amount/actor/dispute changes, cancellation vs SDK/worker start (${connections} connections).`);
 }finally{
  if(created)await sql(`BEGIN;DELETE FROM public."GigLegacyAuthorization" WHERE payment_id='${payment}';
   UPDATE public."Gig" SET payment_id=NULL WHERE id='${gig}';DELETE FROM public."Payment" WHERE id='${payment}';DELETE FROM public."Gig" WHERE id='${gig}';
   DELETE FROM public."User" WHERE id IN ('${payer}','${worker}');DELETE FROM auth.users WHERE id IN ('${payer}','${worker}');COMMIT;`);
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
