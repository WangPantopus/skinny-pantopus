#!/usr/bin/env node
// Exercise the production relay against real SQL with an interrupted transport.
// No provider, staging or paid-service call. Only exact disposable fixtures.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const path = require('node:path');
const [container, database] = process.argv.slice(2);
assert.match(container || '', /^supabase_db_pantopus-home-[a-z0-9_-]+$/);
assert.match(database || '', /^(postgres|[a-z0-9_]+_contract)$/);
const id = n => `ddf18200-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), recipient = id(2), home = id(100);
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
let connections = 0;
function sql(query) {
  connections += 1;
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres',
    '-d', database, '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function rpc(name, args = {}) {
  const params = Object.entries(args).map(([key, value]) => {
    assert.match(key, /^p_[a-z_]+$/);
    return `${key} => ${value === null ? 'NULL' : literal(value)}`;
  });
  assert.match(name, /^[a-z_]+$/);
  return JSON.parse(sql(`SET ROLE service_role; SELECT public.${name}(${params.join(',')})::text; RESET ROLE;`) || 'null');
}
const db = { rpc: async (name, args) => ({ data: rpc(name, args), error: null }) };
let calls = [], mode = 'accepted';
const transport = {
  deliverStoredHomeTaskNotification: async (notification, options) => {
    assert.equal(notification.user_id, recipient);
    assert.equal(notification.metadata.home_id, home);
    assert.equal(notification.type, 'task_assigned');
    assert.equal(notification.context, 'personal');
    assert.equal(notification.title, 'A Home task was assigned to you');
    assert(!notification.body.includes('Private fixture title'));
    calls.push(notification);
    if (mode === 'unknown') throw new Error('Synthetic connection lost after transport attempt');
    if (mode === 'partial') return { acceptedCount: 1, unresolvedCount: 1 };
    return { acceptedCount: options.pushAllowedAtAssignment ? 1 : 0,
      unresolvedCount: 0, suppressed: !options.pushAllowedAtAssignment };
  },
};
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent?.filename.endsWith('/services/homeTaskAssignmentDeliveryService.js')) {
    if (request === '../config/supabaseAdmin') return db;
    if (request === './notificationService') return transport;
  }
  return load.call(this, request, parent, isMain);
};
const service = require(path.resolve(__dirname, '../../backend/services/homeTaskAssignmentDeliveryService.js'));
Module._load = load;
function create(key) {
  const value = rpc('create_home_task_with_receipt', { p_home_id: home, p_actor_id: owner,
    p_request_id: id(key), p_payload: JSON.stringify({ title: 'Private fixture title', assigned_to: recipient }) });
  assert.equal(value.ok, true); return value;
}
function event(taskId) { return JSON.parse(sql(`SELECT to_jsonb(d)::text FROM public."HomeTaskAssignmentDelivery" d WHERE task_id=${literal(taskId)};`)); }
function due(taskId) { sql(`UPDATE public."HomeTaskAssignmentDelivery" SET retry_at=clock_timestamp()-interval '1 second' WHERE task_id=${literal(taskId)};`); }
async function main() {
  let initialized = false;
  try {
    sql(`BEGIN;
      INSERT INTO auth.users(id,email) VALUES(${literal(owner)},'assignment-service-owner@example.invalid'),(${literal(recipient)},'assignment-service-recipient@example.invalid');
      INSERT INTO public."User"(id,email,username,name) SELECT id,email,'assignment_service_'||right(id::text,1),'Assignment fixture' FROM auth.users WHERE id IN (${literal(owner)},${literal(recipient)});
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode) VALUES(${literal(home)},${literal(owner)},${literal(owner)},'Service fixture','Test','WA','98607');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES
        (${literal(home)},${literal(owner)},'owner','owner','adult','verified'),(${literal(home)},${literal(recipient)},'member','member','adult','verified');
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${literal(home)},${literal(recipient)},'tasks.view',true);
      INSERT INTO public."MailPreferences"(user_id,push_notifications) VALUES(${literal(recipient)},true) ON CONFLICT(user_id) DO UPDATE SET push_notifications=true;
      COMMIT;`);
    initialized = true;
    const first = create(501), original = event(first.record.id);
    mode = 'unknown'; assert.equal((await service.deliverPending()).retry, 1);
    assert.equal(event(first.record.id).state, 'pending');
    due(first.record.id); mode = 'partial'; assert.equal((await service.deliverPending()).retry, 1);
    due(first.record.id); mode = 'accepted'; assert.equal((await service.deliverPending()).delivered, 1);
    assert.equal(event(first.record.id).state, 'done');
    assert.equal(calls.length, 3);
    for (const note of calls) assert.equal(note.id, original.notification_id);
    assert.equal(create(501).record.id, first.record.id);
    assert.equal((await service.deliverPending()).selected, 0);
    assert.equal(sql(`SELECT count(*) FROM public."Notification" WHERE metadata->>'home_id'=${literal(home)};`), '1');
    console.log('PASS: production relay recovers unknown/partial delivery with one original event, Notification and task receipt');

    create(502); calls = [];
    sql(`UPDATE public."HomeOccupancy" SET access_end_at=clock_timestamp()-interval '1 second' WHERE home_id=${literal(home)} AND user_id=${literal(recipient)};`);
    assert.equal((await service.deliverPending()).suppressed, 1); assert.equal(calls.length, 0);
    sql(`UPDATE public."HomeOccupancy" SET access_end_at=NULL WHERE home_id=${literal(home)} AND user_id=${literal(recipient)};`);
    assert.equal((await service.deliverPending()).selected, 0);
    console.log('PASS: actual relay suppresses revoked access without invoking transport or replaying after restoration');

    sql(`UPDATE public."MailPreferences" SET push_notifications=false WHERE user_id=${literal(recipient)};`);
    const off = create(503);
    sql(`UPDATE public."MailPreferences" SET push_notifications=true WHERE user_id=${literal(recipient)};`);
    assert.equal((await service.deliverPending()).suppressed, 1);
    assert.equal(event(off.record.id).state, 'suppressed');
    assert.equal((await service.deliverPending()).selected, 0);
    console.log('PASS: disabled-at-assignment event stays in-app and is never replayed after opt-in');

    const leased = create(504); rpc('claim_home_task_assignment_delivery');
    sql(`UPDATE public."HomeTaskAssignmentDelivery" SET lease_until=clock_timestamp()-interval '1 second' WHERE task_id=${literal(leased.record.id)};`);
    assert.equal((await service.deliverPending()).delivered, 1);
    assert.equal(event(leased.record.id).attempts, 2);
    console.log('PASS: production relay recovers a worker crash through the expired original delivery lease');
  } finally {
    if (initialized) {
      sql(`BEGIN; DELETE FROM public."Notification" WHERE metadata->>'home_id'=${literal(home)};
        DELETE FROM public."Home" WHERE id=${literal(home)};
        DELETE FROM public."User" WHERE id IN (${literal(owner)},${literal(recipient)});
        DELETE FROM auth.users WHERE id IN (${literal(owner)},${literal(recipient)}); COMMIT;`);
      assert.equal(sql(`SELECT (SELECT count(*) FROM public."HomeTaskAssignmentDelivery" WHERE home_id=${literal(home)})+
        (SELECT count(*) FROM public."HomeTaskCreateReceipt" WHERE home_id=${literal(home)})+
        (SELECT count(*) FROM public."HomeTask" WHERE home_id=${literal(home)})+
        (SELECT count(*) FROM public."Notification" WHERE metadata->>'home_id'=${literal(home)})+
        (SELECT count(*) FROM auth.users WHERE id IN (${literal(owner)},${literal(recipient)}));`), '0');
      console.log('PASS: exact synthetic fixture cleanup');
    }
  }
  console.log(`PASS: production Home assignment relay through ${connections} real SQL connections`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
