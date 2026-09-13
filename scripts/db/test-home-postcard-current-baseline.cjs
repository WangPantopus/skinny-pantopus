#!/usr/bin/env node
// Record the existing postal flow's current-policy/address gaps using actual
// production routes, SDK and SQL. The provider/notification boundaries never send.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const [container, project, cli, evidence] = process.argv.slice(2);
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(path.resolve(__dirname, '../..') + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const f = require('./home-residency-review-http-fixture.cjs')(container, { summary: true, dashboard: true, postcard: true });
const { home, id, q, sql } = f;
const extras = [id(101), id(102), id(103)];
const results = [], queries = [];
let server, initialized = false;
const ledger = sql('SELECT max(version) FROM supabase_migrations.schema_migrations;');
function snapshot(name) {
  const data = JSON.parse(sql(`SELECT json_build_object(
    'homes',(SELECT json_agg(to_jsonb(h)) FROM public."Home" h WHERE id IN (${[home, ...extras].map(q)})),
    'cards',(SELECT json_agg(to_jsonb(c)) FROM public."HomePostcardCode" c WHERE home_id IN (${[home, ...extras].map(q)})),
    'occupancies',(SELECT json_agg(to_jsonb(o)) FROM public."HomeOccupancy" o WHERE home_id IN (${[home, ...extras].map(q)})),
    'claims',(SELECT json_agg(to_jsonb(c)) FROM public."HomeResidencyClaim" c WHERE home_id IN (${[home, ...extras].map(q)})));`));
  fs.writeFileSync(path.join(evidence, name+'.json'), JSON.stringify(data, null, 2), { mode: 0o600 });
}
async function request(homeId, actorId, action, body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes/${homeId}/${action}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'x-fixture-actor': actorId, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const value = await response.json();
  results.push({ action, homeId, actorId, status: response.status, cache: response.headers.get('cache-control'),
    delivery_unknown: value.delivery_unknown, verification_status: value.verification_status, code: value.code });
  return { status: response.status, body: value, cache: response.headers.get('cache-control') };
}
function extra(homeId, actorId, { archived = false, future = false } = {}) {
  sql(`BEGIN;INSERT INTO public."Home"(id,created_by_user_id,address,address2,city,state,zipcode,home_status)
    VALUES(${q(homeId)},${q(f.actor)},'Submitted postal fixture','602','Test','WA','98607',${q(archived ? 'archived' : 'active')});
    INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES(${q(homeId)},${q(f.actor)},'verified',true);
    INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status,start_at)
    VALUES(${q(homeId)},${q(actorId)},'member','restricted_member','pending_postcard',${future ? "now()+interval '1 day'" : 'NULL'});
    INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_address,claimed_role,status,cold_start_mode)
    VALUES(${q(homeId)},${q(actorId)},'Submitted postal fixture, 602','renter','pending','external_postcard');COMMIT;`);
}
async function main() {
  try {
    assert.equal(sql(`SELECT count(*) FROM public."Home" WHERE id IN (${extras.map(q)});`), '0');
    assert.equal(sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='residency_http_receipt_failure';"), '0');
    let config;
    try { config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })); }
    catch (_) { throw new Error('Owned local SDK configuration unavailable'); }
    assert.equal(config.API_URL, 'http://127.0.0.1:64521');
    const rawFetch = global.fetch;
    global.fetch = (input, options) => { const u = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      assert(['127.0.0.1', 'localhost'].includes(u.hostname), 'No external acceptance calls'); return rawFetch(input, options); };
    const { createClient } = require(path.resolve(__dirname, '../../backend/node_modules/@supabase/supabase-js'));
    const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    f.useDatabaseClient({ supabaseUrl: client.supabaseUrl, rpc: async (name, args) => {
      assert(['admit_home_postcard', 'confirm_home_postcard', 'home_record_context'].includes(name));
      queries.push({ rpc: name }); return client.rpc(name, args);
    }, from: table => {
      assert(['Home','User','HomeOwner','HomeOccupancy','HomeOwnershipClaim','HomeResidencyClaim','HomeRolePermission','HomePermissionOverride','HomePostcardCode'].includes(table));
      queries.push({ table }); return client.from(table);
    } });
    f.setup(); initialized = true;
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const applicant = id(2);
    f.setPostcardResult({ success: false, deliveryUnknown: true });
    let r = await request(home, applicant, 'request-postcard', {});
    assert.equal(r.status, 202); assert.equal(r.body.delivery_unknown, true);
    const original = r.body.postcard.id;
    r = await request(home, applicant, 'request-postcard', {}); assert.equal(r.status, 202); assert.equal(r.body.postcard.id, original);
    assert.equal(f.postcardDeliveries.length, 1);
    r = await request(home, applicant, 'postcard'); assert.equal(r.status, 200); assert.equal(r.body.delivery_unknown, true);
    assert(!/no-store/.test(r.cache || '')); snapshot('unknown-delivery');
    console.log('BASELINE: unknown delivery retains one proof without resending; the legacy status route omits private/no-store');
    r = await request(home, applicant, 'verify-postcard', { code: f.postcardDeliveries[0].code });
    assert.equal(r.status, 200); assert.equal(r.body.verification_status, 'provisional');
    r = await request(home, applicant, 'my-residency'); assert.equal(r.body.current_access, 'none');
    snapshot('confirmed-provisional');
    console.log('BASELINE: a successful code response can mean provisional residency without current household access');

    f.setPostcardResult({ success: true });
    extra(extras[0], id(3));
    sql(`UPDATE public."Home" SET address2='999' WHERE id=${q(extras[0])};`);
    r = await request(extras[0], id(3), 'request-postcard', { address: { line1: 'Submitted postal fixture', line2: '602', city: 'Test', state: 'WA', postal_code: '98607', country: 'US' } });
    assert.equal(r.status, 201); assert.equal(f.postcardDeliveries.at(-1).destination.address2, '999'); snapshot('changed-unselected-unit');
    console.log('BASELINE: the postal request ignores the selected address and dispatches the Home\'s changed unit');

    extra(extras[1], id(4), { archived: true });
    r = await request(extras[1], id(4), 'request-postcard', {}); assert.equal(r.status, 201);
    r = await request(extras[1], id(4), 'verify-postcard', { code: f.postcardDeliveries.at(-1).code }); assert.equal(r.status, 200);
    snapshot('archived-home'); console.log('BASELINE: archived Home still reaches postal dispatch and confirmation');

    extra(extras[2], id(5), { future: true });
    r = await request(extras[2], id(5), 'request-postcard', {}); assert.equal(r.status, 201);
    r = await request(extras[2], id(5), 'verify-postcard', { code: f.postcardDeliveries.at(-1).code }); assert.equal(r.status, 200);
    snapshot('future-occupancy'); console.log('BASELINE: future occupancy start still reaches postal dispatch and changes verification');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({ results, queries, diagnostics: f.diagnostics,
      provider_calls: f.postcardDeliveries.map(({ code, ...safe }) => safe), notifications: f.notifications.length }, null, 2), { mode: 0o600 });
    if (initialized) {
      sql(`DELETE FROM public."Home" WHERE id IN (${extras.map(q)});`); f.cleanup();
      assert.equal(sql(`SELECT count(*) FROM public."Home" WHERE id IN (${[home, ...extras].map(q)});`), '0');
    }
    f.restoreModules(); assert.equal(sql('SELECT max(version) FROM supabase_migrations.schema_migrations;'), ledger);
    console.log('PASS: synthetic provider boundary only; exact fixture cleanup, no schema/ledger adoption');
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });
