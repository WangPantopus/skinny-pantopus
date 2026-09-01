// ============================================================
// MONTHLY RECEIPT JOB
// Runs on the 1st of each month at 9:00 AM PT (17:00 UTC).
// Computes a personalized monthly summary for every active user,
// stores it, and sends in-app notification + push + email.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { computeMonthlyReceipt } = require('../services/monthlyReceiptService');
const { createNotification } = require('../services/notificationService');
const { sendMonthlyReceipt } = require('../services/emailService');

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the previous month's year and month (1-based).
 * getUTCMonth() is 0-based, so its value already equals the 1-based previous month.
 * e.g. on March 1st: getUTCMonth()=2 → previous month is February → 2 in 1-based.
 */
function getPreviousMonth() {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth(); // 0-based current = 1-based previous
  if (month === 0) {
    // January → previous is December of last year
    month = 12;
    year -= 1;
  }
  return { year, month };
}

/**
 * Fetch active users (logged in within the last 60 days) in batches.
 * Uses cursor-based pagination on id to avoid offset performance issues.
 */
async function fetchActiveUserBatch(cutoffDate, afterId, limit) {
  let query = supabaseAdmin
    .from('User')
    .select('id, email')
    .gte('updated_at', cutoffDate)
    .order('id', { ascending: true })
    .limit(limit);

  if (afterId) {
    query = query.gt('id', afterId);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('Failed to fetch active users batch', { error: error.message });
    return [];
  }
  return data || [];
}

/**
 * Process a single user's monthly receipt.
 */
async function processUser(user, year, month) {
  const userId = user.id;

  try {
    // Compute receipt
    const receipt = await computeMonthlyReceipt(userId, year, month);

    // Store in MonthlyReceipt table
    const { data: stored, error: storeErr } = await supabaseAdmin
      .from('MonthlyReceipt')
      .upsert({
        user_id: userId,
        year,
        month,
        receipt,
      }, { onConflict: 'user_id,year,month' })
      .select('id')
      .single();

    if (storeErr) {
      logger.warn('Failed to store monthly receipt', { error: storeErr.message, userId, year, month });
    }

    const receiptId = stored?.id || null;
    const monthLabel = MONTH_LABELS[month - 1];

    // In-app notification (also handles push via notificationService internals)
    await createNotification({
      userId,
      type: 'monthly_receipt',
      title: `Your ${monthLabel} summary is ready`,
      body: receipt.highlight,
      icon: '📊',
      link: '/profile?tab=receipt',
      metadata: { year, month, receipt_id: receiptId },
    });

    // Email (check preference)
    if (user.email) {
      try {
        const { data: prefs } = await supabaseAdmin
          .from('MailPreferences')
          .select('email_receipts')
          .eq('user_id', userId)
          .maybeSingle();

        // Default to true if no preference row or column is null
        const emailEnabled = prefs?.email_receipts !== false;

        if (emailEnabled) {
          await sendMonthlyReceipt(user.email, receipt);

          // Mark emailed_at
          if (receiptId) {
            await supabaseAdmin
              .from('MonthlyReceipt')
              .update({ emailed_at: new Date().toISOString() })
              .eq('id', receiptId);
          }
        }
      } catch (emailErr) {
        logger.warn('Monthly receipt email failed (non-blocking)', { error: emailErr.message, userId });
      }
    }
  } catch (err) {
    logger.error('Monthly receipt processing failed for user', { error: err.message, userId, year, month });
  }
}

/**
 * Main job function.
 */
async function monthlyReceiptJob() {
  const { year, month } = getPreviousMonth();
  const monthLabel = MONTH_LABELS[month - 1];
  logger.info(`[monthlyReceiptJob] Starting for ${monthLabel} ${year}`);

  const cutoffDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  let processed = 0;
  let afterId = null;

  while (true) {
    const batch = await fetchActiveUserBatch(cutoffDate, afterId, BATCH_SIZE);
    if (batch.length === 0) break;

    await Promise.all(batch.map((user) => processUser(user, year, month)));

    processed += batch.length;
    afterId = batch[batch.length - 1].id;

    logger.info(`[monthlyReceiptJob] Processed ${processed} users so far`);

    if (batch.length < BATCH_SIZE) break;
    await sleep(BATCH_DELAY_MS);
  }

  logger.info(`[monthlyReceiptJob] Completed for ${monthLabel} ${year}`, { total_users: processed });
}

module.exports = monthlyReceiptJob;
