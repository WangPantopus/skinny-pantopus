// Run inside the production image against a disposable CI PostgreSQL only.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { initPgBoss, getBoss, stopPgBoss } = require('/app/jobs/pgBossManager');

(async () => {
  assert.equal(new URL(process.env.DATABASE_URL).hostname, 'pantopus-queue-db');
  try {
    const boss = await initPgBoss();
    assert.equal(getBoss(), boss);
    const name = 'production-image-contract';
    await boss.createQueue(name);
    const marker = randomUUID();
    let timer;
    const delivered = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Queue consumer did not receive the job')), 15000);
      boss.work(name, { pollingIntervalSeconds: 1 }, async ([job]) => {
        resolve(job.data.marker);
      }).catch(reject);
    });
    try {
      assert.ok(await boss.send(name, { marker }));
      assert.equal(await delivered, marker);
    } finally { clearTimeout(timer); }
    console.log('Production image queue startup, enqueue and consumption passed');
  } finally { await stopPgBoss(); }
})().catch(error => { console.error(error); process.exit(1); });
