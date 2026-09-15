const { isDeepStrictEqual } = require('util');
const db = require('../config/supabaseAdmin');
const snapshot = p => ({ id: p.id, payer_id: p.payer_id, payee_id: p.payee_id, gig_id: p.gig_id || null,
  payment_type: p.payment_type, amount_total: p.amount_total, amount_to_payee: p.amount_to_payee,
  currency: String(p.currency).toLowerCase(), intent_id: p.stripe_payment_intent_id || null,
  charge_id: p.stripe_charge_id || null, customer_id: p.stripe_customer_id || null, transfer_id: p.stripe_transfer_id || null });
const unavailable = () => Object.assign(new Error('Wallet settlement verification is unavailable.'), { statusCode: 503 });
const publicReceipt = r => ({ id: r.id, paymentId: r.payment_id, status: r.status, amountCents: r.amount_cents,
  currency: r.currency, refundBasisCents: r.refund_basis_cents, createdAt: r.created_at });
async function readProjection(payment) {
  const unknown = { payee_release_status: 'unknown', wallet_settlement: null };
  if (!payment) return unknown;
  const results = await Promise.all([
    db.from('PaymentWalletSettlement').select('*').eq('payment_id', payment.id).maybeSingle(),
    db.from('WalletTransaction').select('*').eq('payment_id', payment.id).in('type', ['gig_income', 'tip_income']).eq('direction', 'credit'),
    db.from('PaymentRefundReceipt').select('amount_cents,status').eq('payment_id', payment.id),
  ]);
  if (results.some(r => r.error)) throw unavailable();
  const settlement = results[0].data; const credits = results[1].data || [];
  const succeeded = (results[2].data || []).filter(r => r.status === 'succeeded');
  if (succeeded.some(r => !Number.isSafeInteger(r.amount_cents) || r.amount_cents <= 0)) return unknown;
  const refunds = succeeded.reduce((n, r) => n + r.amount_cents, 0);
  const termsValid = Number.isSafeInteger(payment.amount_total) && payment.amount_total >= 50
    && Number.isSafeInteger(payment.amount_to_payee) && payment.amount_to_payee >= 0
    && payment.amount_to_payee <= payment.amount_total && String(payment.currency).toLowerCase() === 'usd';
  if (!termsValid || refunds !== (payment.refunded_amount || 0) || refunds > payment.amount_total) return unknown;
  async function exactCredit(tx, amount) {
    if (!tx || tx.payment_id !== payment.id || tx.user_id !== payment.payee_id || tx.counterparty_id !== payment.payer_id
      || (tx.gig_id || null) !== (payment.gig_id || null) || tx.amount !== amount || tx.direction !== 'credit'
      || tx.type !== (payment.payment_type === 'tip' ? 'tip_income' : 'gig_income')) return false;
    const { data: wallet, error } = await db.from('Wallet').select('id,user_id,currency').eq('id', tx.wallet_id).maybeSingle();
    if (error) throw unavailable();
    return wallet?.user_id === payment.payee_id && String(wallet.currency).toLowerCase() === 'usd';
  }
  if (settlement) {
    const basis = settlement.refund_basis_cents;
    if (!isDeepStrictEqual(settlement.frozen_payment, snapshot(payment)) || !Number.isSafeInteger(basis) || basis < 0 || basis > refunds
      || settlement.amount_cents !== payment.amount_to_payee - Number(BigInt(basis) * BigInt(payment.amount_to_payee) / BigInt(payment.amount_total))
      || settlement.currency !== 'usd' || payment.stripe_transfer_id) return unknown;
    if (settlement.status === 'no_earnings') {
      return settlement.amount_cents === 0 && credits.length === 0 && !settlement.wallet_transaction_id
        ? { payee_release_status: 'no_earnings', wallet_settlement: publicReceipt(settlement) } : unknown;
    }
    if (settlement.status !== 'credited' || credits.length !== 1 || credits[0].id !== settlement.wallet_transaction_id
      || !(await exactCredit(credits[0], settlement.amount_cents))) return unknown;
    return { payee_release_status: 'wallet_credited', wallet_settlement: publicReceipt(settlement) };
  }
  // Historical exact full income is positive evidence of release, but GET
  // never manufactures a protected receipt or mutates that historical row.
  if (credits.length === 1 && !payment.stripe_transfer_id && await exactCredit(credits[0], payment.amount_to_payee)) {
    return { payee_release_status: 'wallet_credited', wallet_settlement: null };
  }
  if (credits.length || payment.transfer_status === 'wallet_credited') return unknown;
  if (payment.stripe_transfer_id) return { payee_release_status: 'external_transfer', wallet_settlement: null };
  if (payment.payment_status === 'transferred' || payment.payment_status === 'transfer_pending') return unknown;
  if (refunds === payment.amount_total) return { payee_release_status: 'no_earnings', wallet_settlement: null };
  if (!payment.stripe_payment_intent_id || !payment.stripe_customer_id) return unknown;
  return { payee_release_status: 'held', wallet_settlement: null };
}
async function settle(payment) {
  const { data, error } = await db.rpc('settle_paid_gig_wallet_income', { p_payment_id: payment.id, p_expected: snapshot(payment) });
  if (error || !data) throw unavailable();
  if (data.error || !data.payment || !data.settlement) throw Object.assign(new Error('Wallet settlement needs verification.'), { code: data.error, statusCode: 409 });
  return data;
}
module.exports = { readProjection, settle, snapshot };
