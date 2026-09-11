#!/usr/bin/env node
// Production HTTP/list/IAM/deletion services, actual SDK/PostgREST and owned SQL.
// Auth and post-query faults are controlled. No hosted or paid calls.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const f = require('./home-residency-review-http-fixture.cjs')(process.argv[2], { summary: true, dashboard: true });
const { home, actor, sql, q, id } = f;
let server, initialized = false, hook = null;
const queryCalls = [];
const extra = id(101);
const homeChange = change => sql(`UPDATE public."Home" SET ${change} WHERE id=${q(home)};`);
const occupancyChange = change => sql(`UPDATE public."HomeOccupancy" SET ${change} WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
const ownerChange = status => sql(`UPDATE public."HomeOwner" SET owner_status=${q(status)} WHERE home_id=${q(home)} AND subject_id=${q(actor)};`);
function restore() {
  homeChange(`security_state='normal',home_status='active',owner_id=${q(actor)}`); ownerChange('verified');
  occupancyChange("is_active=true,role='owner',role_base='owner',age_band='adult',verification_status='verified',verified_at=now(),start_at=NULL,end_at=NULL,access_start_at=NULL,access_end_at=NULL");
  sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`);
}
async function after(result, detail) {
  queryCalls.push(detail);
  if (hook?.matches(detail)) { const pending = hook; hook = null; return pending.handle(result); }
  return result;
}
function observe(builder, detail) {
  return new Proxy(builder, { get(target, key) {
    if (key === 'then') return (resolve, reject) => Promise.resolve(target).then(result => after(result, detail)).then(resolve, reject);
    if (typeof target[key] !== 'function') return target[key];
    return (...args) => observe(target[key](...args), { ...detail,
      ...(key === 'select' ? { columns: args[0] } : {}), ...(key === 'eq' ? { filters: { ...detail.filters, [args[0]]: args[1] } } : {}) });
  } });
}
async function request(route = '/my-homes', userId = actor) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes${route}`, {
    headers: { 'x-fixture-actor': userId }, signal: AbortSignal.timeout(30000),
  });
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  return { status: response.status, body: await response.json() };
}
function cards(result, route) {
  assert.equal(result.status, 200, JSON.stringify(result));
  return route === '/primary' ? result.body.home ? [result.body.home] : []
    : route === '/' ? [...result.body.ownedHomes, ...result.body.occupiedHomes] : result.body.homes;
}
async function current(route = '/my-homes') {
  const result = cards(await request(route), route); assert(result.some(card => card.id === home));
  return result.find(card => card.id === home);
}
function unavailable(result) {
  assert.equal(result.status, 503, JSON.stringify(result));
  assert.deepEqual(Object.keys(result.body).sort(), ['code', 'error']);
  assert(!JSON.stringify(result.body).includes('sentinel'));
}
const cardQuery = d => d.table === 'Home' && d.columns.startsWith('id, name, address');
async function main() {
  try {
    assert.match(process.argv[3] || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
    let config;
    try { config = JSON.parse(execFileSync(process.argv[4], ['status', '--workdir', process.argv[3], '-o', 'json'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
    })); } catch (_) { throw new Error('Owned local Supabase configuration unavailable'); }
    assert.equal(config.API_URL, 'http://127.0.0.1:64521');
    const { createClient } = require(path.resolve(__dirname, '../../backend/node_modules/@supabase/supabase-js'));
    const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    f.useDatabaseClient({ supabaseUrl: client.supabaseUrl,
      rpc: async (name, args) => after(await client.rpc(name, args), { rpc: name, args }),
      from: table => observe(client.from(table), { table, columns: '', filters: {} }) });
    f.setup(); initialized = true; restore();
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const routes = ['/my-homes', '/primary', '/'];
    for (const route of routes) {
      const card = await current(route);
      assert.equal(card.access_kind, 'shared'); assert.equal(card.occupancy.role, 'owner'); assert.equal(card.occupancy.is_active, true);
      assert.equal(card.can_delete_home, true); assert.equal(card.ownership_status, 'verified');
      for (const key of ['owner_id', 'owner', 'occupants', 'owners', 'entry_instructions', 'parking_instructions', 'niche_data']) assert(!Object.hasOwn(card, key));
    }
    console.log('PASS: all three production lists use current authority, real occupancy and allowlisted cards without raw identity/private fields');
    const changes = [
      () => homeChange("security_state='frozen'"), () => homeChange("security_state='frozen_silent'"),
      () => homeChange("home_status='archived'"), () => homeChange("home_status='merged'"),
      () => ownerChange('revoked'), () => ownerChange('disputed'), () => occupancyChange('is_active=false'),
      () => occupancyChange("access_end_at=now()-interval '1 second'"), () => occupancyChange("end_at=now()-interval '1 second'"),
      () => occupancyChange("access_start_at=now()+interval '1 day'"), () => occupancyChange("start_at=now()+interval '1 day'"),
      () => sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'home.view',false);`),
    ];
    for (const change of changes) {
      change(); const before = queryCalls.filter(cardQuery).length;
      for (const route of routes) assert.equal(cards(await request(route), route).length, 0);
      assert.equal(queryCalls.filter(cardQuery).length, before);
      restore(); for (const route of routes) await current(route);
    }
    console.log('PASS: twelve authority changes exclude the Home before any card read on all three routes; each recovers');

    occupancyChange("verification_status='pending_doc',verified_at=NULL"); ownerChange('pending');
    let card = await current(); assert.equal(card.access_kind, 'verification'); assert.equal(card.has_home_access, false);
    assert.equal(card.address, null); assert.equal(card.location, null); assert.equal(card.role_base, null); assert.equal(card.can_delete_home, false);
    assert.equal(cards(await request('/primary'), '/primary').length, 0);
    sql(`INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,state,claim_phase_v2)
      VALUES(${q(id(942))},${q(home)},${q(actor)},'approved','challenged');`);
    const flags = require(path.resolve(__dirname, '../../backend/config/householdClaims')).flags, originalFlag = flags.v2ReadPaths;
    try {
      flags.v2ReadPaths = false; assert.equal((await current()).pending_claim_id, null);
      flags.v2ReadPaths = true; assert.equal((await current()).pending_claim_id, id(942));
    } finally { flags.v2ReadPaths = originalFlag; }
    sql(`DELETE FROM public."HomeOwnershipClaim" WHERE id=${q(id(942))} AND home_id=${q(home)};`); restore();
    console.log('PASS: applicant gets personal progress only, no primary residency or shared address; legacy/v2 pending claims stay distinct');

    const targets = [d => d.table === 'Home' && d.columns === 'id',
      d => d.table === 'HomeOccupancy' && d.columns === 'id, home_id',
      d => d.table === 'HomeOwner' && d.columns === 'id, home_id',
      d => d.table === 'HomeOwner' && d.columns.includes('is_primary_owner'),
      d => d.table === 'HomeOwnershipClaim', cardQuery,
      d => d.table === 'Home' && d.columns === 'id, owner_id',
      d => d.table === 'Home' && d.columns.includes('security_state'),
      d => d.table === 'HomeRolePermission', d => d.table === 'HomePermissionOverride',
      d => d.rpc === 'home_record_context', d => d.rpc === 'home_delete_eligibility'];
    for (const route of routes) for (const matches of targets) {
      for (const handle of [() => ({ data: null, error: { message: 'private SQL sentinel' } }),
        () => { throw new Error('private transport sentinel'); }, () => ({ data: null, error: null })]) {
        hook = { matches, handle }; unavailable(await request(route)); assert.equal(hook, null); await current(route);
      }
    }
    console.log('PASS: actual discovery, ownership, claims, cards, IAM and eligibility failures/null/interruptions return safe retryable errors across all three routes');

    for (const route of routes) for (const matches of [cardQuery, d => d.table === 'HomeOwnershipClaim', d => d.rpc === 'home_delete_eligibility']) {
      let capture, release;
      const captured = new Promise(resolve => { capture = resolve; });
      hook = { matches, handle: async result => { capture(); await new Promise(resolve => { release = resolve; }); return result; } };
      const pending = request(route); await captured; occupancyChange('is_active=false'); release(); unavailable(await pending);
      restore(); await current(route);
    }
    console.log('PASS: nine held produced SDK card/claim/eligibility replies retire after current revocation, then recover');

    sql(`INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,state) VALUES(${q(id(942))},${q(home)},${q(actor)},'draft');`);
    let capturedClaim, releaseClaim;
    const claimReady = new Promise(resolve => { capturedClaim = resolve; });
    hook = { matches: d => d.table === 'HomeOwnershipClaim', handle: async result => {
      capturedClaim(); await new Promise(resolve => { releaseClaim = resolve; }); return result;
    } };
    const oldClaim = request(); oldClaim.catch(() => {}); // cleanup can close HTTP after a fixture SQL failure
    await claimReady;
    sql(`UPDATE public."HomeOwnershipClaim" SET state='revoked',claim_phase_v2='withdrawn',terminal_reason='withdrawn_by_user' WHERE id=${q(id(942))} AND home_id=${q(home)};`);
    releaseClaim(); unavailable(await oldClaim); assert.equal((await current()).pending_claim_id, null);
    sql(`DELETE FROM public."HomeOwnershipClaim" WHERE id=${q(id(942))} AND home_id=${q(home)};`);
    console.log('PASS: a held personal claim cannot restore withdrawn verification progress even when Home access stays unchanged');

    // A verified owner does not acquire an invented active occupancy. The next
    // valid Home remains primary even when an earlier occupancy has expired.
    sql(`INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode)
      VALUES(${q(extra)},NULL,${q(f.users[5])},'Second permitted fixture','Test','WA','98607');
      INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier)
      VALUES(${q(extra)},${q(actor)},'verified',true,'strong');`);
    occupancyChange("access_end_at=now()-interval '1 second'");
    card = (await request('/primary')).body.home; assert.equal(card.id, extra); assert.equal(card.occupancy, null);
    assert.equal(card.can_delete_home, true); assert.equal(card.role_base, 'owner');
    assert.equal((await request()).body.homes.length, 1);
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(extra)},${q(actor)},'home.edit',false);`);
    assert.equal((await request()).body.homes[0].can_delete_home, false);
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(extra)};
      DELETE FROM public."HomeOwner" WHERE home_id=${q(extra)}; DELETE FROM public."Home" WHERE id=${q(extra)};`);
    restore(); occupancyChange("age_band='teen'"); assert.equal((await current()).role_base, 'member'); assert.equal((await current()).can_delete_home, false); restore();
    console.log('PASS: owner without occupancy remains truthful and eligible; expired earlier Home does not hide it; explicit deletion deny and minor ceiling win');

    // Exact private creator setup, using the production private-history predicate.
    sql(`DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};
      DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id<>${q(actor)};`);
    ownerChange('pending'); occupancyChange("role='member',role_base='member',verification_status='pending_doc',verified_at=NULL");
    card = await current(); assert.equal(card.access_kind, 'private_setup'); assert.equal(card.has_home_access, false);
    assert.equal(card.occupancy.role, 'member'); assert.equal(card.role_base, null); assert.equal(card.can_delete_home, true);
    assert.equal(card.address, 'Private residency fixture'); assert.equal(cards(await request('/primary'), '/primary').length, 0);
    sql(`INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action) VALUES(${q(home)},${q(actor)},'established_household_history');`);
    card = await current(); assert.equal(card.access_kind, 'verification'); assert.equal(card.can_delete_home, false); assert.equal(card.address, null);
    assert.equal((await request('/my-homes', f.users[5])).body.homes.length, 0);
    console.log('PASS: private creator has useful setup without fabricated admin/membership; established history removes setup/deletion; unrelated account sees an actual empty list');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) {
      sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(extra)};
        DELETE FROM public."HomeOwner" WHERE home_id=${q(extra)}; DELETE FROM public."Home" WHERE id=${q(extra)};
        DELETE FROM public."HomeOwnershipClaim" WHERE id=${q(id(942))} AND home_id=${q(home)};`);
      f.cleanup(); console.log('PASS: exact list authority SQL fixture cleanup');
    }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
