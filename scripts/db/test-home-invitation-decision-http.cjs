#!/usr/bin/env node
// Production HTTP/services -> real local SDK/PostgREST/SQL. No hosted writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const [container,project,cli,evidence]=process.argv.slice(2);
assert.match(project||'',/^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(evidence||'')&&!evidence.startsWith(root+'/'));fs.mkdirSync(evidence,{recursive:true,mode:0o700});
const f=require('./home-residency-review-http-fixture.cjs')(container,{summary:true,dashboard:true,invitations:true});
const {sql,q,home,users,id}=f;
const migration=path.join(root,'supabase/migrations/20260912020000_home_invitation_decision_recovery.sql');
const functions=['home_invitation_decision_projection','prepare_home_invitation_decision','get_home_invitation_decision','resolve_home_invitation_decision'];
const save=(name,value)=>fs.writeFileSync(path.join(evidence,name),JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});
const provenanceQuery=`SELECT encode(sha256(convert_to(jsonb_build_object('ledger',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY version),'[]') FROM supabase_migrations.schema_migrations m),
 'relations',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',relname,'owner',relowner,'acl',relacl) ORDER BY oid) FROM pg_class WHERE relnamespace='public'::regnamespace),
 'functions',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'))::text,'UTF8')),'hex');`;
const policy=()=>JSON.parse(sql(`SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission"r;`));
const definition=()=>sql(`SELECT jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${functions.map(q)});`);
let server,initialized=false,migrated=false,rolesApplied=false,introduced=[],installed=[],before,rolesBefore,installedDefinitions,fault=null,failed=false;
const scopes=new Map(),events=[],capabilities=[];
const snapshot=()=>({commands:JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY request_id),'[]') FROM public."HomeInvitationDecisionCommand"c WHERE actor_user_id IN (${users.map(q)});`)),
 invitations:JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'accepted_by',accepted_by_user_id) ORDER BY id),'[]') FROM public."HomeInvite" WHERE home_id=${q(home)};`)),
 memberships:JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY user_id),'[]') FROM public."HomeOccupancy"o WHERE home_id=${q(home)};`)),
 audit:JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('action',action,'actor',actor_user_id) ORDER BY id),'[]') FROM public."HomeAuditLog" WHERE home_id=${q(home)};`))});
