// ============================================================
// EARNINGS SERVICE — Single source of truth for user earnings
// Used by: GET /api/payments/earnings, GET /api/users/:id/stats, Hub
// So web, mobile, and hub always show the same number.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const INCLUDABLE_STATUSES = [
  'captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred',
  'refund_pending', 'refunded_partial', 'refunded_full', 'disputed',
  'succeeded', 'processing',
];
const INCLUDABLE_STATUS_SET = new Set(INCLUDABLE_STATUSES);
const PAID_STATUS_SET = new Set(['transferred', 'succeeded']);

function toIsoOrNull(dateValue) {
  if (!dateValue) return null;
  const dt = new Date(String(dateValue));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function normalizeEarnings(raw) {
  const totalPayments = Number(raw?.totalPayments ?? raw?.total_payments ?? 0) || 0;
  const totalEarned = Number(raw?.totalEarned ?? raw?.total_earned ?? 0) || 0;
  const totalPaid = Number(raw?.totalPaid ?? raw?.total_paid ?? 0) || 0;
  const totalEscrowed = Number(raw?.totalEscrowed ?? raw?.total_escrowed ?? 0) || 0;
  const totalAvailable = Number(raw?.totalAvailable ?? raw?.total_available ?? 0) || 0;
  const currency = raw?.currency || 'USD';

  return {
    total_earned: totalEarned,
    total_earned_cents: totalEarned,
    totalEarned,
    total_payments: totalPayments,
    totalPayments,
    total_paid: totalPaid,
    totalPaid,
    total_escrowed: totalEscrowed,
    total_available: totalAvailable,
    currency,
  };
}

function aggregateEarningsRows(rows, startDate = null, endDate = null) {
  const startMs = startDate ? new Date(String(startDate)).getTime() : null;
  const endMs = endDate ? new Date(String(endDate)).getTime() : null;

  let totalPayments = 0;
  let totalEarned = 0;
  let totalPaid = 0;
  let totalEscrowed = 0;
  let totalAvailable = 0;

  for (const row of (rows || [])) {
    const createdAtMs = row?.created_at ? new Date(row.created_at).getTime() : null;
    if (startMs && createdAtMs && createdAtMs < startMs) continue;
    if (endMs && createdAtMs && createdAtMs > endMs) continue;

    const status = String(row?.payment_status || '');
    if (!INCLUDABLE_STATUS_SET.has(status)) continue;

    const amountToPayee = Number(row?.amount_to_payee || 0) || 0;
    const refunded = Number(row?.refunded_amount || 0) || 0;
    const net = Math.max(0, amountToPayee - refunded);
    totalPayments += 1;
    totalEarned += net;
    if (PAID_STATUS_SET.has(status)) totalPaid += net;

    const isEscrowed = row?.is_escrowed === true;
    const escrowReleased = Boolean(row?.escrow_released_at);
    if (isEscrowed && !escrowReleased) totalEscrowed += net;
    if (!isEscrowed || escrowReleased || PAID_STATUS_SET.has(status)) totalAvailable += net;
  }

  return normalizeEarnings({
    totalPayments,
    totalEarned,
    totalPaid,
    totalEscrowed,
    totalAvailable,
    currency: 'USD',
  });
}

/**
 * Compute earnings for a user.
 * Primary path: Postgres RPC get_user_earnings.
 * Fallback path: JS aggregation from Payment rows.
 *
 * @param {string} userId - payee user id
 * @param {string|null} [startDate] - optional ISO date string
 * @param {string|null} [endDate] - optional ISO date string
 * @returns {Promise<{ total_earned: number, total_earned_cents: number, total_payments: number, total_paid: number, total_escrowed: number, total_available: number }>}
 */
async function getEarningsForUser(userId, startDate = null, endDate = null) {
  const rpcParams = {
    p_user_id: userId,
    p_start_date: toIsoOrNull(startDate),
    p_end_date: toIsoOrNull(endDate),
  };

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_user_earnings', rpcParams);
  if (!rpcError && rpcData && typeof rpcData === 'object') {
    return normalizeEarnings(rpcData);
  }

  if (rpcError) {
    logger.warn('getEarningsForUser: RPC failed; falling back to JS aggregate', {
      userId,
      error: rpcError.message,
    });
  } else {
    logger.warn('getEarningsForUser: RPC returned empty payload; falling back to JS aggregate', {
      userId,
    });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('Payment')
    .select('amount_to_payee, refunded_amount, payment_status, is_escrowed, escrow_released_at, created_at')
    .eq('payee_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return aggregateEarningsRows(rows || [], startDate, endDate);
}

module.exports = { getEarningsForUser };
