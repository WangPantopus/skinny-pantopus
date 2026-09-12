#!/usr/bin/env node
// Production Home postal routes and real local SDK/SQL. Auth, mail and
// notifications are synthetic. Loopback control endpoints never ship with app.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const [container,project,cli,evidence,portText='18084']=process.argv.slice(2);
assert.match(project||'',/^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(evidence||'')&&!evidence.startsWith(root+'/'));fs.mkdirSync(evidence,{recursive:true,mode:0o700});
const port=Number(portText);assert(port>=18083&&port<=18089);
const f=require('../db/home-residency-review-http-fixture.cjs')(container,{summary:true,dashboard:true,postcard:true});
const {home,id,q,sql}=f,actor=id(2),functions=['lock_home_postcard_current_scope','home_postcard_current_context','home_postcard_request_projection','get_home_postcard_request','cancel_home_postcard_request','valid_home_postcard_address','home_postcard_request_work','begin_home_postcard_request','home_postcard_confirmed_address','get_home_postcard_current_status','claim_home_postcard_current_dispatch','record_home_postcard_current_dispatch','home_postcard_verification_projection','get_home_postcard_verification','cancel_home_postcard_verification','home_postcard_verified_policy','verify_home_postcard_current','promote_home_postcard_review','challenge_home_postcard_review'];
const definition="SELECT pg_get_functiondef('public.review_home_residency(uuid,uuid,text,jsonb,integer)'::regprocedure);";
const properties="SELECT json_build_object('oid',oid,'owner',proowner,'acl',proacl,'config',proconfig) FROM pg_proc WHERE oid='public.review_home_residency(uuid,uuid,text,jsonb,integer)'::regprocedure;";
const before=sql(definition),beforeProperties=sql(properties),ledger=sql('SELECT max(version) FROM supabase_migrations.schema_migrations;');
fs.writeFileSync(path.join(evidence,'review-before.sql'),before+';\n',{mode:0o600,flag:'wx'});
fs.writeFileSync(path.join(evidence,'review-before-properties.json'),beforeProperties,{mode:0o600,flag:'wx'});
let config;
try{config=JSON.parse(execFileSync(cli,['status','--workdir',project,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}));}
catch{throw Error('Owned SDK configuration unavailable');}
assert.equal(config.API_URL,'http://127.0.0.1:64521');
const rawFetch=global.fetch;global.fetch=(input,options)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);assert(['127.0.0.1','localhost'].includes(u.hostname));return rawFetch(input,options);};
const {createClient}=require(path.join(root,'backend/node_modules/@supabase/supabase-js'));
const client=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let fault=null,held=null,holdNext=null,server,schema=false,initialized=false,closing=false;
const events=[];
f.useDatabaseClient({supabaseUrl:client.supabaseUrl,async rpc(name,args){
 assert(functions.includes(name)||['home_record_context','get_home_residency_review','decide_home_residency_review'].includes(name));
 if(fault?.name===name&&fault.kind==='before'){fault=null;return {data:null,error:{code:'SYNTHETIC'}};}
 const result=await client.rpc(name,args);events.push({name,state:result.data?.state,code:result.data?.code,error:result.error?.code||null});
 if(holdNext===name){holdNext=null;await new Promise(resolve=>{held=resolve;});}
 if(fault?.name===name&&!result.error){const kind=fault.kind;fault=null;if(kind==='malformed')return {data:{ok:true},error:null};throw Error('Synthetic lost committed result');}
 return result;
},from(table){assert(['HomePostcardCode','Home','User','HomeOwner','HomeOccupancy','HomeResidencyClaim','HomeRolePermission','HomePermissionOverride','HomeOwnershipClaim'].includes(table));return client.from(table);}});
const configure=enabled=>{
 if(enabled){process.env.HOME_POSTCARD_CODE_KEYS_JSON=JSON.stringify({fixture:Buffer.alloc(32,41).toString('base64')});process.env.HOME_POSTCARD_CODE_ACTIVE_KEY='fixture';}
 else{delete process.env.HOME_POSTCARD_CODE_KEYS_JSON;delete process.env.HOME_POSTCARD_CODE_ACTIVE_KEY;}
};
const state=()=>JSON.parse(sql(`SELECT json_build_object('cards',(SELECT coalesce(json_agg(json_build_object('id',id,'status',status,'attempts',attempts,'dispatch_status',dispatch_status)),'[]') FROM public."HomePostcardCode" WHERE home_id=${q(home)}),
 'requests',(SELECT coalesce(json_agg(json_build_object('request_id',request_id,'state',state,'postcard_id',postcard_id,'code',error_code)),'[]') FROM public."HomePostcardRequestCommand" WHERE home_id=${q(home)}),
 'verifications',(SELECT coalesce(json_agg(json_build_object('request_id',request_id,'state',state,'code',error_code)),'[]') FROM public."HomePostcardVerificationCommand" WHERE home_id=${q(home)}),
 'occupancy',(SELECT json_build_object('is_active',is_active,'verification_status',verification_status,'challenge_window_ends_at',challenge_window_ends_at) FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(actor)}));`));
