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
const migration=path.join(root,'supabase/migrations/20260912040000_home_invitation_sender_recovery.sql');
const decisionMigration=path.join(root,'supabase/migrations/20260912020000_home_invitation_decision_recovery.sql');
const functions=['home_invitation_sender_projection','prepare_home_invitation_sender','list_home_invitation_sender','get_home_invitation_sender','resolve_home_invitation_sender','claim_home_invitation_sender_delivery','record_home_invitation_sender_delivery','home_invitation_decision_projection','prepare_home_invitation_decision','get_home_invitation_decision','resolve_home_invitation_decision'];
const save=(name,value)=>fs.writeFileSync(path.join(evidence,name),JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});
const provenanceQuery=`SELECT encode(sha256(convert_to(jsonb_build_object('ledger',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY version),'[]') FROM supabase_migrations.schema_migrations m),
 'relations',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',relname,'owner',relowner,'acl',relacl) ORDER BY oid) FROM pg_class WHERE relnamespace='public'::regnamespace),
 'functions',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'))::text,'UTF8')),'hex');`;
const policy=()=>JSON.parse(sql(`SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission"r;`));
const definition=()=>sql(`SELECT jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${functions.map(q)});`);
let server,initialized=false,migrated=false,rolesApplied=false,introduced=[],installed=[],before,rolesBefore,installedDefinitions,originalAct,fault=null,failed=false;
const scopes=new Map(),events=[],capabilities=[];
const snapshot=()=>({commands:JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY request_id),'[]') FROM public."HomeInvitationSenderCommand"c WHERE actor_user_id IN (${users.map(q)});`)),
 invitations:JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'accepted_by',accepted_by_user_id) ORDER BY id),'[]') FROM public."HomeInvite" WHERE home_id=${q(home)};`)),
 memberships:JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY user_id),'[]') FROM public."HomeOccupancy"o WHERE home_id=${q(home)};`)),
 audit:JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('action',action,'actor',actor_user_id) ORDER BY id),'[]') FROM public."HomeAuditLog" WHERE home_id=${q(home)};`))});
