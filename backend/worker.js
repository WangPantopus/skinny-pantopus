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
        logger.warn('[Worker] pg-boss not initialized — Tier 2 jobs will fall back to node-cron');
      }
    } catch (err) {
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
