#!/usr/bin/env node
// Actual production HTTP/IAM/dashboard/record services and owned PostgreSQL.
// Only identity and fault/held transport injection are synthetic. No providers.
const assert = require('node:assert/strict');
const f = require('./home-residency-review-http-fixture.cjs')(process.argv[2], { summary: true, dashboard: true });
const { home, actor, sql, q, id } = f;
let server, initialized = false;
const permission = (name, allowed) => sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed)
  VALUES(${q(home)},${q(actor)},${q(name)},${allowed}) ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=EXCLUDED.allowed;`);
const restore = () => sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`);
async function main() {
  try {
    f.setup(); initialized = true;
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/homes/${home}/dashboard`;
    const request = async (suffix = '') => {
      const response = await fetch(base + suffix, { headers: { 'x-fixture-actor': actor }, signal: AbortSignal.timeout(30000) });
      assert.match(response.headers.get('cache-control'), /no-store/);
      return { status: response.status, body: await response.json() };
    };
    const resource = async (kind, suffix = '') => {
      const response = await fetch(base.replace(/dashboard$/, kind) + suffix,
        { headers: { 'x-fixture-actor': actor }, signal: AbortSignal.timeout(30000) });
      assert.match(response.headers.get('cache-control'), /no-store/);
      return { status: response.status, body: await response.json() };
    };
    const unavailable = response => { assert.equal(response.status, 503, JSON.stringify(response)); assert(!('counts' in response.body)); assert(!('home' in response.body)); };
    let r = await request(); assert.equal(r.status, 200, JSON.stringify(r));
    assert.deepEqual(r.body.counts, { tasks_open: 0, issues_open: 0, bills_due: 0, packages_expected: 0, documents: 0, events_upcoming: 0, members_active: 1, pets: 0 });
    assert.equal(r.body.today.unread_mail_count, 0); assert.deepEqual(r.body.recent_activity, []);
    console.log('PASS: real confirmed empty, one current verified member, no-store response');

    sql(`BEGIN;
      UPDATE public."Home" SET entry_instructions='Private entry fixture',location=ST_SetSRID(ST_MakePoint(0,0),4326) WHERE id=${q(home)};
      UPDATE public."HomeOccupancy" SET verification_status='verified', access_end_at=now()-interval '1 second' WHERE home_id=${q(home)} AND user_id=${q(f.users[1])};
      UPDATE public."HomeOccupancy" SET verification_status='verified', access_start_at=now()+interval '1 day' WHERE home_id=${q(home)} AND user_id=${q(f.users[2])};
      INSERT INTO public."HomeTask"(id,home_id,created_by,task_type,title,due_at) VALUES(${q(id(901))},${q(home)},${q(actor)},'chore','Current task',now()-interval '1 hour');
      INSERT INTO public."HomeCalendarEvent"(id,home_id,created_by,event_type,title,start_at) VALUES(${q(id(902))},${q(home)},${q(actor)},'other','Current event',now()+interval '5 minutes');
      INSERT INTO public."HomeBill"(id,home_id,created_by,bill_type,amount,currency,due_date,status)
        VALUES(${q(id(903))},${q(home)},${q(actor)},'electric',142.50,'USD',CURRENT_DATE-1,'overdue'),
          (${q(id(904))},${q(home)},${q(actor)},'electric',120.25,'USD',CURRENT_DATE+1,'due');
      INSERT INTO public."HomePet"(id,home_id,created_by,name,species) VALUES(${q(id(905))},${q(home)},${q(actor)},'Fixture pet','cat');
      INSERT INTO public."HomeGuestPass"(id,home_id,label,token_hash,start_at,end_at) VALUES
        (${q(id(906))},${q(home)},'Current','fixture-current',now()-interval '1 day',now()+interval '1 day'),
        (${q(id(907))},${q(home)},'Future','fixture-future',now()+interval '1 day',now()+interval '2 days'),
        (${q(id(908))},${q(home)},'Expired','fixture-expired',now()-interval '1 day',now()-interval '1 hour');
      INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action) VALUES(${q(home)},${q(actor)},'fixture_summary');
      ${['public', 'members', 'managers', 'sensitive'].map((visibility, index) => `
        INSERT INTO public."HomeIssue"(home_id,reported_by,title,status,visibility) VALUES(${q(home)},${q(actor)},'Fixture issue','scheduled',${q(visibility)});
        INSERT INTO public."HomePackage"(home_id,created_by,status,expected_at,visibility) VALUES(${q(home)},${q(actor)},'expected',now()+interval '2 days',${q(visibility)});
        INSERT INTO public."HomeDocument"(id,home_id,created_by,title,doc_type,visibility) VALUES(${q(id(920 + index))},${q(home)},${q(actor)},'Fixture document','other',${q(visibility)});
      `).join('')}
      INSERT INTO public."HomePackage"(home_id,created_by,status,visibility) VALUES(${q(home)},${q(actor)},'out_for_delivery','members');
      COMMIT;`);
    // Every invalid/private Mail variant is a real database row. Neither a
    // manager nor an owner may infer the presence of another addressee's mail.
    const mailBase = { recipient_home_id: home, address_home_id: home, type: 'notice', content: 'Synthetic local fixture', viewed: false, archived: false, privacy: 'shared_household' };
    const mailRows = [
      {}, { recipient_user_id: actor, privacy: 'private_to_person' },
      { attn_user_id: actor, privacy: 'private_to_person', delivery_visibility: 'attn_only' },
      { recipient_user_id: f.users[1], privacy: 'private_to_person' },
      { attn_user_id: f.users[1], delivery_visibility: 'attn_plus_admins' },
      { privacy: 'private_to_person' }, { viewed: true }, { archived: true },
      { expires_at: '2000-01-01' }, { time_limited_expires_at: '2000-01-01' }, { lifecycle: 'shredded' },
      { access_count_max: 1 },
      { recipient_type: 'user', recipient_id: f.users[1] }, { privacy: 'business_team' },
    ];
    for (const patch of mailRows) {
      const row = { ...mailBase, ...patch };
      sql(`INSERT INTO public."Mail"(${Object.keys(row).map(key => `"${key}"`)}) VALUES(${Object.values(row).map(value => q(value))});`);
    }
    r = await request(); assert.equal(r.status, 200, JSON.stringify(r));
    assert.deepEqual(r.body.counts, { tasks_open: 1, issues_open: 4, bills_due: 2, packages_expected: 5, documents: 4, events_upcoming: 1, members_active: 1, pets: 1 });
    assert.equal(r.body.today.next_bill.amount, 142.5); assert.equal(r.body.today.next_bill.status, 'overdue');
    assert.equal(r.body.today.tasks_due[0].id, id(901)); assert.equal(r.body.today.unread_mail_count, 3);
    assert.equal(r.body.today.active_guest_passes, 1); assert.equal(r.body.today.deliveries_arriving, 1);
    assert.equal(r.body.recent_activity.length, 1); assert.equal(r.body.members[0].user.displayName, 'residency_http_01'); assert(!('name' in r.body.members[0].user)); assert.equal(r.body.members[0].user.id, actor);
    assert(!('entry_instructions' in r.body.home)); assert(!('wifi_qr_file_id' in r.body.home));
    assert.deepEqual(r.body.home.location, { latitude: 0, longitude: 0 });
    console.log('PASS: real tasks/events, overdue bills, expected/arriving packages, scheduled issues, guest dates, member windows, private Mail and header projection');

    for (const [kind, table, total, status] of [['issues', 'HomeIssue', 4, 'scheduled'], ['packages', 'HomePackage', 5, 'expected']]) {
      let result = await resource(kind); assert.equal(result.status, 200, JSON.stringify(result));
      assert.equal(result.body[kind].length, total);
      assert(result.body[kind].every(row => row.home_id === home));
      result = await resource(kind, `?status=${status}`); assert.equal(result.status, 200);
      assert.equal(result.body[kind].length, 4); assert(result.body[kind].every(row => row.status === status));
      assert.equal((await resource(kind, '?status=in_transit')).status, 400);
      assert.equal((await resource(kind, '?status=open&status=expected')).status, 400);
      for (const reject of [false, true]) { f.failNextQuery(table, reject); unavailable(await resource(kind)); }
      for (const malformed of [null, [{ id: id(999), home_id: id(101) }], [null]]) {
        f.interceptNextQuery(table, result => ({ ...result, data: malformed })); unavailable(await resource(kind));
      }
      assert.equal((await resource(kind)).status, 200);
    }
    assert.equal((await resource('issues', '?severity=urgent')).body.issues.length, 0);
    assert.equal((await resource('issues', '?severity=invalid')).status, 400);
    assert.equal((await resource('packages', '?severity=urgent')).status, 400);
    console.log('PASS: actual issue/package lists, canonical filters, SQL/transport and malformed-list failure, no-store and recovery');

    for (const table of ['Home', 'HomeOccupancy', 'HomeOwner', 'HomeRolePermission', 'HomePermissionOverride', 'HomeBill', 'Mail', 'HomeGuestPass', 'HomePackage', 'HomeIssue', 'HomeDocument', 'HomePet', 'HomeAuditLog']) {
      for (const reject of [false, true]) { f.failNextQuery(table, reject); unavailable(await request()); }
    }
    for (const name of ['home_record_context', 'get_home_records', 'home_delete_eligibility']) {
      for (const reject of [false, true]) { f.failNextRpc(name, reject); unavailable(await request()); }
    }
    for (const malformed of [null, -1, '0', Number.NaN]) {
      f.interceptNextQuery('HomePet', result => ({ ...result, count: malformed })); unavailable(await request());
    }
    f.interceptNextQuery('HomeAuditLog', result => ({ ...result, data: null })); unavailable(await request());
    f.interceptNextQuery('Home', result => ({ ...result, error: { message: 'Unreadable Home' } }), detail => detail.columns.includes('address'));
    unavailable(await request());
    f.interceptNextQuery('HomeOwner', result => ({ ...result, error: { message: 'Unreadable owner enrichment' } }), detail => detail.columns.includes('verification_tier'));
    unavailable(await request());
    require('../../backend/services/homeHealthService').invalidateHealthScoreCache(home);
    f.failNextQuery('HomeSeasonalChecklistItem'); unavailable(await request('?include_health_score=true'));
    r = await request('?include_health_score=true'); assert.equal(r.status, 200); assert.equal(typeof r.body.health_score.score, 'number');
    console.log('PASS: SQL and transport errors, malformed counts/lists, Home/enrichment/health failures remain unavailable; successful recovery');

    const denied = ['members.view', 'members.manage', 'tasks.view', 'calendar.view', 'finance.view', 'mailbox.view', 'packages.view', 'maintenance.view', 'docs.view', 'security.manage'];
    denied.forEach(name => permission(name, false));
    const beforeQueries = f.queryDetails.length, beforeRpcs = f.rpcCalls.length;
    r = await request('?include_health_score=true'); assert.equal(r.status, 200, JSON.stringify(r));
    assert.deepEqual(r.body.counts, { tasks_open: 0, issues_open: 0, bills_due: 0, packages_expected: 0, documents: 0, events_upcoming: 0, members_active: 0, pets: 1 });
    assert.equal(r.body.today.unread_mail_count, 0); assert.equal(r.body.today.active_guest_passes, 0); assert.deepEqual(r.body.members, []); assert.deepEqual(r.body.recent_activity, []);
    const queried = f.queryDetails.slice(beforeQueries);
    for (const [kind, table] of [['issues', 'HomeIssue'], ['packages', 'HomePackage']]) {
      const before = f.queryDetails.length;
      assert.equal((await resource(kind)).status, 403);
      assert(!f.queryDetails.slice(before).some(query => query.table === table));
    }
    for (const table of ['HomeBill', 'Mail', 'HomeGuestPass', 'HomePackage', 'HomeIssue', 'HomeDocument', 'HomeAuditLog', 'HomeSeasonalChecklistItem']) assert(!queried.some(query => query.table === table), table);
    assert(!queried.some(query => query.table === 'HomeOccupancy' && query.columns.includes('jsonb_build_object')));
    assert(!f.rpcCalls.slice(beforeRpcs).includes('get_home_records'));
    restore(); permission('sensitive.view', false);
    r = await request(); assert.equal(r.status, 200); assert.equal(r.body.counts.documents, 3); assert.equal(r.body.counts.issues_open, 3); assert.equal(r.body.counts.packages_expected, 4);
    // A member with explicit resource grants still cannot count manager records.
    sql(`UPDATE public."Home" SET owner_id=NULL WHERE id=${q(home)}; DELETE FROM public."HomeOwner" WHERE home_id=${q(home)};
      UPDATE public."HomeOccupancy" SET role='member',role_base='member' WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    for (const name of ['home.view', 'docs.view', 'maintenance.view', 'packages.view']) permission(name, true);
    r = await request(); assert.equal(r.status, 200, JSON.stringify(r)); assert.equal(r.body.counts.documents, 2); assert.equal(r.body.counts.issues_open, 2); assert.equal(r.body.counts.packages_expected, 3);
    assert.equal((await resource('issues')).body.issues.length, 2);
    assert.equal((await resource('packages')).body.packages.length, 3);
    // A separately granted resource is usable without inventing home.view.
    permission('home.view', false); assert.equal((await request()).status, 403);
    assert.equal((await resource('issues')).status, 200); assert.equal((await resource('packages')).status, 200);
    sql(`UPDATE public."Home" SET owner_id=${q(actor)} WHERE id=${q(home)};
      INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier) VALUES(${q(home)},${q(actor)},'verified',true,'strong');
      UPDATE public."HomeOccupancy" SET role='owner',role_base='owner' WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    restore();
    console.log('PASS: explicit resource denials skip private reads even for owner; sensitive and manager visibility stay scoped');

    for (const [kind, table, grant] of [['issues', 'HomeIssue', 'maintenance.view'], ['packages', 'HomePackage', 'packages.view']]) {
      let release, captured;
      const held = new Promise(resolve => { captured = resolve; });
      f.interceptNextQuery(table, async result => { captured(); await new Promise(resolve => { release = resolve; }); return result; });
      const pending = resource(kind); await held; permission(grant, false); release();
      const result = await pending; assert.equal(result.status, 403); assert(!(kind in result.body));
      restore(); assert.equal((await resource(kind)).status, 200);
    }
    console.log('PASS: held issue/package SQL replies cannot restore a revoked view grant; explicit resource-only grants remain usable');

    // Pause an already-produced real SQL response. Mutate actual authority
    // through another connection, then release it to the production aggregate.
    async function heldChange(change, expectedStatus, cleanup) {
      let release, captured;
      const held = new Promise(resolve => { captured = resolve; });
      f.interceptNextQuery('HomePet', async result => { captured(); await new Promise(resolve => { release = resolve; }); return result; });
      const pending = request(); await held;
      sql(change); release();
      const result = await pending; assert.equal(result.status, expectedStatus, JSON.stringify(result)); assert(!('counts' in result.body));
      sql(cleanup); assert.equal((await request()).status, 200);
    }
    await heldChange(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'finance.view',false);`, 503,
      `DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`);
    await heldChange(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`, 403,
      `UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await heldChange(`UPDATE public."HomeOccupancy" SET access_end_at=now()-interval '1 second' WHERE home_id=${q(home)} AND user_id=${q(actor)};`, 403,
      `UPDATE public."HomeOccupancy" SET access_end_at=now()+interval '2 days' WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await heldChange(`UPDATE public."Home" SET security_state='frozen' WHERE id=${q(home)};`, 403,
      `UPDATE public."Home" SET security_state='normal' WHERE id=${q(home)};`);
    await heldChange(`UPDATE public."HomeOwner" SET owner_status='disputed' WHERE home_id=${q(home)} AND subject_id=${q(actor)};`, 403,
      `UPDATE public."HomeOwner" SET owner_status='verified' WHERE home_id=${q(home)} AND subject_id=${q(actor)};`);
    for (const status of ['pending_doc', 'pending_approval', 'provisional_bootstrap']) {
      sql(`UPDATE public."HomeOccupancy" SET verification_status=${q(status)} WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
      r = await request(); assert.equal(r.status, 403); assert(!('home' in r.body));
    }
    sql(`UPDATE public."HomeOccupancy" SET verification_status='verified' WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    assert.equal((await request()).status, 200);
    console.log('PASS: held SQL reply retires changed finance, membership, expiry, frozen Home and disputed ownership; applicants remain separate; fresh recovery succeeds');
    if (process.argv[3] && process.argv[4]) {
      const { execFileSync } = require('node:child_process');
      const path = require('node:path');
      assert.match(process.argv[3], /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
      let status;
      try { status = JSON.parse(execFileSync(process.argv[4], ['status', '--workdir', process.argv[3], '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })); }
      catch (_) { throw new Error('Could not read the owned local Supabase configuration'); }
      assert.equal(status.API_URL, 'http://127.0.0.1:64521'); assert(typeof status.SERVICE_ROLE_KEY === 'string');
      const { createClient } = require(path.resolve(__dirname, '../../backend/node_modules/@supabase/supabase-js'));
      f.useDatabaseClient(createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
      r = await request(); assert.equal(r.status, 200, JSON.stringify(r));
      assert.equal(r.body.today.unread_mail_count, 3); assert.equal(r.body.today.next_bill.amount, 142.5);
      assert.equal(r.body.counts.packages_expected, 5); assert.equal(r.body.today.deliveries_arriving, 1);
      assert.equal(r.body.members[0].user.displayName, 'residency_http_01'); assert.equal(r.body.counts.members_active, 1);
      assert.deepEqual(r.body.home.location, { latitude: 0, longitude: 0 });
      for (const [kind, total] of [['issues', 4], ['packages', 5]]) {
        const result = await resource(kind); assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.body[kind].length, total);
      }
      permission('sensitive.view', false);
      assert.equal((await resource('issues', '?status=scheduled')).body.issues.length, 3);
      assert.equal((await resource('packages', '?status=expected')).body.packages.length, 3); restore();
      permission('finance.view', false); r = await request(); assert.equal(r.status, 200); assert.equal(r.body.counts.bills_due, 0); assert.equal(r.body.today.next_bill, null); restore();
      sql(`UPDATE public."Home" SET security_state='frozen' WHERE id=${q(home)};`);
      assert.equal((await request()).status, 403);
      sql(`UPDATE public."Home" SET security_state='normal' WHERE id=${q(home)};`);
      assert.equal((await request()).status, 200);
      console.log('PASS: actual Supabase SDK/PostgREST wire, nested identity join, compound Mail/package/date filters, fractional bill, geography, denial and recovery');
    }
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) {
      sql(`DELETE FROM public."Mail" WHERE recipient_home_id=${q(home)};`);
      f.cleanup(); console.log('PASS: exact dashboard HTTP fixture SQL cleanup');
    }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
