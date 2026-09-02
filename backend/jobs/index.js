// ============================================================
// JOB RUNNER
// Initializes all scheduled background jobs using node-cron.
// Called from app.js after server.listen().
//
// Schedule overview:
//   - authorizeUpcomingGigs      → hourly at :05
//   - processPendingTransfers    → hourly at :15
//   - retryCaptureFailures        → every 15 minutes at :05/:20/:35/:50
//   - expireUncapturedAuths      → daily at 3:00 AM
//   - autoArchivePosts           → daily at 4:00 AM
//   - mailDayNotification        → every 15 minutes
//   - mailInterruptNotification  → every 5 minutes
//   - mailPartyExpiry            → every minute (Phase 2)
//   - earnRiskReview             → every 15 minutes (Phase 2)
//   - vaultWeeklyDigest          → Mondays at 9:00 AM (Phase 2)
//   - recomputeUtilityScores     → every 15 minutes (Social Layer)
//   - billBenchmarkRefresh       → every 6 hours at :05 (Home Intelligence)
//   - monthlyReceiptJob          → 1st of month at 9:00 AM PT (17:00 UTC)
//   - authRegistryPrune          → hourly at :50 (persistent login)
// ============================================================

const cron = require('node-cron');
const logger = require('../utils/logger');
const householdClaimConfig = require('../config/householdClaims');
const authorizeUpcomingGigs = require('./authorizeUpcomingGigs');
const processPendingTransfers = require('./processPendingTransfers');
const expireUncapturedAuthorizations = require('./expireUncapturedAuthorizations');
const autoArchivePosts = require('./autoArchivePosts');
const mailDayNotification = require('./mailDayNotification');
const mailInterruptNotification = require('./mailInterruptNotification');
// Phase 2 jobs
const mailPartyExpiry = require('./mailPartyExpiry');
const earnRiskReview = require('./earnRiskReview');
const vaultWeeklyDigest = require('./vaultWeeklyDigest');
// Phase 3 jobs
const vacationHoldExpiry = require('./vacationHoldExpiry');
const stampAwarder = require('./stampAwarder');
const communityModeration = require('./communityModeration');
// Discovery jobs
const computeAvgResponseTime = require('./computeAvgResponseTime');
const organicMatch = require('./organicMatch');
const trustAnomalyDetection = require('./trustAnomalyDetection');
// Social layer jobs
const recomputeUtilityScores = require('./recomputeUtilityScores');
// Marketplace jobs
const expireListings = require('./expireListings');
const expireOffers = require('./expireOffers');
const computeReputation = require('./computeReputation');
// Discovery cache jobs
const refreshDiscoveryCache = require('./refreshDiscoveryCache');
// Gig expiry jobs
const expireGigs = require('./expireGigs');
// Payment retry jobs
const retryCaptureFailures = require('./retryCaptureFailures');
// Home ownership jobs
const processClaimWindows = require('./processClaimWindows');
const validateHomeCoordinates = require('./validateHomeCoordinates');
const notifyClaimWindowExpiry = require('./notifyClaimWindowExpiry');
const expireInitiatedHomeClaims = require('./expireInitiatedHomeClaims');
const evidenceRetentionSweep = require('./evidenceRetentionSweep');
const expireAddressVerifications = require('./expireAddressVerifications');
const purgeAddressVerificationEvents = require('./purgeAddressVerificationEvents');
const reconcileHomeHouseholdResolution = require('./reconcileHomeHouseholdResolution');
// Chat jobs
const chatRedactionJob = require('./chatRedactionJob');
// Business cleanup
const cleanupGhostBusinesses = require('./cleanupGhostBusinesses');
// Pop-up business expiry
const expirePopupBusinesses = require('./expirePopupBusinesses');
// Draft business reminders
const draftBusinessReminder = require('./draftBusinessReminder');
// Mail escrow expiry
const mailEscrowExpiry = require('./mailEscrowExpiry');
// Home intelligence jobs
const billBenchmarkRefresh = require('./billBenchmarkRefresh');
const nfipTractWarm = require('./nfipTractWarm');
const rateWatchEvaluate = require('./rateWatchEvaluate');
// Monthly receipt
const monthlyReceiptJob = require('./monthlyReceiptJob');
// Neighborhood density
const neighborhoodPreviewRefresh = require('./neighborhoodPreviewRefresh');
// Assignment coordination jobs
const autoRemindWorker = require('./autoRemindWorker');
// Payment bid expiry
const expirePendingPaymentBids = require('./expirePendingPaymentBids');
// Persistent login registry housekeeping
const authRegistryPrune = require('./authRegistryPrune');
// Support Train reminders
const { runSupportTrainReminders } = require('./supportTrainReminders');
const { runBookingReminders } = require('./bookingReminders');
// Payment health alerting
const { checkAndAlertStuckPayments } = require('../routes/paymentOps');

