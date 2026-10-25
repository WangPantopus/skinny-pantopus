const { PgBoss } = require('pg-boss');
const logger = require('../utils/logger');

let boss = null;

async function initPgBoss() {
  if (process.env.NODE_ENV === 'test') return null;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logger.warn('[pg-boss] DATABASE_URL not set, skipping pg-boss initialization');
    return null;
  }

  boss = new PgBoss({
    connectionString,
    schema: 'pgboss',               // Separate schema, won't interfere with app tables
    // Queue bookkeeping must fit alongside the API on the smallest database.
    max: 2,
    // Supervision wakes every minute. Keep the eligibility threshold below
    // that interval so timing jitter cannot skip an expired-job recovery pass.
    monitorIntervalSeconds: 30,
    maintenanceIntervalSeconds: 60 * 60,
  });

  boss.on('error', (error) => {
    logger.error('[pg-boss] Error:', { error: error.message });
  });

  boss.on('monitor-states', (states) => {
    logger.info('[pg-boss] Queue states:', states);
  });

  await boss.start();
  // pg-boss creates this queue during start(). These are scheduler handoffs,
  // not application jobs; retain a short diagnostic window after completion.
  // updateQueue is required because createQueue leaves existing queues alone.
  await boss.updateQueue('__pgboss__send-it', { deleteAfterSeconds: 60 * 60 });
  logger.info('[pg-boss] Started successfully');

  return boss;
}

function getBoss() {
  return boss;
}

async function stopPgBoss() {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 5000 });
    logger.info('[pg-boss] Stopped');
  }
}

module.exports = { initPgBoss, getBoss, stopPgBoss };
