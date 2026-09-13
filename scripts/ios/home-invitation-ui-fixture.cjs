#!/usr/bin/env node
// Owned invitation UI -> production routes/services -> actual local SDK/SQL.
// Authentication, shell data and notification/email delivery are controlled.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const [container, project, cli, output, portText = '18084', purpose = 'preview', policyMode = 'baseline'] = process.argv.slice(2);
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(output || '') && !output.startsWith(root + '/'));
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
assert(['preview','decision-recovery','sender-recovery','member-onboarding'].includes(purpose));
const memberOnboarding = purpose === 'member-onboarding';
assert(['baseline','member-tasks'].includes(policyMode) && (memberOnboarding || policyMode==='baseline'));
const senderFunctions=['home_invitation_sender_projection','prepare_home_invitation_sender','list_home_invitation_sender','get_home_invitation_sender','resolve_home_invitation_sender','claim_home_invitation_sender_delivery','record_home_invitation_sender_delivery'];
const decisionFunctions = ['home_invitation_decision_projection','prepare_home_invitation_decision','get_home_invitation_decision','resolve_home_invitation_decision'];
const port = Number(portText); assert(port >= 18083 && port <= 18089);
const f = require('../db/home-residency-review-http-fixture.cjs')(container, { summary: true, dashboard: true, invitations: true, tasks: memberOnboarding });
const { actor, home, users, sql, q } = f;
const save = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
const ledgerQuery = `SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(m) ORDER BY version),'[]')::text,'UTF8')),'hex') FROM supabase_migrations.schema_migrations m;`;
const functionQuery = `SELECT coalesce(jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),
  'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid),'[]') FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('write_home_invitation','act_on_home_invitation','list_home_invitations','home_invite_authority','home_record_context','home_delete_eligibility','home_invitation_decision_projection','prepare_home_invitation_decision','get_home_invitation_decision','resolve_home_invitation_decision',${senderFunctions.map(q)});`;
