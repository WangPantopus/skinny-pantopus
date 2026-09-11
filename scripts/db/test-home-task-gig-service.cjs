#!/usr/bin/env node
// Actual Gig HTTP route + validation + production service + isolated PostgreSQL.
// Authentication is synthetic; provider fanout is replaced and no charges run.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const [container, database] = process.argv.slice(2);
assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
assert.match(database || '', /^(postgres|[a-z0-9_]+_contract)$/);
const id = n => `ddf22000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=id(1), other=id(2), home=id(100), literal=v=>`'${String(v).replaceAll("'","''")}'`;
function sql(query) {
  return execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],
    {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
}
const rpc = (name,args) => {
  assert.match(name,/^[a-z_]+$/);
  const params=Object.entries(args).map(([key,value])=>{
    assert.match(key,/^p_[a-z_]+$/);
    return `${key} => ${value===null?'NULL':literal(typeof value==='object'?JSON.stringify(value):value)}`;
  });
  return JSON.parse(sql(`SET ROLE service_role; SELECT public.${name}(${params.join(',')})::text; RESET ROLE;`));
};
let loseReply=false, publishEvents=0;
const db={from:table=>{
  assert.equal(table,'Gig');
  return {insert:payload=>({select:()=>({single:async()=>{
    const keys=Object.keys(payload);keys.forEach(key=>assert.match(key,/^[a-z_]+$/));
    const row=JSON.parse(sql(`SET ROLE service_role; WITH inserted AS (
      INSERT INTO public."Gig"(${keys.join(',')}) SELECT ${keys.map(key=>'g.'+key).join(',')}
      FROM jsonb_populate_record(NULL::public."Gig",${literal(JSON.stringify(payload))}::jsonb) g RETURNING *)
      SELECT to_jsonb(inserted)::text FROM inserted; RESET ROLE;`));
    return {data:row,error:null};
  }})})};
},rpc:async(name,args)=>{
  const data=rpc(name,args);
  if(name==='publish_home_task_gig' && data.ok && loseReply){loseReply=false;throw new Error('Synthetic lost committed reply');}
  return {data,error:null};
}};
const load=Module._load;
const express=require(path.join(root,'backend/node_modules/express'));
const scope=require(path.join(root,'backend/utils/requestSessionScope'));
Module._load=function(request,parent,isMain){
  if(parent?.filename.endsWith('/services/homeTaskGigService.js') && request==='../config/supabaseAdmin')return db;
  if(parent?.filename.endsWith('/routes/gigs.js')){
    if(request==='../config/supabaseAdmin')return db;
    if(request==='../middleware/verifyToken')return (req,res,next)=>{
      req.user={id:req.headers['x-fixture-actor']||actor};req.session={id:'local-task-gig-acceptance'};next();
    };
    if(request==='../middleware/optionalAuth')return (req,res,next)=>next();
    const real=['express','joi','../middleware/validate','../services/homeTaskGigService','../utils/requestSessionScope','../utils/moduleSchemas'];
    if(!real.includes(request)){
      if(request==='../services/gig/browseCacheService')return {invalidateNear:()=>{publishEvents++;}};
      if(request==='../services/savedSearchAlertService')return {alertMatchingSavedSearches:async()=>{}};
      if(request==='../utils/logger')return {info:()=>{},warn:()=>{},error:()=>{}};
      return {};
    }
  }
  return load.call(this,request,parent,isMain);
};
const router=require(path.join(root,'backend/routes/gigs'));
const service=require(path.join(root,'backend/services/homeTaskGigService'));
Module._load=load;
const app=express();app.use(express.json());app.use('/api/gigs',router);
let server;
async function main(){
  let initialized=false;
  try{
    assert.equal(sql(`SELECT count(*) FROM auth.users WHERE id IN(${literal(actor)},${literal(other)});`),'0');
    sql(`BEGIN; INSERT INTO auth.users(id,email) VALUES(${literal(actor)},'gig-source-owner@example.invalid'),(${literal(other)},'gig-source-other@example.invalid');
      INSERT INTO public."User"(id,email,username,name) SELECT id,email,'gig_source_'||right(id::text,1),'Gig source fixture' FROM auth.users WHERE id IN(${literal(actor)},${literal(other)});
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode) VALUES(${literal(home)},${literal(actor)},${literal(actor)},'Private Home fixture','Test','WA','98607');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES
        (${literal(home)},${literal(actor)},'owner','owner','adult','verified'),(${literal(home)},${literal(other)},'member','member','adult','verified'); COMMIT;`);
    initialized=true;
    const create=()=>rpc('mutate_home_record',{p_home_id:home,p_actor_id:actor,p_kind:'task',p_action:'create',p_record_id:null,
      p_payload:{title:'PRIVATE source title',description:'PRIVATE mail and access notes',details:{private_marker:'not for public Gig'}},p_source_mail_id:null});
    const task=create();assert.equal(task.ok,true);
    server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    const request={title:'Reviewed public help',description:'Only this reviewed description is public.',price:25,
      location:{mode:'address',latitude:45.65,longitude:-122.55,address:'Reviewed meetup location'},
      home_task_source:{home_id:home,task_id:task.record.id,request_id:id(500),expected_updated_at:task.record.updated_at,reviewed:true}};
    async function post(body,who=actor,session=true){
      const response=await fetch(`${base}/api/gigs`,{method:'POST',headers:{'content-type':'application/json','x-fixture-actor':who,
        ...(session?{'x-pantopus-session-scope':scope.getRequestSessionScope({user:{id:who},session:{id:'local-task-gig-acceptance'}}).session_scope}:{})},body:JSON.stringify(body)});
      return {status:response.status,headers:response.headers,body:await response.json()};
    }
    assert.equal((await post(request,actor,false)).body.code,'SESSION_SCOPE_CHANGED');
    assert.equal((await post({...request,home_task_source:{...request.home_task_source,reviewed:false}})).status,400);
    assert.equal((await post({...request,location:{...request.location,mode:'home',homeId:home}})).status,400);
    assert.equal((await post({...request,reveal_policy:'public'})).status,400);
    assert.equal((await post({...request,price:25.001})).status,400);
    assert.equal((await post(request,other)).status,403);
    assert.equal(sql(`SELECT count(*) FROM public."HomeTaskGigReceipt" WHERE home_id=${literal(home)};`),'0');
    console.log('PASS: real HTTP validation rejects missing session, unreviewed publication, implicit Home location, public address reveal and foreign actor');
    loseReply=true;const lost=await post(request);assert.equal(lost.status,503,JSON.stringify(lost.body));
    let result=await post(request);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.replayed,true);
    const gig=result.body.gig.id,receipt=result.body.publication_receipt;
    assert.equal(result.headers.get('cache-control'),'private, no-store');
    assert.equal(sql(`SELECT count(*) FROM public."Gig" WHERE user_id=${literal(actor)};`),'1');
    assert.equal(sql(`SELECT status||':'||converted_to_gig_id::text FROM public."HomeTask" WHERE id=${literal(task.record.id)};`),`open:${gig}`);
    assert.equal(sql(`SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=${literal(home)} AND action='home_task_gig_published';`),'1');
    const stored=JSON.parse(sql(`SELECT to_jsonb(g)::text FROM public."Gig" g WHERE id=${literal(gig)};`));
    assert(!JSON.stringify(stored).includes('PRIVATE'));assert(!JSON.stringify(stored).includes(home));assert(!JSON.stringify(stored).includes(task.record.id));
    assert.equal(stored.payment_id,null);assert.equal(stored.accepted_by,null);assert.equal(stored.payment_status,'none');assert.deepEqual(stored.attachments,[]);
    console.log('PASS: lost committed reply recovers one Gig/backlink/audit/receipt, leaves Home task open and copies no private source fields or payment state');
    assert.equal((await post({...request,price:40})).body.code,'HOME_TASK_GIG_CONFLICT');
    assert.equal((await post({...request,home_task_source:{...request.home_task_source,request_id:id(501)}})).body.code,'HOME_TASK_GIG_LINKED');
    sql(`UPDATE public."Gig" SET status='cancelled',price=30 WHERE id=${literal(gig)};`);
    result=await post(request);assert.deepEqual(result.body.publication_receipt,receipt);assert.equal(result.body.gig.status,'cancelled');assert.equal(result.body.gig.price,30);
    assert.equal(publishEvents,0); // lost transport happened before first fanout; replay does not resend.
    console.log('PASS: changed terms conflict; new UUID cannot duplicate; original replay preserves subsequent cancellation and edited price');
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${literal(home)} AND user_id=${literal(actor)};`);
    assert.equal((await post(request)).status,403);
    sql(`UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${literal(home)} AND user_id=${literal(actor)};`);
    const fresh=create();assert.equal(fresh.ok,true);
    const newRequest={...request,home_task_source:{...request.home_task_source,task_id:fresh.record.id,request_id:id(502),expected_updated_at:fresh.record.updated_at}};
    sql(`UPDATE public."HomeTask" SET title='Changed privately',updated_at=clock_timestamp() WHERE id=${literal(fresh.record.id)};`);
    assert.equal((await post(newRequest)).body.code,'HOME_TASK_GIG_STALE');
    assert.equal(sql(`SELECT count(*) FROM public."Gig" WHERE user_id=${literal(actor)};`),'1');
    console.log('PASS: revoked access denies recovery; stale source blocks publication without another Gig');
    sql(`DELETE FROM public."Gig" WHERE id=${literal(gig)};`);
    assert.equal((await post(request)).body.code,'HOME_TASK_GIG_RETIRED');
    assert.equal((await service.read({homeId:home,actorId:actor,taskId:task.record.id})).can_publish,false);
    assert.equal(sql(`SELECT count(*) FROM public."HomeTaskGigReceipt" WHERE home_id=${literal(home)};`),'1');
    console.log('PASS: deleted Gig keeps its immutable source receipt and cannot be republished by retry');
    const {home_task_source:unused,...ordinary}=request;
    const normal=await post(ordinary);assert.equal(normal.status,201,JSON.stringify(normal.body));
    assert.equal(normal.body.gig.task_format,'in_person');assert.equal(normal.body.publication_receipt,undefined);
    assert.equal(publishEvents,1);
    console.log('PASS: ordinary HTTP Gig creation writes a valid required task format on the canonical schema');
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    if(initialized){sql(`BEGIN; DELETE FROM public."HomeTaskGigReceipt" WHERE home_id=${literal(home)};
      DELETE FROM public."Gig" WHERE user_id IN(${literal(actor)},${literal(other)});
      DELETE FROM public."Home" WHERE id=${literal(home)};
      DELETE FROM public."User" WHERE id IN(${literal(actor)},${literal(other)});DELETE FROM auth.users WHERE id IN(${literal(actor)},${literal(other)});COMMIT;`);
      assert.equal(sql(`SELECT (SELECT count(*) FROM public."Home" WHERE id=${literal(home)})+(SELECT count(*) FROM auth.users WHERE id IN(${literal(actor)},${literal(other)}))+(SELECT count(*) FROM public."HomeTaskGigReceipt" WHERE home_id=${literal(home)});`),'0');
      console.log('PASS: exact synthetic fixture cleanup');}
  }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
