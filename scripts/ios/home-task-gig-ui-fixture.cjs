#!/usr/bin/env node
// Installed native UI -> actual Express/Joi/service -> isolated local PostgreSQL.
// Only identity/profile, geo and unrelated shell services are synthetic.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const [container,database,output,portText='18083']=process.argv.slice(2),port=Number(portText);
assert(path.isAbsolute(output||'')&&!output.startsWith(root+'/'));assert(port>=18083&&port<=18089);
const f=require('../db/home-task-gig-http-fixture.cjs')(container,database,'ddf22600');
const {actor,home,sql,rpc,literal:q}=f;
const express=require(path.join(root,'backend/node_modules/express'));
const app=express();app.use(express.json());
const token='pantopus-synthetic-gig-ui-loopback-only';
const email='bp-task-ui@example.com';
const stamp='2026-09-10T12:00:00Z';
const user={id:actor,email,username:'gig_ui_fixture',name:'Gig UI Fixture',firstName:'Gig',lastName:'Fixture',accountType:'personal',account_type:'personal',role:'user',verified:true,createdAt:stamp,updatedAt:stamp};
const homeRow={id:home,name:'Gig UI Fixture',address:'1 Synthetic Street',city:'Test',state:'WA',zipcode:'98607',home_type:'house',isOwner:true,isOccupant:true};
const session=()=>({...f.scope.getRequestSessionScope({user:{id:actor},session:{id:'local-task-gig-acceptance'}}),home_id:home});
let initialized=false,taskId,server;
let commands=[],events=[],detailLayout;
const event=(event,data={})=>events.push({event,...data});
const receipts=()=>JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb)::text FROM public."HomeTaskGigReceipt" r WHERE home_id=${q(home)};`));
const task=()=>{
 const result=rpc('get_home_records',{p_home_id:home,p_actor_id:actor,p_kind:'task',p_record_id:taskId});
 if(!result.ok)throw Object.assign(new Error(result.code),{statusCode:result.status,code:result.code});return result.records[0];
};
const gigs=()=>JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'price',price,'status',status)),'[]'::jsonb)::text FROM public."Gig" WHERE user_id=${q(actor)};`));
const snapshot=()=>({home_id:home,task_id:taskId,commands,events,receipts:receipts(),gigs:gigs()});
function cleanup(){
 sql(`BEGIN;DELETE FROM public."HomeTaskGigReceipt" WHERE home_id=${q(home)};DELETE FROM public."Gig" WHERE user_id=${q(actor)};DELETE FROM public."Home" WHERE id=${q(home)};DELETE FROM public."User" WHERE id=${q(actor)};DELETE FROM auth.users WHERE id=${q(actor)};COMMIT;`);
 assert.equal(sql(`SELECT (SELECT count(*) FROM auth.users WHERE id=${q(actor)})+(SELECT count(*) FROM public."Home" WHERE id=${q(home)});`),'0');
}
function reset(){
 if(initialized)cleanup();
 assert.equal(sql(`SELECT count(*) FROM auth.users WHERE id=${q(actor)};`),'0');
 sql(`BEGIN;INSERT INTO auth.users(id,email) VALUES(${q(actor)},${q(email)});INSERT INTO public."User"(id,email,username,name) VALUES(${q(actor)},${q(email)},'gig_ui_fixture','Gig UI Fixture');
 INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES(${q(home)},${q(actor)},'Private native Home','Test','WA','98607');
 INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES(${q(home)},${q(actor)},'owner','owner','adult','verified');COMMIT;`);
 initialized=true;commands=[];events=[];detailLayout=undefined;
 const result=rpc('mutate_home_record',{p_home_id:home,p_actor_id:actor,p_kind:'task',p_action:'create',p_record_id:null,p_payload:{title:'Private native copper repair',description:'PRIVATE household notes are never public',details:{private_marker:'never publish'}},p_source_mail_id:null});
 assert(result.ok);taskId=result.record.id;f.loseNextReply();
}
app.use(async(req,res,next)=>{
 res.set('Cache-Control','private, no-store');
 const p=req.path,m=req.method;
 try{
  if(p==='/fixture/reset'&&m==='POST'){reset();return res.json(snapshot());}
  if(p==='/fixture/state'&&m==='GET')return res.json(snapshot());
  if(p==='/fixture/revoke'&&m==='POST'){sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);event('revoked');return res.json(snapshot());}
  if(p==='/fixture/restore'&&m==='POST'){sql(`UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);event('restored');return res.json(snapshot());}
  if(p==='/fixture/cancel-elsewhere'&&m==='POST'){sql(`UPDATE public."Gig" SET status='cancelled',price=30 WHERE user_id=${q(actor)};`);event('cancelled_elsewhere');return res.json(snapshot());}
  if(p==='/fixture/gig-state'&&m==='POST'){
   assert(['open','assigned','in_progress','completed','cancelled'].includes(req.body.status));assert(['v1','v2'].includes(req.body.layout));
   sql(`UPDATE public."Gig" SET status=${q(req.body.status)} WHERE user_id=${q(actor)};`);detailLayout=req.body.layout;
   event('detail_state',{status:req.body.status,layout:req.body.layout});return res.json(snapshot());
  }
  if(p==='/fixture/change-task'&&m==='POST'){sql(`UPDATE public."HomeTask" SET title='Changed private native repair',updated_at=clock_timestamp() WHERE id=${q(taskId)};`);event('task_changed');return res.json(snapshot());}
  if(p==='/api/users/login'&&m==='POST'){
   assert.equal(req.body.email,email);assert.equal(req.body.password,'synthetic-loopback-only');event('signed_in');
   return res.json({user,accessToken:token,refreshToken:token+'-refresh',expiresIn:86400,sessionId:'local-task-gig-acceptance',session:{id:'local-task-gig-acceptance',context:'interactive'}});
  }
  if(p.startsWith('/api/')&&req.headers.authorization!=='Bearer '+token)return res.status(401).json({error:'Synthetic sign-in required'});
  if(p==='/api/gigs'&&m==='POST'){
   commands.push(structuredClone(req.body));
   res.once('finish',()=>event('publication_response',{status:res.statusCode,request_id:req.body.home_task_source?.request_id}));
   return next();
  }
  if(p===`/api/homes/${home}/tasks/${taskId}/gig-publication`&&m==='GET')return res.json({...await f.service.read({homeId:home,actorId:actor,taskId}),task_session:session()});
  if(p===`/api/homes/${home}/tasks/${taskId}`&&m==='GET')return res.json({task:task(),task_session:session()});
  if(p===`/api/homes/${home}/tasks`&&m==='GET')return res.json({tasks:[task()],task_session:session(),collection_capabilities:{can_create:true}});
  if(p==='/api/geo/autocomplete'&&m==='GET')return res.json({suggestions:[{suggestion_id:'native-reviewed-address',primary_text:'Reviewed native work location',label:'Reviewed native work location',secondary_text:'Test, WA',center:[-122.55,45.65],kind:'address'}]});
  if(p==='/api/geo/resolve'&&m==='POST'){assert.equal(req.body.suggestion_id,'native-reviewed-address');return res.json({normalized:{address:'Reviewed native work location',city:'Test',state:'WA',zipcode:'98607',latitude:45.65,longitude:-122.55,verified:false,source:'synthetic'}});}
  if(/^\/api\/gigs\/[a-f0-9-]+$/.test(p)&&m==='GET'){
   // Match the owner detail response's geometry boundary: the production GET
   // removes raw PostGIS fields and exposes parsed exact coordinates to owners.
   const row=JSON.parse(sql(`SELECT ((to_jsonb(g)-'exact_location'-'approx_location') || jsonb_build_object('location',jsonb_build_object('latitude',ST_Y(exact_location::geometry),'longitude',ST_X(exact_location::geometry))))::text FROM public."Gig" g WHERE id=${q(p.split('/')[3])} AND user_id=${q(actor)};`));
   event('gig_opened',{gig_id:row.id,status:row.status});return res.json({gig:{...row,creator:user,locationUnlocked:true,...(detailLayout?{is_v2:detailLayout==='v2'}:{})}});
  }
  if(m==='GET'){
   if(['/api/users/profile','/api/users/me'].includes(p))return res.json({user,...user});
   if(p==='/api/homes'||p.endsWith('/my-homes'))return res.json({homes:[homeRow]});
   if(p===`/api/homes/${home}`)return res.json({home:homeRow});
   if(p===`/api/homes/${home}/me`)return res.json({hasAccess:true,is_owner:true,role_base:'owner',permissions:['home.view','tasks.view','tasks.manage']});
   if(p===`/api/homes/${home}/dashboard`)return res.json({home:homeRow,myAccess:{permissions:['tasks.view','tasks.manage'],isOwner:true}});
   if(p.endsWith('/members'))return res.json({members:[]});
   if(p.endsWith('/unread-count'))return res.json({count:0,unread_count:0,unreadCount:0});
   if(p==='/api/notifications')return res.json({notifications:[],unreadCount:0,pagination:{page:1,totalPages:0,total:0}});
  }
  return res.status(404).json({error:'Not part of the synthetic native fixture'});
 }catch(error){event('fixture_denied',{status:error.statusCode||500,code:error.code||'fixture_failure'});return res.status(error.statusCode||500).json({error:error.message,code:error.code});}
});
app.use(f.app);
reset();server=app.listen(port,'127.0.0.1',()=>console.log('Owned native Gig fixture listening on loopback; SQL-backed publication'));
let stopping=false;
async function stop(){
 if(stopping)return;stopping=true;
 fs.writeFileSync(output,JSON.stringify(snapshot(),null,2),{mode:0o600});
 await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
 cleanup();console.log('PASS: exact native fixture SQL cleanup');
}
process.on('SIGINT',()=>stop().catch(()=>{process.exitCode=1;}));process.on('SIGTERM',()=>stop().catch(()=>{process.exitCode=1;}));