async function request(route,index=1,method='GET',body,scope=true,session='decision-fixture'){
 const headers={'Content-Type':'application/json','x-fixture-actor':users[index],'x-fixture-session':session};
 if(scope)headers['x-pantopus-session-scope']=typeof scope==='string'?scope:scopes.get(index);
 const r=await fetch(`http://127.0.0.1:${server.address().port}/api/homes${route}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const value=await r.json();events.push({route:route.replace(/\/token\/[^/]+/,'/token/[redacted]'),index,method,status:r.status,code:value.code,state:value.state});
 if(route.includes('/sender/')||route.includes('/decisions')||route.endsWith('/decision-context'))assert.match(r.headers.get('cache-control'),/no-store/);
 return {status:r.status,body:value};
}
async function context(intent,index=0){const r=await request('/invitations/sender/context',index,'POST',intent);assert.equal(r.status,200);return r.body;}
async function original(intent,n,index=0){const c=await context(intent,index);const token=intent.action==='withdraw'?null:require('crypto').randomBytes(32).toString('hex');if(token)capabilities.push(token);return {request_id:id(n),token,...intent,decision_token:c.decision_token};}
const submit=(b,index=0,scope=true)=>request('/invitations/sender/commands',index,'POST',b,scope);
const read=(b,index=0)=>request(`/invitations/sender/commands/${b.request_id}`,index);
const cancel=(b,index=0)=>{const {request_id,...rest}=b;return request(`/invitations/sender/commands/${request_id}/cancel`,index,'POST',rest);};
const createIntent=index=>({home_id:home,action:'create',payload:{relationship:'member',...(index===null?{}:{user_id:users[index]})}});
const targetIntent=(action,invitation_id)=>({home_id:home,action,invitation_id});
const rowCount=()=>Number(sql(`SELECT count(*) FROM public."HomeInvitationSenderCommand";`));
function removeHome(){sql(`BEGIN;DELETE FROM public."HomeInvite" WHERE home_id=${q(home)};DELETE FROM public."HomeAuditLog" WHERE home_id=${q(home)};
 DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};
 DELETE FROM public."HomeOwner" WHERE home_id=${q(home)};DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)};
 DELETE FROM public."Home" WHERE id=${q(home)};COMMIT;`);}
async function cleanup(){
 if(server)await new Promise(resolve=>server.close(resolve));
 if(initialized){save('final-state.json',snapshot());sql(`DELETE FROM public."HomeInvitationSenderCommand" WHERE actor_user_id IN (${users.map(q)});`);sql(`DELETE FROM public."HomeInvitationDecisionCommand" WHERE actor_user_id IN (${users.map(q)});`);removeHome();
  sql(`DELETE FROM public."User" WHERE id IN (${users.map(q)});DELETE FROM auth.users WHERE id IN (${users.map(q)});`);initialized=false;}
 // Never drop an unrelated trigger/function. The only test trigger is created
 // in a short, exception-safe phase below and removed before reaching cleanup.
 assert.equal(sql(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='invitation_sender_http_failure';`),'0');
 if(migrated){assert.deepEqual(JSON.parse(definition()),JSON.parse(installedDefinitions));assert.equal(rowCount(),0);
  sql(`BEGIN;DROP FUNCTION public.resolve_home_invitation_sender(uuid,uuid,text,jsonb,boolean),public.get_home_invitation_sender(uuid,uuid),public.prepare_home_invitation_sender(uuid,jsonb),public.list_home_invitation_sender(uuid,uuid),public.claim_home_invitation_sender_delivery(uuid,uuid,text),public.record_home_invitation_sender_delivery(uuid,uuid,text,text),public.home_invitation_sender_projection(public."HomeInvitationSenderCommand");
  DROP FUNCTION public.resolve_home_invitation_decision(uuid,uuid,text,jsonb,boolean,integer),public.get_home_invitation_decision(uuid,uuid),public.prepare_home_invitation_decision(uuid,text),public.home_invitation_decision_projection(public."HomeInvitationDecisionCommand");
  ${originalAct};
  DROP TABLE public."HomeInvitationSenderCommand",public."HomeInvitationDecisionCommand",public."HomeInvitationCapability";NOTIFY pgrst,'reload schema';COMMIT;`);migrated=false;}
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
  assert.equal(sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('HomeInvitationSenderCommand','HomeInvitationDecisionCommand','HomeInvitationCapability');`),'0');
  assert.equal(sql(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${[...functions,'invitation_sender_http_failure'].map(q)});`),'0');
  originalAct=sql(`SELECT pg_get_functiondef('public.act_on_home_invitation(uuid,text,uuid,text,integer)'::regprocedure);`);save('original-recipient-function.json',originalAct);
  for(const role of ['admin','manager','member','restricted_member','guest']){const old=rolesBefore.find(r=>r.role_base===role&&r.permission==='home.view');if(old)assert.equal(old.allowed,true);else introduced.push(role);}
  sql('BEGIN;'+fs.readFileSync(path.join(root,'supabase/migrations/20260911030000_home_member_view_defaults.sql'),'utf8')+'COMMIT;');rolesApplied=true;
  installed=policy().filter(r=>r.permission==='home.view'&&introduced.includes(r.role_base));save('installed-role-rows.json',installed);
  sql('BEGIN;'+fs.readFileSync(decisionMigration,'utf8')+fs.readFileSync(migration,'utf8')+"NOTIFY pgrst,'reload schema';COMMIT;");migrated=true;installedDefinitions=definition();save('installed-functions.json',JSON.parse(installedDefinitions));
  assert.equal(sql(`SELECT count(*) FROM unnest(ARRAY['anon','authenticated'])r WHERE has_table_privilege(r,'public."HomeInvitationSenderCommand"','SELECT') OR has_table_privilege(r,'public."HomeInvitationCapability"','SELECT') OR has_function_privilege(r,'public.resolve_home_invitation_sender(uuid,uuid,text,jsonb,boolean)','EXECUTE');`),'0');
  let config;try{config=JSON.parse(execFileSync(cli,['status','--workdir',project,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}));}catch{throw Error('Owned SDK configuration unavailable');}
  assert.equal(config.API_URL,'http://127.0.0.1:64521');
  const rawFetch=global.fetch;global.fetch=(input,options)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);assert(['127.0.0.1','localhost'].includes(u.hostname));return rawFetch(input,options);};
  const client=require(path.join(root,'backend/node_modules/@supabase/supabase-js')).createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  f.useDatabaseClient({supabaseUrl:client.supabaseUrl,from:table=>client.from(table),async rpc(name,args){const r=await client.rpc(name,args);
   if(fault?.name===name){const kind=fault.kind;fault=null;if((kind==='after'&&r.data?.state==='completed')||(kind==='after_claim'&&r.data?.dispatch===true))throw Error('Controlled lost committed sender reply');
    if(kind==='malformed')return {data:{ok:true,state:'completed'},error:null};if(kind==='unavailable')return {data:null,error:{code:'SYNTHETIC_UNAVAILABLE'}};}
   return r;}});
  f.setup();initialized=true;sql(`DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)} AND user_id<>${q(users[0])};DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id<>${q(users[0])};`);
  server=f.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  for(let index=0;index<users.length;index++){const r=await request('/invitations/sender/session',index,'GET',undefined,false);assert.equal(r.status,200);assert.equal(r.body.session.actor_id,users[index]);scopes.set(index,r.body.session.session_scope);}
  assert.equal((await request('/invitations/sender/context',1,'POST',createIntent(2))).status,403);
  const missingUsername=await request('/invitations/sender/context',0,'POST',{home_id:home,action:'create',payload:{username:'missing_synthetic_username'}});assert.equal(missingUsername.status,404);
  sql(`UPDATE public."User" SET username='RESIDENCY_HTTP_04' WHERE id=${q(users[5])};`);
  assert.equal((await request('/invitations/sender/context',0,'POST',{home_id:home,action:'create',payload:{username:'residency_http_04'}})).status,404);
  sql(`UPDATE public."User" SET username='residency_http_06' WHERE id=${q(users[5])};`);
  const a=await original(createIntent(1),801);const initialMembers=snapshot().memberships;
  assert.equal((await submit(a,0,false)).status,409);assert.equal((await submit(a,0,scopes.get(1))).status,409);
  assert.equal((await request('/invitations/sender/commands',0,'POST',a,true,'changed-session')).status,409);assert.equal(rowCount(),0);
  fault={name:'resolve_home_invitation_sender',kind:'after'};assert.equal((await submit(a)).status,503);
  const created=await read(a);assert.equal(created.status,200);assert.equal(created.body.state,'completed');assert.equal(created.body.delivery.email,'unconfirmed');assert.equal(f.notifications.length,0);
  assert.deepEqual(snapshot().memberships,initialMembers);assert.equal((await submit(a)).status,200);assert.equal((await cancel(a)).body.state,'completed');assert.equal(f.notifications.length,0);
  assert.equal((await read(a,1)).status,404);assert.equal((await submit({...a,token:'c'.repeat(64)})).body.code,'INVITE_SENDER_CONFLICT');
  assert.equal(sql(`SELECT count(*) FROM public."HomeInvite" WHERE home_id=${q(home)};`),'1');
  for(const kind of ['malformed','unavailable']){fault={name:'get_home_invitation_sender',kind};assert.equal((await read(a)).status,503);assert.deepEqual((await read(a)).body,created.body);}
  console.log('PASS: current authority, session/account binding, saved create lost reply, conservative delivery, immutable replay and failed reads');
  const tombstone=await original(createIntent(2),802);assert.equal((await cancel(tombstone)).body.state,'cancelled');assert.equal((await submit(tombstone)).body.state,'cancelled');
  const b=await original(createIntent(2),803);
  sql(`CREATE FUNCTION public.invitation_sender_http_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id=${q(b.request_id)}::uuid AND NEW.state='completed' THEN RAISE EXCEPTION 'Controlled receipt failure'; END IF;RETURN NEW;END $$;
   CREATE TRIGGER invitation_sender_http_failure BEFORE UPDATE ON public."HomeInvitationSenderCommand" FOR EACH ROW EXECUTE FUNCTION public.invitation_sender_http_failure();`);
  try{assert.equal((await submit(b)).status,503);assert.equal((await read(b)).status,404);assert.equal(sql(`SELECT count(*) FROM public."HomeInvite" WHERE home_id=${q(home)};`),'1');}
  finally{sql('DROP TRIGGER invitation_sender_http_failure ON public."HomeInvitationSenderCommand";DROP FUNCTION public.invitation_sender_http_failure();');}
  const race=await Promise.all([submit(b),cancel(b),submit({...b,payload:{...b.payload,message:'different original'}})]);
  const winner=(await read(b)).body;assert(['completed','cancelled'].includes(winner.state));
  for(const r of race){if(r.status===409)assert.equal(r.body.code,'INVITE_SENDER_CONFLICT');else assert.equal(r.body.state,winner.state);}
  if(winner.state==='completed')assert.equal((await submit(b)).body.state,'completed');
  const changed=await original(createIntent(3),804);sql(`UPDATE public."Home" SET name='Changed sender terms' WHERE id=${q(home)};`);
  assert.equal((await submit(changed)).body.code,'INVITE_SENDER_CHANGED');assert.equal((await read(changed)).body.state,'rejected');sql(`UPDATE public."Home" SET name=NULL WHERE id=${q(home)};`);
  console.log('PASS: unseen cancellation, changed original conflict, receipt-write rollback, concurrent submission/cancel and changed prepared terms');
  const invitationId=created.body.invitation_id;
  const recipientPrepared=await request(`/invitations/token/${a.token}/decision-context`,1);assert.equal(recipientPrepared.status,200);
  const listed=await request(`/${home}/invitations`,0);assert.equal(listed.status,200);
  const listedTarget=listed.body.invitations.find(i=>i.id===invitationId);assert.equal(listedTarget.invitee.id,users[1]);assert.equal(listedTarget.invitee.username,'residency_http_02');
  const identityContext=await context(targetIntent('resend',invitationId));assert.equal(identityContext.invitation.invitee.id,users[1]);
  const identityIntent={request_id:id(815),token:require('crypto').randomBytes(32).toString('hex'),...targetIntent('resend',invitationId),decision_token:identityContext.decision_token};capabilities.push(identityIntent.token);
  sql(`UPDATE public."User" SET name='Changed recipient label' WHERE id=${q(users[1])};`);
  assert.equal((await submit(identityIntent)).body.code,'INVITE_SENDER_CHANGED');sql(`UPDATE public."User" SET name='Residency fixture' WHERE id=${q(users[1])};`);
  const resend=await original(targetIntent('resend',invitationId),805);f.setInvitationDelivery({success:true},true);
  const resent=await submit(resend);assert.equal(resent.status,201);assert.deepEqual(resent.body.delivery,{email:'provider_accepted',in_app:'saved'});const notifications=f.notifications.length;
  assert.equal((await submit(resend)).status,200);assert.equal(f.notifications.length,notifications);assert.deepEqual((await read(resend)).body,resent.body);
  const afterResend=await request(`/invitations/token/${a.token}/decision-context`,1);assert.equal(afterResend.body.decision_token,recipientPrepared.body.decision_token);
  const aliasPrepared=await request(`/invitations/token/${resend.token}/decision-context`,1);assert.equal(aliasPrepared.body.decision_token,recipientPrepared.body.decision_token);
  assert.equal(sql(`SELECT count(*) FROM public."HomeInvitationCapability" WHERE invitation_id=${q(invitationId)};`),'1');
  const withdrawPrepared=await original(targetIntent('withdraw',invitationId),806);
  const rp=recipientPrepared.body;const accepted=await request('/invitations/decisions',1,'POST',{request_id:id(880),token:a.token,home_id:home,invitation_id:invitationId,action:'accept',decision_token:rp.decision_token});assert.equal(accepted.status,201);
  const acceptedMember=sql(`SELECT to_jsonb(o) FROM public."HomeOccupancy"o WHERE home_id=${q(home)} AND user_id=${q(users[1])};`);
  const resolvedWithdraw=await submit(withdrawPrepared);assert.equal(resolvedWithdraw.body.state,'rejected');assert.equal(resolvedWithdraw.body.code,'INVITE_ALREADY_USED');
  assert.equal(sql(`SELECT to_jsonb(o) FROM public."HomeOccupancy"o WHERE home_id=${q(home)} AND user_id=${q(users[1])};`),acceptedMember);
  console.log('PASS: explicit resend proof, no replay delivery, old/alias links preserve prepared recipient decisions, resolved withdrawal preserves membership');
  f.setInvitationDelivery({success:false},false);
  const userCreate=await original({home_id:home,action:'create',payload:{username:'residency_http_04',relationship:'member'}},807);
  const userCreated=await submit(userCreate);assert.equal(userCreated.status,201);
  assert.equal(sql(`SELECT invitee_user_id FROM public."HomeInvite" WHERE id=${q(userCreated.body.invitation_id)};`),users[3]);
  const withdraw=await original(targetIntent('withdraw',userCreated.body.invitation_id),808);
  const lostResend=await original(targetIntent('resend',userCreated.body.invitation_id),809);
  fault={name:'resolve_home_invitation_sender',kind:'after'};assert.equal((await submit(lostResend)).status,503);assert.equal((await read(lostResend)).body.state,'completed');
  fault={name:'resolve_home_invitation_sender',kind:'after'};assert.equal((await submit(withdraw)).status,503);assert.equal((await read(withdraw)).body.state,'completed');
  assert.equal((await cancel(withdraw)).body.state,'completed');
  for(const token of [userCreate.token,lostResend.token]){const p=await request(`/invitations/token/${token}`,3,'GET',undefined,false);assert.equal(p.body.invitation.status,'revoked');}
  assert.equal(sql(`SELECT count(*) FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(users[3])};`),'0');
  const claimLost=await original({home_id:home,action:'create',payload:{email:'sender-claim-lost@example.invalid',relationship:'member'}},813);
  const emailCount=f.invitationEmailAttempts.length;fault={name:'claim_home_invitation_sender_delivery',kind:'after_claim'};
  const claimLostSaved=await submit(claimLost);assert.equal(claimLostSaved.body.state,'completed');assert.equal(claimLostSaved.body.delivery.email,'unconfirmed');assert.equal(f.invitationEmailAttempts.length,emailCount);
  assert.equal((await submit(claimLost)).body.state,'completed');assert.equal(f.invitationEmailAttempts.length,emailCount);
  assert.equal(sql(`SELECT dispatch_claimed::text||':'||delivery_recorded::text FROM public."HomeInvitationSenderCommand" WHERE request_id=${q(claimLost.request_id)};`),'true:false');
  const outcomeLost=await original({home_id:home,action:'create',payload:{email:'sender-proof-lost@example.invalid',relationship:'member'}},814);
  f.setInvitationDelivery({success:true},false);fault={name:'record_home_invitation_sender_delivery',kind:'after'};
  const outcomeUnknown=await submit(outcomeLost);assert.equal(outcomeUnknown.body.state,'completed');assert.equal(outcomeUnknown.body.delivery.email,'unconfirmed');
  assert.equal((await read(outcomeLost)).body.delivery.email,'provider_accepted');assert.equal(f.invitationEmailAttempts.length,emailCount+1);
  assert.equal((await submit(outcomeLost)).body.delivery.email,'provider_accepted');assert.equal(f.invitationEmailAttempts.length,emailCount+1);
  console.log('PASS: lost one-shot delivery claim sends nothing; lost proof reply recovers provider handoff without another send');
  const expiredCreate=await original({home_id:home,action:'create',payload:{email:'expired-sender@example.invalid',relationship:'member'}},816);
  const expiredCreated=await submit(expiredCreate);assert.equal(expiredCreated.status,201);
  sql(`UPDATE public."HomeInvite" SET expires_at=clock_timestamp()-interval '1 minute' WHERE id=${q(expiredCreated.body.invitation_id)};`);
  assert((await request(`/${home}/invitations`,0)).body.invitations.some(i=>i.id===expiredCreated.body.invitation_id));
  assert.equal((await request('/invitations/sender/context',0,'POST',targetIntent('resend',expiredCreated.body.invitation_id))).status,410);
  const expiredWithdraw=await original(targetIntent('withdraw',expiredCreated.body.invitation_id),817);assert.equal((await submit(expiredWithdraw)).body.state,'completed');
  sql(`INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier) VALUES(${q(home)},${q(users[5])},'verified',false,'strong');`);
  const formerSenderCreate=await original(createIntent(4),818,5);const formerCreated=await submit(formerSenderCreate,5);assert.equal(formerCreated.status,201);
  sql(`DELETE FROM public."HomeOwner" WHERE home_id=${q(home)} AND subject_id=${q(users[5])};`);
  assert((await request(`/${home}/invitations`,0)).body.invitations.some(i=>i.id===formerCreated.body.invitation_id));
  assert.equal((await request('/invitations/sender/context',0,'POST',targetIntent('resend',formerCreated.body.invitation_id))).body.code,'INVITER_ACCESS_CHANGED');
  const formerWithdraw=await original(targetIntent('withdraw',formerCreated.body.invitation_id),819);assert.equal((await submit(formerWithdraw)).body.state,'completed');
  console.log('PASS: safe recipient labels bind reviewed identity; expired and former-inviter pending rows remain visible for authorized withdrawal');
  // Older accepted invitations may lack an admission snapshot and keep a
  // display role separate from the canonical role used by recipient admission.
  const legacyCreate=await original(createIntent(3),820);const legacyCreated=await submit(legacyCreate);assert.equal(legacyCreated.status,201);
  const legacyId=legacyCreated.body.invitation_id;
  sql(`UPDATE public."HomeInvite" SET admission_policy=NULL,proposed_role='guest',proposed_role_base='member' WHERE id=${q(legacyId)};`);
  const legacyBefore=sql(`SELECT to_jsonb(i) FROM public."HomeInvite"i WHERE id=${q(legacyId)};`),membersBeforeLegacy=snapshot().memberships;
  const legacyRecipient=await request(`/invitations/token/${legacyCreate.token}/decision-context`,3);assert.equal(legacyRecipient.status,200);
  const legacyContext=await context(targetIntent('resend',legacyId));assert.equal(legacyContext.invitation.proposed_role_base,'member');assert.equal(legacyContext.invitation.proposed_role,'guest');
  const legacyResend=await original(targetIntent('resend',legacyId),821);assert.equal((await submit(legacyResend)).status,201);
  assert.equal(f.invitationEmailAttempts.at(-1).role,'member');
  assert.equal(sql(`SELECT to_jsonb(i) FROM public."HomeInvite"i WHERE id=${q(legacyId)};`),legacyBefore);assert.deepEqual(snapshot().memberships,membersBeforeLegacy);
  assert.equal((await request(`/invitations/token/${legacyResend.token}/decision-context`,3)).body.decision_token,legacyRecipient.body.decision_token);
  for(const [change,code] of [
   ["proposed_role_base=NULL,proposed_role='unrecognized_legacy_role'",'INVITE_POLICY_CHANGED'],
   ["admission_policy='{}'::jsonb",'INVITE_POLICY_CHANGED'],
   ["proposed_role_base='owner'",'OWNERSHIP_FLOW_REQUIRED'],
   ["proposed_preset_key='claim_merge:synthetic'",'OWNERSHIP_FLOW_REQUIRED']]){
   sql(`UPDATE public."HomeInvite" SET ${change} WHERE id=${q(legacyId)};`);
   assert.equal((await request('/invitations/sender/context',0,'POST',targetIntent('resend',legacyId))).body.code,code);
   sql(`UPDATE public."HomeInvite" SET admission_policy=NULL,proposed_role='guest',proposed_role_base='member',proposed_preset_key=NULL WHERE id=${q(legacyId)};`);
  }
  const legacyAccepted=await request('/invitations/decisions',3,'POST',{request_id:id(881),token:legacyResend.token,home_id:home,invitation_id:legacyId,action:'accept',decision_token:legacyRecipient.body.decision_token});
  assert.equal(legacyAccepted.status,201);assert.equal(sql(`SELECT role_base FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(users[3])};`),'member');
  console.log('PASS: legacy null policy and canonical role resend preserve original terms; invalid policy and ownership stay rejected');
  // An old access_request:<UUID> row can predate source_request_id. Resolve
  // only a genuine matching approved request; never infer one from a label.
  const sourceCreate=await original(createIntent(4),822),sourceCreated=await submit(sourceCreate);assert.equal(sourceCreated.status,201);
  const sourceInvite=sourceCreated.body.invitation_id,sourceId=id(923),sourcePrefix='access_request:'+sourceId;
  sql(`INSERT INTO public."HomeHouseholdAccessRequest"(id,home_id,requester_user_id,requested_identity,status,resolved_by,resolved_at)
   VALUES(${q(sourceId)},${q(home)},${q(users[4])},'household_member','approved',${q(users[0])},clock_timestamp());
   UPDATE public."HomeInvite" SET proposed_preset_key=${q(sourcePrefix)},admission_policy=NULL,source_request_id=NULL WHERE id=${q(sourceInvite)};`);
  const sourceBefore=sql(`SELECT to_jsonb(i) FROM public."HomeInvite"i WHERE id=${q(sourceInvite)};`),membersBeforeSource=snapshot().memberships;
  const sourceRecipient=await request(`/invitations/token/${sourceCreate.token}/decision-context`,4);assert.equal(sourceRecipient.status,200);
  const sourceChanged=await original(targetIntent('resend',sourceInvite),823);
  sql(`UPDATE public."HomeHouseholdAccessRequest" SET status='rejected' WHERE id=${q(sourceId)};`);
  assert.equal((await submit(sourceChanged)).body.code,'INVITE_SOURCE_CHANGED');assert.equal((await read(sourceChanged)).body.state,'rejected');
  assert.equal(sql(`SELECT count(*) FROM public."HomeInvitationCapability" WHERE invitation_id=${q(sourceInvite)};`),'0');
  sql(`UPDATE public."HomeHouseholdAccessRequest" SET status='approved' WHERE id=${q(sourceId)};`);
  const sourceResend=await original(targetIntent('resend',sourceInvite),824);assert.equal((await submit(sourceResend)).status,201);
  assert.equal(sql(`SELECT to_jsonb(i) FROM public."HomeInvite"i WHERE id=${q(sourceInvite)};`),sourceBefore);assert.deepEqual(snapshot().memberships,membersBeforeSource);
  assert.equal((await request(`/invitations/token/${sourceResend.token}/decision-context`,4)).body.decision_token,sourceRecipient.body.decision_token);
  // The same source shape also works on modern rows with an explicit FK and
  // a non-null policy snapshot. Its approved requester, resolver and role bind.
  sql(`UPDATE public."HomeInvite" SET source_request_id=${q(sourceId)},admission_policy=public.home_invite_policy('member',NULL) WHERE id=${q(sourceInvite)};`);
  await context(targetIntent('resend',sourceInvite));
  sql(`UPDATE public."HomeInvite" SET proposed_preset_key=NULL WHERE id=${q(sourceInvite)};`);
  await context(targetIntent('resend',sourceInvite)); // Current approved-request creation uses its FK without the legacy prefix.
  sql(`UPDATE public."HomeInvite" SET proposed_preset_key=${q(sourcePrefix)} WHERE id=${q(sourceInvite)};`);
  for(const change of ["status='cancelled'",`requester_user_id=${q(users[2])}`,`resolved_by=${q(users[2])}`,"requested_identity='guest'"]){
   sql(`UPDATE public."HomeHouseholdAccessRequest" SET ${change} WHERE id=${q(sourceId)};`);
   assert.equal((await request('/invitations/sender/context',0,'POST',targetIntent('resend',sourceInvite))).body.code,'INVITE_SOURCE_CHANGED');
   sql(`UPDATE public."HomeHouseholdAccessRequest" SET status='approved',requester_user_id=${q(users[4])},resolved_by=${q(users[0])},requested_identity='household_member' WHERE id=${q(sourceId)};`);
  }
  for(const prefix of ['access_request:malformed','access_request:'+id(924)]){
   sql(`UPDATE public."HomeInvite" SET proposed_preset_key=${q(prefix)} WHERE id=${q(sourceInvite)};`);
   assert.equal((await request('/invitations/sender/context',0,'POST',targetIntent('resend',sourceInvite))).body.code,'INVITE_SOURCE_CHANGED');
  }
  sql(`UPDATE public."HomeInvite" SET proposed_preset_key=${q('access_request:'+id(924))},source_request_id=NULL WHERE id=${q(sourceInvite)};`);
  assert.equal((await request('/invitations/sender/context',0,'POST',targetIntent('resend',sourceInvite))).body.code,'INVITE_SOURCE_CHANGED');
  await context(targetIntent('withdraw',sourceInvite)); // Invalid source cannot prevent explicit withdrawal.
  sql(`UPDATE public."HomeInvite" SET proposed_preset_key=${q(sourcePrefix)},source_request_id=NULL,admission_policy=NULL WHERE id=${q(sourceInvite)};`);
  // Simulate the gap between transactional completion and the service's
  // one-shot delivery claim without invoking any transport directly.
  const sourceClaim=await original(targetIntent('resend',sourceInvite),825);
  const {request_id:claimRequest,token:claimToken,...claimIntent}=sourceClaim;
  const sourceSaved=await client.rpc('resolve_home_invitation_sender',{p_actor_id:users[0],p_request_id:claimRequest,p_token:claimToken,p_intent:claimIntent,p_cancel:false});assert.equal(sourceSaved.data?.state,'completed');
  sql(`UPDATE public."HomeInvite" SET admission_policy='{}'::jsonb WHERE id=${q(sourceInvite)};`);
  const policyClaimDenied=await client.rpc('claim_home_invitation_sender_delivery',{p_actor_id:users[0],p_request_id:claimRequest,p_token:claimToken});assert.deepEqual(policyClaimDenied.data,{ok:true,dispatch:false});
  sql(`UPDATE public."HomeInvite" SET admission_policy=NULL WHERE id=${q(sourceInvite)};`);
  sql(`UPDATE public."HomeHouseholdAccessRequest" SET status='rejected' WHERE id=${q(sourceId)};`);
  const attemptsBeforeClaim=f.invitationEmailAttempts.length,notificationsBeforeClaim=f.notifications.length;
  const sourceClaimDenied=await client.rpc('claim_home_invitation_sender_delivery',{p_actor_id:users[0],p_request_id:claimRequest,p_token:claimToken});assert.deepEqual(sourceClaimDenied.data,{ok:true,dispatch:false});
  assert.equal((await read(sourceClaim)).body.delivery.email,'unconfirmed');assert.equal((await submit(sourceClaim)).body.state,'completed');
  assert.equal(f.invitationEmailAttempts.length,attemptsBeforeClaim);assert.equal(f.notifications.length,notificationsBeforeClaim);
  sql(`UPDATE public."HomeHouseholdAccessRequest" SET status='approved' WHERE id=${q(sourceId)};`);
  assert.equal(sql(`SELECT to_jsonb(i) FROM public."HomeInvite"i WHERE id=${q(sourceInvite)};`),sourceBefore);assert.deepEqual(snapshot().memberships,membersBeforeSource);
  const sourceAccepted=await request('/invitations/decisions',4,'POST',{request_id:id(882),token:sourceResend.token,home_id:home,invitation_id:sourceInvite,action:'accept',decision_token:sourceRecipient.body.decision_token});assert.equal(sourceAccepted.status,201);
  assert.equal(sql(`SELECT role_base FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(users[4])};`),'member');
  console.log('PASS: genuine approved legacy/current request resend, changed-source rejection, no dispatch after source loss, and unchanged recipient originals');
  const noAuthority=await original(createIntent(4),810);
  const revocationTarget=await original(createIntent(null),811);const revocationCreated=await submit(revocationTarget);assert.equal(revocationCreated.status,201);
  const revokedWithdraw=await original(targetIntent('withdraw',revocationCreated.body.invitation_id),812);
  sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(users[0])},'members.manage',false);`);
  assert.equal((await submit(noAuthority)).body.code,'MEMBERS_MANAGE_REQUIRED');assert.equal((await submit(revokedWithdraw)).body.code,'MEMBERS_MANAGE_REQUIRED');
  const legacy=await request(`/invitations/${revocationCreated.body.invitation_id}/reject`,0,'POST',{},false);assert.equal(legacy.status,403);
  assert.equal((await request(`/${home}/invitations`,0)).status,403);assert.equal((await read(a)).body.state,'completed');
  assert.equal(sql(`SELECT status FROM public."HomeInvite" WHERE id=${q(revocationCreated.body.invitation_id)};`),'pending');
  console.log('PASS: username identity, lost resend/withdraw replies, all aliases revoked, current authority for commands and legacy sender decline');
  const beforeDelete=snapshot();save('accepted-state.json',beforeDelete);
  for(const secret of capabilities)assert(!JSON.stringify(beforeDelete.commands).includes(secret));
  sql(`DELETE FROM public."Home" WHERE id=${q(home)};`);
  assert.equal(sql(`SELECT count(*) FROM public."HomeInvitationCapability";`),'0');assert.equal(sql(`SELECT count(*) FROM public."HomeInvite" WHERE home_id=${q(home)};`),'0');
  assert.equal((await read(a)).body.state,'completed');assert.equal((await submit(a)).body.state,'completed');
  save('result.json',{passed:true,real_http_sdk_sql:true,session_binding:true,terms_binding:true,lost_create_resend_withdraw_recovery:true,
   delivery_provider_handoff_and_in_app_save_only:true,recipient_original_preserved_across_resend:true,legitimate_membership_preserved:true,
   cancellation_and_receipt_rollback:true,submit_cancel_race:winner.state,legacy_sender_current_authority:true,deleted_home_history_preserved:true,home_invite_capability_cascade:true,lost_delivery_claim_and_proof:true,
   legacy_null_policy_canonical_role:true,approved_legacy_and_current_source:true,invalid_policy_source_owner_rejected:true,changed_source_history_preserved:true,delivery_claim_current_source:true,command_count:beforeDelete.commands.length});
  console.log('PASS: deleted-Home historical sender recovery contains no raw capability or private payload');
 }catch(error){failed=true;fs.writeFileSync(path.join(evidence,'failure.txt'),String(error.stack),{mode:0o600});console.error('Invitation sender acceptance failed; private diagnostics retained');}
 finally{save('events.json',events);try{await cleanup();console.log('PASS: exact fixtures, role rows, full ledger and schema provenance restored');}catch(error){failed=true;fs.writeFileSync(path.join(evidence,'cleanup-failure.txt'),String(error.stack),{mode:0o600});console.error('Exact cleanup needs inspection; private diagnostics retained');}}
 if(failed)process.exitCode=1;
}
if(process.argv[6]==='--cleanup-only'){
 const prior=JSON.parse(fs.readFileSync(path.join(evidence,'preservation-before.json'),'utf8'));
 before=prior.provenance_sha256;rolesBefore=prior.roles;
 originalAct=JSON.parse(fs.readFileSync(path.join(evidence,'original-recipient-function.json'),'utf8'));
 installedDefinitions=fs.readFileSync(path.join(evidence,'installed-functions.json'),'utf8');
 installed=JSON.parse(fs.readFileSync(path.join(evidence,'installed-role-rows.json'),'utf8'));
 assert.equal(sql(`SELECT (SELECT count(*) FROM public."Home" WHERE id=${q(home)})+(SELECT count(*) FROM auth.users WHERE id IN (${users.map(q)}));`),'0');
 migrated=true;rolesApplied=true;
 cleanup().then(()=>console.log('PASS: recovery cleanup restored exact provenance')).catch(()=>{console.error('Recovery cleanup failed; inspect private state');process.exitCode=1;});
}else main();
