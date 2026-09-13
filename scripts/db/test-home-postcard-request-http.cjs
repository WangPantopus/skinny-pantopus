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
  'claim_home_postcard_current_dispatch','record_home_postcard_current_dispatch'];
const ledger = sql('SELECT max(version) FROM supabase_migrations.schema_migrations;');
let server, initialized = false, schemaInstalled = false, fault = null, beforeRpc = null;
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
    'commands',(SELECT coalesce(json_agg(to_jsonb(c)),'[]') FROM public."HomePostcardRequestCommand" c WHERE home_id=${q(home)}),
    'occupancies',(SELECT json_agg(to_jsonb(o)) FROM public."HomeOccupancy" o WHERE home_id=${q(home)}),
    'claims',(SELECT json_agg(to_jsonb(c)) FROM public."HomeResidencyClaim" c WHERE home_id=${q(home)}));`));
  fs.writeFileSync(path.join(evidence, label + '.json'), JSON.stringify(data, null, 2), { mode: 0o600 });
}
const cardRow = cardId => sql(`SELECT to_jsonb(p) FROM public."HomePostcardCode" p WHERE id=${q(cardId)};`);
async function request(action, body, actor = applicant) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes/${home}/${action}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'x-fixture-actor': actor, 'Content-Type': 'application/json' },
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
    assert.equal(sql(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${functions.map(q)});`), '0');
    assert.equal(sql(`SELECT to_regclass('public."HomePostcardRequestCommand"') IS NULL;`), 't');
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
      assert(functions.includes(name) || name === 'home_record_context');
      if (beforeRpc?.name === name) { const hook = beforeRpc; beforeRpc = null; await hook.run(args); }
      if (fault?.name === name && fault.before) { fault = null; return { data: null, error: { code: 'SYNTHETIC' } }; }
      const response = await client.rpc(name, args);
      events.push({ rpc: name, state: response.data?.state, code: response.data?.code, error: response.error?.code || null,
        diagnostic: response.error?.message });
      if (fault?.name === name && !response.error) {
        const active = fault; fault = null;
        if (active.malformed) return { data: { ok: true }, error: null };
        throw new Error('Synthetic lost committed SDK reply');
      }
      return response;
    }, from: table => { assert(['HomePostcardCode','Home','User','HomeOwner','HomeOccupancy','HomeResidencyClaim',
      'HomeRolePermission','HomePermissionOverride','HomeOwnershipClaim'].includes(table)); return client.from(table); } });
    sql('BEGIN;' + fs.readFileSync(path.join(root, 'supabase/migrations/20260911050000_home_postcard_current_recovery.sql'), 'utf8') + "NOTIFY pgrst, 'reload schema'; COMMIT;"); schemaInstalled = true;
    f.setup(); initialized = true;
    sql(`UPDATE public."Home" SET address2='602' WHERE id=${q(home)};
      DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(f.actor)};
      UPDATE public."HomeOccupancy" SET role_base='restricted_member',age_band='teen',verification_status='pending_postcard'
        WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    // Wait only for this temporary schema to enter the owned PostgREST cache.
    for (let n = 0; n < 30; n++) {
      const r = await client.rpc('get_home_postcard_current_status', { p_home_id: home, p_actor_id: applicant });
      if (!r.error) break;
      if (n === 29) throw new Error('Temporary postal schema did not reach owned PostgREST');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    let r = await current(); assert.equal(r.status, 200); assert.equal(r.body.postcard, null);
    assert.equal(r.body.can_request, true); assert.equal(r.body.can_resume, false);
    r = await current(outsider); assert.equal(r.status, 404);
    delete process.env.HOME_POSTCARD_CODE_KEYS_JSON; delete process.env.HOME_POSTCARD_CODE_ACTIVE_KEY;
    const missing = requestId(); r = await submit(missing); assert.equal(r.status, 503); assert.equal(r.body.code, 'POSTCARD_CODE_KEY_UNAVAILABLE');
    r = await read(missing); assert.equal(r.status, 404);
    const cancelled = requestId(); r = await cancel(cancelled); assert.equal(r.body.state, 'cancelled');
    r = await submit(cancelled); assert.equal(r.body.state, 'cancelled'); assert.equal(f.postcardDeliveries.length, 0);
    configure();
    const original = requestId();
    fault = { name: 'begin_home_postcard_request' };
    r = await submit(original); assert.equal(r.status, 503); assert.equal(f.postcardDeliveries.length, 0);
    r = await read(original); completed(r, original); const firstCard = r.body.postcard_id;
    const savedCard = cardRow(firstCard);
    r = await current(); assert.equal(r.body.can_resume, true); assert.equal(r.body.postcard.delivery, 'not_started');
    assert.deepEqual(r.body.request.address, address);
    r = await submit(original, { ...address, line2: '999' }); assert.equal(r.status, 409);
    r = await read(original, outsider); assert.equal(r.status, 404);
    configure({ rotated: fixtureKeys.rotated }, 'rotated');
    r = await submit(original); completed(r, original); assert.equal(r.body.dispatch_error, 'POSTCARD_CODE_KEY_UNAVAILABLE');
    assert.equal(cardRow(firstCard), savedCard); assert.equal(f.postcardDeliveries.length, 0);
    configure(fixtureKeys, 'rotated');
    sql(`UPDATE public."HomeOccupancy" SET start_at=clock_timestamp()+interval '1 day' WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    r = await submit(original); completed(r, original); assert.equal(r.body.dispatch_error, 'POSTCARD_ACCESS_REVIEW_REQUIRED');
    assert.equal(cardRow(firstCard), savedCard);
    sql(`UPDATE public."HomeOccupancy" SET start_at=NULL WHERE home_id=${q(home)} AND user_id=${q(applicant)};
      UPDATE public."Home" SET address2='CURRENT-PRIVATE-999' WHERE id=${q(home)};`);
    r = await submit(original); completed(r, original); assert.equal(r.body.dispatch_error, 'POSTCARD_ADDRESS_CHANGED');
    r = await current(); assert.equal(r.body.request.address.line2, '602'); assert(!JSON.stringify(r).includes('CURRENT-PRIVATE-999'));
    assert.equal(r.body.can_resume, false); assert.equal(r.body.can_verify, false); assert.equal(cardRow(firstCard), savedCard);
    sql(`UPDATE public."Home" SET address2='602' WHERE id=${q(home)};`);
    f.setPostcardResult({ success: false, deliveryUnknown: true });
    r = await submit(original); completed(r, original); assert.equal(f.postcardDeliveries.length, 1);
    assert.equal(f.postcardDeliveries[0].destination.address2, '602');
    r = await current(); assert.equal(r.body.postcard.delivery, 'unknown'); assert.equal(r.body.can_resume, false);
    delete process.env.HOME_POSTCARD_CODE_KEYS_JSON;
    await Promise.all(Array.from({ length: 8 }, async () => completed(await submit(original), original)));
    assert.equal(f.postcardDeliveries.length, 1); configure();
    snapshot('original-recovery-unknown');
    console.log('PASS: original UUID/address/code-key recovery, cancellation, current-policy refusal and no duplicate uncertain dispatch');

    retireOwnCards();
    const dispatchLost = requestId(); fault = { name: 'claim_home_postcard_current_dispatch' };
    r = await submit(dispatchLost); completed(r, dispatchLost); assert.equal(f.postcardDeliveries.length, 1);
    r = await current(); assert.equal(r.body.postcard.delivery, 'unknown'); assert.equal(r.body.can_resume, false);
    r = await submit(dispatchLost); completed(r, dispatchLost); assert.equal(f.postcardDeliveries.length, 1);
    retireOwnCards();
    const receiptLost = requestId(); f.setPostcardResult({ success: true }); fault = { name: 'record_home_postcard_current_dispatch', before: true };
    r = await submit(receiptLost); completed(r, receiptLost); const receiptCard = r.body.postcard_id;
    assert.equal(f.postcardDeliveries.length, 2); r = await current(); assert.equal(r.body.postcard.delivery, 'unknown');
    completed(await submit(receiptLost), receiptLost); assert.equal(f.postcardDeliveries.length, 2);
    const receipt = 'psc_fixture_' + receiptCard;
    const webhook = require(path.join(root, 'backend/services/homePostcardService'));
    const reconciled = await webhook.processWebhookEvent(receipt, 'postcard.created', { body: { id: receipt, object: 'postcard', metadata: { pantopus_home_postcard_id: receiptCard } } });
    assert.equal(reconciled.success, true); r = await current(); assert.equal(r.body.postcard.delivery, 'accepted');
    fault = { name: 'get_home_postcard_current_status', malformed: true }; r = await current(); assert.equal(r.status, 503);
    r = await current(); assert.equal(r.body.postcard.delivery, 'accepted');
    console.log('PASS: lost dispatch reply never resends; failed receipt save remains unknown until signed-webhook boundary reconciliation; malformed status retries');

    retireOwnCards();
    const rejection = requestId(); f.setPostcardResult({ success: false, deliveryUnknown: false });
    r = await submit(rejection); completed(r, rejection); r = await current();
    assert.equal(r.body.postcard.delivery, 'rejected'); assert.equal(r.body.postcard.status, 'cancelled'); assert.equal(r.body.can_request, true);
    const calls = f.postcardDeliveries.length;
    completed(await submit(rejection), rejection); assert.equal(f.postcardDeliveries.length, calls);
    const corrected = requestId(); f.setPostcardResult({ success: true });
    r = await submit(corrected); completed(r, corrected); assert.equal(f.postcardDeliveries.length, calls + 1);
    r = await cancel(corrected); assert.equal(r.body.state, 'completed');
    snapshot('definite-rejection-and-new-request');
    console.log('PASS: definite refusal allows an explicit new request; cancellation cannot pretend admitted mail was recalled');

    retireOwnCards();
    for (const state of ['archived', 'merged']) {
      sql(`UPDATE public."Home" SET home_status=${q(state)} WHERE id=${q(home)};`);
      r = await submit(requestId()); assert.equal(r.status, 403); assert.equal(r.body.state, 'rejected'); assert.equal(r.body.code, 'POSTCARD_HOME_UNAVAILABLE');
    }
    sql(`UPDATE public."Home" SET home_status='active' WHERE id=${q(home)};`);
    for (const state of ['frozen', 'frozen_silent', 'disputed']) {
      sql(`UPDATE public."Home" SET security_state=${q(state)} WHERE id=${q(home)};`);
      r = await submit(requestId()); assert.equal(r.status, 403); assert.equal(r.body.code, 'POSTCARD_HOME_UNAVAILABLE');
    }
    sql(`UPDATE public."Home" SET security_state='normal' WHERE id=${q(home)};
      UPDATE public."HomeResidencyClaim" SET status='rejected' WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
    r = await submit(requestId()); assert.equal(r.status, 409); assert.equal(r.body.code, 'POSTCARD_ACCESS_REVIEW_REQUIRED');
    sql(`UPDATE public."HomeResidencyClaim" SET status='pending' WHERE home_id=${q(home)} AND user_id=${q(applicant)};
      UPDATE public."Home" SET owner_id=${q(applicant)} WHERE id=${q(home)};`);
    r = await submit(requestId()); assert.equal(r.status, 409); assert.equal(r.body.code, 'OWNERSHIP_FLOW_REQUIRED');
    sql(`UPDATE public."Home" SET owner_id=${q(f.actor)} WHERE id=${q(home)};`);
    // Fault after insert/admission but before receipt: the entire new transaction must roll back.
    sql(`CREATE FUNCTION public.postcard_request_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic late postal receipt failure'; END; $$;
      CREATE TRIGGER postcard_request_fixture_failure BEFORE INSERT ON public."HomeAuditLog" FOR EACH ROW WHEN (NEW.home_id=${q(home)}::uuid) EXECUTE FUNCTION public.postcard_request_fixture_failure();`);
    const failed = requestId(); const beforeCount = sql(`SELECT count(*) FROM public."HomePostcardCode" WHERE home_id=${q(home)};`);
    r = await submit(failed); assert.equal(r.status, 503); assert.equal(sql(`SELECT count(*) FROM public."HomePostcardCode" WHERE home_id=${q(home)};`), beforeCount);
    r = await read(failed); assert.equal(r.status, 404);
    sql('DROP TRIGGER postcard_request_fixture_failure ON public."HomeAuditLog"; DROP FUNCTION public.postcard_request_fixture_failure();');
    completed(await submit(failed), failed);
    console.log('PASS: archived/merged/frozen/disputed/rejected/ownership constraints and late-write rollback/retry');
    assert.equal(f.notifications.length, 0); snapshot('final');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({ results, events, diagnostics: f.diagnostics,
      provider_calls: f.postcardDeliveries.map(({ code, ...safe }) => safe), notifications: f.notifications.length }, null, 2), { mode: 0o600 });
    if (initialized) {
      sql(`DROP TRIGGER IF EXISTS postcard_request_fixture_failure ON public."HomeAuditLog";
        DROP FUNCTION IF EXISTS public.postcard_request_fixture_failure();
        DELETE FROM public."HomePostcardRequestCommand" WHERE home_id=${q(home)};`); f.cleanup();
    }
    if (schemaInstalled) {
      const drops = sql(`SELECT 'DROP FUNCTION '||p.oid::regprocedure::text||';' FROM pg_proc p WHERE pronamespace='public'::regnamespace AND proname IN (${functions.map(q)}) ORDER BY oid DESC;`);
      sql('BEGIN;' + drops + 'DROP TABLE public."HomePostcardRequestCommand";' + "NOTIFY pgrst, 'reload schema'; COMMIT;");
      assert.equal(sql(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${functions.map(q)});`), '0');
    }
    f.restoreModules();
    for (const [key, value] of [['HOME_POSTCARD_CODE_KEYS_JSON', oldEnv.keys], ['HOME_POSTCARD_CODE_ACTIVE_KEY', oldEnv.active]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    assert.equal(sql('SELECT max(version) FROM supabase_migrations.schema_migrations;'), ledger);
    console.log('PASS: exact fixture and temporary schema cleanup; no mail/messages, no ledger adoption');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
