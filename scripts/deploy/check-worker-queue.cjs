// Run inside the production image against a disposable CI PostgreSQL only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { setTimeout: delay } = require('node:timers/promises');
const { initPgBoss, getBoss, stopPgBoss } = require('/app/jobs/pgBossManager');

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
    console.log('Production queue contract passed: all 21 consumers, existing queue upgrade, cron dispatch, retries, retention, two-connection pool and restart');
  } finally { await stopPgBoss(); }
})().catch(error => { console.error(error); process.exit(1); });
