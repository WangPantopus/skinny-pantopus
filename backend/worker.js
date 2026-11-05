/**
 * Worker process entry point.
 *
 * Runs pg-boss queue workers (Tier 2 jobs) and node-cron (Tier 3 jobs)
 * in a standalone process, separate from the Express API server.
 *
 * Usage:
 *   node worker.js
 *   # or via docker-compose: command: node worker.js
 */

const fs = require('fs');
const dotenvPath = fs.existsSync('.env') ? '.env' : '.env.dev';
require('dotenv').config({ path: dotenvPath });
require('./config/stagingRuntime').validateStagingRuntime();

const logger = require('./utils/logger');
const { initPgBoss, stopPgBoss } = require('./jobs/pgBossManager');
const { registerPgBossJobs } = require('./jobs/pgBossJobs');
const { startJobs } = require('./jobs');

function envFlagEnabled(name, defaultValue = true) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return defaultValue;
  return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

async function main() {
  // A restarted container must not inherit a readiness marker from a previous
  // process while it is still establishing its queue connection.
  fs.rmSync('/tmp/pantopus-worker-ready', { force: true });
  logger.info('[Worker] Starting...');

  // Start pg-boss queue workers (Tier 2 jobs)
  let pgBossBackedJobsStarted = false;
  if (envFlagEnabled('PGBOSS_ENABLED', true)) {
    try {
      const boss = await initPgBoss();
      if (boss) {
        await registerPgBossJobs(boss);
        pgBossBackedJobsStarted = true;
      } else {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Hosted worker requires DATABASE_URL when PGBOSS_ENABLED=true');
        }
        logger.warn('[Worker] pg-boss not initialized — Tier 2 jobs will fall back to node-cron');
      }
    } catch (err) {
      // Staging also uses production security/runtime defaults. Failing the
      // process lets deployment readiness trigger rollback instead of reporting
      // success with missing queue consumers or partially registered jobs.
      if (process.env.NODE_ENV === 'production') throw err;
      logger.error('[Worker] Failed to initialize pg-boss; Tier 2 jobs will fall back to node-cron', {
        error: err.message,
        stack: err.stack,
      });
    }
  } else {
    logger.info('[Worker] Skipping pg-boss because PGBOSS_ENABLED=false');
  }

  // Start node-cron jobs (Tier 3 — lightweight, idempotent)
  if (envFlagEnabled('CRON_ENABLED', true)) {
    startJobs({ skipPgBossBackedJobs: pgBossBackedJobsStarted });
  } else {
    logger.info('[Worker] Skipping node-cron because CRON_ENABLED=false');
  }

  // Written only after queue/cron registration; stale heartbeats fail Docker health.
  const heartbeat = () => fs.writeFileSync('/tmp/pantopus-worker-ready', String(Date.now()));
  heartbeat();
  setInterval(heartbeat, 10000).unref();
  logger.info('[Worker] Ready');
}

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`[Worker] ${signal} received, shutting down...`);
  await stopPgBoss().catch((err) => {
    logger.error('[Worker] Error stopping pg-boss:', { error: err.message });
  });
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('[Worker] Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[Worker] Unhandled Rejection', { reason });
  process.exit(1);
});

main().catch((err) => {
  logger.error('[Worker] Fatal error:', { error: err.message, stack: err.stack });
  process.exit(1);
});