async function request(route,index=1,method='GET',body,scope=true,session='decision-fixture'){
 const headers={'Content-Type':'application/json','x-fixture-actor':users[index],'x-fixture-session':session};
 if(scope)headers['x-pantopus-session-scope']=typeof scope==='string'?scope:scopes.get(index);
 const r=await fetch(`http://127.0.0.1:${server.address().port}/api/homes${route}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const value=await r.json();events.push({route:route.replace(/\/token\/[^/]+/,'/token/[redacted]'),index,method,status:r.status,code:value.code,state:value.state});
 if(route.includes('/decisions')||route.endsWith('/decision-context'))assert.match(r.headers.get('cache-control'),/no-store/);
 return {status:r.status,body:value};
}
async function create(index){
 const r=await request(`/${home}/invite`,0,'POST',{relationship:'member',...(index===null?{}:{user_id:users[index]})},false);
 assert.equal(r.status,201);assert.equal(r.body.emailSent,false);assert(r.body.invitation.token);capabilities.push(r.body.invitation.token);return r.body.invitation;
}
async function prepare(inv,index){const r=await request(`/invitations/token/${inv.token}/decision-context`,index);assert.equal(r.status,200);return r.body;}
const body=(inv,context,number,action='accept')=>({request_id:id(number),token:inv.token,home_id:context.home_id,invitation_id:context.invitation_id,decision_token:context.decision_token,action});
const submit=(b,index=1,scope=true)=>request('/invitations/decisions',index,'POST',b,scope);
const read=(b,index=1)=>request(`/invitations/decisions/${b.request_id}`,index);
const cancel=(b,index=1)=>{const {request_id,...rest}=b;return request(`/invitations/decisions/${request_id}/cancel`,index,'POST',rest);};
const rowCount=()=>Number(sql(`SELECT count(*) FROM public."HomeInvitationDecisionCommand";`));
function removeHome(){sql(`BEGIN;DELETE FROM public."HomeInvite" WHERE home_id=${q(home)};DELETE FROM public."HomeAuditLog" WHERE home_id=${q(home)};
 DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};
 DELETE FROM public."HomeOwner" WHERE home_id=${q(home)};DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)};
 DELETE FROM public."Home" WHERE id=${q(home)};COMMIT;`);}
async function cleanup(){
 if(server)await new Promise(resolve=>server.close(resolve));
 if(initialized){save('final-state.json',snapshot());sql(`DELETE FROM public."HomeInvitationDecisionCommand" WHERE actor_user_id IN (${users.map(q)});`);removeHome();
  sql(`DELETE FROM public."User" WHERE id IN (${users.map(q)});DELETE FROM auth.users WHERE id IN (${users.map(q)});`);initialized=false;}
 // Never drop an unrelated trigger/function. The only test trigger is created
 // in a short, exception-safe phase below and removed before reaching cleanup.
 assert.equal(sql(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='invitation_decision_http_failure';`),'0');
 if(migrated){assert.equal(definition(),installedDefinitions);assert.equal(rowCount(),0);
  sql(`BEGIN;DROP FUNCTION public.resolve_home_invitation_decision(uuid,uuid,text,jsonb,boolean,integer),public.get_home_invitation_decision(uuid,uuid),public.prepare_home_invitation_decision(uuid,text),public.home_invitation_decision_projection(public."HomeInvitationDecisionCommand");DROP TABLE public."HomeInvitationDecisionCommand";NOTIFY pgrst,'reload schema';COMMIT;`);migrated=false;}
 if(rolesApplied){if(installed.length)sql(`BEGIN;LOCK TABLE public."HomeRolePermission" IN SHARE ROW EXCLUSIVE MODE;
  DO $$ BEGIN IF (SELECT count(*) FROM public."HomeRolePermission"r WHERE to_jsonb(r) IN (SELECT value FROM jsonb_array_elements(${q(JSON.stringify(installed))}::jsonb)))<>${installed.length} THEN RAISE EXCEPTION 'Fixture role rows changed';END IF;END $$;
  DELETE FROM public."HomeRolePermission"r WHERE to_jsonb(r) IN (SELECT value FROM jsonb_array_elements(${q(JSON.stringify(installed))}::jsonb));COMMIT;`);
  assert.deepEqual(policy(),rolesBefore);rolesApplied=false;}
 if(before)assert.equal(sql(provenanceQuery),before);
 save('cleanup.json',{complete_ledger_relations_functions_preserved:true,complete_role_rows_restored:true,owned_fixtures_removed:true});f.restoreModules();
}
async function main(){
 try{
  before=sql(provenanceQuery);rolesBefore=policy();save('preservation-before.json',{provenance_sha256:before,roles:rolesBefore});
  assert.equal(sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname='HomeInvitationDecisionCommand';`),'0');
  assert.equal(sql(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${[...functions,'invitation_decision_http_failure'].map(q)});`),'0');
  for(const role of ['admin','manager','member','restricted_member','guest']){const old=rolesBefore.find(r=>r.role_base===role&&r.permission==='home.view');if(old)assert.equal(old.allowed,true);else introduced.push(role);}
  sql('BEGIN;'+fs.readFileSync(path.join(root,'supabase/migrations/20260911030000_home_member_view_defaults.sql'),'utf8')+'COMMIT;');rolesApplied=true;
  installed=policy().filter(r=>r.permission==='home.view'&&introduced.includes(r.role_base));save('installed-role-rows.json',installed);
  sql('BEGIN;'+fs.readFileSync(migration,'utf8')+"NOTIFY pgrst,'reload schema';COMMIT;");migrated=true;installedDefinitions=definition();save('installed-functions.json',JSON.parse(installedDefinitions));
  assert.equal(sql(`SELECT count(*) FROM unnest(ARRAY['anon','authenticated'])r WHERE has_table_privilege(r,'public."HomeInvitationDecisionCommand"','SELECT') OR has_function_privilege(r,'public.resolve_home_invitation_decision(uuid,uuid,text,jsonb,boolean,integer)','EXECUTE');`),'0');
  let config;try{config=JSON.parse(execFileSync(cli,['status','--workdir',project,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}));}catch{throw Error('Owned SDK configuration unavailable');}
  assert.equal(config.API_URL,'http://127.0.0.1:64521');
  const rawFetch=global.fetch;global.fetch=(input,options)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);assert(['127.0.0.1','localhost'].includes(u.hostname));return rawFetch(input,options);};
  const client=require(path.join(root,'backend/node_modules/@supabase/supabase-js')).createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  f.useDatabaseClient({supabaseUrl:client.supabaseUrl,from:table=>client.from(table),async rpc(name,args){const r=await client.rpc(name,args);
   if(fault?.name===name){const kind=fault.kind;fault=null;if(kind==='after'&&r.data?.state==='completed')throw Error('Controlled lost committed invitation decision');
    if(kind==='malformed')return {data:{ok:true,state:'completed'},error:null};if(kind==='unavailable')return {data:null,error:{code:'SYNTHETIC_UNAVAILABLE'}};}
   return r;}});
  f.setup();initialized=true;sql(`DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)} AND user_id<>${q(users[0])};DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id<>${q(users[0])};`);
  server=f.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  for(let index=0;index<users.length;index++){const r=await request('/invitations/decisions/session',index,'GET',undefined,false);assert.equal(r.status,200);assert.equal(r.body.session.actor_id,users[index]);scopes.set(index,r.body.session.session_scope);}
  const invites=[];for(const index of [1,2,3])invites[index]=await create(index);
  const c1=await prepare(invites[1],1),a=body(invites[1],c1,701);
  const n=rowCount();assert.equal((await submit(a,1,false)).status,409);assert.equal((await submit(a,1,scopes.get(2))).status,409);assert.equal((await request('/invitations/decisions',1,'POST',a,true,'changed-session')).status,409);assert.equal(rowCount(),n);
  const wrong=await request(`/invitations/token/${invites[1].token}/decision-context`,2);assert.equal(wrong.status,403);
  fault={name:'resolve_home_invitation_decision',kind:'after'};assert.equal((await submit(a)).status,503);
  const accepted=await read(a);assert.equal(accepted.status,200);assert.equal(accepted.body.state,'completed');assert.equal(accepted.body.current_access,'not_checked');
  assert.equal((await submit(a)).status,200);assert.equal((await cancel(a)).body.state,'completed');
  assert.equal((await read(a,2)).status,404);assert.equal((await submit({...a,action:'decline'})).status,409);
  assert.equal(sql(`SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=${q(home)} AND action='HOME_INVITE_ACCEPTED';`),'1');
  sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(users[1])},'home.view',false);`);
  assert.equal((await request(`/${home}`,1)).status,403);assert.deepEqual((await read(a)).body,accepted.body);
  sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(users[1])};`);
  assert.equal((await submit(a)).body.state,'completed');assert.equal((await request(`/${home}`,1)).status,403);
  for(const kind of ['malformed','unavailable']){fault={name:'get_home_invitation_decision',kind};assert.equal((await read(a)).status,503);assert.deepEqual((await read(a)).body,accepted.body);}
  console.log('PASS: account/session binding, lost reply, exact replay after denied/removed access, failed reads');
  const c2=await prepare(invites[2],2),b=body(invites[2],c2,711);
  assert.equal((await cancel(b,2)).body.state,'cancelled');assert.equal((await submit(b,2)).body.state,'cancelled');assert.equal((await submit({...b,action:'decline'},2)).status,409);
  const b2=body(invites[2],c2,712);
  sql(`CREATE FUNCTION public.invitation_decision_http_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id=${q(b2.request_id)}::uuid AND NEW.state='completed' THEN RAISE EXCEPTION 'Controlled receipt failure'; END IF;RETURN NEW;END $$;
   CREATE TRIGGER invitation_decision_http_failure BEFORE UPDATE ON public."HomeInvitationDecisionCommand" FOR EACH ROW EXECUTE FUNCTION public.invitation_decision_http_failure();`);
  try{assert.equal((await submit(b2,2)).status,503);assert.equal((await read(b2,2)).status,404);assert.equal(sql(`SELECT status FROM public."HomeInvite" WHERE id=${q(invites[2].id)};`),'pending');assert.equal(sql(`SELECT count(*) FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(users[2])};`),'0');}
  finally{sql('DROP TRIGGER invitation_decision_http_failure ON public."HomeInvitationDecisionCommand";DROP FUNCTION public.invitation_decision_http_failure();');}
  const race=await Promise.all([submit(b2,2),submit({...b2,action:'decline'},2),cancel(b2,2)]);
  const winner=(await read(b2,2)).body;assert(['completed','cancelled'].includes(winner.state));
  for(const r of race){if(r.status===409)assert.equal(r.body.code,'INVITE_DECISION_CONFLICT');else{assert.equal(r.body.action,winner.action);assert.equal(r.body.state,winner.state);}}
  const won=winner.state+'-'+winner.action,original={...b2,action:winner.action};
  assert.equal((await submit(original,2)).body.state,winner.state);assert.equal((await cancel(original,2)).body.state,winner.state);
  assert.equal(sql(`SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=${q(home)} AND actor_user_id=${q(users[2])} AND action IN ('HOME_INVITE_ACCEPTED','HOME_INVITE_REVOKED');`),winner.state==='completed'?'1':'0');
  console.log('PASS: unseen cancellation tombstone, opposite-intent collision, receipt rollback and submit/cancel race');
  const c3=await prepare(invites[3],3),c=body(invites[3],c3,721);
  sql(`UPDATE public."HomeInvite" SET access_start_at=clock_timestamp()+interval '1 day' WHERE id=${q(invites[3].id)};`);
  const changed=await submit(c,3);assert.equal(changed.status,409);assert.equal(changed.body.code,'INVITE_DECISION_CHANGED');assert.equal(changed.body.state,'rejected');assert.equal((await submit(c,3)).body.state,'rejected');
  const cNew=body(invites[3],await prepare(invites[3],3),722,'decline');fault={name:'resolve_home_invitation_decision',kind:'after'};assert.equal((await submit(cNew,3)).status,503);
  assert.equal((await read(cNew,3)).body.action,'decline');assert.equal((await read(cNew,3)).body.state,'completed');assert.equal(sql(`SELECT status FROM public."HomeInvite" WHERE id=${q(invites[3].id)};`),'revoked');
  const open=await create(null),d=body(open,await prepare(open,4),731,'decline');assert.equal((await submit(d,4)).status,201);
  assert.equal(sql(`SELECT status FROM public."HomeInvite" WHERE id=${q(open.id)};`),'pending');assert.equal((await submit(d,4)).body.state,'completed');
  const stolen={...d,request_id:id(732),action:'accept'};assert.equal((await submit(stolen,5)).body.code,'INVITE_DECISION_CHANGED');
  const e=body(open,await prepare(open,5),733);assert.equal((await submit(e,5)).status,201);assert.equal((await read(d,4)).body.action,'decline');
  assert.equal(sql(`SELECT count(*) FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(users[4])};`),'0');
  console.log('PASS: changed terms rejection and retained viewer decline without revoking an open invitation');
  const beforeDelete=snapshot();save('accepted-state.json',beforeDelete);
  for(const secret of capabilities)assert(!JSON.stringify(beforeDelete.commands).includes(secret));
  assert(!JSON.stringify(accepted.body).includes('home_label'));assert(!JSON.stringify(accepted.body).includes('token_hash'));
  removeHome();assert.deepEqual((await read(a)).body,accepted.body);assert.equal((await submit(a)).body.state,'completed');assert.equal(sql(`SELECT count(*) FROM public."Home" WHERE id=${q(home)};`),'0');assert.equal((await request(`/${home}`,1)).status,403);
  save('result.json',{passed:true,real_http_sdk_sql:true,session_binding:true,terms_binding:true,lost_reply_recovery:true,current_access_separate:true,
   cancellation_and_receipt_rollback:true,submit_cancel_race:won,open_link_viewer_decline:true,deleted_home_history_preserved:true,command_count:beforeDelete.commands.length});
  console.log('PASS: deleted-Home history survives without restoring membership or retaining private invitation fields');
 }catch(error){failed=true;fs.writeFileSync(path.join(evidence,'failure.txt'),String(error.stack),{mode:0o600});console.error('Invitation decision acceptance failed; private diagnostics retained');}
 finally{save('events.json',events);try{await cleanup();console.log('PASS: exact fixtures, role rows, full ledger and schema provenance restored');}catch(error){failed=true;fs.writeFileSync(path.join(evidence,'cleanup-failure.txt'),String(error.stack),{mode:0o600});console.error('Exact cleanup needs inspection; private diagnostics retained');}}
 if(failed)process.exitCode=1;
}
main();
