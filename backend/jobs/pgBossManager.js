const { PgBoss } = require('pg-boss');
const logger = require('../utils/logger');

let boss = null;

// All consumers share one circuit. Backoff rejects locally, without sending
// another query or automatically replaying a write whose commit is uncertain.
function protectQueueDatabase(db) {
  const execute = db.executeSql.bind(db);
  let retryAt = 0;
  let failures = 0;
  let probing = false;
  let generation = 0;

  const unavailable = () => Object.assign(new Error('Queue database is backing off'), {
    code: 'PGBOSS_DB_BACKOFF',
  });
  const transient = error => /^(08|53|57)/.test(error.code || '')
    || ['55P03', '40001', '40P01', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN'].includes(error.code)
    || /timeout|timed out|connection terminated|connection closed|not currently accepting connections/i.test(error.message || '');

  db.executeSql = async (text, values) => {
    const probe = retryAt > 0;
    if (probe && (Date.now() < retryAt || probing)) throw unavailable();
    if (probe) probing = true;
    const startedGeneration = generation;
    try {
      const result = await execute(text, values);
      // A successful query already in flight cannot erase a newer failure.
      if (probe && generation === startedGeneration) {
        retryAt = 0;
        failures = 0;
        logger.info('[pg-boss] Database recovered; queue polling resumed');
      }
      return result;
    } catch (error) {
      if (transient(error) && generation === startedGeneration) {
        failures += 1;
        generation += 1;
        const delayMs = Math.min(120000, 30000 * (2 ** Math.min(failures - 1, 2)));
        retryAt = Date.now() + delayMs;
        logger.warn('[pg-boss] Database unavailable; queue polling backed off', {
          code: error.code || 'CONNECTION_ERROR', retryInMs: delayMs,
        });
      } else if (probe && !transient(error) && generation === startedGeneration) {
        // A constraint/programming error still proves the database is reachable.
        retryAt = 0;
        failures = 0;
      }
      throw error;
    } finally {
      if (probe) probing = false;
    }
  };
}

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
    application_name: 'pantopus-queue',
    connectionTimeoutMillis: 3000,
    // Cancel work in PostgreSQL first; the client bound covers a lost socket.
    statement_timeout: 5000,
    lock_timeout: 1000,
    query_timeout: 8000,
    idle_in_transaction_session_timeout: 8000,
    // Supavisor session pooling ignores these PostgreSQL startup parameters.
    // Await explicit session settings before lending each new connection to
    // pg-boss. This hook also runs when the pool replaces a lost connection.
    onConnect: async (client) => {
      await client.query(`
        SET statement_timeout = '5s';
        SET lock_timeout = '1s';
        SET idle_in_transaction_session_timeout = '8s';
        SET application_name = 'pantopus-queue';
      `);
    },
    // Supervision wakes every minute. Keep the eligibility threshold below
    // that interval so timing jitter cannot skip an expired-job recovery pass.
    monitorIntervalSeconds: 30,
    maintenanceIntervalSeconds: 60 * 60,
  });
  protectQueueDatabase(boss.getDb());

  boss.on('error', (error) => {
    if (error.code === 'PGBOSS_DB_BACKOFF') return;
    logger.error('[pg-boss] Error:', { error: error.message });
  });

  boss.on('monitor-states', (states) => {
    logger.info('[pg-boss] Queue states:', states);
  });

  await boss.start();
  // pg-boss creates this queue during start(). These are scheduler handoffs,
  // not application jobs; retain a short diagnostic window after completion.
  // updateQueue is required because createQueue leaves existing queues alone.
  await boss.updateQueue('__pgboss__send-it', {
    deleteAfterSeconds: 60 * 60,
    expireInSeconds: 60,
    retryLimit: 20,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 300,
  });
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