const LAMBDA_BACKED_CRON_JOBS = new Set([
  'authorizeUpcomingGigs',
  'processPendingTransfers',
  'retryCaptureFailures',
  'expireUncapturedAuthorizations',
  'autoArchivePosts',
  'computeAvgResponseTime',
  'trustAnomalyDetection',
  'chatRedactionJob',
  'cleanupGhostBusinesses',
  'checkAndAlertStuckPayments',
]);

const PGBOSS_BACKED_CRON_JOBS = new Set([
  'recomputeUtilityScores',
  'organicMatch',
  'refreshDiscoveryCache',
  'expirePendingPaymentBids',
  'computeReputation',
  'earnRiskReview',
  'processClaimWindows',
  'reconcileHomeHouseholdResolution',
  'validateHomeCoordinates',
  'mailInterruptNotification',
  'communityModeration',
]);

function envFlagEnabled(name, defaultValue = true) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return defaultValue;
  return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

/**
 * Wraps a job function with error handling and timing.
 * Prevents one job crash from killing the whole process.
 */
function wrapJob(name, fn) {
  const wrapped = async () => {
    const start = Date.now();
    logger.info(`[CRON] Starting: ${name}`);
    try {
      await fn();
      const elapsed = Date.now() - start;
      logger.info(`[CRON] Completed: ${name}`, { elapsed_ms: elapsed });
    } catch (err) {
      const elapsed = Date.now() - start;
      logger.error(`[CRON] Failed: ${name}`, {
        error: err.message,
        stack: err.stack,
        elapsed_ms: elapsed,
      });
    }
  };
  wrapped.jobName = name;
  return wrapped;
}

/**
 * Start all scheduled jobs.
 * Call this once after the server is listening.
 */
