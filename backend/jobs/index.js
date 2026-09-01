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
//   - mailDayNotification        → daily at 8:00 AM
//   - mailInterruptNotification  → every 5 minutes
//   - mailPartyExpiry            → every minute (Phase 2)
//   - earnRiskReview             → every 15 minutes (Phase 2)
//   - vaultWeeklyDigest          → Mondays at 9:00 AM (Phase 2)
//   - recomputeUtilityScores     → every 15 minutes (Social Layer)
//   - billBenchmarkRefresh       → every 6 hours at :05 (Home Intelligence)
//   - monthlyReceiptJob          → 1st of month at 9:00 AM PT (17:00 UTC)
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
// Monthly receipt
const monthlyReceiptJob = require('./monthlyReceiptJob');
// Neighborhood density
const neighborhoodPreviewRefresh = require('./neighborhoodPreviewRefresh');
// Assignment coordination jobs
const autoRemindWorker = require('./autoRemindWorker');
// Payment bid expiry
const expirePendingPaymentBids = require('./expirePendingPaymentBids');
// Support Train reminders
const { runSupportTrainReminders } = require('./supportTrainReminders');
const { runBookingReminders } = require('./bookingReminders');
// Payment health alerting
const { checkAndAlertStuckPayments } = require('../routes/paymentOps');

/**
 * Wraps a job function with error handling and timing.
 * Prevents one job crash from killing the whole process.
 */
