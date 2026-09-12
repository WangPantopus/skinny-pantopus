#!/usr/bin/env node
// Actual production HTTP -> Supabase SDK -> SQL acceptance. Authentication and
// provider/notification transport are controlled. Never sends mail or messages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const [container, project, cli, evidence] = process.argv.slice(2);
const root = path.resolve(__dirname, '../..');
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const f = require('./home-residency-review-http-fixture.cjs')(container, { summary: true, dashboard: true, postcard: true });
const { home, id, q, sql } = f;
const applicant = id(2), outsider = id(6), results = [], events = [];
const functions = ['lock_home_postcard_current_scope','home_postcard_current_context','home_postcard_request_projection',
  'get_home_postcard_request','cancel_home_postcard_request','valid_home_postcard_address','home_postcard_request_work',
  'begin_home_postcard_request','home_postcard_confirmed_address','get_home_postcard_current_status',
  'claim_home_postcard_current_dispatch','record_home_postcard_current_dispatch','home_postcard_verification_projection',
  'get_home_postcard_verification','cancel_home_postcard_verification','home_postcard_verified_policy','verify_home_postcard_current','promote_home_postcard_review','challenge_home_postcard_review'];
const ledger = sql('SELECT max(version) FROM supabase_migrations.schema_migrations;');
const reviewDefinitionQuery = "SELECT pg_get_functiondef('public.review_home_residency(uuid,uuid,text,jsonb,integer)'::regprocedure);";
const reviewPropertiesQuery = "SELECT json_build_object('oid',oid,'owner',proowner,'acl',proacl,'config',proconfig) FROM pg_proc WHERE oid='public.review_home_residency(uuid,uuid,text,jsonb,integer)'::regprocedure;";
const originalReview = sql(reviewDefinitionQuery);
const originalReviewProperties = sql(reviewPropertiesQuery);
// Persist an executable, exact pre-mutation recovery copy before installing DDL.
// pg_get_functiondef omits the SQL statement terminator.
fs.writeFileSync(path.join(evidence, 'review-before.sql'), originalReview + ';\n', { mode: 0o600, flag: 'wx' });
fs.writeFileSync(path.join(evidence, 'review-before-properties.json'), originalReviewProperties, { mode: 0o600, flag: 'wx' });
let server, initialized = false, schemaInstalled = false, fault = null, beforeRpc = null;
const extraHomes = Array.from({ length: 201 }, (_, index) => id(10000 + index));
let serial = 1000;
const requestId = () => id(++serial);
const address = { line1: 'Private residency fixture', line2: '602', city: 'Test', state: 'WA', postal_code: '98607', country: 'US' };
const oldEnv = { keys: process.env.HOME_POSTCARD_CODE_KEYS_JSON, active: process.env.HOME_POSTCARD_CODE_ACTIVE_KEY };
// Synthetic test-only key material never enters reports or command output.
const fixtureKeys = { original: Buffer.alloc(32, 17).toString('base64'), rotated: Buffer.alloc(32, 23).toString('base64') };
const configure = (keys = fixtureKeys, active = 'original') => {
  process.env.HOME_POSTCARD_CODE_KEYS_JSON = JSON.stringify(keys); process.env.HOME_POSTCARD_CODE_ACTIVE_KEY = active;
};
function snapshot(label) {
  const data = JSON.parse(sql(`SELECT json_build_object(
    'cards',(SELECT coalesce(json_agg(to_jsonb(c)),'[]') FROM public."HomePostcardCode" c WHERE home_id=${q(home)}),
    'verification_commands',(SELECT coalesce(json_agg(to_jsonb(c)),'[]') FROM public."HomePostcardVerificationCommand" c WHERE home_id=${q(home)}),
    'commands',(SELECT coalesce(json_agg(to_jsonb(c)),'[]') FROM public."HomePostcardRequestCommand" c WHERE home_id=${q(home)}),
    'occupancies',(SELECT json_agg(to_jsonb(o)) FROM public."HomeOccupancy" o WHERE home_id=${q(home)}),
    'claims',(SELECT json_agg(to_jsonb(c)) FROM public."HomeResidencyClaim" c WHERE home_id=${q(home)}));`));
  fs.writeFileSync(path.join(evidence, label + '.json'), JSON.stringify(data, null, 2), { mode: 0o600 });
}
const cardRow = cardId => sql(`SELECT to_jsonb(p) FROM public."HomePostcardCode" p WHERE id=${q(cardId)};`);
async function request(action, body, actor = applicant, extraHeaders = {}) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes/${home}/${action}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'x-fixture-actor': actor, 'Content-Type': 'application/json', ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const value = await response.json();
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert(!/(code_hash|code_key_id|vendor_job_id|destination|SERVICE_ROLE|stack)/.test(JSON.stringify(value)));
  results.push({ action, actor, status: response.status, body: value });
  return { status: response.status, body: value };
}
const submit = (command, selected = address, actor = applicant) => request('postcard-requests', { request_id: command, address: selected }, actor);
const current = (actor = applicant) => request('postcard-status', undefined, actor);
const read = (command, actor = applicant) => request('postcard-requests/' + command, undefined, actor);
const cancel = command => request('postcard-requests/' + command + '/cancel', {});
function retireOwnCards() {
  snapshot('before-retirement-' + serial);
  sql(`UPDATE public."HomePostcardCode" SET status='expired',requested_at=clock_timestamp()-interval '2 hours' WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
}
function completed(r, command) {
  assert.equal(r.status, 200); assert.equal(r.body.state, 'completed');
  assert.equal(r.body.command.request_id, command); assert.equal(r.body.command.actor_id, applicant);
  assert.equal(r.body.home_id, home); assert.match(r.body.postcard_id, /^[a-f0-9-]{36}$/);
}
async function main() {
  try {
    assert.equal(sql(`SELECT count(*) FROM public."Home" WHERE id IN (${extraHomes.map(q)});`), '0');
    assert.equal(sql(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${functions.map(q)});`), '0');
    assert.equal(sql(`SELECT to_regclass('public."HomePostcardRequestCommand"') IS NULL AND to_regclass('public."HomePostcardVerificationCommand"') IS NULL;`), 't');
    assert.equal(sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('postcard_request_fixture_failure','residency_http_receipt_failure');"), '0');
    let config;
    try { config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })); }
    catch (_) { throw new Error('Owned local SDK configuration unavailable'); }
    assert.equal(config.API_URL, 'http://127.0.0.1:64521');
    const rawFetch = global.fetch;
    global.fetch = (input, options) => { const u = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      assert(['127.0.0.1', 'localhost'].includes(u.hostname), 'No external acceptance calls'); return rawFetch(input, options); };
    const { createClient } = require(path.join(root, 'backend/node_modules/@supabase/supabase-js'));
    const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    f.useDatabaseClient({ supabaseUrl: client.supabaseUrl, rpc: async (name, args) => {
      assert(functions.includes(name) || ['home_record_context','get_home_residency_review','decide_home_residency_review'].includes(name));
      if (beforeRpc?.name === name) { const hook = beforeRpc; beforeRpc = null; await hook.run(args); }
      if (fault?.name === name && fault.before && (!fault.homeId || fault.homeId === args.p_home_id)) { fault = null; return { data: null, error: { code: 'SYNTHETIC' } }; }
      const response = await client.rpc(name, args);
      events.push({ rpc: name, state: response.data?.state, code: response.data?.code, error: response.error?.code || null,
        diagnostic: response.error?.message });
      if (fault?.name === name && !response.error && (!fault.homeId || fault.homeId === args.p_home_id)) {
        const active = fault; fault = null;
        if (active.malformed) return { data: { ok: true }, error: null };
        throw new Error('Synthetic lost committed SDK reply');
      }
      return response;
    }, from: table => { assert(['HomePostcardCode','Home','User','HomeOwner','HomeOccupancy','HomeResidencyClaim',
      'HomeRolePermission','HomePermissionOverride','HomeOwnershipClaim'].includes(table)); return client.from(table); } });
    sql('BEGIN;' + fs.readFileSync(path.join(root, 'supabase/migrations/20260911050000_home_postcard_current_recovery.sql'), 'utf8') + '\n' +
      fs.readFileSync(path.join(root, 'supabase/migrations/20260912010000_home_postcard_verification_recovery.sql'), 'utf8') + "NOTIFY pgrst, 'reload schema'; COMMIT;"); schemaInstalled = true;
    f.setup(); initialized = true;
    sql(`UPDATE public."Home" SET address2='602' WHERE id=${q(home)};
      DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(f.actor)};
      UPDATE public."HomeOccupancy" SET id=${q(id(90000))},role_base='restricted_member',age_band='teen',verification_status='pending_postcard',access_end_at=clock_timestamp()+interval '20 days'
        WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    // Wait only for this temporary schema to enter the owned PostgREST cache.
    for (let n = 0; n < 30; n++) {
      const r = await client.rpc('get_home_postcard_verification', { p_home_id: home, p_actor_id: applicant, p_postcard_id: id(999), p_request_id: id(998) });
      if (!r.error) break;
      if (n === 29) throw new Error('Temporary postal schema did not reach owned PostgREST');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    configure(); f.setPostcardResult({ success: false, deliveryUnknown: true });
    const original = requestId(); let r = await submit(original); completed(r, original);
    const card = r.body.postcard_id, code = f.postcardDeliveries[0].code;
    const wrong = code === '111111' ? '222222' : '111111';
    const verification = (attempt, value = code, cardId = card, actor = applicant) => request(`postcards/${cardId}/verifications`, { request_id: attempt, code: value }, actor);
    const readVerification = (attempt, actor = applicant) => request(`postcards/${card}/verifications/${attempt}`, undefined, actor);
    const cancelVerification = attempt => request(`postcards/${card}/verifications/${attempt}/cancel`, {});
    const attempts = () => JSON.parse(cardRow(card)).attempts;
    const occupancy = () => sql(`SELECT to_jsonb(o) FROM public."HomeOccupancy" o WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    const failed = requestId(); fault = { name: 'verify_home_postcard_current' };
    r = await verification(failed, wrong); assert.equal(r.status, 503); assert.equal(attempts(), 1);
    r = await readVerification(failed); assert.equal(r.status, 400); assert.equal(r.body.code, 'POSTCARD_WRONG_CODE'); assert.equal(r.body.attempts_remaining, 4);
    r = await verification(failed, wrong); assert.equal(r.status, 400); assert.equal(attempts(), 1);
    r = await verification(failed); assert.equal(r.status, 409); assert.equal(r.body.code, 'POSTCARD_VERIFICATION_CONFLICT');
    r = await readVerification(failed, outsider); assert.equal(r.status, 404);
    const cancelled = requestId(); r = await cancelVerification(cancelled); assert.equal(r.body.state, 'cancelled');
    r = await verification(cancelled); assert.equal(r.body.state, 'cancelled'); assert.equal(attempts(), 1);
    r = await verification(requestId(), code, id(7000)); assert.equal(r.status, 404); assert.equal(attempts(), 1);
    const before = occupancy();
    sql(`UPDATE public."Home" SET home_status='archived' WHERE id=${q(home)};`);
    r = await verification(requestId()); assert.equal(r.status, 403); assert.equal(r.body.code, 'POSTCARD_HOME_UNAVAILABLE');
    assert.equal(occupancy(), before); assert.equal(attempts(), 1);
    sql(`UPDATE public."Home" SET home_status='active' WHERE id=${q(home)};
      UPDATE public."HomeOccupancy" SET start_at=clock_timestamp()+interval '1 day' WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    r = await verification(requestId()); assert.equal(r.status, 409); assert.equal(r.body.code, 'POSTCARD_ACCESS_REVIEW_REQUIRED');
    assert.equal(attempts(), 1);
    sql(`UPDATE public."HomeOccupancy" SET start_at=NULL WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    const success = requestId(); fault = { name: 'verify_home_postcard_current' };
    r = await verification(success); assert.equal(r.status, 503); assert.equal(attempts(), 2);
    r = await readVerification(success); completed(r, success); assert.equal(r.body.verification_status, 'provisional'); assert.equal(r.body.current_access, 'not_checked');
    const after = occupancy(); const originalWindow = JSON.parse(after).challenge_window_ends_at;
    r = await request('my-residency'); assert.equal(r.status, 200); assert.equal(r.body.current_access, 'none'); assert.equal(r.body.next_step, 'household_review');
    assert.equal(sql(`SELECT status FROM public."HomeResidencyClaim" WHERE home_id=${q(home)} AND user_id=${q(applicant)};`), 'pending');
    completed(await verification(success), success); assert.equal(occupancy(), after); assert.equal(attempts(), 2);
    const nextAttempt = requestId(); completed(await verification(nextAttempt), nextAttempt); assert.equal(occupancy(), after); assert.equal(attempts(), 2);
    fault = { name: 'get_home_postcard_verification', malformed: true }; r = await readVerification(success); assert.equal(r.status, 503);
    completed(await readVerification(success), success);
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    r = await verification(requestId()); assert.equal(r.status, 409); assert.equal(r.body.code, 'POSTCARD_ACCESS_REVIEW_REQUIRED');
    completed(await readVerification(success), success); r = await request('my-residency'); assert.equal(r.body.current_access, 'none'); assert.equal(r.body.next_step, 'access_review');
    assert.equal(JSON.parse(occupancy()).challenge_window_ends_at, originalWindow);
    snapshot('retained-code-and-current-review');
    console.log('PASS: exact card/attempt, lost wrong/correct reply recovery, cancellation, unchanged review dates, reviewable claim and current removal');

    sql(`UPDATE public."HomeOccupancy" SET is_active=true,challenge_window_started_at=clock_timestamp()-interval '8 days',
      challenge_window_ends_at=clock_timestamp()-interval '1 day' WHERE home_id=${q(home)} AND user_id=${q(applicant)};
      UPDATE public."HomePostcardCode" SET verified_at=clock_timestamp()-interval '7 days' WHERE id=${q(card)};
      UPDATE public."Home" SET home_status='archived' WHERE id=${q(home)};`);
    const job = require(path.join(root, 'backend/jobs/processClaimWindows'));
    await job(); assert.equal(JSON.parse(occupancy()).verification_status, 'provisional'); assert.equal(f.notifications.length, 0);
    sql(`UPDATE public."Home" SET home_status='active' WHERE id=${q(home)};
      UPDATE public."HomeResidencyClaim" SET status='rejected' WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    await job(); assert.equal(JSON.parse(occupancy()).verification_status, 'provisional'); assert.equal(f.notifications.length, 0);
    sql(`UPDATE public."HomeResidencyClaim" SET status='pending' WHERE home_id=${q(home)} AND user_id=${q(applicant)};
      UPDATE public."User" SET date_of_birth='2020-01-01' WHERE id=${q(applicant)};
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(applicant)},'home.view',false),(${q(home)},${q(applicant)},'docs.view',false);`);
    // More than one page of earlier blocked candidates must not starve the
    // eligible review. They are exact synthetic Homes with no mail proof.
    sql('BEGIN;' + extraHomes.map((extraHome, index) => `
      INSERT INTO public."Home"(id,created_by_user_id,address,city,state,zipcode)
        VALUES(${q(extraHome)},${q(f.actor)},'Blocked review fixture','Test','WA','98607');
      INSERT INTO public."HomeOccupancy"(id,home_id,user_id,role,role_base,verification_status,challenge_window_started_at,challenge_window_ends_at)
        VALUES(${q(id(20000 + index))},${q(extraHome)},${q(applicant)},'member','restricted_member','provisional',clock_timestamp()-interval '8 days',clock_timestamp()-interval '1 day');
    `).join('') + 'COMMIT;');
    fault = { name: 'promote_home_postcard_review', before: true, homeId: home };
    await job(); assert.equal(JSON.parse(occupancy()).verification_status, 'provisional'); assert.equal(f.notifications.length, 0);
    await job(); const promoted = occupancy(); assert.equal(JSON.parse(promoted).verification_status, 'verified');
    assert.equal(JSON.parse(promoted).age_band, 'child'); assert.equal(JSON.parse(promoted).role_base, 'restricted_member');
    assert.equal(JSON.parse(promoted).can_manage_tasks, false); assert.equal(f.notifications.length, 1);
    assert(!JSON.stringify(f.notifications).includes('Private residency fixture'));
    await job(); assert.equal(occupancy(), promoted); assert.equal(f.notifications.length, 1);
    r = await request('my-residency'); assert.equal(r.body.current_access, 'none'); assert.equal(r.body.next_step, 'access_review');
    assert.equal(sql(`SELECT count(*) FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(applicant)} AND NOT allowed;`), '2');
    const occId = JSON.parse(promoted).id;
    r = await request(`challenge-member/${occId}`, {}, f.actor); assert.equal(r.status, 409); assert.equal(r.body.code, 'POSTCARD_REVIEW_CHANGED');
    assert.equal(occupancy(), promoted);
    sql(`UPDATE public."HomeOccupancy" SET verification_status='provisional',verified_at=NULL,verification_expires_at=NULL,
      challenge_window_started_at=clock_timestamp(),challenge_window_ends_at=clock_timestamp()+interval '7 days'
      WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    r = await request(`challenge-member/${occId}`, {}, outsider); assert.equal(r.status, 403);
    r = await request(`challenge-member/${occId}`, {}, f.actor); assert.equal(r.status, 200);
    const challenged = occupancy(); assert.equal(JSON.parse(challenged).verification_status, 'suspended_challenged');
    assert.equal(JSON.parse(challenged).is_active, false); assert.equal(f.notifications.length, 2);
    r = await request(`challenge-member/${occId}`, {}, f.actor); assert.equal(r.status, 200);
    assert.equal(occupancy(), challenged); assert.equal(f.notifications.length, 2);
    await job(); assert.equal(occupancy(), challenged); assert.equal(f.notifications.length, 2);
    console.log('PASS: actual challenge endpoint refuses completed review, requires current authority, suspends atomically and recovers without duplicate notification');
    sql(`UPDATE public."HomeOccupancy" SET is_active=true,verification_status='pending_postcard',verified_at=NULL,
      verification_expires_at=NULL,challenge_window_started_at=NULL,challenge_window_ends_at=NULL
      WHERE home_id=${q(home)} AND user_id=${q(applicant)};
      UPDATE public."HomeResidencyClaim" SET status='pending' WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    f.setPostcardResult({ success: true });
    const newMail = requestId(); r = await submit(newMail); completed(r, newMail);
    const newCard = r.body.postcard_id, newCode = f.postcardDeliveries.at(-1).code;
    const beforeLateCard = cardRow(newCard), beforeLateOccupancy = occupancy();
    sql(`CREATE FUNCTION public.postcard_request_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic late verification receipt failure'; END; $$;
      CREATE TRIGGER postcard_request_fixture_failure BEFORE INSERT ON public."HomeAuditLog" FOR EACH ROW WHEN (NEW.home_id=${q(home)}::uuid) EXECUTE FUNCTION public.postcard_request_fixture_failure();`);
    const lateAttempt = requestId(); r = await verification(lateAttempt, newCode, newCard); assert.equal(r.status, 503);
    assert.equal(cardRow(newCard), beforeLateCard); assert.equal(occupancy(), beforeLateOccupancy);
    assert.equal(sql(`SELECT count(*) FROM public."HomePostcardVerificationCommand" WHERE actor_user_id=${q(applicant)} AND request_id=${q(lateAttempt)};`), '0');
    sql('DROP TRIGGER postcard_request_fixture_failure ON public."HomeAuditLog"; DROP FUNCTION public.postcard_request_fixture_failure();');
    r = await verification(lateAttempt, newCode, newCard); completed(r, lateAttempt);
    console.log('PASS: late verification audit failure rolls back code, occupancy and retained outcome; original retry recovers');
    const claimId = sql(`SELECT id FROM public."HomeResidencyClaim" WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    r = await request(`claim/${claimId}/review`, undefined, f.actor); assert.equal(r.status, 200);
    const reviewToken = r.body.claim.review_token, sessionScope = r.body.residency_session.session_scope;
    r = await request(`claim/${claimId}/approve`, { request_id: requestId(), review_token: reviewToken, proposed_role: 'restricted_member' }, f.actor,
      { 'x-pantopus-session-scope': sessionScope });
    assert.equal(r.status, 200); assert.equal(r.body.claim.status, 'verified');
    assert.equal(r.body.occupancy.verification_status, 'verified'); assert.equal(r.body.occupancy.role_base, 'restricted_member');
    assert.equal(r.body.occupancy.age_band, 'child');
    console.log('PASS: actual prepared household approval completes the postal review while preserving child role and explicit denies');
    snapshot('current-promotion-with-explicit-denies');
    console.log('PASS: actual promotion worker rejects archived/rejected state, passes 201 earlier blocked candidates, recovers RPC failure, tightens child restrictions and preserves denies without renewal');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({ results, events, diagnostics: f.diagnostics,
      provider_calls: f.postcardDeliveries.map(({ code, ...safe }) => safe), notifications: f.notifications.length }, null, 2), { mode: 0o600 });
    if (initialized) {
      sql(`DROP TRIGGER IF EXISTS postcard_request_fixture_failure ON public."HomeAuditLog";
        DROP FUNCTION IF EXISTS public.postcard_request_fixture_failure();
        DELETE FROM public."HomePostcardVerificationCommand" WHERE home_id=${q(home)};
        DELETE FROM public."HomePostcardRequestCommand" WHERE home_id=${q(home)};
        DELETE FROM public."Home" WHERE id IN (${extraHomes.map(q)});`); f.cleanup();
      assert.equal(sql(`SELECT count(*) FROM public."Home" WHERE id IN (${extraHomes.map(q)});`), '0');
    }
    if (schemaInstalled) {
      const drops = sql(`SELECT 'DROP FUNCTION '||p.oid::regprocedure::text||';' FROM pg_proc p WHERE pronamespace='public'::regnamespace AND proname IN (${functions.map(q)}) ORDER BY oid DESC;`);
      sql('BEGIN;' + originalReview + ';\n' + drops + 'DROP TABLE public."HomePostcardVerificationCommand"; DROP TABLE public."HomePostcardRequestCommand";' + "NOTIFY pgrst, 'reload schema'; COMMIT;");
      assert.equal(sql(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${functions.map(q)});`), '0');
    }
    assert.equal(sql(reviewDefinitionQuery), originalReview);
    assert.equal(sql(reviewPropertiesQuery), originalReviewProperties);
    fs.writeFileSync(path.join(evidence, 'review-restored.json'), JSON.stringify({ exact_definition_preserved: true, oid_owner_acl_config_preserved: true }), { mode: 0o600, flag: 'wx' });
    f.restoreModules();
    for (const [key, value] of [['HOME_POSTCARD_CODE_KEYS_JSON', oldEnv.keys], ['HOME_POSTCARD_CODE_ACTIVE_KEY', oldEnv.active]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    assert.equal(sql('SELECT max(version) FROM supabase_migrations.schema_migrations;'), ledger);
    console.log('PASS: exact fixture and temporary schema cleanup; no mail/messages, no ledger adoption');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
