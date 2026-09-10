#!/usr/bin/env node
// Production stop/refund services + real local PostgreSQL; synthetic provider only.
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const [container, database] = process.argv.slice(2);
if (!container?.startsWith('supabase_db_') || !/^[a-z0-9_]+_contract$/.test(database || '')) throw new Error('Use local disposable DATABASE_contract');
const root = path.resolve(__dirname, '../..');
const run = promisify(execFile);
const id = n => `aac70000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const payer=id(1), worker=id(2), gig=id(101), payment=id(301), bid=id(501), operation=id(801);
const quote = v => v == null ? 'NULL' : "'"+String(typeof v==='object'?JSON.stringify(v):v).replaceAll("'","''")+"'";
let connections=0, beforeBegin=null, beforeClaim=null, onCancel=null, loseFinish=false, loseDelivery=false;
async function sql(query) {
 connections++;
 const { stdout }=await run('docker',['exec',container,'psql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',
  `SET lock_timeout='5s'; SET statement_timeout='10s'; ${query}`]);
 return stdout.trim();
}
const allowed=new Set(['read_gig_stop_preview','begin_gig_stop','read_gig_stop_request','check_gig_stop_current','claim_gig_stop','finish_gig_stop',
 'release_gig_stop_lease','record_gig_stop_evidence','claim_gig_stop_delivery','read_gig_stop_delivery','finish_gig_stop_delivery',
 'reserve_payment_refund','claim_payment_refund','record_payment_refund_receipts','claim_gig_stop_reconciliation']);
const tables=new Set(['Payment','PaymentRefundRequest','PaymentRefundReceipt','PaymentWalletSettlement','WalletTransaction','Wallet','User']);
const identifier=n=>{assert.match(n,/^[a-zA-Z_]+$/);return `"${n}"`;};
const db={
 rpc:async(name,args={})=>{
  assert.ok(allowed.has(name),`Unexpected RPC ${name}`);
  if(name==='begin_gig_stop'&&beforeBegin){const hook=beforeBegin;beforeBegin=null;await hook();}
  if(name==='claim_gig_stop'&&beforeClaim){const hook=beforeClaim;beforeClaim=null;await hook();}
  const values=Object.entries(args).map(([key,value])=>{assert.match(key,/^p_[a-z_]+$/);return `${key}=>${quote(value)}`;}).join(',');
  try{
   const data=JSON.parse(await sql(`SET ROLE service_role; SELECT coalesce(to_jsonb(public.${name}(${values})),'null'::jsonb);`));
   if(loseFinish&&name==='finish_gig_stop'){loseFinish=false;return {error:{message:'Synthetic lost database acknowledgement'}};}
   if(loseDelivery&&name==='finish_gig_stop_delivery'){loseDelivery=false;return {error:{message:'Synthetic lost delivery acknowledgement'}};}
   return {data};
  }catch(error){return {error:{message:error.message}};}
 },
 from:name=>{
  assert.ok(tables.has(name),'Unexpected table');const filters=[];let order='';
  const query={select:()=>query,eq:(key,value)=>{filters.push(`${identifier(key)}=${quote(value)}`);return query;},
   in:(key,values)=>{filters.push(`${identifier(key)} IN (${values.map(quote).join(',')})`);return query;},
   order:(key,options)=>{order=` ORDER BY ${identifier(key)} ${options?.ascending===false?'DESC':'ASC'}`;return query;},
   maybeSingle:async()=>{const rows=await execute();return rows.error?rows:rows.data.length>1?{error:{message:'Multiple rows'}}:{data:rows.data[0]||null};},
   then:(resolve,reject)=>execute().then(resolve,reject)};
  async function execute(){try{return {data:JSON.parse(await sql(`SET ROLE service_role; SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (SELECT * FROM public.${identifier(name)}${filters.length?' WHERE '+filters.join(' AND '):''}${order}) x;`))};}catch(error){return {error:{message:error.message}};}}
  return query;
 }
};
let intent,charge,cancels=0,keys=[],reads=0,refundCreates=0,refundStatus='pending',expectedRefundAmount=1000,loseRefund=false,providerRefunds=[],delivered=[];
const stripe={paymentIntents:{retrieve:async pid=>{assert.equal(pid,intent.id);reads++;return structuredClone(intent);},
 cancel:async(pid,params,options)=>{assert.equal(pid,intent.id);assert.equal(params.cancellation_reason,'requested_by_customer');
  assert.equal(options.idempotencyKey,`gig-stop:${operation}:pi_stop_race`);cancels++;keys.push(options.idempotencyKey);
  if(onCancel)await onCancel();intent.status='canceled';intent.amount_capturable=0;return structuredClone(intent);}},
 charges:{retrieve:async cid=>{assert.equal(cid,charge.id);return structuredClone(charge);}},
 refunds:{list:async args=>{assert.equal(args.payment_intent,intent.id);return {data:structuredClone(providerRefunds),has_more:false};},
 create:async(args,options)=>{assert.equal(args.amount,expectedRefundAmount);assert.equal(options.idempotencyKey,`pantopus-refund:${operation}`);refundCreates++;
  const receipt={id:'re_stoprace',payment_intent:intent.id,charge:charge.id,amount:args.amount,currency:'usd',status:refundStatus,
   created:Math.floor(Date.now()/1000),metadata:args.metadata};providerRefunds.push(receipt);
  if(loseRefund){loseRefund=false;throw new Error('Synthetic lost provider refund response');}return structuredClone(receipt);}}
};
const replacements=new Map([[path.join(root,'backend/config/supabaseAdmin.js'),db],
 [path.join(root,'backend/stripe/getStripeClient.js'),{getStripeClient:()=>stripe}],
 [path.join(root,'backend/services/notificationService.js'),{deliverStoredGigNotification:async n=>{assert.equal(n.metadata.stop_request_id,operation);delivered.push(n.id);return {acceptedCount:1,unresolvedCount:0};}}]]);
const original=Module._load;
Module._load=function(request,parent,isMain){const resolved=Module._resolveFilename(request,parent,isMain);return replacements.has(resolved)?replacements.get(resolved):original.apply(this,arguments);};
const stop=require(path.join(root,'backend/services/gigStopService.js'));
Module._load=original;
const erase=`DELETE FROM public."Notification" WHERE metadata->>'stop_request_id'='${operation}';
 DELETE FROM public."GigStopDelivery" WHERE request_id='${operation}';
 DELETE FROM public."GigStopRequest" WHERE gig_id='${gig}';
 DELETE FROM public."Refund" WHERE payment_id='${payment}'; DELETE FROM public."PaymentRefundReceipt" WHERE payment_id='${payment}';
 DELETE FROM public."PaymentRefundRequest" WHERE payment_id='${payment}'; DELETE FROM public."PaymentRefundRecovery" WHERE payment_id='${payment}';
 DELETE FROM public."WalletTransaction" WHERE payment_id='${payment}'; DELETE FROM public."Wallet" WHERE user_id='${worker}';`;
async function reset() {
 await sql(`BEGIN;${erase}
 UPDATE public."Payment" SET payment_status='authorized',stripe_payment_intent_id='pi_stop_race',stripe_charge_id=NULL,captured_at=NULL,
 capture_attempts=0,refunded_amount=0,dispute_id=NULL,payment_attempted_at=NULL WHERE id='${payment}';
 UPDATE public."Gig" SET status='assigned',accepted_by='${worker}',payment_id='${payment}',user_id='${payer}',price=10,started_at=NULL,
 accepted_at=now(),worker_completed_at=NULL,owner_confirmed_at=NULL,cancelled_at=NULL,cancelled_by=NULL,cancellation_reason=NULL,cancellation_policy='flexible',payment_status='authorized' WHERE id='${gig}';
 UPDATE public."GigBid" SET status='accepted',bid_amount=10 WHERE id='${bid}';COMMIT;`);
 intent={id:'pi_stop_race',customer:'cus_stop_race',amount:1000,currency:'usd',capture_method:'manual',status:'requires_capture',amount_received:0,amount_capturable:1000,latest_charge:'ch_stoprace',metadata:{payer_id:payer,payee_id:worker,gig_id:gig}};
 charge={id:'ch_stoprace',customer:intent.customer,payment_intent:intent.id,amount:1000,currency:'usd',paid:true,captured:false,amount_captured:0,refunded:false,amount_refunded:0};
 cancels=0;keys=[];reads=0;refundCreates=0;refundStatus='pending';expectedRefundAmount=1000;loseRefund=false;providerRefunds=[];delivered=[];beforeBegin=null;beforeClaim=null;onCancel=null;loseFinish=false;loseDelivery=false;
}
async function command(action='cancel',actorId=payer){const preview=await stop.preview({gigId:gig,actorId,action});return {gigId:gig,actorId,sessionScope:'a'.repeat(64),requestId:operation,action,expectedTerms:preview.terms};}
async function overlap(update,following,afterWait='') {
 const child=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1']);
 let output='',errors='',ready;const signal=new Promise(resolve=>{ready=resolve;});
 child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('STOP_LOCK_READY'))ready();});child.stderr.on('data',chunk=>{errors+=chunk;});
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code?reject(new Error(errors)):resolve());});
 child.stdin.end(`BEGIN;${update} SELECT 'STOP_LOCK_READY';SELECT pg_sleep(0.5);${afterWait}COMMIT;`);
 await Promise.race([signal,done]);try{return await following();}finally{await done;connections++;}
}
(async()=>{let created=false;try{
 await sql(`BEGIN;INSERT INTO auth.users(id,email) VALUES('${payer}','stop-race-payer@example.invalid'),('${worker}','stop-race-worker@example.invalid');
 INSERT INTO public."User"(id,email,username,name) SELECT id,email,'stop_race_'||right(id::text,1),'Stop race' FROM auth.users WHERE id IN('${payer}','${worker}');
 INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,cancellation_policy) VALUES('${gig}','${payer}','${payer}','Stop race','Synthetic',10,'assigned','${worker}','flexible');
 INSERT INTO public."GigBid"(id,gig_id,user_id,bid_amount,status) VALUES('${bid}','${gig}','${worker}',10,'accepted');
 INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,stripe_customer_id,stripe_payment_intent_id,payment_status)
 VALUES('${payment}','${gig}','${payer}','${worker}',1000,1000,150,850,'cus_stop_race','pi_stop_race','authorized');
 UPDATE public."Gig" SET payment_id='${payment}' WHERE id='${gig}';COMMIT;`);created=true;
 await reset();let cmd=await command();const financial=await sql(`SELECT public.gig_stop_payment_snapshot(p) FROM public."Payment" p WHERE id='${payment}';`);
 onCancel=async()=>{throw new Error('Provider offline');};let result=await stop.execute(cmd);assert.equal(result.status,'pending');assert.equal(result.receipt,null);
 await assert.rejects(sql(`UPDATE public."Gig" SET status='in_progress',started_at=now() WHERE id='${gig}';`),/saved stop/);
 await assert.rejects(sql(`UPDATE public."Payment" SET payment_status='capture_pending',capture_attempts=1 WHERE id='${payment}';`),/saved stop/);
 assert.equal(await sql(`SELECT count(*) FROM public."GigStopDelivery" WHERE request_id='${operation}';`),'0');
 const priorReads=reads;assert.equal((await stop.readRequest(cmd)).status,'pending');assert.equal(reads,priorReads);
 onCancel=null;result=await stop.execute({...cmd,sessionScope:'b'.repeat(64)});assert.equal(result.status,'completed');assert.equal(new Set(keys).size,1);
 assert.equal(await sql(`SELECT public.gig_stop_payment_snapshot(p) FROM public."Payment" p WHERE id='${payment}';`),financial);
 assert.equal((await stop.execute(cmd)).status,'completed');assert.equal(cancels,2);
 loseDelivery=true;await assert.rejects(stop.deliverPending(),e=>e.code==='STOP_RECEIPT_UNKNOWN');await stop.deliverPending();assert.equal(new Set(delivered).size,1);

 await reset();cmd=await command();onCancel=async()=>{intent.status='canceled';intent.amount_capturable=0;throw new Error('Lost response');};
 assert.equal((await stop.execute(cmd)).status,'completed');assert.equal(cancels,1);
 await reset();cmd=await command();loseFinish=true;assert.equal((await stop.execute(cmd)).status,'completed');assert.equal(cancels,1);

 await reset();cmd=await command();const results=await Promise.all([stop.execute(cmd),stop.execute(cmd)]);
 assert.ok(results.some(x=>x.status==='completed'));assert.equal(cancels,1);
 assert.equal(await sql(`SELECT count(*) FROM public."GigStopRequest" WHERE gig_id='${gig}';`),'1');

 await reset();cmd=await command();await assert.rejects(overlap(`UPDATE public."Gig" SET status='in_progress',started_at=now() WHERE id='${gig}';`,()=>stop.execute(cmd)),e=>e.code==='STOP_STARTED_POLICY_REVIEW');assert.equal(cancels,0);
 await reset();cmd=await command();onCancel=async()=>{await assert.rejects(sql(`UPDATE public."Gig" SET status='in_progress',started_at=now() WHERE id='${gig}';`),/saved stop/);};assert.equal((await stop.execute(cmd)).status,'completed');
 await reset();cmd=await command();beforeBegin=()=>sql(`UPDATE public."Gig" SET price=11 WHERE id='${gig}';`);
 await assert.rejects(stop.execute(cmd),e=>e.code==='STOP_PAYMENT_REVIEW');assert.equal(cancels,0);

 await reset();cmd=await command();beforeClaim=()=>overlap(`UPDATE public."Payment" SET payment_status='disputed',dispute_id='dp_stop_race' WHERE id='${payment}';`,async()=>{});
 result=await stop.execute(cmd);assert.equal(result.status,'pending');assert.equal(result.canRetry,false);assert.equal(cancels,0);
 await reset();cmd=await command();onCancel=()=>sql(`UPDATE public."Payment" SET payment_status='disputed',dispute_id='dp_stop_race' WHERE id='${payment}';`);
 result=await stop.execute(cmd);assert.equal(result.status,'pending');assert.equal(await sql(`SELECT provider_receipt->>'status' FROM public."GigStopRequest" WHERE id='${operation}';`),'canceled');
 assert.equal(await sql(`SELECT status FROM public."Gig" WHERE id='${gig}';`),'assigned');

 await reset();cmd=await command('worker_release',worker);result=await stop.execute(cmd);
 assert.equal(result.receipt.gigStatus,'open');assert.equal(result.request.actorId,worker);
 assert.equal(await sql(`SELECT status FROM public."GigBid" WHERE id='${bid}';`),'rejected');
 assert.equal((await stop.readRequest(cmd)).status,'completed');

 // Stop admission and the legacy wallet primitive share Payment-before-Wallet
 // ordering. Prove both winners using real overlapping transactions, before
 // provider discovery has created any refund reservation.
 await reset();await sql(`UPDATE public."Payment" SET payment_status='captured_hold',captured_at=now(),stripe_charge_id='ch_stoprace' WHERE id='${payment}';`);
 cmd=await command();
 const creditSql=`SET ROLE service_role; SELECT public.wallet_credit('${worker}',850,'gig_income',NULL,'${payment}','${gig}','${payer}',NULL,'gig_income:${payment}');`;
 await assert.rejects(overlap(`SET LOCAL ROLE service_role; SELECT public.begin_gig_stop('${gig}','${payer}',${quote(cmd.sessionScope)},'${operation}','cancel',${quote(cmd.expectedTerms)});`,
  ()=>sql(creditSql)),/saved stop request must finish before wallet income/);
 assert.equal(await sql(`SELECT count(*) FROM public."WalletTransaction" WHERE payment_id='${payment}';`),'0');
 assert.equal(await sql(`SELECT count(*) FROM public."Wallet" WHERE user_id='${worker}';`),'0');
 assert.equal(await sql(`SELECT count(*) FROM public."PaymentRefundRequest" WHERE payment_id='${payment}';`),'0');
 assert.equal(await sql(`SELECT payment_status FROM public."Payment" WHERE id='${payment}';`),'captured_hold');
 assert.equal(refundCreates,0);
 await reset();await sql(`UPDATE public."Payment" SET payment_status='captured_hold',captured_at=now(),stripe_charge_id='ch_stoprace' WHERE id='${payment}';`);
 cmd=await command();
 await assert.rejects(overlap(creditSql,()=>stop.execute(cmd)),e=>e.code==='STOP_PAYMENT_REVIEW');
 assert.equal(await sql(`SELECT balance FROM public."Wallet" WHERE user_id='${worker}';`),'850');
 assert.equal(await sql(`SELECT count(*) FROM public."WalletTransaction" WHERE payment_id='${payment}';`),'1');
 assert.equal(await sql(`SELECT count(*) FROM public."GigStopRequest" WHERE gig_id='${gig}';`),'0');
 assert.equal(refundCreates,0);assert.equal(cancels,0);

 await reset();await sql(`UPDATE public."Payment" SET payment_status='captured_hold',captured_at=now()-interval '3 days',cooling_off_ends_at=now()-interval '1 day',stripe_charge_id='ch_stoprace' WHERE id='${payment}';`);
 cmd=await command();
 const settlement=await overlap(`SET LOCAL ROLE service_role; SELECT id FROM public."Gig" WHERE id='${gig}' FOR UPDATE;`,
  ()=>sql(`SET ROLE service_role; SELECT public.settle_paid_gig_wallet_income(p.id,public.refund_payment_snapshot(p)) FROM public."Payment" p WHERE id='${payment}';`),
  `SELECT public.begin_gig_stop('${gig}','${payer}',${quote(cmd.sessionScope)},'${operation}','cancel',${quote(cmd.expectedTerms)});`);
 assert.equal(JSON.parse(settlement).error,'GIG_TERMS_CHANGED');
 assert.equal(await sql(`SELECT state FROM public."GigStopRequest" WHERE id='${operation}';`),'pending');
 assert.equal(await sql(`SELECT count(*) FROM public."PaymentWalletSettlement" WHERE payment_id='${payment}';`),'0');
 assert.equal(await sql(`SELECT count(*) FROM public."WalletTransaction" WHERE payment_id='${payment}';`),'0');

 await reset();await sql(`UPDATE public."Payment" SET payment_status='captured_hold',captured_at=now(),stripe_charge_id='ch_stoprace' WHERE id='${payment}';`);
 intent.status='succeeded';intent.amount_received=1000;intent.amount_capturable=0;charge.captured=true;charge.amount_captured=1000;
 cmd=await command();loseRefund=true;result=await stop.execute(cmd);assert.equal(result.status,'pending');assert.equal(result.financialStatus,'refund_pending');assert.equal(refundCreates,1);
 result=await stop.execute(cmd);assert.equal(result.status,'pending');assert.equal(refundCreates,1);
 providerRefunds[0].status='succeeded';result=await stop.execute(cmd);assert.equal(result.status,'completed');assert.equal(result.receipt.financialStatus,'refunded');assert.equal(refundCreates,1);
 assert.equal(await sql(`SELECT refunded_amount FROM public."Payment" WHERE id='${payment}';`),'1000');

 await reset();await sql(`UPDATE public."Payment" SET payment_status='captured_hold',captured_at=now(),stripe_charge_id='ch_stoprace' WHERE id='${payment}';`);
 intent.status='succeeded';intent.amount_received=1000;intent.amount_capturable=0;charge.captured=true;charge.amount_captured=1000;
 providerRefunds=[{id:'re_stopexternal',payment_intent:intent.id,charge:charge.id,amount:200,currency:'usd',status:'succeeded',created:Math.floor(Date.now()/1000),metadata:{}}];
 expectedRefundAmount=800;refundStatus='pending';cmd=await command();
 assert.equal((await stop.execute(cmd)).status,'pending');assert.equal(refundCreates,1);
 assert.equal(await sql(`SELECT amount_cents FROM public."PaymentRefundRequest" WHERE id='${operation}';`),'800');
 providerRefunds[1].status='succeeded';const beforeCreates=refundCreates;
 assert.deepEqual(await stop.reconcilePending(),{checked:1,completed:1});assert.equal(refundCreates,beforeCreates);
 assert.equal((await stop.readRequest(cmd)).receipt.financialStatus,'refunded');

 await reset();cmd=await command();onCancel=async()=>{throw new Error('Provider offline');};assert.equal((await stop.execute(cmd)).status,'pending');
 intent.status='canceled';intent.amount_capturable=0;const beforeCancels=cancels;
 assert.deepEqual(await stop.reconcilePending(),{checked:1,completed:1});assert.equal(cancels,beforeCancels);
 assert.equal((await stop.readRequest(cmd)).receipt.financialStatus,'released');
 console.log(`Stop production service/SQL passed: original release/refund identity, lost provider and DB acknowledgements, independent delivery, readonly status and background reconciliation, concurrent command, worker-start, wallet-credit and protected-settlement interleavings, changed terms, dispute before/during provider call, worker release, pending-to-succeeded refund, external partial-refund discovery before freezing remaining amount (${connections} connections).`);
}finally{if(created)await sql(`BEGIN;${erase} UPDATE public."Gig" SET payment_id=NULL WHERE id='${gig}';DELETE FROM public."GigBid" WHERE id='${bid}';
 DELETE FROM public."Payment" WHERE id='${payment}';DELETE FROM public."Gig" WHERE id='${gig}';DELETE FROM public."User" WHERE id IN('${payer}','${worker}');DELETE FROM auth.users WHERE id IN('${payer}','${worker}');COMMIT;`);}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
