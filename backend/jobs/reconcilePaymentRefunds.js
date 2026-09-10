const db = require('../config/supabaseAdmin');
const refunds = require('../services/paymentRefundService');
const logger = require('../utils/logger');
module.exports = async function reconcilePaymentRefunds() {
  const { data, error } = await db.from('PaymentRefundRequest').select('*')
    .in('status', ['pending', 'requires_action']).order('updated_at', { ascending: true }).limit(100);
  if (error) throw new Error('Refund recovery queue is unavailable');
  for (const request of data || []) {
    try { await refunds.recoverRequest(request); }
    catch (err) { logger.warn('Refund still awaiting confirmation', { requestId: request.id, code: err.code || 'refund_pending' }); }
  }
};
