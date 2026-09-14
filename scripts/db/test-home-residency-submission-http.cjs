#!/usr/bin/env node
// Verify atomic submission recovery through production HTTP and real SDK/SQL.
// Only fixture auth/notification/postage boundaries and a post-query read fault are controlled.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const [container, project, cli, evidence] = process.argv.slice(2);
assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const id = n => `ddc24300-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), actor = id(2), home = id(100);
const q = v => `'${String(v).replaceAll("'", "''")}'`;
const sql = input => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000 }).trim();
const count = () => Number(sql(`SELECT (SELECT count(*) FROM public."Home" WHERE id=${q(home)})+(SELECT count(*) FROM auth.users WHERE id IN (${q(owner)},${q(actor)}));`));
assert.equal(count(), 0, 'Reserved submission fixture must be empty');
let config;
try { config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })); }
catch (_) { throw new Error('Owned local SDK configuration unavailable'); }
assert.equal(config.API_URL, 'http://127.0.0.1:64521');
const rawFetch = global.fetch;
global.fetch = (input, options) => {
  const u = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assert(['127.0.0.1', 'localhost'].includes(u.hostname), 'Acceptance blocks external fetch');
  return rawFetch(input, options);
};
const { createClient } = require(path.join(root, 'backend/node_modules/@supabase/supabase-js'));
const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const events = [], results = [];
let fault = false, initialized = false, schemaInstalled = false, loseReply = false, server;
const functions = ['home_residency_submission_projection','get_home_residency_submission','cancel_home_residency_submission','submit_home_residency'];
const ledger = sql('SELECT max(version) FROM supabase_migrations.schema_migrations;');
assert.equal(sql(`SELECT to_regclass('public."HomeResidencySubmissionCommand"') IS NULL;`), 't');
assert.equal(sql(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${functions.map(q)});`), '0');
assert.equal(sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='residency_submission_fixture_failure';"),'0');
const db = { auth: client.auth, async rpc(name, args) {
  assert(['submit_home_residency','get_home_residency_submission','cancel_home_residency_submission'].includes(name));
  assert([actor,owner].includes(args.p_actor_id)); assert.equal(args.p_home_id,home);
  const result = await client.rpc(name,args);
  events.push({ event:'sdk_rpc',name,state:result.data?.state,code:result.data?.code,error:result.error?.code || null, diagnostic:result.error?.message });
  if (name==='submit_home_residency' && loseReply && result.data?.state==='completed') {
    loseReply=false; throw new Error('Synthetic lost committed SDK reply');
  }
  return result;
}, from(table) {
  assert(['HomeAddress', 'Home', 'HomeOccupancy', 'HomeOwner', 'HomeResidencyClaim', 'User', 'HomeRolePermission', 'HomePermissionOverride'].includes(table));
  const base = client.from(table);
  return new Proxy(base, { get(target, key) {
    if (key === 'select') return (columns, ...options) => {
      const query = target.select(columns, ...options);
      function wrap(value) { return new Proxy(value, { get(t, k) {
        if (k === 'then') return (resolve, reject) => t.then(result => {
          events.push({ event: 'sdk_read', table, columns, error: result.error?.code || null });
          if (fault && table === 'HomeOccupancy' && columns === 'user_id') {
            fault = false; return { data: null, error: { code: 'SYNTHETIC', message: 'Private synthetic authority failure' } };
          }
          return result;
        }).then(resolve, reject);
        const next = Reflect.get(t, k); return typeof next === 'function' ? (...xs) => wrap(next.apply(t, xs)) : next;
      } }); }
      return wrap(query);
    };
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
} };
const load = Module._load;
Module._load = function(name, parent, isMain) {
  if (parent?.filename.startsWith(root + '/backend/')) {
    if (name.endsWith('/config/supabaseAdmin')) return db;
    if (name.endsWith('/utils/logger')) return { info() {}, warn() {}, error(message) { events.push({ event: 'diagnostic', message }); } };
    if (name.endsWith('/middleware/verifyToken')) return (req, _res, next) => { req.user = { id: req.headers['x-fixture-actor'] || actor }; assert([actor,owner].includes(req.user.id)); next(); };
    if (name.endsWith('/middleware/rateLimiter')) {
      const real=load.call(this,name,parent,isMain);
      return new Proxy({}, { get: (_target,key) => key==='homeResidencySubmissionLimiter' ? real[key] : (_req,_res,next) => {
        if(key==='postcardLimiter') events.push({event:'legacy_postcard_budget'});next();
      } });
    }
    if (name.endsWith('/services/notificationService')) return { createBulkNotifications: async () => events.push({ event: 'controlled_notification' }) };
    if (name.endsWith('/services/homePostcardService')) return { request: async (homeId, userId) => {
      assert.equal(homeId, home); assert.equal(userId, actor); events.push({ event: 'blocked_postage_boundary' });
      return { status: 503, body: { code: 'SYNTHETIC_POSTCARD_UNAVAILABLE', error: 'Controlled postage unavailable' } };
    } };
    if (parent.filename.endsWith('/routes/home.js')) {
      if (name === '../services/addressValidation') return { AddressVerdictStatus: {} };
      if (name === '../utils/homeDocumentAccess') return { HOME_DOCUMENT_TYPES: ['other'], HOME_DOCUMENT_VISIBILITIES: ['members'] };
      if (!['express', 'joi', 'crypto', '../utils/parsePostGISPoint', '../middleware/validate', '../utils/homePermissions', '../utils/normalizeAddress', '../utils/requestSessionScope', '../services/homeResidencySubmissionService'].includes(name)) return {};
    }
  }
  return load.call(this, name, parent, isMain);
};
const express = require(path.join(root, 'backend/node_modules/express'));
const app = express(); app.use(express.json()); app.use('/api/homes', require(path.join(root, 'backend/routes/home')));
const snapshot = () => JSON.parse(sql(`SELECT json_build_object(
  'claims',(SELECT coalesce(json_agg(json_build_object('status',status,'claimed_role',claimed_role,'cold_start_mode',cold_start_mode)),'[]') FROM public."HomeResidencyClaim" WHERE home_id=${q(home)}),
  'actor_occupancies',(SELECT coalesce(json_agg(json_build_object('is_active',is_active,'verification_status',verification_status,'role_base',role_base)),'[]') FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(actor)}),
  'verified_owners',(SELECT count(*) FROM public."HomeOwner" WHERE home_id=${q(home)} AND owner_status='verified'));`));
let serial = 1000;
const requestId = () => id(++serial);
const endpoint = request => `/api/homes/${home}/residency-submissions${request ? `/${request}` : ''}`;
async function request(method, suffix, body, asActor = actor) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${suffix}`, {
    method, headers: { 'Content-Type': 'application/json', 'x-fixture-actor':asActor }, body:body===undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  const value=await response.json(); const result={ status:response.status,body:value };results.push(result);return result;
}
let selectedAddress;
const submit = (id, role='renter') => request('POST',endpoint(),{ request_id:id,claimed_role:role,address:selectedAddress });
const read = id => request('GET',endpoint(id));
const cancel = id => request('POST',endpoint(id)+'/cancel',{});
const reset = () => sql(`BEGIN; DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};
  DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(actor)};
  DELETE FROM public."HomeAuditLog" WHERE home_id=${q(home)}; COMMIT;`);
