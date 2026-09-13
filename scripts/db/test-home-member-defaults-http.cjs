#!/usr/bin/env node
// Actual invitation routes/services -> SDK/PostgREST -> owned SQL -> Home list/detail.
// Auth and notification/email transports are controlled. No hosted/provider calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const f = require('./home-residency-review-http-fixture.cjs')(process.argv[2], { summary: true, dashboard: true, invitations: true });
const { actor, home, id, sql, q } = f;
const target = id(2), second = id(3), roles = ['admin', 'manager', 'member', 'restricted_member', 'guest'];
let server, initialized = false, before = null, introduced = [], installed = [], loseAcceptance = false;
const evidence = fs.mkdtempSync('/private/tmp/pantopus-home-member-defaults-http-state-');
fs.chmodSync(evidence, 0o700);
const policyRows = () => JSON.parse(sql('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY role_base,permission),\'[]\') FROM public."HomeRolePermission"r;'));
async function request(route, actorId = target, method = 'GET', body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes${route}`, {
    method, headers: { 'x-fixture-actor': actorId, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, body: await response.json() };
}
async function shared(actorId = target) {
  const list = await request('/my-homes', actorId); assert.equal(list.status, 200);
  const card = list.body.homes.find(row => row.id === home); assert(card);
  assert.equal(card.access_kind, 'shared'); assert.equal(card.has_home_access, true);
  assert.equal(card.role_base, 'member'); assert.equal(card.occupancy.verification_status, 'verified');
  assert.equal(card.can_delete_home, false); assert.notEqual(card.ownership_status, 'verified');
  const detail = await request(`/${home}`, actorId); assert.equal(detail.status, 200);
  assert.equal(detail.body.home.id, home); assert.equal(detail.body.home.is_owner, false);
  return card;
}
async function create(actorId) {
  const response = await request(`/${home}/invite`, actor, 'POST', { user_id: actorId, relationship: 'member' });
  assert.equal(response.status, 201); assert.equal(response.body.emailSent, false);
  assert(response.body.invitation.id); return response.body.invitation.id;
}
async function main() {
  try {
    assert.match(process.argv[3] || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
    let config;
    try { config = JSON.parse(execFileSync(process.argv[4], ['status', '--workdir', process.argv[3], '-o', 'json'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
    })); } catch (_) { throw new Error('Owned local SDK configuration unavailable'); }
    assert.equal(config.API_URL, 'http://127.0.0.1:64521');
    const { createClient } = require(path.resolve(__dirname, '../../backend/node_modules/@supabase/supabase-js'));
    const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    f.useDatabaseClient({ supabaseUrl: client.supabaseUrl, from: table => client.from(table), rpc: async (name, args) => {
      const result = await client.rpc(name, args);
      if (loseAcceptance && name === 'act_on_home_invitation' && args.p_action === 'accept' && result.data?.ok) {
        loseAcceptance = false; throw new Error('Controlled lost committed invitation reply');
      }
      return result;
    } });
    before = policyRows();
    fs.writeFileSync(path.join(evidence, 'roles-before.json'), JSON.stringify(before), { mode: 0o600 });
    for (const role of roles) {
      const existing = before.find(row => row.role_base === role && row.permission === 'home.view');
      // Never overwrite an operator's deny to make an acceptance fixture pass.
      if (existing) assert.equal(existing.allowed, true, 'Current role deny requires a different acceptance scenario');
      else introduced.push(role);
    }
    sql('BEGIN;\n' + fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20260911030000_home_member_view_defaults.sql'), 'utf8') + '\nCOMMIT;');
    installed = policyRows().filter(row => row.permission === 'home.view' && introduced.includes(row.role_base));
    fs.writeFileSync(path.join(evidence, 'roles-introduced.json'), JSON.stringify(installed), { mode: 0o600 });
    f.setup(); initialized = true;
    sql(`UPDATE public."HomeOccupancy" SET age_band='adult',role='member',role_base='member' WHERE home_id=${q(home)} AND user_id<>${q(actor)};`);
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const pending = await request('/my-homes'); assert.equal(pending.status, 200);
    assert(!pending.body.homes.some(row => row.has_home_access));
    const invitation = await create(target);
    assert(!(await request('/my-homes')).body.homes.some(row => row.has_home_access));
    let accepted = await request(`/invitations/${invitation}/accept`, target, 'POST', {});
    assert.equal(accepted.status, 200); assert.equal(accepted.body.homeId, home);
    await shared();
    assert.equal(sql(`SELECT count(*) FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(target)};`), '0');
    console.log('PASS: actual HTTP invitation acceptance grants ordinary current Home view without any synthetic permission override');

    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(target)},'home.view',false);`);
    assert(!(await request('/my-homes')).body.homes.some(row => row.has_home_access));
    assert.equal((await request(`/${home}`)).status, 403);
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(target)} AND permission='home.view';`);
    await shared();
    for (const change of ["verification_status='provisional_bootstrap'", "access_start_at=now()+interval '1 day'", "access_end_at=now()-interval '1 second'", 'is_active=false']) {
      sql(`UPDATE public."HomeOccupancy" SET ${change} WHERE home_id=${q(home)} AND user_id=${q(target)};`);
      assert(!(await request('/my-homes')).body.homes.some(row => row.has_home_access));
      assert.equal((await request(`/${home}`)).status, 403);
      sql(`UPDATE public."HomeOccupancy" SET verification_status='verified',access_start_at=NULL,access_end_at=NULL,is_active=true WHERE home_id=${q(home)} AND user_id=${q(target)};`);
      await shared();
    }
    console.log('PASS: personal denial, provisional/future/expired/inactive membership retire real list and detail; each recovers');

    const secondInvite = await create(second);
    loseAcceptance = true;
    accepted = await request(`/invitations/${secondInvite}/accept`, second, 'POST', {});
    assert.equal(accepted.status, 503);
    const auditCount = sql(`SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=${q(home)};`);
    assert.equal(sql(`SELECT verification_status FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(second)};`), 'verified');
    accepted = await request(`/invitations/${secondInvite}/accept`, second, 'POST', {});
    assert.equal(accepted.status, 200); assert.equal(sql(`SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=${q(home)};`), auditCount);
    await shared(second);
    console.log('PASS: a lost committed admission reply retries the same invitation without another occupancy or audit mutation');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { f.cleanup(); console.log('PASS: exact invitation HTTP fixture SQL cleanup'); }
    if (before) {
      // Retire only the exact rows absent before this local rehearsal. A changed
      // row aborts restoration instead of overwriting someone else's decision.
      assert.equal(installed.length, introduced.length);
      if (installed.length) sql(`BEGIN;
        LOCK TABLE public."HomeRolePermission" IN SHARE ROW EXCLUSIVE MODE;
        DO $$ BEGIN
          IF (SELECT count(*) FROM public."HomeRolePermission"r WHERE to_jsonb(r) IN
            (SELECT value FROM jsonb_array_elements(${q(JSON.stringify(installed))}::jsonb)))<>${installed.length}
            THEN RAISE EXCEPTION 'Rehearsal role rows changed; preserve for review'; END IF;
        END $$;
        DELETE FROM public."HomeRolePermission"r WHERE to_jsonb(r) IN
          (SELECT value FROM jsonb_array_elements(${q(JSON.stringify(installed))}::jsonb));
        COMMIT;`);
      assert.deepEqual(policyRows(), before); console.log('PASS: local role references restored exactly; migration ledger unchanged');
    }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
