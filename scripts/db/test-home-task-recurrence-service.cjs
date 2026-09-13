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
const id = n => `ddf20200-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
    return `${key} => ${value === null ? 'NULL' : literal(typeof value === 'object' ? JSON.stringify(value) : value)}`;
  });
  assert.match(name, /^[a-z_]+$/);
  return JSON.parse(sql(`SET ROLE service_role; SELECT public.${name}(${params.join(',')})::text; RESET ROLE;`) || 'null');
}
const db = { rpc: async (name, args) => ({ data: rpc(name, args), error: null }) };
let loseCommand = true, loseGeneration = true;
db.rpc = async (name, args) => {
  const data = rpc(name, args);
  if (name === 'set_home_task_recurrence' && loseCommand) { loseCommand = false; throw new Error('Synthetic lost command reply after commit'); }
  if (name === 'generate_home_task_recurrence' && loseGeneration) { loseGeneration = false; throw new Error('Synthetic lost generation reply after commit'); }
  return { data, error: null };
};
const load = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith('/services/homeTaskRecurrenceService.js') && request === '../config/supabaseAdmin') return db;
  return load.call(this, request, parent, isMain);
};
const service = require(path.resolve(__dirname, '../../backend/services/homeTaskRecurrenceService.js'));
Module._load = load;
async function main() {
  let initialized = false;
  try {
    assert.equal(sql(`SELECT count(*) FROM auth.users WHERE id IN (${literal(owner)},${literal(recipient)});`), '0');
    sql(`BEGIN;
      INSERT INTO auth.users(id,email) VALUES(${literal(owner)},'recurrence-service-owner@example.invalid'),(${literal(recipient)},'recurrence-service-recipient@example.invalid');
      INSERT INTO public."User"(id,email,username,name) SELECT id,email,'recurrence_service_'||right(id::text,1),'Recurrence fixture' FROM auth.users WHERE id IN (${literal(owner)},${literal(recipient)});
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode) VALUES(${literal(home)},${literal(owner)},${literal(owner)},'Service fixture','Test','WA','98607');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES
        (${literal(home)},${literal(owner)},'owner','owner','adult','verified'),(${literal(home)},${literal(recipient)},'member','member','adult','verified');
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${literal(home)},${literal(recipient)},'tasks.view',true);
      COMMIT;`);
    initialized = true;
    const created = JSON.parse(sql(`SELECT public.mutate_home_record(${literal(home)},${literal(owner)},'task','create',NULL,
      jsonb_build_object('title','Recurring service task','assigned_to',${literal(recipient)},'due_at',clock_timestamp()-interval '3 days'))::text;`));
    assert.equal(created.ok,true);
    const args = { homeId:home, actorId:owner, taskId:created.record.id, requestId:id(501) };
    const state = await service.read(args);
    args.command = {action:'start',expected_revision:0,expected_task_updated_at:state.task_updated_at,frequency:'DAILY',interval:1,timezone:'UTC'};
    await assert.rejects(service.change(args),{statusCode:503});
    const saved = await service.change(args);
    assert.equal(saved.replayed,true);assert.equal(saved.receipt.request_id,args.requestId);
    assert.equal(sql(`SELECT count(*) FROM public."HomeTaskRecurrenceCommand" WHERE home_id=${literal(home)};`),'1');
    console.log('PASS: production service recovers the original command after a committed reply is lost');
    sql(`UPDATE public."HomeTaskRecurrence" SET next_due_at=anchor_at+interval '1 day' WHERE home_id=${literal(home)};`);
    assert.equal((await service.generateDue()).failed,1);
    assert.equal((await service.generateDue()).selected,0);
    const resumed = await service.read(args);
    assert.equal(resumed.configuration.generated_count,1);
    const generated = resumed.configuration.last_task_id;
    assert.notEqual(generated,args.taskId);
    assert.equal(sql(`SELECT count(*) FROM public."HomeTaskCreateReceipt" WHERE task_id=${literal(generated)};`),'1');
    assert.equal(sql(`SELECT count(*) FROM public."HomeTaskAssignmentDelivery" WHERE task_id=${literal(generated)};`),'1');
    assert.equal(sql(`SELECT count(*) FROM public."HomeTask" WHERE home_id=${literal(home)};`),'2');
    console.log('PASS: actual generator loses a committed response, then resumes with one task/receipt/outbox and no backlog');
    await service.change({...args,requestId:id(502),command:{action:'pause',expected_revision:1}});
    assert.equal((await service.change(args)).configuration.state,'paused');
    assert.equal((await service.generateDue()).selected,0);
    console.log('PASS: original start replay cannot undo a later pause through the production service');
  } finally {
    if (initialized) {
      sql(`BEGIN; DELETE FROM public."Notification" WHERE metadata->>'home_id'=${literal(home)};
        DELETE FROM public."Home" WHERE id=${literal(home)};
        DELETE FROM public."User" WHERE id IN (${literal(owner)},${literal(recipient)});
        DELETE FROM auth.users WHERE id IN (${literal(owner)},${literal(recipient)}); COMMIT;`);
      assert.equal(sql(`SELECT (SELECT count(*) FROM public."HomeTaskRecurrence" WHERE home_id=${literal(home)})+
        (SELECT count(*) FROM public."HomeTaskRecurrenceCommand" WHERE home_id=${literal(home)})+
        (SELECT count(*) FROM public."HomeTask" WHERE home_id=${literal(home)})+
        (SELECT count(*) FROM public."Notification" WHERE metadata->>'home_id'=${literal(home)})+
        (SELECT count(*) FROM auth.users WHERE id IN (${literal(owner)},${literal(recipient)}));`),'0');
      console.log('PASS: exact synthetic fixture cleanup');
    }
  }
  console.log(`PASS: production recurrence service through ${connections} actual SQL connections`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