function startJobs(options = {}) {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test') {
    logger.info('[CRON] Skipping job startup in test environment');
    return;
  }

  logger.info('[CRON] Initializing background jobs...');

  const householdClaimJobsDryRun = householdClaimConfig.jobs.dryRun;
  const skipPgBossBackedJobs = Boolean(options.skipPgBossBackedJobs);
  const lambdaBackedCronsEnabled = options.lambdaBackedCronsEnabled ?? envFlagEnabled('LAMBDA_BACKED_CRON_ENABLED', true);
  const scheduledJobs = [];
  const skippedJobs = [];

  const scheduleCron = (expression, task, cronOptions) => {
    const jobName = task.jobName || 'unknown';
    if (skipPgBossBackedJobs && PGBOSS_BACKED_CRON_JOBS.has(jobName)) {
      skippedJobs.push({ name: jobName, reason: 'pg-boss' });
      return null;
    }
    if (!lambdaBackedCronsEnabled && LAMBDA_BACKED_CRON_JOBS.has(jobName)) {
      skippedJobs.push({ name: jobName, reason: 'lambda' });
      return null;
    }
    scheduledJobs.push(jobName);
    return cron.schedule(expression, task, cronOptions);
  };

  // ─── Authorize Upcoming Gigs ───
  // Runs at minute 5 of every hour (e.g. 1:05, 2:05, ...)
  // For gigs starting within 24h with saved cards, creates off-session
  // PaymentIntents. Also auto-cancels gigs with failed auth within 2h of start.
  scheduleCron('5 * * * *', wrapJob('authorizeUpcomingGigs', authorizeUpcomingGigs), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Process Pending Transfers (Escrow Release) ───
  // Runs at minute 15 of every hour (e.g. 1:15, 2:15, ...)
  // For captured payments past the 48h cooling-off period,
  // transfers funds to provider's Stripe Connect account.
  scheduleCron('15 * * * *', wrapJob('processPendingTransfers', processPendingTransfers), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Retry Capture Failures ───
  // Runs every 15 minutes at :20/:35/:50/:05.
  // Retries payment capture for gigs where owner confirmed completion
  // but capture failed. Stops after 3 attempts and notifies payer.
  scheduleCron('5,20,35,50 * * * *', wrapJob('retryCaptureFailures', retryCaptureFailures), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Uncaptured Authorizations ───
  // Runs daily at 3:00 AM UTC.
  // Cancels gigs whose payment auth is expiring soon (within 24h)
  // if work hasn't started. Alerts admins for in-progress gigs
  // with expiring auths (needs manual re-authorization).
  scheduleCron('0 3 * * *', wrapJob('expireUncapturedAuthorizations', expireUncapturedAuthorizations), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Auto-Archive Expired Posts ───
  // Runs daily at 4:00 AM UTC.
  // Archives local posts (Nearby, Neighborhood, etc.) based on
  // category TTL rules: stories=24h, events=24h after end, deals=3d, etc.
  scheduleCron('0 4 * * *', wrapJob('autoArchivePosts', autoArchivePosts), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Mail Day Notification ───
  // Runs every 15 minutes — the send is triggered by mail actually being
  // scanned, not by the clock. Each run picks up users who have unreviewed
  // pieces today and are currently inside their own local daytime window;
  // MailDaySession.notified_at keeps that to exactly one push per user per
  // mail day. (It previously ran once at 08:00 UTC — 1am Pacific — which
  // is both the wrong hour and before most mail is scanned.)
  scheduleCron('*/15 * * * *', wrapJob('mailDayNotification', mailDayNotification), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Mail Interrupt Notification ───
  // Runs every 5 minutes.
  // Detects time-critical events (package out-for-delivery, urgent/overdue
  // items, certified mail) and logs interrupt events for real-time push.
  scheduleCron('*/5 * * * *', wrapJob('mailInterruptNotification', mailInterruptNotification), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Mail Party Expiry (Phase 2) ───
  // Runs every minute.
  // Expires pending party invitations older than 90 seconds and
  // notifies the host that nobody joined.
  scheduleCron('* * * * *', wrapJob('mailPartyExpiry', mailPartyExpiry), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Earn Risk Review (Phase 2) ───
  // Runs every 15 minutes.
  // Reviews risk sessions, calculates rolling scores, transitions
  // users through risk tiers, auto-lifts expired suspensions.
  scheduleCron('*/15 * * * *', wrapJob('earnRiskReview', earnRiskReview), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Vault Weekly Digest (Phase 2) ───
  // Runs every Monday at 9:00 AM UTC.
  // Summarizes vault activity: auto-filed items, unfiled items needing
  // attention, and storage stats per drawer.
  scheduleCron('0 9 * * 1', wrapJob('vaultWeeklyDigest', vaultWeeklyDigest), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Vacation Hold Expiry (Phase 3) ───
  // Runs hourly at :25.
  // Expires completed vacation holds and activates scheduled ones.
  scheduleCron('25 * * * *', wrapJob('vacationHoldExpiry', vacationHoldExpiry), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Stamp Awarder (Phase 3) ───
  // Runs every 6 hours at :35.
  // Checks user milestones and awards stamps.
  scheduleCron('35 */6 * * *', wrapJob('stampAwarder', stampAwarder), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Community Moderation (Phase 3) ───
  // Runs every 30 minutes.
  // Flags community items with multiple "concerned" reactions.
  scheduleCron('*/30 * * * *', wrapJob('communityModeration', communityModeration), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Compute Avg Response Time (Discovery) ───
  // Runs daily at 5:00 AM UTC.
  // For each business, computes the average time between a customer's
  // first message and the business's first reply. Stores on BusinessProfile.
  scheduleCron('0 5 * * *', wrapJob('computeAvgResponseTime', computeAvgResponseTime), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Organic Match (Discovery Phase 6) ───
  // Runs every 2 minutes.
  // Matches local businesses to community posts with service_category set.
  // Uses proximity, neighbor work history, and rating. Never paid.
  scheduleCron('*/2 * * * *', wrapJob('organicMatch', organicMatch), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Trust Anomaly Detection (Phase 8) ───
  // Runs every 6 hours at :45.
  // Flags providers with suspicious neighbor_count growth from
  // recently-created homes. Routes to manual review queue.
  scheduleCron('45 */6 * * *', wrapJob('trustAnomalyDetection', trustAnomalyDetection), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Recompute Utility Scores (Social Layer) ───
  // Runs every 15 minutes at :10.
  // Recomputes utility_score on recent posts so feed ranking
  // reflects up-to-date engagement signals.
  scheduleCron('10,25,40,55 * * * *', wrapJob('recomputeUtilityScores', recomputeUtilityScores), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Listings (Marketplace) ───
  // Runs every 15 minutes at :03/:18/:33/:48.
  // Archives active listings whose expires_at has passed and
  // decrements inventory slot counts for address-attached ones.
  scheduleCron('3,18,33,48 * * * *', wrapJob('expireListings', expireListings), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Listing Offers (Marketplace) ───
  // Runs every 15 minutes at :01/:16/:31/:46.
  // Expires pending listing offers whose 48-hour window has passed,
  // decrements active_offer_count, and notifies buyers.
  scheduleCron('1,16,31,46 * * * *', wrapJob('expireOffers', expireOffers), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Compute Reputation Scores (Marketplace) ───
  // Runs every 30 minutes at :07/:37.
  // Recomputes reputation for users with recent reviews
  // or completed transactions.
  scheduleCron('7,37 * * * *', wrapJob('computeReputation', computeReputation), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Refresh Discovery Cache (Marketplace) ───
  // Runs every 2 minutes.
  // Refreshes geohash-based discovery cache for recently active areas.
  scheduleCron('*/2 * * * *', wrapJob('refreshDiscoveryCache', refreshDiscoveryCache), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Past-Deadline Gigs ───
  // Runs every 15 minutes at :08/:23/:38/:53.
  // Cancels open gigs whose deadline has passed so they
  // no longer appear in browse or map results.
  scheduleCron('8,23,38,53 * * * *', wrapJob('expireGigs', expireGigs), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Process Claim Windows (Home Ownership) ───
  // Runs every 10 minutes at :07/:17/:27/:37/:47/:57.
  // Promotes provisional occupancies whose challenge window has expired
  // to fully verified status.
  scheduleCron('7,17,27,37,47,57 * * * *', wrapJob('processClaimWindows', processClaimWindows), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Validate Home Coordinates (BUG 6B) ───
  // Runs every 30 minutes at :12/:42.
  // Reverse-geocodes recently created homes via Mapbox
  // and flags coordinate-address mismatches.
  scheduleCron('12,42 * * * *', wrapJob('validateHomeCoordinates', validateHomeCoordinates), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Notify Claim Window Expiry (BUG 5B) ───
  // Runs every 2 hours at :20.
  // Sends 48-hour warning notifications to home occupants
  // before the ownership claim window closes.
  scheduleCron('20 */2 * * *', wrapJob('notifyClaimWindowExpiry', notifyClaimWindowExpiry), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Initiated Home Claims (Household Claim Phase 3) ───
  // Runs hourly at :11.
  // Expires initiated ownership claims whose evidence deadline passed.
  scheduleCron('11 * * * *', wrapJob(
    'expireInitiatedHomeClaims',
    () => expireInitiatedHomeClaims({ dryRun: householdClaimJobsDryRun }),
  ), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Evidence Retention Sweep (Wedge privacy promise) ───
  // Runs daily at 04:17 UTC.
  // Deletes any stored verification document whose claim is decided
  // but whose purge failed or never ran (services/evidencePurge is the
  // in-line path; this is the net under it).
  scheduleCron('17 4 * * *', wrapJob(
    'evidenceRetentionSweep',
    () => evidenceRetentionSweep({ dryRun: householdClaimJobsDryRun }),
  ), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Purge Address Verification Events ───
  // Runs daily at 03:41 UTC.
  // Retention for verification telemetry. The table previously grew without
  // bound and no job touched it.
  scheduleCron('41 3 * * *', wrapJob(
    'purgeAddressVerificationEvents',
    () => purgeAddressVerificationEvents(),
  ), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Address Verifications ───
  // Runs hourly at :26.
  // Sweeps mail-verification attempts and postcard codes past their expiry.
  // Before this existed, no job touched any mail table: an attempt sat at
  // 'sent' forever, holding a slot in the per-address budget.
  scheduleCron('26 * * * *', wrapJob(
    'expireAddressVerifications',
    () => expireAddressVerifications(),
  ), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Reconcile Home Household Resolution (Household Claim Phase 3) ───
  // Runs every 30 minutes at :14/:44.
  // Recomputes household resolution for homes with ownership-claim activity.
  scheduleCron('14,44 * * * *', wrapJob(
    'reconcileHomeHouseholdResolution',
    () => reconcileHomeHouseholdResolution({ dryRun: householdClaimJobsDryRun }),
  ), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Chat Redaction ───
  // Runs hourly at :30.
  // Permanently redacts soft-deleted messages past their retention period.
  // Replaces message text and clears attachments in batches.
  scheduleCron('30 * * * *', wrapJob('chatRedactionJob', chatRedactionJob), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Auth registry prune (persistent login) ───
  // Runs hourly at :50. Drops expired DPoP jtis and challenges.
  scheduleCron('50 * * * *', wrapJob('authRegistryPrune', authRegistryPrune), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Cleanup Ghost Businesses ───
  // Runs daily at 2:30 AM UTC.
  // Removes orphaned business accounts created by the old wizard flow
  // that were never completed (no locations, no catalog, low completeness).
  scheduleCron('30 2 * * *', wrapJob('cleanupGhostBusinesses', cleanupGhostBusinesses), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Pop-Up Businesses ───
  // Runs hourly at :45.
  // Unpublishes pop_up_temporary businesses whose active_until has passed.
  scheduleCron('45 * * * *', wrapJob('expirePopupBusinesses', expirePopupBusinesses), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Draft Business Reminders ───
  // Runs daily at 10:00 AM UTC.
  // Sends in-app and email reminders for draft businesses < 7 days old.
  // Max 3 reminders per business.
  scheduleCron('0 10 * * *', wrapJob('draftBusinessReminder', draftBusinessReminder), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Mail Escrow Expiry (Phase 7) ───
  // Runs daily at 6:00 AM UTC.
  // Expires pending escrowed mail past its expiry date and
  // notifies senders that their letter wasn't picked up.
  scheduleCron('0 6 * * *', wrapJob('mailEscrowExpiry', mailEscrowExpiry), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Bill Benchmark Refresh (Home Intelligence) ───
  // Runs every 6 hours at :05.
  // Pre-computes anonymous neighborhood bill averages from paid HomeBill
  // records. Groups by geohash-6, bill_type, month/year. Privacy: min 3 households.
  scheduleCron('5 */6 * * *', wrapJob('billBenchmarkRefresh', billBenchmarkRefresh), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── NFIP Tract Warm (Home Intelligence) ───
  // Runs every 15 minutes at :08/:23/:38/:53.
  // Fetches OpenFEMA NFIP premium benchmarks for tracts the flood
  // composer marked pending (the API is too slow for the request path).
  // Up to 3 tracts per run; results cache 90 days.
  scheduleCron('8,23,38,53 * * * *', wrapJob('nfipTractWarm', nfipTractWarm), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Rate Watch Evaluate (Home Record Watch) ───
  // Runs Fridays at 02:00 UTC — the PMMS survey publishes Thursdays,
  // so one weekly evaluation sees each fresh reading. Alerts are
  // idempotent via claim-before-send on the watch row.
  scheduleCron('0 2 * * 5', wrapJob('rateWatchEvaluate', rateWatchEvaluate), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Monthly Receipt ───
  // Runs on the 1st of each month at 9:00 AM PT (17:00 UTC).
  // Computes personalized monthly summaries for active users,
  // stores receipts, sends notification + push + email.
  scheduleCron('0 17 1 * *', wrapJob('monthlyReceiptJob', monthlyReceiptJob), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Neighborhood Preview Refresh (Density) ───
  // Runs every 15 minutes at :02/:17/:32/:47.
  // Counts verified users per geohash-6 cell, upserts NeighborhoodPreview,
  // and sends milestone notifications (10/25/50/100/200/500).
  scheduleCron('2,17,32,47 * * * *', wrapJob('neighborhoodPreviewRefresh', neighborhoodPreviewRefresh), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Payment Health Alerts ───
  // Runs every 15 minutes at :12/:27/:42/:57.
  // Checks for stuck payments and sends Slack/PagerDuty alerts.
  scheduleCron('12,27,42,57 * * * *', wrapJob('checkAndAlertStuckPayments', checkAndAlertStuckPayments), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Stale pending_payment Bids ───
  // Runs every 2 minutes.
  // Reverts bids stuck in pending_payment past their 10-minute expiry.
  scheduleCron('*/2 * * * *', wrapJob('expirePendingPaymentBids', expirePendingPaymentBids), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Auto-Remind Assigned Workers ───
  // Runs every 5 minutes at :02/:07/:12/...
  // Sends automatic start-work reminders to workers approaching their
  // scheduled start time. Caps at 2 auto-reminders per assignment.
  scheduleCron('2,7,12,17,22,27,32,37,42,47,52,57 * * * *', wrapJob('autoRemindWorker', autoRemindWorker), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Support Train Reminders ───
  // Runs every 30 minutes at :09/:39.
  // Sends 24h and day-of reminders to helpers, nudges organizers
  // about unfilled slots within the next 7 days.
  scheduleCron('9,39 * * * *', wrapJob('supportTrainReminders', runSupportTrainReminders), {
    scheduled: true,
    timezone: 'UTC',
  });

  // Calendarly booking reminders — every 15 minutes at :03/:18/:33/:48 (T-24h + T-1h).
  scheduleCron('3,18,33,48 * * * *', wrapJob('bookingReminders', runBookingReminders), {
    scheduled: true,
    timezone: 'UTC',
  });

  logger.info('[CRON] Background jobs initialized', {
    scheduled_count: scheduledJobs.length,
    skipped_count: skippedJobs.length,
    scheduled_jobs: scheduledJobs,
    skipped_jobs: skippedJobs,
  });
}

module.exports = { startJobs };
