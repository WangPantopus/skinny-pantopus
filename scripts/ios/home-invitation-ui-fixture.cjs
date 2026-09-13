#!/usr/bin/env node
// Owned invitation UI -> production routes/services -> actual local SDK/SQL.
// Authentication, shell data and notification/email delivery are controlled.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const [container, project, cli, output, portText = '18084', purpose = 'preview'] = process.argv.slice(2);
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(output || '') && !output.startsWith(root + '/'));
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
assert(['preview','decision-recovery','sender-recovery'].includes(purpose));
const senderFunctions=['home_invitation_sender_projection','prepare_home_invitation_sender','list_home_invitation_sender','get_home_invitation_sender','resolve_home_invitation_sender','claim_home_invitation_sender_delivery','record_home_invitation_sender_delivery'];
const decisionFunctions = ['home_invitation_decision_projection','prepare_home_invitation_decision','get_home_invitation_decision','resolve_home_invitation_decision'];
const port = Number(portText); assert(port >= 18083 && port <= 18089);
const f = require('../db/home-residency-review-http-fixture.cjs')(container, { summary: true, dashboard: true, invitations: true });
const { actor, home, users, sql, q } = f;
const save = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
const ledgerQuery = `SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(m) ORDER BY version),'[]')::text,'UTF8')),'hex') FROM supabase_migrations.schema_migrations m;`;
const functionQuery = `SELECT coalesce(jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),
  'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid),'[]') FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('write_home_invitation','act_on_home_invitation','list_home_invitations','home_invite_authority','home_record_context','home_delete_eligibility','home_invitation_decision_projection','prepare_home_invitation_decision','get_home_invitation_decision','resolve_home_invitation_decision',${senderFunctions.map(q)});`;
