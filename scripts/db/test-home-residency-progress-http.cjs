#!/usr/bin/env node
// Personal progress through production routes and real local SDK/SQL. Only
// authentication and faults after an actual query result are controlled.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const [container, project, cli, evidence] = process.argv.slice(2);
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(path.resolve(__dirname, '../..') + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const f = require('./home-residency-review-http-fixture.cjs')(container, { summary: true, dashboard: true });
const { home, sql, q, id } = f;
const applicant = id(2), other = id(6), claimId = id(202);
let server, initialized = false, hook;
const events = [];
async function after(result, detail) {
  events.push(detail);
  if (hook?.matches(detail)) { const current = hook; hook = null; return current.handle(result); }
  return result;
}
function observe(builder, detail) {
  return new Proxy(builder, { get(target, key) {
    if (key === 'then') return (resolve, reject) => Promise.resolve(target).then(result => after(result, detail)).then(resolve, reject);
    if (typeof target[key] !== 'function') return target[key];
    assert(!['insert', 'update', 'delete', 'upsert'].includes(key), 'Progress must be read-only');
    return (...args) => observe(target[key](...args), { ...detail,
      ...(key === 'select' ? { columns: args[0] } : {}), ...(key === 'eq' ? { filters: { ...detail.filters, [args[0]]: args[1] } } : {}) });
  } });
}
const changeClaim = fields => sql(`UPDATE public."HomeResidencyClaim" SET ${fields} WHERE id=${q(claimId)};`);
const changeOccupancy = fields => sql(`UPDATE public."HomeOccupancy" SET ${fields} WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
function restore() {
  changeClaim("status='pending',cold_start_mode=NULL,claimed_address='My submitted street, Unit 602',reviewed_at=NULL");
  changeOccupancy("verification_status='pending_approval',is_active=true,verified_at=NULL,verification_expires_at=NULL,start_at=NULL,end_at=NULL,access_start_at=NULL,access_end_at=NULL");
  sql(`UPDATE public."Home" SET home_status='active',security_state='normal' WHERE id=${q(home)};DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(applicant)};`);
}
async function request(route = `/${home}/my-residency`, actor = applicant) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes${route}`, {
    headers: { 'x-fixture-actor': actor }, signal: AbortSignal.timeout(30000),
  });
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  return { status: response.status, body: await response.json() };
}
async function progress(next = 'household_review', access = 'none') {
  const r = await request(); assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.body.home_id, home); assert.equal(r.body.request.id, claimId);
  assert.equal(r.body.request.submitted_address, 'My submitted street, Unit 602');
  assert.equal(r.body.next_step, next); assert.equal(r.body.current_access, access);
  const encoded = JSON.stringify(r.body);
  for (const secret of ['Private residency fixture', 'changed-private-sentinel', 'reviewed_by', 'cold_start_mode', 'user_id', 'vendor_job_id', 'code_hash']) assert(!encoded.includes(secret));
  return r.body;
}
function unavailable(r) {
  assert.equal(r.status, 503, JSON.stringify(r));
  assert.deepEqual(Object.keys(r.body).sort(), ['code', 'error']);
  assert(!JSON.stringify(r.body).includes('sentinel'));
}
async function main() {
  const ledger = sql('SELECT max(version) FROM supabase_migrations.schema_migrations;');
  try {
    let config;
    try { config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })); }
    catch (_) { throw new Error('Owned local SDK configuration unavailable'); }
    assert.equal(config.API_URL, 'http://127.0.0.1:64521');
    const rawFetch = global.fetch;
    global.fetch = (input, options) => { const u = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      assert(['127.0.0.1', 'localhost'].includes(u.hostname)); return rawFetch(input, options); };
    const { createClient } = require(path.resolve(__dirname, '../../backend/node_modules/@supabase/supabase-js'));
    const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    f.useDatabaseClient({ supabaseUrl: client.supabaseUrl,
      rpc: async (name, args) => after(await client.rpc(name, args), { rpc: name, args }),
      from: table => observe(client.from(table), { table, columns: '', filters: {} }) });
    f.setup(); initialized = true; restore();
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    await progress();
    let list = await request('/my-residency'); assert.equal(list.status, 200); assert.equal(list.body.requests.length, 1);
    assert.equal(list.body.requests[0].id, claimId); assert.equal(list.body.next_cursor, null);
    sql(`UPDATE public."Home" SET address='changed-private-sentinel',address2='999',name='changed-private-sentinel' WHERE id=${q(home)};`);
    await progress(); list = await request('/my-residency'); assert.equal(list.body.requests[0].submitted_address, 'My submitted street, Unit 602');
    const legacy = await request('/my-claims'); assert.equal(legacy.status, 200);
    assert.equal(legacy.body.claims.length, 1); assert.equal(legacy.body.claims[0].claimed_address, 'My submitted street, Unit 602');
    assert.equal(legacy.body.claims[0].home, null); assert(!JSON.stringify(legacy.body).includes('changed-private-sentinel'));
    assert.equal(legacy.body.next_cursor, null);
    assert(!events.some(e => e.table === 'Home' && /address|name/.test(e.columns)));
    console.log('PASS: personal address is the applicant\'s submitted value; current private Home fields and other identities are never selected/projected');
    assert.equal((await request(undefined, other)).status, 404);
    assert.deepEqual((await request('/my-residency', other)).body, { requests: [], next_cursor: null });
    assert.equal((await request('/bad/my-residency')).status, 400);
    assert.equal((await request('/my-residency?after=bad')).status, 400);
    console.log('PASS: actor isolation, absent progress, invalid IDs/cursors and private/no-store errors');
    for (const mode of ['self_bootstrap', 'external_postcard', 'stale_authority_postcard']) {
      changeClaim(`cold_start_mode=${q(mode)}`); await progress('address_verification');
    }
    restore(); changeClaim("status='rejected'"); await progress('resubmit');
    restore(); changeClaim("status='verified',reviewed_at=now()"); await progress('access_review');
    changeOccupancy("verification_status='verified',verified_at=now()");
    // This owned DB has not permanently adopted the accepted member-view
    // defaults migration. Scope the positive permission to this fixture actor.
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(applicant)},'home.view',true);`);
    await progress('home', 'shared');
    sql(`UPDATE public."HomePermissionOverride" SET allowed=false WHERE home_id=${q(home)} AND user_id=${q(applicant)} AND permission='home.view';`);
    await progress('access_review'); restore();
    for (const fields of ["is_active=false", "access_end_at=now()-interval '1 second'", "start_at=now()+interval '1 day'", "end_at=now()+interval '1 day'", "verification_status='provisional'", "verified_at=now()", "verification_expires_at=now()+interval '1 day'"]) {
      changeOccupancy(fields); await progress('access_review'); restore();
    }
    for (const fields of ["security_state='frozen'", "security_state='frozen_silent'", "security_state='disputed'", "home_status='archived'", "home_status='merged'"]) {
      sql(`UPDATE public."Home" SET ${fields} WHERE id=${q(home)};`); await progress('unavailable'); restore();
    }
    changeOccupancy("verification_status='pending_doc'");
    // The saved household-review application remains household review even if
    // an older occupancy template used the generic document-pending status.
    await progress(); restore();
    const ownerProgress = await request(undefined, f.actor); assert.equal(ownerProgress.body.next_step, 'home'); assert.equal(ownerProgress.body.request, null);
    console.log('PASS: saved review, current access, postal routing, rejection, removal, scheduled/expired access and restricted Home states stay distinct');
    const claimQuery = d => d.table === 'HomeResidencyClaim';
    for (const route of ['/my-residency', '/my-claims', `/${home}/my-residency`]) {
      for (const handle of [() => ({ data: null, error: { message: 'private sentinel' } }),
        () => { throw new Error('private transport sentinel'); }, result => ({ ...result, data: Array.isArray(result.data)
          ? result.data.map(r => ({ ...r, user_id: other })) : { ...result.data, user_id: other } })]) {
        hook = { matches: claimQuery, handle }; unavailable(await request(route)); assert.equal(hook, null); await progress();
      }
      let capture, release; const captured = new Promise(resolve => { capture = resolve; });
      hook = { matches: claimQuery, handle: async result => { capture(); await new Promise(resolve => { release = resolve; }); return result; } };
      const pending = request(route); await captured; changeClaim("status='rejected'"); release(); unavailable(await pending); restore(); await progress();
    }
    for (const matches of [d => d.table === 'Home' && d.columns.includes('security_state'), d => d.rpc === 'home_record_context']) {
      let capture, release; const captured = new Promise(resolve => { capture = resolve; });
      hook = { matches, handle: async result => { capture(); await new Promise(resolve => { release = resolve; }); return result; } };
      const pending = request(); await captured; changeOccupancy('is_active=false'); release(); unavailable(await pending); restore(); await progress();
    }
    console.log('PASS: failed/interrupted/malformed own reads and held claim/authority results fail safely, then recover');
    sql(`INSERT INTO public."HomeResidencyClaim"(id,user_id,claimed_address) VALUES ${Array.from({ length: 51 }, (_, i) => `(${q(id(3000+i))},${q(applicant)},'Personal historical request ${i}')`).join(',')};`);
    list = await request('/my-residency'); assert.equal(list.body.requests.length, 50); assert(list.body.next_cursor);
    const last = await request('/my-residency?after='+list.body.next_cursor); assert.equal(last.body.requests.length, 2); assert.equal(last.body.next_cursor, null);
    assert.equal(new Set([...list.body.requests, ...last.body.requests].map(r => r.id)).size, 52);
    console.log('PASS: bounded personal-history pagination retains requests without a current Home and includes every row exactly once');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) {
      sql(`DELETE FROM public."HomeResidencyClaim" WHERE user_id=${q(applicant)} AND id BETWEEN ${q(id(3000))} AND ${q(id(3050))};`);
      f.cleanup();
    }
    fs.writeFileSync(path.join(evidence, 'events.json'), JSON.stringify({ events, diagnostics: f.diagnostics }, null, 2), { mode: 0o600 });
    f.restoreModules(); assert.equal(sql('SELECT max(version) FROM supabase_migrations.schema_migrations;'), ledger);
    console.log('PASS: exact synthetic cleanup; existing schema, ledger and unrelated rows preserved');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
