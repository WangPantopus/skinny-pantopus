#!/usr/bin/env node
// Actual production HTTP/IAM/SQL and Supabase SDK/PostgREST. Provider replies
// and post-query interruptions are controlled; no paid or hosted calls occur.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const f = require('./home-residency-review-http-fixture.cjs')(process.argv[2], { summary: true, dashboard: true });
const { home, actor, sql, q } = f;
let server, initialized = false, hook = null, providerCalls = 0;
const queryCalls = [];
const property = { attomPayload: null, source: 'unavailable', unavailableReason: 'ATTOM_NOT_CONFIGURED' };
const updateHome = change => sql(`UPDATE public."Home" SET ${change} WHERE id=${q(home)};`);
const updateOccupancy = change => sql(`UPDATE public."HomeOccupancy" SET ${change} WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
const updateOwner = status => sql(`UPDATE public."HomeOwner" SET owner_status=${q(status)} WHERE home_id=${q(home)} AND subject_id=${q(actor)};`);
const restore = () => {
  updateHome("security_state='normal',home_status='active'"); updateOwner('verified');
  updateOccupancy("is_active=true,role='owner',role_base='owner',verification_status='verified',verified_at=now(),start_at=NULL,end_at=NULL,access_start_at=NULL,access_end_at=NULL");
  sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`);
  f.setPropertyDetailResult(() => { providerCalls++; return property; });
};
// Await the real SDK result before injecting a failure or holding an obsolete
// result. Query syntax, nested joins and SQL/RPC authority are not simulated.
function observe(builder, detail) {
  return new Proxy(builder, { get(target, key) {
    if (key === 'then') return (resolve, reject) => Promise.resolve(target).then(async result => {
      queryCalls.push(detail);
      if (hook?.matches(detail)) { const pending = hook; hook = null; return pending.handle(result); }
      return result;
    }).then(resolve, reject);
    if (typeof target[key] !== 'function') return target[key];
    return (...args) => observe(target[key](...args), key === 'select' ? { ...detail, columns: args[0] } : detail);
  } });
}
async function request(suffix = '', homeId = home) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes/${homeId}${suffix}`, {
    headers: { 'x-fixture-actor': actor }, signal: AbortSignal.timeout(30000),
  });
  assert.match(response.headers.get('cache-control'), /no-store/);
  return { status: response.status, body: await response.json() };
}
const detailQuery = d => d.table === 'Home' && d.columns.includes('occupants:');
const propertyQuery = d => d.table === 'Home' && d.columns === '*';
const ownerQuery = d => d.table === 'HomeOwner' && d.columns.includes('is_primary_owner');
function denied(result, status = 403) {
  assert.equal(result.status, status, JSON.stringify(result));
  assert.deepEqual(Object.keys(result.body).sort(), ['code', 'error']);
}
async function current(suffix = '') {
  const result = await request(suffix); assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.body.home.id, home);
  if (suffix) { assert.equal(result.body.source, 'unavailable'); assert.equal(result.body.attom_property_detail, null); }
  return result.body;
}
async function main() {
  try {
    assert.match(process.argv[3] || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
    let config;
    try { config = JSON.parse(execFileSync(process.argv[4], ['status', '--workdir', process.argv[3], '-o', 'json'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
    })); } catch (_) { throw new Error('Owned local Supabase configuration unavailable'); }
    assert.equal(config.API_URL, 'http://127.0.0.1:64521'); assert.equal(typeof config.SERVICE_ROLE_KEY, 'string');
    const { createClient } = require(path.resolve(__dirname, '../../backend/node_modules/@supabase/supabase-js'));
    const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    f.useDatabaseClient({ supabaseUrl: client.supabaseUrl, rpc: client.rpc.bind(client),
      from: table => observe(client.from(table), { table, columns: '' }) });
    f.setup(); initialized = true; restore();
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    await current(); await current('/property-details');
    for (const suffix of ['', '/property-details']) assert.equal((await request(suffix, 'invalid')).status, 400);
    console.log('PASS: actual SDK nested Home detail and unavailable property detail preserve their successful envelopes and no-store responses');

    updateOccupancy("age_band='teen'");
    assert.equal((await current()).home.isOwner, false);
    updateOccupancy("age_band='adult'");
    updateOwner('pending');
    sql(`INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,state,claim_phase_v2)
      VALUES(${q(f.id(942))},${q(home)},${q(actor)},'approved','challenged');`);
    const flags = require(path.resolve(__dirname, '../../backend/config/householdClaims')).flags;
    const originalFlag = flags.v2ReadPaths;
    try {
      flags.v2ReadPaths = false; assert.equal((await current()).home.pendingClaimId, null);
      flags.v2ReadPaths = true; assert.equal((await current()).home.pendingClaimId, f.id(942));
      for (const handle of [() => ({ data: null, error: { message: 'private claim sentinel' } }),
        () => { throw new Error('private claim transport sentinel'); }, () => ({ data: null, error: null })]) {
        hook = { matches: d => d.table === 'HomeOwnershipClaim', handle };
        denied(await request(), 503); assert.equal(hook, null);
        assert.equal((await current()).home.pendingClaimId, f.id(942));
      }
    } finally { flags.v2ReadPaths = originalFlag; }
    sql(`DELETE FROM public."HomeOwnershipClaim" WHERE id=${q(f.id(942))} AND home_id=${q(home)};`);
    restore();
    console.log('PASS: real minor owner ceilings, legacy/v2 pending claim selection and unavailable-claim recovery');


    const changes = [
      () => updateHome("security_state='frozen'"), () => updateHome("security_state='frozen_silent'"),
      () => updateHome("home_status='archived'"), () => updateHome("home_status='merged'"),
      () => updateOwner('revoked'), () => updateOwner('disputed'), () => updateOccupancy('is_active=false'),
      () => updateOccupancy("access_end_at=now()-interval '1 second'"), () => updateOccupancy("end_at=now()-interval '1 second'"),
      () => updateOccupancy("access_start_at=now()+interval '1 day'"), () => updateOccupancy("start_at=now()+interval '1 day'"),
      () => updateOccupancy("verification_status='pending_doc',verified_at=NULL"),
      () => sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'home.view',false);`),
    ];
    for (const change of changes) {
      change(); const before = queryCalls.filter(d => detailQuery(d) || propertyQuery(d)).length, providers = providerCalls;
      denied(await request()); denied(await request('/property-details'));
      assert.equal(queryCalls.filter(d => detailQuery(d) || propertyQuery(d)).length, before); assert.equal(providerCalls, providers);
      restore(); await current(); await current('/property-details');
    }
    console.log('PASS: thirteen actual authority changes deny both routes before shared Home/provider queries, then recover');

    for (const [suffix, matches] of [['', detailQuery], ['/property-details', propertyQuery], ['', ownerQuery]]) {
      for (const handle of [() => ({ data: null, error: { message: 'private sentinel' } }),
        () => { throw new Error('private transport sentinel'); }, () => ({ data: null, error: null })]) {
        hook = { matches, handle }; denied(await request(suffix), 503); assert.equal(hook, null); await current(suffix);
      }
    }
    for (const malformed of [null, {}, { source: 'error', attomPayload: null }, { source: 'cache' },
      { source: 'unavailable', attomPayload: {} }, { source: 'cache', attomPayload: [] }]) {
      f.setPropertyDetailResult(malformed); denied(await request('/property-details'), 503); restore(); await current('/property-details');
    }
    f.setPropertyDetailResult(() => { throw new Error('private provider sentinel'); });
    denied(await request('/property-details'), 503); restore(); await current('/property-details');
    console.log('PASS: actual Home/owner query failures, missing data and malformed/failed provider responses are safe retryable errors');

    async function held(suffix, matches, change) {
      let captured, release; const observed = new Promise(resolve => { captured = resolve; });
      const hold = async result => { captured(); await new Promise(resolve => { release = resolve; }); return result; };
      if (matches) hook = { matches, handle: hold }; else f.setPropertyDetailResult(() => hold(property));
      const pending = request(suffix); await observed; change(); release(); denied(await pending);
      restore(); await current(suffix);
    }
    for (const change of [() => updateOccupancy('is_active=false'), () => updateHome("security_state='frozen'"),
      () => sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'home.view',false);`)]) {
      await held('', detailQuery, change); await held('', ownerQuery, change); await held('/property-details', null, change);
    }
    console.log('PASS: nine already-produced SDK Home/owner or provider replies cannot return data after revocation, freeze or explicit denial');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { sql(`DELETE FROM public."HomeOwnershipClaim" WHERE id=${q(f.id(942))} AND home_id=${q(home)};`); f.cleanup(); console.log('PASS: exact Home detail authority SQL fixture cleanup'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
