// Run inside the production image against a disposable CI PostgreSQL only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { setTimeout: delay } = require('node:timers/promises');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const { Client } = require('/app/node_modules/pg');
const { initPgBoss, getBoss, stopPgBoss } = require('/app/jobs/pgBossManager');

// Supavisor's session pooler drops these startup parameters. Exercise the
// deployed connection hook with that behavior, including reconnects below.
const bossRequire = createRequire(require.resolve('/app/node_modules/pg-boss'));
const { Client: QueueClient } = bossRequire('pg');
const startupConf = QueueClient.prototype.getStartupConf;
let strippedStartups = 0;
QueueClient.prototype.getStartupConf = function () {
  const config = startupConf.call(this);
  if (config.application_name === 'pantopus-queue') {
    strippedStartups += 1;
    delete config.application_name;
    delete config.statement_timeout;
    delete config.lock_timeout;
    delete config.idle_in_transaction_session_timeout;
  }
  return config;
};

async function until(check, message, timeout = 120000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(500);
  }
  throw new Error(message);
}

// Use the production registration and handler wrapper, replacing only business
// side effects. The queue, cron dispatcher, retry and maintenance are real.
const calls = new Map();
const moduleStub = { exports: {} };
vm.runInNewContext(fs.readFileSync('/app/jobs/pgBossJobs.js', 'utf8'), {
  module: moduleStub,
  require: name => {
    if (name === '../utils/logger') return { info() {}, error() {} };
    if (name === '../config/householdClaims') return { jobs: { dryRun: true } };
    assert.match(name, /^\.\//);
    return async () => {
      const count = (calls.get(name) || 0) + 1;
      calls.set(name, count);
      if (name === './deliverGigAuthorizationExpiry' && count === 1) {
        throw new Error('Synthetic transient delivery failure');
      }
    };
  },
});
const { registerPgBossJobs } = moduleStub.exports;

(async () => {
  assert.equal(new URL(process.env.DATABASE_URL).hostname, 'pantopus-queue-db');
  const appQueue = 'deliver-gig-authorization-expiry';
  const dispatchQueue = '__pgboss__send-it';
  try {
    let boss = await initPgBoss();
    assert.equal(getBoss(), boss);
    const errors = [];
    boss.on('error', error => errors.push(error));
    const db = boss.getDb();
    const sql = (text, values) => db.executeSql(text, values);
    assert.equal(db.pool.options.max, 2);
    assert.equal((await sql('SHOW statement_timeout')).rows[0].statement_timeout, '5s');
    assert.equal((await sql('SHOW lock_timeout')).rows[0].lock_timeout, '1s');
    assert.equal((await sql('SHOW idle_in_transaction_session_timeout')).rows[0].idle_in_transaction_session_timeout, '8s');
    assert.equal((await sql('SHOW application_name')).rows[0].application_name, 'pantopus-queue');
    assert.ok(strippedStartups > 0, 'Pooler startup simulation did not reach the queue client');
    assert.equal(db.pool.options.query_timeout, 8000);
    // Simulate an installation with the previous seven-day queue defaults.
    await boss.createQueue(appQueue, { policy: 'singleton', deleteAfterSeconds: 604800 });
    const pending = await boss.send(appQueue, {}, { startAfter: 86400, retentionSeconds: 604800 });
    await sql("UPDATE pgboss.job SET state = 'retry', created_on = now() - interval '2 days' WHERE id = $1", [pending]);

    const consumers = [];
    const work = boss.work.bind(boss);
    boss.work = async (name, options, fn) => {
      consumers.push(name);
      assert.equal(options.pollingIntervalSeconds, 30);
      return work(name, options, fn);
    };
    await registerPgBossJobs(boss);
    assert.equal(consumers.length, 21);
    const schedules = await boss.getSchedules();
    assert.equal(schedules.length, consumers.length);
    for (const name of consumers) {
      const queue = await boss.getQueue(name);
      assert.equal(queue.deleteAfterSeconds, 86400);
      assert.equal(queue.retentionSeconds, 604800);
      assert.equal(queue.retryLimit, 3);
      assert.equal(queue.retryDelay, 30);
      assert.equal(queue.retryBackoff, true);
      assert.equal(queue.expireInSeconds, 3600);
      assert.equal(queue.policy, 'singleton');
    }
    assert.equal((await boss.getQueue(dispatchQueue)).deleteAfterSeconds, 3600);

    const ids = [];
    for (const name of consumers) ids.push(await boss.send(name, { synthetic: true }));
    await until(async () => {
      const { rows } = await sql("SELECT count(*)::int AS n FROM pgboss.job WHERE id = ANY($1::uuid[]) AND state = 'completed'", [ids]);
      return rows[0].n === consumers.length;
    }, 'Not every registered consumer completed its job');
    assert.equal(calls.size, consumers.length);
    await until(async () => {
      const { rows } = await sql("SELECT count(*)::int AS n FROM pgboss.job WHERE name = $1 AND state = 'completed' AND retry_count > 0", [appQueue]);
      return rows[0].n > 0;
    }, 'Transient failure did not retry and complete');
    await until(async () => {
      const { rows } = await sql("SELECT count(*)::int AS n FROM pgboss.job WHERE name = $1 AND state = 'completed' AND data->>'name' = $2", [dispatchQueue, appQueue]);
      return rows[0].n > 0;
    }, 'Minute cron did not dispatch through the internal queue');
    await until(async () => {
      const { rows } = await sql("SELECT count(*)::int AS n FROM pgboss.job WHERE name = $1 AND state = 'completed' AND singleton_key = $1", [appQueue]);
      return rows[0].n > 0;
    }, 'Cron-dispatched application job did not complete');

    // A real failed enqueue must retain both handoffs for retry. The successful
    // half of the batch must not publish a duplicate when the batch is replayed.
    await sql(`CREATE FUNCTION public.reject_health_probe() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.data->>'healthFault' = 'reject' THEN
        RAISE EXCEPTION 'Synthetic dispatch rejection' USING ERRCODE = '23514';
      END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_health_probe BEFORE INSERT ON pgboss.job_common
      FOR EACH ROW EXECUTE FUNCTION public.reject_health_probe()`);
    const handoffs = [randomUUID(), randomUUID()];
    const targets = ['deliver-gig-stop', 'deliver-home-task-assignments'];
    await boss.insert(dispatchQueue, handoffs.map((id, i) => ({
      id, data: { name: targets[i], data: { healthFault: i ? 'reject' : 'accept' }, options: {} },
    })));
    await until(async () => {
      const { rows } = await sql('SELECT state FROM pgboss.job WHERE name = $1 AND id = $2', [dispatchQueue, handoffs[1]]);
      assert.notEqual(rows[0].state, 'completed', 'Failed dispatch was silently marked complete');
      return rows[0].state === 'retry';
    }, 'Rejected dispatch did not enter retry');
    await sql('DROP TRIGGER reject_health_probe ON pgboss.job_common; DROP FUNCTION public.reject_health_probe()');
    await until(async () => (await sql("SELECT count(*)::int AS n FROM pgboss.job WHERE name = $1 AND id = ANY($2::uuid[]) AND state = 'completed'", [dispatchQueue, handoffs])).rows[0].n === 2,
      'Dispatch did not recover after enqueue failure', 180000);
    assert.equal((await sql("SELECT count(*)::int AS n FROM pgboss.job WHERE name = ANY($1::text[]) AND data ? 'healthFault'", [targets])).rows[0].n, 2);
    assert.equal((await sql('SELECT count(*)::int AS n FROM pgboss.job WHERE name = ANY($1::text[]) AND id = ANY($2::uuid[])', [targets, handoffs])).rows[0].n, 2);

    // Age synthetic terminal records; maintenance must spare pending retries,
    // active jobs and recent failures while deleting expired terminal history.
    const fixtures = [];
    for (const [name, state, age] of [
      [appQueue, 'completed', '2 days'], [appQueue, 'failed', '2 days'],
      [dispatchQueue, 'completed', '2 hours'], [appQueue, 'failed', '1 hour'],
      [appQueue, 'active', '0 seconds'],
    ]) {
      const id = await boss.send(name, {}, { startAfter: 86400 });
      await sql("UPDATE pgboss.job SET state = $2::pgboss.job_state, started_on = now(), completed_on = CASE WHEN $2 = 'active' THEN NULL ELSE now() - $3::interval END WHERE id = $1", [id, state, age]);
      fixtures.push(id);
    }
    await sql('UPDATE pgboss.queue SET maintain_on = NULL WHERE name = ANY($1::text[])', [[appQueue, dispatchQueue]]);
    await boss.supervise([await boss.getQueue(appQueue), await boss.getQueue(dispatchQueue)]);
    const remaining = (await sql('SELECT id FROM pgboss.job WHERE id = ANY($1::uuid[])', [[pending, ...fixtures]])).rows.map(row => row.id).sort();
    assert.deepEqual(remaining, [pending, fixtures[3], fixtures[4]].sort());
    // A future retry survives worker replacement and existing scheduler queue
    // settings are refreshed, rather than silently keeping their old defaults.
    await boss.deleteJob(appQueue, fixtures[4]);
    await boss.updateQueue(dispatchQueue, { deleteAfterSeconds: 604800 });
    await stopPgBoss();
    boss = await initPgBoss();
    assert.equal((await boss.getQueue(dispatchQueue)).deleteAfterSeconds, 3600);
    assert.equal((await boss.findJobs(appQueue, { id: pending }))[0].state, 'retry');
    const restartedSchedules = await boss.getSchedules();
    assert.deepEqual(restartedSchedules, schedules);
    assert.equal(errors.length, 0);
    const guarded = boss.getDb();
    const started = Date.now();
    await assert.rejects(guarded.executeSql('SELECT pg_sleep(10)'), error => error.code === '57014');
    assert.ok(Date.now() - started < 7500, 'Slow queue SQL did not cancel on the server');
    let attempts = 0;
    const query = guarded.pool.query.bind(guarded.pool);
    guarded.pool.query = (...args) => { attempts += 1; return query(...args); };
    await Promise.all(Array.from({ length: 21 }, () => assert.rejects(
      guarded.executeSql('SELECT 1'), error => error.code === 'PGBOSS_DB_BACKOFF')));
    assert.equal(attempts, 0, 'Consumers queried PostgreSQL during shared backoff');
    await until(async () => {
      try { await guarded.executeSql('SELECT 1'); return true; }
      catch (error) { if (error.code !== 'PGBOSS_DB_BACKOFF') throw error; return false; }
    }, 'Queue did not recover from SQL timeout', 45000);

    // Stop accepting connections in this disposable database only. An admin
    // connection stays alive so recovery never depends on the guarded pool.
    const adminUrl = new URL(process.env.DATABASE_URL);
    adminUrl.pathname = '/template1';
    const admin = new Client({ connectionString: adminUrl.toString(), application_name: 'queue-check-admin' });
    await admin.connect();
    try {
      await admin.query('ALTER DATABASE postgres ALLOW_CONNECTIONS false');
      await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'pantopus-queue'");
      await assert.rejects(guarded.executeSql('SELECT 1'));
      const firstAttempt = Date.now();
      const initialAttempts = attempts;
      await delay(15000);
      await assert.rejects(guarded.executeSql('SELECT 1'), error => error.code === 'PGBOSS_DB_BACKOFF');
      assert.equal(attempts, initialAttempts, 'Circuit retried before its 30-second delay');
      await until(async () => attempts > initialAttempts, 'Circuit never attempted recovery', 30000);
      assert.ok(Date.now() - firstAttempt >= 29000);
      await delay(1000); // let the failed connection finish opening the longer circuit
      await admin.query('ALTER DATABASE postgres ALLOW_CONNECTIONS true');
      const secondAttempts = attempts;
      await delay(35000);
      await assert.rejects(guarded.executeSql('SELECT 1'), error => error.code === 'PGBOSS_DB_BACKOFF');
      assert.equal(attempts, secondAttempts, 'Repeated failure did not back off for 60 seconds');
      await until(async () => {
        try { await guarded.executeSql('SELECT 1'); return true; }
        catch (error) { if (error.code !== 'PGBOSS_DB_BACKOFF') throw error; return false; }
      }, 'Queue did not recover after database outage', 45000);
      assert.equal((await guarded.executeSql('SHOW statement_timeout')).rows[0].statement_timeout, '5s');
      assert.equal((await guarded.executeSql('SHOW lock_timeout')).rows[0].lock_timeout, '1s');
      await registerPgBossJobs(boss);
      const definitions = rows => rows.map(({ updated_on, ...definition }) => definition);
      assert.deepEqual(definitions(await boss.getSchedules()), definitions(schedules));
      assert.equal((await boss.findJobs(appQueue, { id: pending }))[0].state, 'retry');
    } finally {
      await admin.query('ALTER DATABASE postgres ALLOW_CONNECTIONS true');
      await admin.end();
    }
    console.log('Production queue contract passed: all 21 consumers, schedules, retries, retention, restart, SQL cancellation, shared exponential backoff and idempotent dispatch recovery');
  } finally { await stopPgBoss(); }
})().catch(error => { console.error(error); process.exit(1); });
