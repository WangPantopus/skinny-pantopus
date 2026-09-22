// Test double for the SQL transaction; exact locking/rollback and privilege
// behavior is checked by scripts/db/contracts/paid-gig-refund.sql.
module.exports = (args, getTable) => {
  const p = getTable('Payment').find(x => x.id === args.p_payment_id);
  if (!p) return { data: { error: 'NOT_FOUND' } };
  if (!['transfer_scheduled', 'transfer_pending'].includes(p.payment_status)) return { data: { payment: p } };
  if (p.dispute_id || p.refunded_amount > 0) return { data: { error: 'REFUND_OR_DISPUTE' } };
  const credited = getTable('WalletTransaction').some(x => x.payment_id === p.id && x.amount === p.amount_to_payee
    && x.direction === 'credit' && x.user_id === p.payee_id);
  if (!credited && (p.payment_status === 'transfer_pending' || p.stripe_transfer_id)) return { data: { error: 'TRANSFER_UNKNOWN' } };
  p.payment_status = credited ? 'transferred' : 'captured_hold';
  if (credited) { p.transfer_status = 'wallet_credited'; p.transfer_completed_at = new Date().toISOString(); }
  const g = getTable('Gig').find(x => x.payment_id === p.id); if (g) g.payment_status = p.payment_status;
  return { data: { payment: p } };
};
