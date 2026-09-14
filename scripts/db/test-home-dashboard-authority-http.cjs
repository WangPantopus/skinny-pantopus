#!/usr/bin/env node
// Production HTTP/IAM/SQL current-authority contract. Only auth and injected
// transport faults are synthetic; no hosted database or provider is accepted.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const f = require('./home-residency-review-http-fixture.cjs')(process.argv[2], { summary: true, dashboard: true });
const { home, actor, sql, q } = f;
let server, initialized = false;
const updateOccupancy = change => sql(`UPDATE public."HomeOccupancy" SET ${change} WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
const updateHome = change => sql(`UPDATE public."Home" SET ${change} WHERE id=${q(home)};`);
const updateOwner = status => sql(`UPDATE public."HomeOwner" SET owner_status=${q(status)} WHERE home_id=${q(home)} AND subject_id=${q(actor)};`);
const restore = () => {
  updateOccupancy("is_active=true,role='owner',role_base='owner',verification_status='verified',verified_at=now(),access_start_at=NULL,access_end_at=NULL,start_at=NULL,end_at=NULL");
  updateHome("security_state='normal',home_status='active'"); updateOwner('verified');
  sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`);
};
async function main() {
  try {
    f.setup(); initialized = true; restore();
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const request = async (homeId = home) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes/${homeId}/dashboard-access`, {
        headers: { 'x-fixture-actor': actor }, signal: AbortSignal.timeout(30000),
      });
      assert.match(response.headers.get('cache-control'), /no-store/);
      return { status: response.status, body: await response.json() };
    };
    const denied = (response, kind = null) => {
      assert.equal(response.status, 403, JSON.stringify(response));
      assert.equal(response.body.hasAccess, false); assert.deepEqual(response.body.permissions, []);
      assert.equal(response.body.home_id, home); assert.match(response.body.access_revision, /^[a-f0-9]{64}$/);
      assert.equal(response.body.verification_required, kind !== null); assert.equal(response.body.verification_kind, kind);
      assert.deepEqual(Object.keys(response.body).sort(), ['access_revision', 'hasAccess', 'home_id', 'permissions', 'verification_kind', 'verification_required', 'verification_status']);
    };
    const unavailable = response => {
      assert.equal(response.status, 503, JSON.stringify(response));
      assert.deepEqual(Object.keys(response.body).sort(), ['code', 'error']);
    };
    let r = await request(); assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.body.home_id, home); assert.equal(r.body.is_owner, true); assert(r.body.permissions.includes('home.view'));
    assert.match(r.body.access_revision, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(r.body).sort(), ['access_revision', 'hasAccess', 'home_id', 'is_owner', 'permissions', 'role_base']);
    const revision = r.body.access_revision; assert.equal((await request()).body.access_revision, revision);
    assert.equal((await request('invalid')).status, 400);
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'finance.view',false);`);
    r = await request(); assert.equal(r.status, 200); assert(!r.body.permissions.includes('finance.view')); assert.notEqual(r.body.access_revision, revision);
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'home.view',false);`);
    denied(await request()); restore();
    console.log('PASS: minimal stable current authority, changed explicit grant revision, invalid Home, and no shared access without home.view');

    for (const change of ["is_active=false", "access_end_at=now()-interval '1 second'", "end_at=now()-interval '1 second'", "access_start_at=now()+interval '1 day'", "start_at=now()+interval '1 day'"]) {
      updateOccupancy(change); denied(await request()); restore();
    }
    for (const change of ["security_state='frozen'", "security_state='frozen_silent'", "home_status='archived'", "home_status='merged'"]) {
      updateHome(change); denied(await request()); restore();
    }
    for (const status of ['revoked', 'disputed']) { updateOwner(status); denied(await request()); restore(); }
    console.log('PASS: real revoked/ended/future membership, frozen/archived/merged Home and disputed/revoked ownership deny');

    for (const role of ['owner', 'member']) {
      for (const status of ['pending_doc', 'pending_approval', 'provisional_bootstrap']) {
        updateOccupancy(`verification_status=${q(status)},verified_at=NULL,role=${q(role)},role_base=${q(role)}`);
        r = await request(); denied(r, role === 'owner' ? 'ownership' : 'residency'); assert.equal(r.body.verification_status, status);
        updateOccupancy("access_end_at=now()-interval '1 second'"); denied(await request()); updateOccupancy('access_end_at=NULL');
        updateOccupancy("access_start_at=now()+interval '1 day'"); denied(await request()); updateOccupancy('access_start_at=NULL');
        updateOccupancy('is_active=false'); denied(await request()); updateOccupancy('is_active=true');
        updateHome("security_state='frozen'"); denied(await request()); updateHome("security_state='normal'");
        updateOwner('disputed'); denied(await request()); updateOwner('verified');
      }
      restore();
    }
    console.log('PASS: current ownership/residency applicants stay distinct without private data; revoked, future, expired and frozen/disputed applicants get no verification controls');

    for (const table of ['Home', 'HomeOccupancy', 'HomeOwner', 'HomeRolePermission', 'HomePermissionOverride']) {
      for (const reject of [false, true]) { f.failNextQuery(table, reject); unavailable(await request()); }
    }
    for (const reject of [false, true]) { f.failNextRpc('home_record_context', reject); unavailable(await request()); }
    updateOccupancy("verification_status='pending_doc',verified_at=NULL");
    for (const malformed of [{ id: home }, { id: f.id(999), security_state: 'normal', home_status: 'active' }]) {
      f.interceptNextQuery('Home', result => ({ ...result, data: malformed }), detail => detail.columns.includes('security_state'));
      unavailable(await request());
    }
    f.interceptNextQuery('HomeOwner', result => ({ ...result, data: [null] }), detail => !detail.filters.some(filter => filter.includes('verified')));
    unavailable(await request()); restore();
    console.log('PASS: authority SQL/transport and malformed personal-context failures stay explicit and recoverable');

    async function heldChange(table, match, change, expected) {
      let release, captured; const held = new Promise(resolve => { captured = resolve; });
      f.interceptNextQuery(table, async result => { captured(); await new Promise(resolve => { release = resolve; }); return result; }, match);
      const pending = request(); await held; change(); release();
      const result = await pending; assert.equal(result.status, expected, JSON.stringify(result));
      assert(!('home' in result.body)); restore(); assert.equal((await request()).status, 200);
    }
    await heldChange('HomeOccupancy', () => true, () => updateOccupancy('is_active=false'), 403);
    updateOccupancy("verification_status='pending_doc',verified_at=NULL");
    await heldChange('Home', detail => detail.columns.includes('security_state'), () => updateHome("security_state='frozen'"), 503);
    updateOccupancy("verification_status='pending_doc',verified_at=NULL");
    await heldChange('HomeOwner', detail => !detail.filters.some(filter => filter.includes('verified')), () => updateOwner('disputed'), 503);
    console.log('PASS: held real authority replies cannot restore revoked membership or obsolete applicant controls');

    if (process.argv[3] && process.argv[4]) {
      assert.match(process.argv[3], /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
      let status;
      try { status = JSON.parse(execFileSync(process.argv[4], ['status', '--workdir', process.argv[3], '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })); }
      catch (_) { throw new Error('Could not read the owned local Supabase configuration'); }
      assert.equal(status.API_URL, 'http://127.0.0.1:64521'); assert(typeof status.SERVICE_ROLE_KEY === 'string');
      const { createClient } = require(path.resolve(__dirname, '../../backend/node_modules/@supabase/supabase-js'));
      f.useDatabaseClient(createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
      assert.equal((await request()).status, 200);
      updateHome("security_state='frozen'"); denied(await request()); restore();
      for (const role of ['member', 'owner']) {
        updateOccupancy(`verification_status='pending_doc',verified_at=NULL,role=${q(role)},role_base=${q(role)}`);
        denied(await request(), role === 'owner' ? 'ownership' : 'residency'); restore();
      }
      console.log('PASS: actual Supabase SDK/PostgREST current authority, frozen denial and both applicant envelopes');
    }
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { f.cleanup(); console.log('PASS: exact dashboard authority SQL fixture cleanup'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