const policyRows = () => JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY role_base,permission),'[]') FROM public."HomeRolePermission" r;`));
const before = { ledger: sql(ledgerQuery), functions: JSON.parse(sql(functionQuery)), roles: policyRows() };
save('preservation-before.json', before);
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgname='residency_http_receipt_failure';"), '0');
assert.equal(sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='residency_http_receipt_failure';"), '0');
let initialized = false, rolesApplied = false, installed = [], introduced = [], server, stopping = false, fault = null, held = null, commandsApplied = false, installedCommands = null, senderApplied = false, installedSender = null;
const events = [], capabilities = [];
function inspectOwnedNativePreferences() {
  const simulator = 'F9BBAB33-BAA0-4A00-9ECE-E3B1343627A8', bundle = 'app.pantopus.ios';
  const data = execFileSync('/usr/bin/xcrun', ['simctl','get_app_container',simulator,bundle,'data'], {encoding:'utf8'}).trim();
  assert(data.includes('/Devices/' + simulator + '/data/Containers/Data/Application/'));
  const plist = path.join(data, 'Library/Preferences/' + bundle + '.plist');
  const preferences = fs.existsSync(plist)
    ? JSON.parse(execFileSync('/usr/bin/plutil', ['-convert','json','-o','-',plist], {encoding:'utf8'})) : {};
  const encoded = JSON.stringify(preferences);
  const result = {event:'native_preferences_checked',
    invitation_capability_count:capabilities.filter(c=>encoded.includes(c.token)).length,
    legacy_handoff_absent: !Object.keys(preferences).some(key=>key.startsWith('pantopus.pendingDeepLink.'))};
  save('native-storage-check-' + (events.filter(e=>e.event===result.event).length + 1) + '.json',result);
  events.push(result); return result;
}
const authToken = index => 'pantopus-synthetic-invitation-loopback-' + index;
const profile = index => ({ id: users[index], email: `residency-http-${index + 1}@example.invalid`,
  username: 'invitation_fixture_' + index, name: index === 0 ? 'Invitation owner' : 'Invite recipient ' + index,
  firstName: 'Invite', lastName: 'Fixture', accountType: 'personal', account_type: 'personal', role: 'user', verified: true,
  createdAt: '2026-09-12T12:00:00Z', updatedAt: '2026-09-12T12:00:00Z' });
const commandDefinition = () => sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid),'[]') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${decisionFunctions.map(q)});`);
const senderDefinition=()=>sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid),'[]') FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${senderFunctions.map(q)});`);
const state = () => ({ events, controlled_notifications: f.notifications, controlled_email_attempts:f.invitationEmailAttempts,
  sender_commands:senderApplied?JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('actor_id',actor_user_id,'request_id',request_id,'invitation_id',invitation_id,'home_id',home_id,'action',action,'state',state,'code',error_code,'delivery',jsonb_build_object('email',email_status,'in_app',in_app_status)) ORDER BY created_at,request_id),'[]') FROM public."HomeInvitationSenderCommand" WHERE actor_user_id IN (${users.map(q)});`)):[],
  commands: commandsApplied ? JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('actor_id',actor_user_id,'request_id',request_id,'invitation_id',invitation_id,'home_id',home_id,'action',action,'state',state,'occupancy_id',occupancy_id,'code',error_code) ORDER BY request_id),'[]') FROM public."HomeInvitationDecisionCommand" WHERE actor_user_id IN (${users.map(q)});`)) : [],
  invitations: JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'invitee_user_id',invitee_user_id,
    'accepted_by_user_id',accepted_by_user_id,'accepted_at',accepted_at) ORDER BY id),'[]') FROM public."HomeInvite" WHERE home_id=${q(home)};`)),
  memberships: JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'is_active',is_active,
    'verification_status',verification_status,'role_base',role_base,'access_start_at',access_start_at,'access_end_at',access_end_at) ORDER BY user_id),'[]') FROM public."HomeOccupancy" WHERE home_id=${q(home)};`)),
  audit: JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('action',action,'actor_user_id',actor_user_id,'target_id',target_id) ORDER BY created_at,id),'[]') FROM public."HomeAuditLog" WHERE home_id=${q(home)};`)),
});
async function stop() {
  if (stopping) return; stopping = true; held?.(); held = null;
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (initialized) {
    save('state.json', state());
    if (senderApplied) sql(`DELETE FROM public."HomeInvitationSenderCommand" WHERE actor_user_id IN (${users.map(q)});`);
    if (commandsApplied) sql(`DELETE FROM public."HomeInvitationDecisionCommand" WHERE actor_user_id IN (${users.map(q)});`);
    // This fixture creates no receipt-failure trigger/function. Leave unrelated
    // schema objects alone and remove only the owned Home and actor rows.
    sql(`BEGIN;
      DELETE FROM public."HomeInvite" WHERE home_id=${q(home)};
      DELETE FROM public."HomeAuditLog" WHERE home_id=${q(home)};
      DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};
      DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};
      DELETE FROM public."HomeOwner" WHERE home_id=${q(home)};
      DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)};
      DELETE FROM public."Home" WHERE id=${q(home)};
      DELETE FROM public."User" WHERE id IN (${users.map(q)});
      DELETE FROM auth.users WHERE id IN (${users.map(q)}); COMMIT;`);
    assert.equal(sql(`SELECT (SELECT count(*) FROM public."Home" WHERE id=${q(home)})+
      (SELECT count(*) FROM auth.users WHERE id IN (${users.map(q)}));`), '0');
    initialized = false;
  }
  if(senderApplied){
    assert.equal(senderDefinition(),installedSender);assert.equal(sql('SELECT count(*) FROM public."HomeInvitationSenderCommand";'),'0');
    const original=before.functions.find(fn=>fn.definition.includes('FUNCTION public.act_on_home_invitation('));assert(original);
    sql(`BEGIN;DROP FUNCTION public.resolve_home_invitation_sender(uuid,uuid,text,jsonb,boolean),public.get_home_invitation_sender(uuid,uuid),public.prepare_home_invitation_sender(uuid,jsonb),public.list_home_invitation_sender(uuid,uuid),public.claim_home_invitation_sender_delivery(uuid,uuid,text),public.record_home_invitation_sender_delivery(uuid,uuid,text,text),public.home_invitation_sender_projection(public."HomeInvitationSenderCommand");
      ${original.definition}; DROP TABLE public."HomeInvitationSenderCommand",public."HomeInvitationCapability";NOTIFY pgrst,'reload schema';COMMIT;`);senderApplied=false;
  }
  if (commandsApplied) {
    assert.equal(commandDefinition(), installedCommands);
    assert.equal(sql('SELECT count(*) FROM public."HomeInvitationDecisionCommand";'), '0');
    sql(`BEGIN; DROP FUNCTION public.resolve_home_invitation_decision(uuid,uuid,text,jsonb,boolean,integer), public.get_home_invitation_decision(uuid,uuid), public.prepare_home_invitation_decision(uuid,text), public.home_invitation_decision_projection(public."HomeInvitationDecisionCommand"); DROP TABLE public."HomeInvitationDecisionCommand"; NOTIFY pgrst,'reload schema'; COMMIT;`);
    commandsApplied = false;
  }
  if (rolesApplied) {
    assert.equal(installed.length, introduced.length);
    if (installed.length) sql(`BEGIN; LOCK TABLE public."HomeRolePermission" IN SHARE ROW EXCLUSIVE MODE;
      DO $$ BEGIN IF (SELECT count(*) FROM public."HomeRolePermission" r WHERE to_jsonb(r) IN
        (SELECT value FROM jsonb_array_elements(${q(JSON.stringify(installed))}::jsonb)))<>${installed.length}
        THEN RAISE EXCEPTION 'Fixture role rows changed; preserve for review'; END IF; END $$;
      DELETE FROM public."HomeRolePermission" r WHERE to_jsonb(r) IN
        (SELECT value FROM jsonb_array_elements(${q(JSON.stringify(installed))}::jsonb)); COMMIT;`);
    assert.deepEqual(policyRows(), before.roles); rolesApplied = false;
  }
  assert.equal(sql(ledgerQuery), before.ledger); assert.deepEqual(JSON.parse(sql(functionQuery)), before.functions);
  save('cleanup.json', { fixtures_removed: true, complete_role_rows_restored: true, complete_ledger_preserved: true, exact_functions_properties_preserved: true });
  f.restoreModules(); console.log('PASS: exact invitation fixture cleanup, role rows, ledger and function provenance preserved');
}
async function main() {
  let config;
  try { config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: 30000 })); }
  catch { throw Error('Owned local SDK configuration unavailable'); }
  assert.equal(config.API_URL, 'http://127.0.0.1:64521');
  const rawFetch = global.fetch;
  global.fetch = (input, options) => { const u = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    assert(['127.0.0.1','localhost'].includes(u.hostname), 'External fixture traffic is blocked'); return rawFetch(input, options); };
  const { createClient } = require(path.join(root, 'backend/node_modules/@supabase/supabase-js'));
  const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  f.useDatabaseClient({ supabaseUrl: client.supabaseUrl, from: table => client.from(table), async rpc(name, args) {
    const action = name === 'resolve_home_invitation_sender' ? args.p_cancel ? 'sender_cancel' : args.p_intent.action : name === 'prepare_home_invitation_sender' ? 'sender_context' : name === 'list_home_invitation_sender' ? 'sender_list' : name === 'get_home_invitation_sender' ? 'sender_read' : name === 'claim_home_invitation_sender_delivery' ? 'sender_delivery_claim' : name === 'record_home_invitation_sender_delivery' ? 'sender_delivery_record' : name === 'resolve_home_invitation_decision' ? args.p_cancel ? 'decision_cancel' : args.p_intent.action : name === 'prepare_home_invitation_decision' ? 'context' : name === 'get_home_invitation_decision' ? 'decision_read' : args.p_action;
    const invitationRpc = name === 'act_on_home_invitation' || decisionFunctions.includes(name) || senderFunctions.includes(name);
    if (invitationRpc && fault && fault.action === action && fault.kind === 'before') {
      // Resolve a real read before reporting the controlled unavailable write.
      if (name === 'resolve_home_invitation_sender') await client.rpc('get_home_invitation_sender',{p_actor_id:args.p_actor_id,p_request_id:args.p_request_id});
      else if (name === 'claim_home_invitation_sender_delivery' || name === 'record_home_invitation_sender_delivery') await client.rpc('get_home_invitation_sender',{p_actor_id:args.p_actor_id,p_request_id:args.p_request_id});
      else if (name === 'resolve_home_invitation_decision') await client.rpc('get_home_invitation_decision', {p_actor_id:args.p_actor_id,p_request_id:args.p_request_id});
      else await client.rpc(name, name === 'act_on_home_invitation' ? { ...args, p_action: 'preview' } : args);
      events.push({ event: 'unavailable_before_decision', action });
      if (!fault.persistent) fault = null;
      return { data: null, error: { code: 'SYNTHETIC_UNAVAILABLE' } };
    }
    const result = await client.rpc(name, args);
    if(name==='resolve_home_invitation_sender' && result.data?.state==='completed' && args.p_token && !capabilities.some(c=>c.token===args.p_token)){
      const i=JSON.parse(sql(`SELECT jsonb_build_object('id',id,'invitee_user_id',invitee_user_id) FROM public."HomeInvite" WHERE id=${q(result.data.invitation_id)} AND home_id=${q(home)};`));
      assert(i);capabilities.push({index:capabilities.length+1,actor_id:i.invitee_user_id,token:args.p_token,invitation_id:i.id,sender_request_id:args.p_request_id});
    }
    events.push({ event: 'sdk_rpc', name, action, ok: result.data?.ok, code: result.data?.code, replayed: result.data?.replayed });
    if (invitationRpc && fault && fault.action === action) {
      const kind = fault.kind; if (!fault.persistent) fault = null;
      if (kind === 'after' && result.data?.ok) throw Error('Controlled lost invitation reply');
      if (kind === 'hold') { events.push({ event: 'reply_held', action }); await new Promise(resolve => { assert.equal(held, null); held = resolve; }); events.push({ event: 'reply_released', action }); }
      if (kind === 'malformed') return { data: { ok: true, invitation: { id: result.data?.invitation?.id } }, error: null };
    }
    return result;
  } });
  const roles = ['admin','manager','member','restricted_member','guest'];
  for (const role of roles) {
    const old = before.roles.find(row => row.role_base === role && row.permission === 'home.view');
    if (old) assert.equal(old.allowed, true, 'Preserve current role denies'); else introduced.push(role);
  }
  sql('BEGIN;' + fs.readFileSync(path.join(root, 'supabase/migrations/20260911030000_home_member_view_defaults.sql'), 'utf8') + 'COMMIT;');
  rolesApplied = true; installed = policyRows().filter(row => row.permission === 'home.view' && introduced.includes(row.role_base));
  save('roles-introduced.json', installed);
  if (['decision-recovery','sender-recovery'].includes(purpose)) {
    assert.equal(sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname='HomeInvitationDecisionCommand';`), '0');
    assert.equal(commandDefinition(), '[]');
    sql('BEGIN;' + fs.readFileSync(path.join(root,'supabase/migrations/20260912020000_home_invitation_decision_recovery.sql'),'utf8') + "NOTIFY pgrst,'reload schema';COMMIT;");
    commandsApplied = true; installedCommands = commandDefinition(); save('installed-command-functions.json',JSON.parse(installedCommands));
  }
  if(purpose==='sender-recovery'){
    assert.equal(sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('HomeInvitationSenderCommand','HomeInvitationCapability');`),'0');
    assert.equal(senderDefinition(),'[]');
    sql('BEGIN;'+fs.readFileSync(path.join(root,'supabase/migrations/20260912040000_home_invitation_sender_recovery.sql'),'utf8')+"NOTIFY pgrst,'reload schema';COMMIT;");
    senderApplied=true;installedSender=senderDefinition();save('installed-sender-functions.json',JSON.parse(installedSender));
  }
  f.setup(); initialized = true;
  sql(`DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)} AND user_id IN (${users.slice(1).map(q)});
    DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id IN (${users.slice(1).map(q)});`);
  const express = require(path.join(root, 'backend/node_modules/express'));
  const app = express(); app.use(express.json());
  app.use(async (req,res,next) => {
    res.set('Cache-Control','private, no-store');
    if (req.path === '/fixture/state') return res.json(state());
    // Private opt-in native driver only; never copied into diagnostics or Git.
    if (req.path === '/fixture/capabilities' && ['decision-recovery','sender-recovery'].includes(purpose)) return res.json({home,capabilities});
    if (req.path === '/fixture/native-storage-check' && purpose === 'decision-recovery') return res.json(inspectOwnedNativePreferences());
    if (req.path === '/fixture/fault') { assert(['preview','accept','decline','context','decision_read','decision_cancel','logout','sender_context','sender_list','sender_read','sender_cancel','create','resend','withdraw','sender_delivery_claim','sender_delivery_record','members'].includes(req.body.action));
      assert(['before','after','malformed','hold','clear'].includes(req.body.kind));fault=req.body.kind==='clear'?null:req.body;return res.json({ok:true}); }
    if (req.path === '/fixture/release') { assert(held); const release = held; held = null; release(); return res.json({ok:true}); }
    if(req.path==='/fixture/delivery' && senderApplied){
      assert(['accepted','unconfirmed'].includes(req.body.email));assert(typeof req.body.in_app==='boolean');
      f.setInvitationDelivery({success:req.body.email==='accepted'},req.body.in_app);events.push({event:'controlled_delivery',...req.body});return res.json({ok:true});
    }
    if(req.path==='/fixture/sender-scenario' && senderApplied){
      const mode=req.body.mode;assert(['deny_manage','restore_manage','change_home','accept','expire'].includes(mode));
      if(mode==='deny_manage')sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'members.manage',false) ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=false;`);
      else if(mode==='restore_manage')sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(actor)} AND permission='members.manage';`);
      else if(mode==='change_home')sql(`UPDATE public."Home" SET name='Changed invitation fixture' WHERE id=${q(home)};`);
      else{
        const c=capabilities.find(c=>c.invitation_id===req.body.invitation_id);assert(c);
        if(mode==='expire')sql(`UPDATE public."HomeInvite" SET expires_at=clock_timestamp()-interval '1 minute' WHERE id=${q(c.invitation_id)} AND home_id=${q(home)};`);
        else {assert(users.includes(c.actor_id));const result=await client.rpc('act_on_home_invitation',{p_invite_id:null,p_token:c.token,p_actor_id:c.actor_id,p_action:'accept',p_validity_days:365});assert.equal(result.data?.ok,true);}
      }
      events.push({event:'owned_sender_scenario',mode,invitation_id:req.body.invitation_id});return res.json({ok:true});
    }
    if (req.path === '/fixture/scenario') {
      const capability = capabilities.find(c => c.index === req.body.index); assert(capability);
      assert(['expire','scheduled','legacy_metadata','remove','deny_view'].includes(req.body.mode));
      if (req.body.mode === 'remove') sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(capability.actor_id)};`);
      else if (req.body.mode === 'deny_view') sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(capability.actor_id)},'home.view',false) ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=false;`);
      else if (req.body.mode === 'legacy_metadata') {
        sql(`UPDATE public."Home" SET home_type=NULL WHERE id=${q(home)}; UPDATE public."HomeInvite" SET expires_at=NULL WHERE id=${q(capability.invitation_id)} AND home_id=${q(home)} AND status='pending';`);
      } else sql(`UPDATE public."HomeInvite" SET ${req.body.mode === 'expire' ? "expires_at=clock_timestamp()-interval '1 minute'" : "access_start_at=clock_timestamp()+interval '1 day'"} WHERE id=${q(capability.invitation_id)} AND home_id=${q(home)} AND status='pending';`);
      events.push({event:'owned_scenario',index:req.body.index,mode:req.body.mode}); return res.json({ok:true});
    }
    if (req.path === '/fixture/stop') { res.json({ok:true});void stop();return; }
    if (req.path === '/api/users/login') {
      const index=users.findIndex((_,i)=>profile(i).email===req.body.email);assert(index>=0);assert.equal(req.body.password,'synthetic-loopback-only');
      return res.json({user:profile(index),accessToken:authToken(index),refreshToken:authToken(index)+'-refresh',expiresIn:86400,
        sessionId:'local-invitation-'+index,session:{id:'local-invitation-'+index,context:'interactive'}});
    }
    const index=users.findIndex((_,i)=>req.headers.authorization==='Bearer '+authToken(i));
    if (index<0 && !(req.method==='GET' && /^\/api\/homes\/invitations\/token\/[^/]+$/.test(req.path)))
      return res.status(401).json({error:'Synthetic sign-in required'});
    if(index>=0){req.headers['x-fixture-actor']=users[index];req.headers['x-fixture-session']='local-invitation-'+index;}
    const invitationIndex = capabilities.find(c=>req.path.includes('/token/'+c.token))?.index;
    events.push({event:'request',method:req.method,path:req.path.replace(/\/(token|guest)\/[^/]+/g,'/$1/[redacted]'),actor:index,
      ...(invitationIndex===undefined?{}:{invitation_index:invitationIndex}),
      ...(req.method==='POST'&&(['/api/homes/invitations/decisions','/api/homes/invitations/sender/commands'].includes(req.path)||/^\/api\/homes\/invitations\/sender\/commands\/[a-f0-9-]+\/cancel$/.test(req.path))?{request_id:req.body.request_id||req.path.split('/').at(-2),request_hash:require('node:crypto').createHash('sha256').update(JSON.stringify(req.body)).digest('hex')}: {})});
    if(fault?.action==='members' && [`/api/homes/${home}/members`,`/api/homes/${home}/occupants`].includes(req.path)){if(!fault.persistent)fault=null;events.push({event:'members_refresh_unavailable'});return res.status(503).json({error:'Controlled member refresh unavailable'});}
    if(['/api/users/profile','/api/users/me'].includes(req.path)) return res.json({user:profile(index),...profile(index)});
    if(req.path==='/api/hub') return res.json({user:profile(index),context:{activeHomeId:null,activePersona:{type:'personal'}},
      availability:{hasHome:false,hasBusiness:false,hasPayoutMethod:false},homes:[],businesses:[],
      setup:{steps:[],allDone:true,profileCompleteness:{score:100,checks:{firstName:true,lastName:true,photo:false,bio:false,skills:false},missingFields:[]}},
      statusItems:[],cards:{personal:{unreadChats:0,earnings:0,gigsNearby:0,rating:0,reviewCount:0}},jumpBackIn:[],activity:[]});
    if(req.path.endsWith('/unread-count'))return res.json({count:0,unread_count:0,unreadCount:0});
    if(req.path==='/api/notifications')return res.json({notifications:[],unreadCount:0,pagination:{page:1,totalPages:0,total:0}});
    if(req.path.includes('/logout')) {
      if(fault?.action==='logout' && fault.kind==='hold') {
        assert.equal(held,null); events.push({event:'logout_reply_held',actor:index});
        held=()=>{events.push({event:'logout_reply_released',actor:index});if(!res.destroyed)res.json({success:true});}; return;
      }
      return res.json({success:true});
    }
    return next();
  });
  app.use(f.app);app.use((_req,res)=>res.status(404).json({error:'Outside invitation acceptance scope'}));
  app.use((_error,_req,res,_next)=>res.status(503).json({error:'Controlled invitation service unavailable'}));
  server=app.listen(port,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  for(const index of (purpose==='sender-recovery'?[1,2]:[1,2,3,4])) {
    const response=await fetch(`http://127.0.0.1:${port}/api/homes/${home}/invite`,{method:'POST',headers:{Authorization:'Bearer '+authToken(0),'Content-Type':'application/json'},body:JSON.stringify({user_id:users[index],relationship:'member'})});
    assert.equal(response.status,201);const value=await response.json();assert.equal(value.emailSent,false);assert(value.invitation.id && value.invitation.token);
    capabilities.push({index,actor_id:users[index],token:value.invitation.token,invitation_id:value.invitation.id,auth_token:authToken(index),email:profile(index).email});
  }
  save('capabilities.json',{home,capabilities});console.log('Owned invitation fixture ready on loopback; real routes, SDK and SQL; delivery controlled');
}
process.on('SIGTERM',()=>stop().catch(()=>{process.exitCode=1;}));
process.on('SIGINT',()=>stop().catch(()=>{process.exitCode=1;}));
main().catch(async error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack),{mode:0o600});console.error('Fixture initialization failed; private diagnostics retained');try{await stop();}catch{console.error('Fixture cleanup requires inspection');}process.exitCode=1;});