f.app.get('/api/users/profile',async(_req,res)=>{const r=await client.from('User').select('id,email,username,name,role').eq('id',actor).single();assert(!r.error);res.json({...r.data,user:r.data});});
f.app.get('/fixture/state',(_req,res)=>res.json({...state(),events,held:!!held,provider_calls:f.postcardDeliveries.length,notifications:f.notifications.length}));
f.app.get('/fixture/code',(_req,res)=>res.json({code:f.postcardDeliveries.at(-1)?.code}));
f.app.post('/fixture/fault',(req,res)=>{assert([...functions,'home_record_context'].includes(req.body.name));assert(['before','lost','malformed'].includes(req.body.kind));fault=req.body;res.json({ok:true});});
f.app.post('/fixture/hold',(req,res)=>{assert(functions.includes(req.body.name));holdNext=req.body.name;res.json({ok:true});});
f.app.post('/fixture/release',(_req,res)=>{held?.();held=null;res.json({ok:true});});
f.app.post('/fixture/keys',(req,res)=>{assert.equal(typeof req.body.enabled,'boolean');configure(req.body.enabled);res.json({ok:true});});
f.app.post('/fixture/delivery',(req,res)=>{assert(['unknown','accepted','rejected'].includes(req.body.state));f.setPostcardResult(req.body.state==='accepted'?{success:true}:{success:false,deliveryUnknown:req.body.state==='unknown'});res.json({ok:true});});
f.app.post('/fixture/unit',(req,res)=>{assert(['602','603'].includes(req.body.unit));sql(`UPDATE public."Home" SET address2=${q(req.body.unit)} WHERE id=${q(home)};`);res.json({ok:true});});
f.app.post('/fixture/access',(req,res)=>{assert(['removed','verified','frozen','restored'].includes(req.body.state));
 if(req.body.state==='removed')sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
 if(req.body.state==='verified')sql(`UPDATE public."HomeOccupancy" SET is_active=true,verification_status='verified',verified_at=clock_timestamp(),verification_expires_at=clock_timestamp()+interval '365 days' WHERE home_id=${q(home)} AND user_id=${q(actor)};UPDATE public."HomeResidencyClaim" SET status='verified' WHERE home_id=${q(home)} AND user_id=${q(actor)};INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'home.view',true) ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=true;`);
 if(req.body.state==='frozen')sql(`UPDATE public."Home" SET security_state='frozen' WHERE id=${q(home)};`);
 if(req.body.state==='restored')sql(`UPDATE public."Home" SET security_state='normal' WHERE id=${q(home)};UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
 res.json({ok:true});});
f.app.post('/fixture/stop',(_req,res)=>{res.json({ok:true});void cleanup();});
async function cleanup(){
 if(closing)return;closing=true;held?.();held=null;
 if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
 if(initialized){fs.writeFileSync(path.join(evidence,'final-state.json'),JSON.stringify({...state(),events,provider_calls:f.postcardDeliveries.length,notifications:f.notifications.length},null,2),{mode:0o600});
  sql(`DELETE FROM public."HomePostcardVerificationCommand" WHERE home_id=${q(home)};DELETE FROM public."HomePostcardRequestCommand" WHERE home_id=${q(home)};`);f.cleanup();}
 if(schema){const drops=sql(`SELECT 'DROP FUNCTION '||oid::regprocedure::text||';' FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${functions.map(q)}) ORDER BY oid DESC;`);
  sql('BEGIN;'+before+';\n'+drops+'DROP TABLE public."HomePostcardVerificationCommand";DROP TABLE public."HomePostcardRequestCommand";'+"NOTIFY pgrst, 'reload schema';COMMIT;");}
 assert.equal(sql(definition),before);assert.equal(sql(properties),beforeProperties);assert.equal(sql('SELECT max(version) FROM supabase_migrations.schema_migrations;'),ledger);
 fs.writeFileSync(path.join(evidence,'cleanup.json'),JSON.stringify({exact_review_preserved:true,oid_owner_acl_config_preserved:true,ledger_preserved:true,fixtures_removed:true}),{mode:0o600});f.restoreModules();console.log('PASS: exact synthetic fixture and temporary schema cleanup; original review definition/properties and ledger preserved');
}
async function main(){try{
 assert.equal(sql(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${functions.map(q)});`),'0');
 assert.equal(sql(`SELECT to_regclass('public."HomePostcardRequestCommand"') IS NULL AND to_regclass('public."HomePostcardVerificationCommand"') IS NULL;`),'t');
 sql('BEGIN;'+['20260911050000_home_postcard_current_recovery.sql','20260912010000_home_postcard_verification_recovery.sql'].map(name=>fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8')).join('\n')+"NOTIFY pgrst, 'reload schema';COMMIT;");schema=true;
 f.setup();initialized=true;sql(`UPDATE public."Home" SET address2='602' WHERE id=${q(home)};UPDATE public."HomeResidencyClaim" SET claimed_address='Private residency fixture, 602',cold_start_mode='external_postcard' WHERE home_id=${q(home)} AND user_id=${q(actor)};UPDATE public."HomeOccupancy" SET role_base='restricted_member',verification_status='pending_postcard' WHERE home_id=${q(home)} AND user_id=${q(actor)};`);configure(true);
 for(let i=0;i<30;i++){const r=await client.rpc('get_home_postcard_current_status',{p_home_id:home,p_actor_id:actor});if(!r.error)break;if(i===29)throw Error('Owned schema cache unavailable');await new Promise(r=>setTimeout(r,100));}
 server=f.app.listen(port,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});console.log('READY: owned local postal UI fixture at '+port);
}catch(error){await cleanup();throw error;}}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>cleanup().catch(()=>{console.error('Fixture cleanup failed; inspect private evidence');process.exitCode=1;}));
main().catch(error=>{console.error(error);process.exitCode=1;});
