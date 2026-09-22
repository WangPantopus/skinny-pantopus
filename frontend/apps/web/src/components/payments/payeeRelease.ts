import type { Payment, PaymentWalletSettlement } from '@pantopus/types';

type ReleaseSummary = Pick<Payment, 'id' | 'amount_total' | 'currency' | 'refunded_amount'
  | 'payee_release_status' | 'wallet_settlement'>;
const states = ['held', 'wallet_credited', 'no_earnings', 'external_transfer', 'unknown'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validRelease(payment: ReleaseSummary): boolean {
  if (payment.currency.toLowerCase() !== 'usd') return false;
  const status = payment.payee_release_status;
  if (status !== undefined && !states.includes(status)) return false;
  const receipt = payment.wallet_settlement;
  if (receipt === null || receipt === undefined) return status !== 'no_earnings'
    || payment.refunded_amount === payment.amount_total;
  if (typeof receipt !== 'object') return false;
  return typeof receipt.id === 'string' && uuid.test(receipt.id) && receipt.paymentId === payment.id
    && typeof receipt.currency === 'string' && receipt.currency.toLowerCase() === payment.currency.toLowerCase()
    && Number.isSafeInteger(receipt.amountCents) && receipt.amountCents >= 0 && receipt.amountCents <= payment.amount_total
    && Number.isSafeInteger(receipt.refundBasisCents) && receipt.refundBasisCents >= 0
    && receipt.refundBasisCents <= (payment.refunded_amount ?? 0)
    && typeof receipt.createdAt === 'string' && Number.isFinite(Date.parse(receipt.createdAt))
    && ((status === 'wallet_credited' && receipt.status === 'credited' && receipt.amountCents > 0)
      || (status === 'no_earnings' && receipt.status === 'no_earnings' && receipt.amountCents === 0));
}

export function verifiedSettlement(payment: ReleaseSummary): PaymentWalletSettlement | null {
  return validRelease(payment) ? payment.wallet_settlement ?? null : null;
}

export function releaseMessage(payment: ReleaseSummary): string | null {
  if (!validRelease(payment)) return 'Worker payment status could not be verified. Check status before continuing.';
  switch (payment.payee_release_status) {
    case 'held': return null;
    case 'wallet_credited': return 'Earnings have been credited to the worker’s wallet. Contact support to request another refund.';
    case 'external_transfer': return 'Earnings have been sent to the worker. Contact support to request another refund.';
    case 'no_earnings': return 'No worker earnings remain after refunds.';
    default: return 'Worker payment status needs verification. Contact support before requesting a refund.';
  }
}