const policyRows = () => JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY role_base,permission),'[]') FROM public."HomeRolePermission" r;`));
function completePreservation() {
  const tables = JSON.parse(sql(`BEGIN READ ONLY;SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname) ORDER BY n.nspname,c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage','supabase_migrations') AND c.relkind='r';ROLLBACK;`));
  const identifier = value => '"' + value.replaceAll('"','""') + '"';
  const rows = tables.map(([schema,table])=>`SELECT ${q(schema)}::text schema_name,${q(table)}::text table_name,count(*) row_count,
    md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' ORDER BY to_jsonb(r)::text),'')) digest FROM ${identifier(schema)}.${identifier(table)} r`).join(' UNION ALL ');
  return JSON.parse(sql(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL statement_timeout='90s';
    SELECT jsonb_build_object('rows',(SELECT jsonb_agg(to_jsonb(t) ORDER BY schema_name,table_name) FROM (${rows})t),
      'functions',(SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'definition_hash',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
        'owner',p.proowner,'acl',p.proacl,'config',p.proconfig) ORDER BY p.oid) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind IN ('f','p')),
      'relations',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'name',c.relname,'kind',c.relkind,'owner',c.relowner,'acl',c.relacl,
        'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','auth','storage','supabase_migrations')),
      'extensions',(SELECT jsonb_agg(to_jsonb(e) ORDER BY oid) FROM pg_extension e));ROLLBACK;`));
}
const before = { ledger: sql(ledgerQuery), functions: JSON.parse(sql(functionQuery)), roles: policyRows() };
if (memberOnboarding) before.complete = completePreservation();
save('preservation-before.json', before);
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgname='residency_http_receipt_failure';"), '0');
assert.equal(sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='residency_http_receipt_failure';"), '0');
let initialized = false, rolesApplied = false, installed = [], introduced = [], server, stopping = false, fault = null, held = null, commandsApplied = false, installedCommands = null, senderApplied = false, installedSender = null;
const events = [], capabilities = [];
let privateSourceMail = null;
const memberChanges = new Map();
function memberScenario(index, mode) {
  assert(memberOnboarding && Number.isInteger(index) && index>0 && index<users.length);
  assert(['deny_home_view','deny_tasks_view','deny_tasks_edit','remove','restore'].includes(mode));
  const user=users[index], changes=memberChanges.get(index)||new Map();
  if(mode==='restore') {
    const commands=[];
    for(const [key,change] of changes) {
      const table=key==='occupancy'?'HomeOccupancy':'HomePermissionOverride';
      commands.push(`DO $$ BEGIN IF NOT EXISTS(SELECT FROM public."${table}" r WHERE to_jsonb(r)=${q(JSON.stringify(change.after))}::jsonb)
        THEN RAISE EXCEPTION 'Owned member scenario changed; preserve for review'; END IF; END $$;`);
      if(key==='occupancy') commands.push(`UPDATE public."HomeOccupancy" SET is_active=${change.before.is_active?'true':'false'},
        updated_at=${change.before.updated_at===null?'NULL':q(change.before.updated_at)} WHERE id=${q(change.before.id)};`);
      else {
        commands.push(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(user)} AND permission=${q(key)};`);
        if(change.before) commands.push(`INSERT INTO public."HomePermissionOverride" SELECT (jsonb_populate_record(NULL::public."HomePermissionOverride",${q(JSON.stringify(change.before))}::jsonb)).*;`);
      }
    }
    sql('BEGIN;'+commands.join('\n')+'COMMIT;'); memberChanges.delete(index);
  } else {
    const key=mode==='remove'?'occupancy':{'deny_home_view':'home.view','deny_tasks_view':'tasks.view','deny_tasks_edit':'tasks.edit'}[mode];
    const read=()=>JSON.parse(sql(key==='occupancy'
      ?`SELECT coalesce((SELECT to_jsonb(r) FROM public."HomeOccupancy" r WHERE home_id=${q(home)} AND user_id=${q(user)}),'null');`
      :`SELECT coalesce((SELECT to_jsonb(r) FROM public."HomePermissionOverride" r WHERE home_id=${q(home)} AND user_id=${q(user)} AND permission=${q(key)}),'null');`));
    if(changes.has(key))assert.deepEqual(read(),changes.get(key).after);
    else {
      const original=read();
      if(key==='occupancy') {assert(original);sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(user)};`);}
      else sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(user)},${q(key)},false)
        ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=false;`);
      changes.set(key,{before:original,after:read()});memberChanges.set(index,changes);
    }
  }
  events.push({event:'owned_member_scenario',index,mode});
}
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
const privateCapabilities = () => ({home,capabilities,...(memberOnboarding ? {home_name:'Member first use fixture',home_address:'Private residency fixture',policy_mode:policyMode,
  actors:users.map((id,index)=>({index,id,email:profile(index).email,auth_token:authToken(index)}))} : {})});
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
  ...(memberOnboarding ? {
    policy_mode:policyMode,
    tasks:JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'home_id',home_id,'created_by',created_by,'title',title,
      'description',description,'status',status,'visibility',visibility,'assigned_to',assigned_to,'completed_at',completed_at) ORDER BY id),'[]') FROM public."HomeTask" WHERE home_id=${q(home)};`)),
    task_receipts:JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('actor_id',actor_user_id,'request_id',request_id,'task_id',task_id,
      'payload_hash',payload_hash) ORDER BY actor_user_id,request_id),'[]') FROM public."HomeTaskCreateReceipt" WHERE home_id=${q(home)};`)),
    member_access:JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('actor_id',u,'access',public.home_effective_access(${q(home)},u)) ORDER BY u)
      FROM unnest(ARRAY[${users.map(q)}]::uuid[])u;`)),
    claim_count:Number(sql(`SELECT count(*) FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};`)),
    ownership_claim_count:Number(sql(`SELECT count(*) FROM public."HomeOwnershipClaim" WHERE home_id=${q(home)};`)),
    ownership:JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('subject_id',subject_id,'status',owner_status) ORDER BY subject_id),'[]')
      FROM public."HomeOwner" WHERE home_id=${q(home)};`)),
  } : {}),
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
      ${privateSourceMail ? `DELETE FROM public."Mail" WHERE id=${q(privateSourceMail)} AND recipient_user_id=${q(actor)} AND recipient_home_id=${q(home)};` : ''}
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
  if (memberOnboarding) {
    const after = completePreservation(); save('complete-preservation-after.json',after); assert.deepEqual(after,before.complete);
  }
  save('cleanup.json', { fixtures_removed: true, complete_role_rows_restored: true, complete_ledger_preserved: true, exact_functions_properties_preserved: true,
    ...(memberOnboarding ? {complete_populated_rows_schema_preserved:true,preserved_tables:before.complete.rows.length} : {}) });
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
    const taskRpc = memberOnboarding && ['get_home_records','create_home_task_with_receipt','mutate_home_record','get_home_task_recurrence','get_home_task_gig_publication','get_home_task_media'].includes(name);
    if(taskRpc){assert.equal(args.p_home_id,home);assert(users.includes(args.p_actor_id));if(args.p_kind!==undefined)assert(['task','event'].includes(args.p_kind));}
    const action = taskRpc ? name==='get_home_records' ? args.p_record_id ? 'task_read' : 'task_list' : name==='create_home_task_with_receipt' ? 'task_create'
      : name==='mutate_home_record' ? 'task_'+args.p_action : 'task_metadata'
      : name === 'resolve_home_invitation_sender' ? args.p_cancel ? 'sender_cancel' : args.p_intent.action : name === 'prepare_home_invitation_sender' ? 'sender_context' : name === 'list_home_invitation_sender' ? 'sender_list' : name === 'get_home_invitation_sender' ? 'sender_read' : name === 'claim_home_invitation_sender_delivery' ? 'sender_delivery_claim' : name === 'record_home_invitation_sender_delivery' ? 'sender_delivery_record' : name === 'resolve_home_invitation_decision' ? args.p_cancel ? 'decision_cancel' : args.p_intent.action : name === 'prepare_home_invitation_decision' ? 'context' : name === 'get_home_invitation_decision' ? 'decision_read' : args.p_action;
    const invitationRpc = taskRpc || name === 'act_on_home_invitation' || decisionFunctions.includes(name) || senderFunctions.includes(name);
    if (invitationRpc && fault && fault.action === action && fault.kind === 'before') {
      // Resolve a real read before reporting the controlled unavailable write.
      if (taskRpc) await client.rpc('get_home_records',{p_home_id:home,p_actor_id:args.p_actor_id,p_kind:'task',p_record_id:args.p_record_id||null});
      else if (name === 'resolve_home_invitation_sender') await client.rpc('get_home_invitation_sender',{p_actor_id:args.p_actor_id,p_request_id:args.p_request_id});
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
  const defaults = ['admin','manager','member','restricted_member','guest'].map(role=>[role,'home.view']);
  if(policyMode==='member-tasks')defaults.push(['member','tasks.view'],['member','tasks.edit']);
  for (const [role,permission] of defaults) {
    const old = before.roles.find(row => row.role_base === role && row.permission === permission);
    if (old && permission==='home.view') assert.equal(old.allowed, true, 'Preserve current role denies');
    if (!old) introduced.push(role+':'+permission);
  }
  sql('BEGIN;' + fs.readFileSync(path.join(root, 'supabase/migrations/20260911030000_home_member_view_defaults.sql'), 'utf8')
    +(policyMode==='member-tasks'?fs.readFileSync(path.join(root,'supabase/migrations/20260912050000_home_member_task_defaults.sql'),'utf8'):'')+'COMMIT;');
  rolesApplied = true; installed = policyRows().filter(row => introduced.includes(row.role_base+':'+row.permission));
  save('roles-introduced.json', installed);
  if (['decision-recovery','sender-recovery','member-onboarding'].includes(purpose)) {
    assert.equal(sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname='HomeInvitationDecisionCommand';`), '0');
    assert.equal(commandDefinition(), '[]');
    sql('BEGIN;' + fs.readFileSync(path.join(root,'supabase/migrations/20260912020000_home_invitation_decision_recovery.sql'),'utf8') + "NOTIFY pgrst,'reload schema';COMMIT;");
    commandsApplied = true; installedCommands = commandDefinition(); save('installed-command-functions.json',JSON.parse(installedCommands));
  }
  if(purpose==='sender-recovery'||memberOnboarding){
    assert.equal(sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('HomeInvitationSenderCommand','HomeInvitationCapability');`),'0');
    assert.equal(senderDefinition(),'[]');
    sql('BEGIN;'+fs.readFileSync(path.join(root,'supabase/migrations/20260912040000_home_invitation_sender_recovery.sql'),'utf8')+"NOTIFY pgrst,'reload schema';COMMIT;");
    senderApplied=true;installedSender=senderDefinition();save('installed-sender-functions.json',JSON.parse(installedSender));
  }
  f.setup(); initialized = true;
  sql(`DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)} AND user_id IN (${users.slice(1).map(q)});
    DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id IN (${users.slice(1).map(q)});`);
  if(memberOnboarding)sql(`UPDATE public."Home" SET name='Member first use fixture' WHERE id=${q(home)};`);
  const express = require(path.join(root, 'backend/node_modules/express'));
  const app = express(); app.use(express.json());
  app.use(async (req,res,next) => {
    res.set('Cache-Control','private, no-store');
    if (req.path === '/fixture/state') return res.json(state());
    // Private opt-in native driver only; never copied into diagnostics or Git.
    if (req.path === '/fixture/capabilities' && ['decision-recovery','sender-recovery','member-onboarding'].includes(purpose)) return res.json(privateCapabilities());
    if (req.path === '/fixture/member-scenario' && memberOnboarding) {memberScenario(req.body.index,req.body.mode);return res.json(state());}
    if (req.path === '/fixture/member-private-source' && memberOnboarding && policyMode==='member-tasks') {
      // An existing personal source is owned test data, never an access grant.
      // Derive its Task with the real SDK/SQL command, then let ordinary member
      // HTTP reads prove that the new defaults cannot disclose that source.
      assert.equal(req.method,'POST');assert.equal(privateSourceMail,null);
      const mailId=f.id(950);assert.equal(sql(`SELECT count(*) FROM public."Mail" WHERE id=${q(mailId)};`),'0');
      sql(`INSERT INTO public."Mail"(id,recipient_user_id,recipient_home_id,type,content,subject,privacy)
        VALUES(${q(mailId)},${q(actor)},${q(home)},'letter','Owned synthetic personal source','Personal source fixture','private_to_person');`);
      privateSourceMail=mailId;
      const result=await client.rpc('mutate_home_record',{p_home_id:home,p_actor_id:actor,p_kind:'task',p_action:'create',
        p_record_id:null,p_payload:{title:'Existing personal source Task'},p_source_mail_id:mailId});
      assert.equal(result.error,null);assert.equal(result.data?.ok,true);assert.equal(result.data.record.home_id,home);
      events.push({event:'owned_private_source_created',task_id:result.data.record.id});
      return res.json({task_id:result.data.record.id});
    }
    if (req.path === '/fixture/native-storage-check' && purpose === 'decision-recovery') return res.json(inspectOwnedNativePreferences());
    if (req.path === '/fixture/fault') { assert(['preview','accept','decline','context','decision_read','decision_cancel','logout','sender_context','sender_list','sender_read','sender_cancel','create','resend','withdraw','sender_delivery_claim','sender_delivery_record','members',...(memberOnboarding?['task_list','task_read','task_create','task_update','task_metadata']:[])].includes(req.body.action));
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
    if(memberOnboarding)res.once('finish',()=>events.push({event:'response',method:req.method,
      path:req.path.replace(/\/(token|guest)\/[^/]+/g,'/$1/[redacted]'),actor:index,status:res.statusCode}));
    events.push({event:'request',method:req.method,path:req.path.replace(/\/(token|guest)\/[^/]+/g,'/$1/[redacted]'),actor:index,
      ...(invitationIndex===undefined?{}:{invitation_index:invitationIndex}),
      ...(req.method==='POST'&&(['/api/homes/invitations/decisions','/api/homes/invitations/sender/commands'].includes(req.path)||/^\/api\/homes\/invitations\/sender\/commands\/[a-f0-9-]+\/cancel$/.test(req.path)
        ||memberOnboarding&&req.path===`/api/homes/${home}/tasks`)?{request_id:req.body.request_id||req.path.split('/').at(-2),request_hash:require('node:crypto').createHash('sha256').update(JSON.stringify(req.body)).digest('hex')}: {})});
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
  for(const index of (memberOnboarding?[]:purpose==='sender-recovery'?[1,2]:[1,2,3,4])) {
    const response=await fetch(`http://127.0.0.1:${port}/api/homes/${home}/invite`,{method:'POST',headers:{Authorization:'Bearer '+authToken(0),'Content-Type':'application/json'},body:JSON.stringify({user_id:users[index],relationship:'member'})});
    assert.equal(response.status,201);const value=await response.json();assert.equal(value.emailSent,false);assert(value.invitation.id && value.invitation.token);
    capabilities.push({index,actor_id:users[index],token:value.invitation.token,invitation_id:value.invitation.id,auth_token:authToken(index),email:profile(index).email});
  }
  save('capabilities.json',privateCapabilities());console.log('Owned invitation fixture ready on loopback; real routes, SDK and SQL; delivery controlled');
}
process.on('SIGTERM',()=>stop().catch(()=>{process.exitCode=1;}));
process.on('SIGINT',()=>stop().catch(()=>{process.exitCode=1;}));
main().catch(async error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack),{mode:0o600});console.error('Fixture initialization failed; private diagnostics retained');try{await stop();}catch{console.error('Fixture cleanup requires inspection');}process.exitCode=1;});
