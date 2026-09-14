#!/usr/bin/env node
// Dedicated synthetic R03 candidate only. Production HTTP/services/SDK/SQL;
// loopback authentication, shell data and all delivery are controlled.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createHash,randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const [runtimePath,output,lease]=process.argv.slice(2);
assert.equal(lease,'--exclusive-lease');assert(path.isAbsolute(output)&&!output.startsWith(root+'/'));
fs.mkdirSync(output,{recursive:true,mode:0o700});
const runtime=JSON.parse(fs.readFileSync(runtimePath,'utf8'));
assert.equal(runtime.api_url,'http://127.0.0.1:18085');assert.match(runtime.database,/^home_member_removal_r03_[a-f0-9]{12}$/);
const hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(runtime.migration_sha256,hash(fs.readFileSync(path.join(root,'supabase/migrations/20260913010000_home_member_removal_recovery.sql'))));
const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
const f=require('./home-member-removal-route-fixture.cjs')(runtime.database_container,{database:runtime.database,summary:true,dashboard:true,invitations:true,tasks:true});
const {actor,home,users,sql,q}=f;
function dbSql(database,query){return execFileSync('docker',['exec','-i',runtime.database_container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe']}).trim();}
function preservation(database){
 const tables=JSON.parse(dbSql(database,"BEGIN READ ONLY;SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage','supabase_migrations') AND c.relkind='r';ROLLBACK;"));
 const ident=v=>'"'+v.replaceAll('"','""')+'"';
 const rows=tables.map(([s,t])=>`SELECT ${q(s)}::text schema_name,${q(t)}::text table_name,count(*) row_count,md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' ORDER BY to_jsonb(r)::text),'')) digest FROM ${ident(s)}.${ident(t)}r`).join(' UNION ALL ');
 return JSON.parse(dbSql(database,`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SELECT jsonb_build_object(
 'rows',(SELECT jsonb_agg(to_jsonb(t) ORDER BY schema_name,table_name) FROM (${rows})t),
 'functions',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind IN('f','p')),
 'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage','supabase_migrations')),
 'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a WHERE attrelid IN(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage','supabase_migrations'))),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE connamespace IN('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace,'supabase_migrations'::regnamespace)),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY oid) FROM pg_attrdef d WHERE adrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)));
 ROLLBACK;`));
}
// relpages/reltuples and statistics are operational estimates, not schema; they
// and freeze horizons can change through autovacuum without a schema mutation. Preserve catalog
// identity/columns/constraints/triggers/defaults and all complete logical rows.
function stable(value){const v=structuredClone(value);for(const r of v.relations){delete r.relpages;delete r.reltuples;delete r.relallvisible;delete r.relallfrozen;delete r.relfrozenxid;delete r.relminmxid;}return v;}
const before={candidate:preservation(runtime.database),retained:preservation('postgres')};save('preservation-before.json',before);
const events=[],capabilities=[],sessions=new Map(),latest=new Map();let sequence=0,server,initialized=false,stopping=false;
const faults=new Map(),held=new Map();
const profile=index=>({id:users[index],email:`residency-http-${index+1}@example.invalid`,username:`removal_fixture_${index}`,name:`Removal fixture ${index}`,firstName:'Removal',lastName:`Fixture ${index}`,accountType:'personal',account_type:'personal',role:'user',verified:true,createdAt:'2026-09-13T00:00:00Z',updatedAt:'2026-09-13T00:00:00Z'});
function issue(index){const token='pantopus-synthetic-removal-'+randomUUID();const session={index,id:'removal-session-'+randomUUID(),sequence:++sequence};sessions.set(token,session);latest.set(index,token);events.push({event:'login_session',actor:index,sequence:session.sequence});return {user:profile(index),accessToken:token,refreshToken:token+'-refresh',expiresIn:86400,sessionId:session.id,session:{id:session.id,context:'interactive'}};}
const bundle=()=>({home,home_name:'Member removal fixture',home_address:'Private residency fixture',member_removal_actual:true,protected_removal:true,database_scope:'synthetic_candidate',capabilities,actors:users.map((id,index)=>({index,id,email:profile(index).email,username:profile(index).username,name:null,auth_token:latest.get(index)||null}))});
const rows=(table,where=`home_id=${q(home)}`,omit=[])=>JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(r)${omit.map(k=>'-'+q(k)).join('')} ORDER BY to_jsonb(r)::text),'[]') FROM public."${table}"r WHERE ${where};`));
const state=()=>({events,member_removal_actual:true,controlled_notifications:f.notifications,controlled_email_attempts:f.invitationEmailAttempts,
 removal_commands:rows('HomeMemberRemovalCommand',`actor_user_id IN(${users.map(q)})`,['decision_token','intent_hash']),
 memberships:rows('HomeOccupancy'),claims:rows('HomeResidencyClaim'),review_receipts:rows('HomeResidencyReviewReceipt'),
 letters:rows('ResidencyLetter',undefined,['letter_code','pdf_base64']),scoped_grants:rows('HomeScopedGrant',undefined,['token_hash']),overrides:rows('HomePermissionOverride'),audit:rows('HomeAuditLog'),ownership:rows('HomeOwner'),
 sender_commands:rows('HomeInvitationSenderCommand',`actor_user_id IN(${users.map(q)})`,['intent_hash','decision_token','input_payload','capability_fingerprint']),
 commands:rows('HomeInvitationDecisionCommand',`actor_user_id IN(${users.map(q)})`,['intent_hash','token_hash','decision_token'])});
const fullState=()=>({occupancies:rows('HomeOccupancy'),claims:rows('HomeResidencyClaim'),review_receipts:rows('HomeResidencyReviewReceipt'),letters:rows('ResidencyLetter'),scoped_grants:rows('HomeScopedGrant'),overrides:rows('HomePermissionOverride'),audit:rows('HomeAuditLog'),ownership:rows('HomeOwner')});
function take(action,args={}){const found=faults.get(action);if(!found||found.target_id&&found.target_id!==args.p_target_id&&found.target_id!==args.p_intent?.target_user_id)return null;const current={...found};if(!found.persistent&&--found.remaining===0)faults.delete(action);return current;}
async function pause(action,kind){assert(!held.has(action));events.push({event:kind==='hold_before'?'held_before_rpc':'reply_held',action});const proceed=await new Promise(resolve=>held.set(action,resolve));events.push({event:proceed?'hold_released':'hold_discarded',action});if(!proceed)throw Error('Controlled discarded unresolved request');}
function release(action,proceed){assert(held.has(action));const resolve=held.get(action);held.delete(action);resolve(proceed);}
async function stop(){if(stopping)return;stopping=true;for(const action of [...held.keys()])release(action,false);if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});if(initialized){save('final-state.json',state());f.cleanup();}
 const after={candidate:preservation(runtime.database),retained:preservation('postgres')};save('preservation-after.json',after);assert.deepEqual(stable(after.candidate),stable(before.candidate));assert.deepEqual(stable(after.retained),stable(before.retained));
 save('cleanup.json',{fixtures_removed:true,complete_role_rows_restored:true,complete_ledger_preserved:true,exact_functions_properties_preserved:true,complete_populated_rows_schema_preserved:true,candidate_tables:before.candidate.rows.length,retained_tables:before.retained.rows.length,retained_catalog_preserved:true,candidate_database_retained:true});f.restoreModules();console.log('PASS: candidate fixture cleanup and retained full rows/catalog preservation');}
async function main(){
 const rawFetch=global.fetch;global.fetch=(input,options)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);assert(['127.0.0.1','localhost'].includes(u.hostname),'External acceptance traffic blocked');return rawFetch(input,options);};
 const {createClient}=require(path.join(root,'backend/node_modules/@supabase/supabase-js'));
 const client=createClient(runtime.api_url,runtime.service_role_key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,options)=>{const u=new URL(input);assert.equal(u.origin,runtime.api_url);assert(u.pathname.startsWith('/rest/v1/'));u.pathname=u.pathname.slice('/rest/v1'.length);return global.fetch(u,options);}}});
 f.useDatabaseClient({supabaseUrl:client.supabaseUrl,from:table=>client.from(table),async rpc(name,args){
  const action=name==='prepare_home_member_removal'?'removal_context':name==='get_home_member_removal'?'removal_read':name==='resolve_home_member_removal'?(args.p_cancel?'removal_cancel':'removal_submit'):name==='mutate_home_member'?'member_'+args.p_action:name;
  const current=take(action,args);if(current?.kind==='before'){events.push({event:'unavailable_before_rpc',action});return {data:null,error:{code:'SYNTHETIC_UNAVAILABLE'}};}
  if(current?.kind==='hold_before')await pause(action,'hold_before');
  const result=await client.rpc(name,args);events.push({event:'sdk_rpc',name,action,actor_id:args.p_actor_id,target_id:args.p_target_id||args.p_intent?.target_user_id,request_id:args.p_request_id,ok:result.data?.ok,state:result.data?.state,code:result.data?.code,replayed:result.data?.replayed,error:result.error?.code||null});
  if(name==='resolve_home_invitation_sender'&&result.data?.state==='completed'&&args.p_token&&!capabilities.some(c=>c.token===args.p_token)){const i=rows('HomeInvite',`id=${q(result.data.invitation_id)} AND home_id=${q(home)}`)[0];assert(i);capabilities.push({actor_id:i.invitee_user_id,token:args.p_token,invitation_id:i.id,sender_request_id:args.p_request_id});}
  if(current?.kind==='after'&&result.data?.ok){events.push({event:'lost_committed_reply',action,request_id:args.p_request_id,target_id:args.p_target_id||args.p_intent?.target_user_id});throw Error('Controlled lost committed reply');}
  if(current?.kind==='hold')await pause(action,'hold');return result;
 }});
 f.setup();initialized=true;
 sql(`UPDATE public."Home" SET name='Member removal fixture' WHERE id=${q(home)};`);
 for(let i=0;i<users.length;i++)sql(`UPDATE public."User" SET name=${q(profile(i).name)},username=${q(profile(i).username)} WHERE id=${q(users[i])};`);
 // Independent prior synthetic nonprimary owner can restore the first owner's
 // explicit deny through the actual supported permission endpoint. This setup
 // is not proof of ownership verification or of a positive renewal workflow.
 sql(`BEGIN;INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier) VALUES(${q(home)},${q(users[5])},'verified',false,'strong');
 INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,start_at) VALUES(${q(home)},${q(users[5])},'owner','owner','adult','verified',now()-interval '1 day');COMMIT;`);
 const express=require(path.join(root,'backend/node_modules/express')),app=express();app.use(express.json({verify(req,_res,buffer){req.exactBody=buffer.toString('utf8');}}));
 app.use(async(req,res,next)=>{try{
  res.set('Cache-Control','private, no-store');
  if(req.path==='/fixture/state')return res.json(state());if(req.path==='/fixture/full-state')return res.json(fullState());if(req.path==='/fixture/capabilities')return res.json(bundle());
  if(req.path==='/fixture/fault'){const {action,kind,target_id}=req.body;assert(['removal_context','removal_submit','removal_read','removal_cancel','member_remove','members','logout'].includes(action));assert(['before','after','hold_before','hold','clear'].includes(kind));if(target_id)assert(users.includes(target_id));const remaining=req.body.remaining??1;assert(Number.isInteger(remaining)&&remaining>=1&&remaining<=3);if(kind==='clear')faults.delete(action);else faults.set(action,{kind,target_id,remaining,persistent:req.body.persistent===true});return res.json({ok:true});}
  if(req.path==='/fixture/release'||req.path==='/fixture/discard'){release(req.body.action,req.path.endsWith('/release'));return res.json({ok:true});}
  if(req.path==='/fixture/stop'){res.json({ok:true});void stop().catch(()=>{console.error('Cleanup requires private inspection');process.exitCode=1;});return;}
  if(req.path==='/api/users/login'){const i=users.findIndex((_,index)=>profile(index).email===req.body.email);assert(i>=0);assert.equal(req.body.password,'synthetic-loopback-only');return res.json(issue(i));}
  const token=req.headers.authorization?.replace(/^Bearer /,''),session=sessions.get(token);
  if(!session)return res.status(401).json({error:'Synthetic sign-in required'});
  const index=session.index;req.headers['x-fixture-actor']=users[index];req.headers['x-fixture-session']=session.id;
  const safePath=req.path.replace(/\/(token|guest)\/[^/]+/g,'/$1/[redacted]');events.push({event:'request',method:req.method,path:safePath,actor:index,session_sequence:session.sequence,...(req.method==='POST'&&req.path.includes('/member-removals/commands')?{request_id:req.body.request_id||req.path.split('/').at(-2),request_hash:hash(req.exactBody)}:{})});
  res.once('finish',()=>events.push({event:'response',method:req.method,path:safePath,actor:index,session_sequence:session.sequence,status:res.statusCode,retry_after_present:res.hasHeader('Retry-After')}));
  if([`/api/homes/${home}/members`,`/api/homes/${home}/occupants`].includes(req.path)){const current=take('members');if(current?.kind==='before'){events.push({event:'members_refresh_unavailable'});return res.status(503).json({error:'Controlled current member read unavailable'});}}
  if(['/api/users/profile','/api/users/me'].includes(req.path))return res.json({user:profile(index),...profile(index)});
  if(req.path==='/api/hub')return res.json({user:profile(index),context:{activeHomeId:null,activePersona:{type:'personal'}},availability:{hasHome:false,hasBusiness:false,hasPayoutMethod:false},homes:[],businesses:[],setup:{steps:[],allDone:true,profileCompleteness:{score:100,checks:{firstName:true,lastName:true,photo:false,bio:false,skills:false},missingFields:[]}},statusItems:[],cards:{personal:{unreadChats:0,earnings:0,gigsNearby:0,rating:0,reviewCount:0}},jumpBackIn:[],activity:[]});
  if(req.path.endsWith('/unread-count'))return res.json({count:0,unread_count:0,unreadCount:0});if(req.path==='/api/notifications')return res.json({notifications:[],unreadCount:0,pagination:{page:1,totalPages:0,total:0}});
  if(req.path.includes('/logout')){sessions.delete(token);const current=take('logout');if(current?.kind==='hold')await pause('logout','hold');return res.json({success:true});}
  next();
 }catch(error){next(error);}});
 app.use(f.app);app.use((_req,res)=>res.status(404).json({error:'Outside removal acceptance scope'}));app.use((error,_req,res,_next)=>{events.push({event:'controlled_route_error',name:error.name});res.status(503).json({error:'Controlled removal service unavailable'});});
 server=app.listen(18084,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const auth=issue(0);for(const i of [1,2,3,4]){const response=await fetch(`http://127.0.0.1:18084/api/homes/${home}/claim/${f.claims[i-1]}/approve`,{method:'POST',headers:{Authorization:'Bearer '+auth.accessToken,'Content-Type':'application/json'},body:JSON.stringify({proposed_role:'member'})});assert.equal(response.status,200);const body=await response.json();assert.equal(body.claim.status,'verified');assert(body.receipt?.id);events.push({event:'initial_member_actual_review',index:i,receipt_id:body.receipt.id});}
 for(const i of [1,2,3,4])sql(`BEGIN;INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(users[i])},'docs.upload',false);
 INSERT INTO public."HomeScopedGrant"(id,home_id,grantee_user_id,resource_type,resource_id,end_at) VALUES(${q(f.id(700+i))},${q(home)},${q(users[i])},'HomeTask',${q(f.id(800+i))},NULL),(${q(f.id(710+i))},${q(home)},${q(users[i])},'HomeTask',${q(f.id(810+i))},clock_timestamp()-interval '1 day');
 INSERT INTO public."ResidencyLetter"(id,home_id,user_id,letter_code,resident_name,address_line1,pdf_sha256,pdf_base64,status,revoked_at,revoke_reason) VALUES(${q(f.id(720+i))},${q(home)},${q(users[i])},${q('removal-current-'+i)},'Synthetic','Synthetic','fixture','fixture','issued',NULL,NULL),(${q(f.id(730+i))},${q(home)},${q(users[i])},${q('removal-prior-'+i)},'Synthetic','Synthetic','fixture','fixture','revoked',clock_timestamp()-interval '1 day','owned_prior');COMMIT;`);
 const sourceNames=['scripts/db/home-member-removal-ui-fixture.cjs','scripts/db/home-member-removal-route-fixture.cjs','supabase/migrations/20260913010000_home_member_removal_recovery.sql',...fs.readdirSync(path.join(root,'backend/services')).filter(n=>n.startsWith('home')&&n.endsWith('.js')).map(n=>'backend/services/'+n),'backend/routes/home.js','backend/routes/homeIam.js','backend/routes/homeMemberRemovals.js','backend/utils/homePermissions.js','backend/utils/requestSessionScope.js'];
 save('source-binding.json',{root,runtime_database:runtime.database,scope:'Synthetic candidate committed workflow, not populated/hosted adoption',sources:Object.fromEntries(sourceNames.map(name=>[name,hash(fs.readFileSync(path.join(root,name)))]))});save('initial-state.json',state());save('capabilities.json',bundle());console.log('Owned protected removal fixture ready on loopback18084; real candidate SDK/SQL; controlled auth/delivery');
}
process.on('SIGTERM',()=>stop().catch(()=>{process.exitCode=1;}));process.on('SIGINT',()=>stop().catch(()=>{process.exitCode=1;}));
main().catch(async error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack),{mode:0o600});console.error('Fixture failed; private diagnostics retained');try{await stop();}catch{console.error('Cleanup requires private inspection');}process.exitCode=1;});