function completed(r, id, routing='household_review') {
  assert([200,201].includes(r.status));assert.equal(r.body.state,'completed');assert.equal(r.body.command.request_id,id);
  assert.equal(r.body.command.actor_id,actor);assert.equal(r.body.home_id,home);assert.equal(r.body.claimed_role,'renter');
  assert.equal(r.body.routing,routing);assert.equal(r.body.requires_verification,true);assert.equal(r.body.current_access,'not_checked');
  assert.equal(r.body.postcard_requested,false);assert(!JSON.stringify(r.body).includes('Private submission fixture'));
}
async function main() {
  try {
    const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260911043000_home_residency_submission.sql'),'utf8');
    sql('BEGIN;'+migration+"NOTIFY pgrst, 'reload schema'; COMMIT;");schemaInstalled=true;
    sql(`BEGIN; INSERT INTO auth.users(id,email,email_confirmed_at,last_sign_in_at) VALUES
      (${q(owner)},'atomic-submission-owner@example.invalid',now(),now()),(${q(actor)},'atomic-submission-actor@example.invalid',now(),now());
      INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,'atomic_submission_'||right(id::text,2),'Submission fixture','user' FROM auth.users WHERE id IN (${q(owner)},${q(actor)});
      INSERT INTO public."Home"(id,created_by_user_id,address,city,state,zipcode) VALUES(${q(home)},${q(owner)},'Private submission fixture','Test','WA','98607');
      INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier) VALUES(${q(home)},${q(owner)},'verified',true,'strong');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,verified_at) VALUES(${q(home)},${q(owner)},'owner','owner','adult','verified',now()); COMMIT;`);
    initialized=true;
    let cached=false;
    for(let attempt=0;attempt<40;attempt++) {
      const probe=await client.rpc('get_home_residency_submission',{p_home_id:home,p_actor_id:actor,p_request_id:requestId()});
      if(!probe.error) {cached=true;break;}
      assert.equal(probe.error.code,'PGRST202');await new Promise(resolve=>setTimeout(resolve,200));
    }
    assert(cached,'PostgREST must observe the temporary function before acceptance');
    server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const checked=await request('POST','/api/homes/check-address',{address:'Private submission fixture',city:'Test',state:'WA',zip_code:'98607'});
    assert.equal(checked.status,200);assert.equal(checked.body.home_id,home);
    selectedAddress=checked.body.residency_address;
    assert.deepEqual(selectedAddress,{line1:'Private submission fixture',line2:'',city:'Test',state:'WA',postal_code:'98607',country:'US'});
    let id=requestId();let r=await submit(id);completed(r,id);
    assert.equal(snapshot().claims.length,1);assert.equal(snapshot().actor_occupancies.length,1);
    assert.equal(snapshot().actor_occupancies[0].verification_status,'pending_approval');
    const original=JSON.stringify(r.body);completed(await read(id),id);assert.equal(JSON.stringify((await submit(id)).body),original);
    assert.equal((await submit(id,'household')).status,409);
    assert.equal((await request('GET',endpoint(id),undefined,owner)).status,404);
    console.log('PASS: atomic ordinary submission, current authority, exact retry/status, role conflict and cross-actor privacy');
    reset();
    assert.equal((await request('POST',endpoint(),{request_id:requestId(),claimed_role:'renter'})).status,400);
    sql(`UPDATE public."Home" SET address2='Unit 2' WHERE id=${q(home)};`);
    const changedRequest=requestId();const changed=await submit(changedRequest);
    assert.equal(changed.status,409);assert.equal(changed.body.code,'RESIDENCY_ADDRESS_CHANGED');
    assert.equal(snapshot().claims.length,0);assert.equal(snapshot().actor_occupancies.length,0);
    completed(await read(id),id);
    sql(`UPDATE public."Home" SET address2=NULL WHERE id=${q(home)};`);
    assert.equal((await submit(changedRequest)).body.code,'RESIDENCY_ADDRESS_CHANGED');
    id=requestId();completed(await submit(id),id);reset();
    console.log('PASS: actual address lookup binds the original apartment; changed address rejects atomically, retains old proof and requires a fresh command');
    id=requestId();loseReply=true;assert.equal((await submit(id)).status,503);completed(await read(id),id);completed(await submit(id),id);
    assert.equal(snapshot().claims.length,1);assert.equal(sql(`SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=${q(home)} AND action='residency_submission_saved';`),'1');
    console.log('PASS: lost committed SDK reply recovers one claim, occupancy, audit and original outcome');
    reset();id=requestId();assert.equal((await cancel(id)).body.state,'cancelled');assert.equal((await submit(id)).body.state,'cancelled');assert.equal(snapshot().claims.length,0);
    console.log('PASS: cancellation tombstone prevents a delayed original submission');
    sql(`DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(owner)};`);
    id=requestId();completed(await submit(id),id);assert.equal(snapshot().verified_owners,1);
    console.log('PASS: current verified owner without occupancy still routes to household review');
    reset();
    sql(`CREATE FUNCTION public.residency_submission_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.home_id=${q(home)}::uuid AND NEW.action='residency_submission_saved' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER residency_submission_fixture_failure BEFORE INSERT ON public."HomeAuditLog" FOR EACH ROW EXECUTE FUNCTION public.residency_submission_fixture_failure();`);
    id=requestId();assert.equal((await submit(id)).status,503);assert.equal(snapshot().claims.length,0);assert.equal(snapshot().actor_occupancies.length,0);
    assert.equal((await read(id)).status,404);
    sql('DROP TRIGGER residency_submission_fixture_failure ON public."HomeAuditLog";DROP FUNCTION public.residency_submission_fixture_failure();');
    completed(await submit(id),id);
    console.log('PASS: actual late audit failure rolls back the entire command and the original retry recovers');
    const claim=sql(`SELECT id FROM public."HomeResidencyClaim" WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    sql(`UPDATE public."HomeResidencyClaim" SET status='rejected',reviewed_at=now(),reviewed_by=${q(owner)} WHERE id=${q(claim)};
      UPDATE public."HomeOccupancy" SET age_band='teen',start_at=now()-interval '1 day',access_end_at=now()+interval '2 days' WHERE home_id=${q(home)} AND user_id=${q(actor)};
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'home.view',false);`);
    const occupancyBefore=sql(`SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    id=requestId();completed(await submit(id),id);assert.equal(sql(`SELECT id FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};`),claim);
    assert.equal(sql(`SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id=${q(home)} AND user_id=${q(actor)};`),occupancyBefore);
    assert.equal(sql(`SELECT allowed FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(actor)};`),'f');
    console.log('PASS: rejected resubmission is atomic and preserves existing age, access dates, flags and explicit denies');
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    id=requestId();r=await submit(id);assert.equal(r.status,409);assert.equal(r.body.code,'MEMBERSHIP_RENEWAL_REQUIRED');
    assert.equal(snapshot().actor_occupancies[0].is_active,false);
    reset();sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(actor)};
      DELETE FROM public."HomeOwner" WHERE home_id=${q(home)};UPDATE public."Home" SET created_by_user_id=${q(actor)} WHERE id=${q(home)};`);
    id=requestId();completed(await submit(id),id,'self_bootstrap');assert.equal(snapshot().actor_occupancies[0].verification_status,'provisional_bootstrap');
    const unchanged=sql(`SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    const other=requestId();completed(await submit(other),other,'self_bootstrap');assert.equal(sql(`SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id=${q(home)} AND user_id=${q(actor)};`),unchanged);
    console.log('PASS: private creator setup can submit residency without inventing verification or re-templating a duplicate');
    reset();sql(`UPDATE public."Home" SET created_by_user_id=${q(owner)} WHERE id=${q(home)};
      UPDATE public."User" SET date_of_birth=current_date-interval '10 years' WHERE id=${q(actor)};`);
    id=requestId();completed(await submit(id),id,'external_postcard');assert.equal(snapshot().actor_occupancies[0].verification_status,'pending_postcard');
    assert.equal(sql(`SELECT age_band::text||':'||can_manage_tasks::text||':'||can_manage_access::text FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(actor)};`),'child:false:false');
    assert.equal(events.filter(e=>e.event==='blocked_postage_boundary').length,0);
    console.log('PASS: external verification preserves minor ceilings and reports no postcard dispatch');
    let throttled=false;
    for(let n=0;n<31;n++) { const retry=await submit(id);if(retry.status===429) {
      assert.equal(retry.body.code,'RESIDENCY_SUBMISSION_RATE_LIMITED');throttled=true;break;
    } completed(retry,id,'external_postcard'); }
    assert(throttled,'Actual dedicated actor submission budget must be bounded');
    completed(await read(id),id,'external_postcard');completed(await cancel(id),id,'external_postcard');
    assert.equal((await cancel(requestId())).body.state,'cancelled');
    const otherActor=await request('POST',endpoint(),{request_id:requestId(),claimed_role:'household',address:selectedAddress},owner);
    assert.notEqual(otherActor.status,429);
    assert.equal(events.filter(e=>e.event==='legacy_postcard_budget').length,0);
    console.log('PASS: actual per-actor submission limit preserves status/cancellation and never consumes postcard budget');
  } finally {
    if (initialized) {
      fs.writeFileSync(path.join(evidence,'before-cleanup.json'),JSON.stringify({results,events,final:snapshot()},null,2),{mode:0o600});
      sql(`BEGIN; DROP TRIGGER IF EXISTS residency_submission_fixture_failure ON public."HomeAuditLog";
        DROP FUNCTION IF EXISTS public.residency_submission_fixture_failure();
        DELETE FROM public."HomeAuditLog" WHERE home_id=${q(home)};DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};
        DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};DELETE FROM public."HomePostcardCode" WHERE home_id=${q(home)};
        DELETE FROM public."HomeOwner" WHERE home_id=${q(home)};DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)};
        DELETE FROM public."Home" WHERE id=${q(home)};DELETE FROM public."User" WHERE id IN (${q(owner)},${q(actor)});
        DELETE FROM auth.users WHERE id IN (${q(owner)},${q(actor)});COMMIT;`);
      assert.equal(count(),0);
    }
    if(schemaInstalled) {
      sql(`BEGIN; DROP FUNCTION public.get_home_residency_submission(uuid,uuid,uuid);
        DROP FUNCTION public.cancel_home_residency_submission(uuid,uuid,uuid);
        DROP FUNCTION public.submit_home_residency(uuid,uuid,uuid,jsonb);
        DROP FUNCTION public.home_residency_submission_projection(public."HomeResidencySubmissionCommand");
        DROP TABLE public."HomeResidencySubmissionCommand"; NOTIFY pgrst,'reload schema'; COMMIT;`);
      assert.equal(sql('SELECT max(version) FROM supabase_migrations.schema_migrations;'),ledger);
      console.log('PASS: exact synthetic SQL/temporary functions cleaned; pre-existing review helpers and migration ledger preserved');
    }
    await new Promise(resolve=>server?server.close(resolve):resolve());Module._load=load;global.fetch=rawFetch;
  }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