function wrapJob(name, fn) {
  return async () => {
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
}

/**
 * Start all scheduled jobs.
 * Call this once after the server is listening.
 */
function startJobs() {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test') {
    logger.info('[CRON] Skipping job startup in test environment');
    return;
  }

  logger.info('[CRON] Initializing background jobs...');

  const householdClaimJobsDryRun = householdClaimConfig.jobs.dryRun;

  // ─── Authorize Upcoming Gigs ───
  // Runs at minute 5 of every hour (e.g. 1:05, 2:05, ...)
  // For gigs starting within 24h with saved cards, creates off-session
  // PaymentIntents. Also auto-cancels gigs with failed auth within 2h of start.
  cron.schedule('5 * * * *', wrapJob('authorizeUpcomingGigs', authorizeUpcomingGigs), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Process Pending Transfers (Escrow Release) ───
  // Runs at minute 15 of every hour (e.g. 1:15, 2:15, ...)
  // For captured payments past the 48h cooling-off period,
  // transfers funds to provider's Stripe Connect account.
  cron.schedule('15 * * * *', wrapJob('processPendingTransfers', processPendingTransfers), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Retry Capture Failures ───
  // Runs every 15 minutes at :20/:35/:50/:05.
  // Retries payment capture for gigs where owner confirmed completion
  // but capture failed. Stops after 3 attempts and notifies payer.
  cron.schedule('5,20,35,50 * * * *', wrapJob('retryCaptureFailures', retryCaptureFailures), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Uncaptured Authorizations ───
  // Runs daily at 3:00 AM UTC.
  // Cancels gigs whose payment auth is expiring soon (within 24h)
  // if work hasn't started. Alerts admins for in-progress gigs
  // with expiring auths (needs manual re-authorization).
  cron.schedule('0 3 * * *', wrapJob('expireUncapturedAuthorizations', expireUncapturedAuthorizations), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Auto-Archive Expired Posts ───
  // Runs daily at 4:00 AM UTC.
  // Archives local posts (Nearby, Neighborhood, etc.) based on
  // category TTL rules: stories=24h, events=24h after end, deals=3d, etc.
  cron.schedule('0 4 * * *', wrapJob('autoArchivePosts', autoArchivePosts), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Mail Day Notification ───
  // Runs daily at 8:00 AM UTC (default; per-user time checked inside job).
  // Builds a summary of each user's mailbox and logs a mail_day_notification
  // event. Phase 2 will wire to actual push notifications.
  cron.schedule('0 8 * * *', wrapJob('mailDayNotification', mailDayNotification), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Mail Interrupt Notification ───
  // Runs every 5 minutes.
  // Detects time-critical events (package out-for-delivery, urgent/overdue
  // items, certified mail) and logs interrupt events for real-time push.
  cron.schedule('*/5 * * * *', wrapJob('mailInterruptNotification', mailInterruptNotification), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Mail Party Expiry (Phase 2) ───
  // Runs every minute.
  // Expires pending party invitations older than 90 seconds and
  // notifies the host that nobody joined.
  cron.schedule('* * * * *', wrapJob('mailPartyExpiry', mailPartyExpiry), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Earn Risk Review (Phase 2) ───
  // Runs every 15 minutes.
  // Reviews risk sessions, calculates rolling scores, transitions
  // users through risk tiers, auto-lifts expired suspensions.
  cron.schedule('*/15 * * * *', wrapJob('earnRiskReview', earnRiskReview), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Vault Weekly Digest (Phase 2) ───
  // Runs every Monday at 9:00 AM UTC.
  // Summarizes vault activity: auto-filed items, unfiled items needing
  // attention, and storage stats per drawer.
  cron.schedule('0 9 * * 1', wrapJob('vaultWeeklyDigest', vaultWeeklyDigest), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Vacation Hold Expiry (Phase 3) ───
  // Runs hourly at :25.
  // Expires completed vacation holds and activates scheduled ones.
  cron.schedule('25 * * * *', wrapJob('vacationHoldExpiry', vacationHoldExpiry), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Stamp Awarder (Phase 3) ───
  // Runs every 6 hours at :35.
  // Checks user milestones and awards stamps.
  cron.schedule('35 */6 * * *', wrapJob('stampAwarder', stampAwarder), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Community Moderation (Phase 3) ───
  // Runs every 30 minutes.
  // Flags community items with multiple "concerned" reactions.
  cron.schedule('*/30 * * * *', wrapJob('communityModeration', communityModeration), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Compute Avg Response Time (Discovery) ───
  // Runs daily at 5:00 AM UTC.
  // For each business, computes the average time between a customer's
  // first message and the business's first reply. Stores on BusinessProfile.
  cron.schedule('0 5 * * *', wrapJob('computeAvgResponseTime', computeAvgResponseTime), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Organic Match (Discovery Phase 6) ───
  // Runs every 2 minutes.
  // Matches local businesses to community posts with service_category set.
  // Uses proximity, neighbor work history, and rating. Never paid.
  cron.schedule('*/2 * * * *', wrapJob('organicMatch', organicMatch), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Trust Anomaly Detection (Phase 8) ───
  // Runs every 6 hours at :45.
  // Flags providers with suspicious neighbor_count growth from
  // recently-created homes. Routes to manual review queue.
  cron.schedule('45 */6 * * *', wrapJob('trustAnomalyDetection', trustAnomalyDetection), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Recompute Utility Scores (Social Layer) ───
  // Runs every 15 minutes at :10.
  // Recomputes utility_score on recent posts so feed ranking
  // reflects up-to-date engagement signals.
  cron.schedule('10,25,40,55 * * * *', wrapJob('recomputeUtilityScores', recomputeUtilityScores), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Listings (Marketplace) ───
  // Runs every 15 minutes at :03/:18/:33/:48.
  // Archives active listings whose expires_at has passed and
  // decrements inventory slot counts for address-attached ones.
  cron.schedule('3,18,33,48 * * * *', wrapJob('expireListings', expireListings), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Listing Offers (Marketplace) ───
  // Runs every 15 minutes at :01/:16/:31/:46.
  // Expires pending listing offers whose 48-hour window has passed,
  // decrements active_offer_count, and notifies buyers.
  cron.schedule('1,16,31,46 * * * *', wrapJob('expireOffers', expireOffers), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Compute Reputation Scores (Marketplace) ───
  // Runs every 30 minutes at :07/:37.
  // Recomputes reputation for users with recent reviews
  // or completed transactions.
  cron.schedule('7,37 * * * *', wrapJob('computeReputation', computeReputation), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Refresh Discovery Cache (Marketplace) ───
  // Runs every 2 minutes.
  // Refreshes geohash-based discovery cache for recently active areas.
  cron.schedule('*/2 * * * *', wrapJob('refreshDiscoveryCache', refreshDiscoveryCache), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Past-Deadline Gigs ───
  // Runs every 15 minutes at :08/:23/:38/:53.
  // Cancels open gigs whose deadline has passed so they
  // no longer appear in browse or map results.
  cron.schedule('8,23,38,53 * * * *', wrapJob('expireGigs', expireGigs), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Process Claim Windows (Home Ownership) ───
  // Runs every 10 minutes at :07/:17/:27/:37/:47/:57.
  // Promotes provisional occupancies whose challenge window has expired
  // to fully verified status.
  cron.schedule('7,17,27,37,47,57 * * * *', wrapJob('processClaimWindows', processClaimWindows), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Validate Home Coordinates (BUG 6B) ───
  // Runs every 30 minutes at :12/:42.
  // Reverse-geocodes recently created homes via Mapbox
  // and flags coordinate-address mismatches.
  cron.schedule('12,42 * * * *', wrapJob('validateHomeCoordinates', validateHomeCoordinates), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Notify Claim Window Expiry (BUG 5B) ───
  // Runs every 2 hours at :20.
  // Sends 48-hour warning notifications to home occupants
  // before the ownership claim window closes.
  cron.schedule('20 */2 * * *', wrapJob('notifyClaimWindowExpiry', notifyClaimWindowExpiry), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Initiated Home Claims (Household Claim Phase 3) ───
  // Runs hourly at :11.
  // Expires initiated ownership claims whose evidence deadline passed.
  cron.schedule('11 * * * *', wrapJob(
    'expireInitiatedHomeClaims',
    () => expireInitiatedHomeClaims({ dryRun: householdClaimJobsDryRun }),
  ), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Reconcile Home Household Resolution (Household Claim Phase 3) ───
  // Runs every 30 minutes at :14/:44.
  // Recomputes household resolution for homes with ownership-claim activity.
  cron.schedule('14,44 * * * *', wrapJob(
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
  cron.schedule('30 * * * *', wrapJob('chatRedactionJob', chatRedactionJob), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Cleanup Ghost Businesses ───
  // Runs daily at 2:30 AM UTC.
  // Removes orphaned business accounts created by the old wizard flow
  // that were never completed (no locations, no catalog, low completeness).
  cron.schedule('30 2 * * *', wrapJob('cleanupGhostBusinesses', cleanupGhostBusinesses), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Pop-Up Businesses ───
  // Runs hourly at :45.
  // Unpublishes pop_up_temporary businesses whose active_until has passed.
  cron.schedule('45 * * * *', wrapJob('expirePopupBusinesses', expirePopupBusinesses), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Draft Business Reminders ───
  // Runs daily at 10:00 AM UTC.
  // Sends in-app and email reminders for draft businesses < 7 days old.
  // Max 3 reminders per business.
  cron.schedule('0 10 * * *', wrapJob('draftBusinessReminder', draftBusinessReminder), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Mail Escrow Expiry (Phase 7) ───
  // Runs daily at 6:00 AM UTC.
  // Expires pending escrowed mail past its expiry date and
  // notifies senders that their letter wasn't picked up.
  cron.schedule('0 6 * * *', wrapJob('mailEscrowExpiry', mailEscrowExpiry), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Bill Benchmark Refresh (Home Intelligence) ───
  // Runs every 6 hours at :05.
  // Pre-computes anonymous neighborhood bill averages from paid HomeBill
  // records. Groups by geohash-6, bill_type, month/year. Privacy: min 3 households.
  cron.schedule('5 */6 * * *', wrapJob('billBenchmarkRefresh', billBenchmarkRefresh), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Monthly Receipt ───
  // Runs on the 1st of each month at 9:00 AM PT (17:00 UTC).
  // Computes personalized monthly summaries for active users,
  // stores receipts, sends notification + push + email.
  cron.schedule('0 17 1 * *', wrapJob('monthlyReceiptJob', monthlyReceiptJob), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Neighborhood Preview Refresh (Density) ───
  // Runs every 15 minutes at :02/:17/:32/:47.
  // Counts verified users per geohash-6 cell, upserts NeighborhoodPreview,
  // and sends milestone notifications (10/25/50/100/200/500).
  cron.schedule('2,17,32,47 * * * *', wrapJob('neighborhoodPreviewRefresh', neighborhoodPreviewRefresh), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Payment Health Alerts ───
  // Runs every 15 minutes at :12/:27/:42/:57.
  // Checks for stuck payments and sends Slack/PagerDuty alerts.
  cron.schedule('12,27,42,57 * * * *', wrapJob('checkAndAlertStuckPayments', checkAndAlertStuckPayments), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Expire Stale pending_payment Bids ───
  // Runs every 2 minutes.
  // Reverts bids stuck in pending_payment past their 10-minute expiry.
  cron.schedule('*/2 * * * *', wrapJob('expirePendingPaymentBids', expirePendingPaymentBids), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Auto-Remind Assigned Workers ───
  // Runs every 5 minutes at :02/:07/:12/...
  // Sends automatic start-work reminders to workers approaching their
  // scheduled start time. Caps at 2 auto-reminders per assignment.
  cron.schedule('2,7,12,17,22,27,32,37,42,47,52,57 * * * *', wrapJob('autoRemindWorker', autoRemindWorker), {
    scheduled: true,
    timezone: 'UTC',
  });

  // ─── Support Train Reminders ───
  // Runs every 30 minutes at :09/:39.
  // Sends 24h and day-of reminders to helpers, nudges organizers
  // about unfilled slots within the next 7 days.
  cron.schedule('9,39 * * * *', wrapJob('supportTrainReminders', runSupportTrainReminders), {
    scheduled: true,
    timezone: 'UTC',
  });

  // Calendarly booking reminders — every 15 minutes at :03/:18/:33/:48 (T-24h + T-1h).
  cron.schedule('3,18,33,48 * * * *', wrapJob('bookingReminders', runBookingReminders), {
    scheduled: true,
    timezone: 'UTC',
  });

  logger.info('[CRON] Background jobs initialized', {
    jobs: [
      { name: 'authorizeUpcomingGigs', schedule: 'hourly at :05' },
      { name: 'processPendingTransfers', schedule: 'hourly at :15' },
      { name: 'retryCaptureFailures', schedule: 'every 15 minutes at :05/:20/:35/:50' },
      { name: 'expireUncapturedAuthorizations', schedule: 'daily at 3:00 AM UTC' },
      { name: 'autoArchivePosts', schedule: 'daily at 4:00 AM UTC' },
      { name: 'mailDayNotification', schedule: 'daily at 8:00 AM UTC' },
      { name: 'mailInterruptNotification', schedule: 'every 5 minutes' },
      { name: 'mailPartyExpiry', schedule: 'every minute' },
      { name: 'earnRiskReview', schedule: 'every 15 minutes' },
      { name: 'vaultWeeklyDigest', schedule: 'Mondays at 9:00 AM UTC' },
      { name: 'vacationHoldExpiry', schedule: 'hourly at :25' },
      { name: 'stampAwarder', schedule: 'every 6 hours at :35' },
      { name: 'communityModeration', schedule: 'every 30 minutes' },
      { name: 'computeAvgResponseTime', schedule: 'daily at 5:00 AM UTC' },
      { name: 'organicMatch', schedule: 'every 2 minutes' },
      { name: 'trustAnomalyDetection', schedule: 'every 6 hours at :45' },
      { name: 'recomputeUtilityScores', schedule: 'every 15 minutes at :10/:25/:40/:55' },
      { name: 'expireListings', schedule: 'every 15 minutes at :03/:18/:33/:48' },
      { name: 'expireOffers', schedule: 'every 15 minutes at :01/:16/:31/:46' },
      { name: 'computeReputation', schedule: 'every 30 minutes at :07/:37' },
      { name: 'refreshDiscoveryCache', schedule: 'every 2 minutes' },
      { name: 'expireGigs', schedule: 'every 15 minutes at :08/:23/:38/:53' },
      { name: 'processClaimWindows', schedule: 'every 10 minutes at :07/:17/:27/:37/:47/:57' },
      { name: 'validateHomeCoordinates', schedule: 'every 30 minutes at :12/:42' },
      { name: 'notifyClaimWindowExpiry', schedule: 'every 2 hours at :20' },
      { name: 'expireInitiatedHomeClaims', schedule: 'hourly at :11' },
      { name: 'reconcileHomeHouseholdResolution', schedule: 'every 30 minutes at :14/:44' },
      { name: 'chatRedactionJob', schedule: 'hourly at :30' },
      { name: 'cleanupGhostBusinesses', schedule: 'daily at 2:30 AM UTC' },
      { name: 'expirePopupBusinesses', schedule: 'hourly at :45' },
      { name: 'draftBusinessReminder', schedule: 'daily at 10:00 AM UTC' },
      { name: 'mailEscrowExpiry', schedule: 'daily at 6:00 AM UTC' },
      { name: 'billBenchmarkRefresh', schedule: 'every 6 hours at :05' },
      { name: 'monthlyReceiptJob', schedule: '1st of month at 9:00 AM PT (17:00 UTC)' },
      { name: 'neighborhoodPreviewRefresh', schedule: 'every 15 minutes at :02/:17/:32/:47' },
      { name: 'checkAndAlertStuckPayments', schedule: 'every 15 minutes at :12/:27/:42/:57' },
      { name: 'autoRemindWorker', schedule: 'every 5 minutes at :02/:07/:12/...' },
      { name: 'expirePendingPaymentBids', schedule: 'every 2 minutes' },
      { name: 'supportTrainReminders', schedule: 'every 30 minutes at :09/:39' },
      { name: 'bookingReminders', schedule: 'every 15 minutes at :03/:18/:33/:48' },
    ],
  });
}

module.exports = { startJobs };
