const PgBoss = require('pg-boss');
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
    monitorIntervalSeconds: 30,
  });

  boss.on('error', (error) => {
    logger.error('[pg-boss] Error:', { error: error.message });
  });

  boss.on('monitor-states', (states) => {
    logger.info('[pg-boss] Queue states:', states);
  });

  await boss.start();
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
