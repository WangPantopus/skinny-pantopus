const logger = require('../utils/logger');
const householdClaimConfig = require('../config/householdClaims');

// Import existing job functions (no changes to them)
const recomputeUtilityScores = require('./recomputeUtilityScores');
const organicMatch = require('./organicMatch');
const refreshDiscoveryCache = require('./refreshDiscoveryCache');
const expirePendingPaymentBids = require('./expirePendingPaymentBids');
const computeReputation = require('./computeReputation');
const earnRiskReview = require('./earnRiskReview');
const processClaimWindows = require('./processClaimWindows');
const reconcileHomeHouseholdResolution = require('./reconcileHomeHouseholdResolution');
const validateHomeCoordinates = require('./validateHomeCoordinates');
const mailInterruptNotification = require('./mailInterruptNotification');
const communityModeration = require('./communityModeration');

const householdClaimJobsDryRun = householdClaimConfig.jobs.dryRun;

const QUEUE_OPTIONS = {
  policy: 'singleton',
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  expireInSeconds: 60 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
};

const JOBS = [
  { name: 'recompute-utility-scores',     cron: '10,25,40,55 * * * *', fn: recomputeUtilityScores },
  { name: 'organic-match',                cron: '*/2 * * * *',  fn: organicMatch },
  { name: 'refresh-discovery-cache',      cron: '*/2 * * * *',  fn: refreshDiscoveryCache },
  { name: 'expire-pending-payment-bids',  cron: '*/2 * * * *',  fn: expirePendingPaymentBids },
  { name: 'compute-reputation',           cron: '7,37 * * * *', fn: computeReputation },
  { name: 'earn-risk-review',             cron: '*/15 * * * *', fn: earnRiskReview },
  { name: 'process-claim-windows',        cron: '7,17,27,37,47,57 * * * *', fn: processClaimWindows },
  { name: 'reconcile-household',          cron: '14,44 * * * *',fn: () => reconcileHomeHouseholdResolution({ dryRun: householdClaimJobsDryRun }) },
  { name: 'validate-home-coordinates',    cron: '12,42 * * * *',fn: validateHomeCoordinates },
  { name: 'mail-interrupt-notification',  cron: '*/5 * * * *',  fn: mailInterruptNotification },
  { name: 'community-moderation',         cron: '*/30 * * * *', fn: communityModeration },
];

async function registerPgBossJobs(boss) {
  for (const job of JOBS) {
    await boss.createQueue(job.name, QUEUE_OPTIONS);

    // Schedule recurring job
    await boss.schedule(job.name, job.cron, null, {
      tz: 'UTC',
      singletonKey: job.name,
    });

    // Register worker
    await boss.work(job.name, { pollingIntervalSeconds: 5 }, async ([pgJob]) => {
      const start = Date.now();
      logger.info(`[pg-boss] Starting: ${job.name}`, { jobId: pgJob.id });
      try {
        await job.fn();
        const elapsed = Date.now() - start;
        logger.info(`[pg-boss] Completed: ${job.name}`, { elapsed_ms: elapsed, jobId: pgJob.id });
      } catch (err) {
        const elapsed = Date.now() - start;
        logger.error(`[pg-boss] Failed: ${job.name}`, {
          error: err.message,
          stack: err.stack,
          elapsed_ms: elapsed,
          jobId: pgJob.id,
        });
        throw err; // pg-boss handles retry
      }
    });

    logger.info(`[pg-boss] Registered job: ${job.name} (${job.cron})`);
  }
}

module.exports = { registerPgBossJobs };
