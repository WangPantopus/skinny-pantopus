import type * as api from '@pantopus/api';

export type RefundHistory = Awaited<ReturnType<typeof api.payments.getPaymentRefunds>>;
export type RefundRequest = RefundHistory['requests'][number];
export type RefundSummary = RefundHistory['payment'];
export type RefundAttempt = Pick<RefundRequest, 'requestId' | 'requestedAmountCents' | 'reason' | 'description'>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reasons = ['duplicate', 'fraudulent', 'requested_by_customer', 'work_not_completed', 'other'];
const statuses = ['pending', 'requires_action', 'succeeded', 'failed', 'canceled'];

export function validAttempt(value: unknown): value is RefundAttempt {
  if (!value || typeof value !== 'object') return false;
  const r = value as RefundAttempt;
  return typeof r.requestId === 'string' && uuid.test(r.requestId) && reasons.includes(r.reason)
    && (r.requestedAmountCents === null || (Number.isSafeInteger(r.requestedAmountCents) && r.requestedAmountCents > 0))
    && (r.description === null || (typeof r.description === 'string' && r.description.length <= 500));
}

export function validRequest(value: unknown, paymentId: string, total: number): value is RefundRequest {
  if (!validAttempt(value)) return false;
  const r = value as RefundRequest;
  return r.paymentId === paymentId && ['refund', 'release'].includes(r.operation)
    && statuses.includes(r.status) && r.currency?.toLowerCase() === 'usd'
    && Number.isSafeInteger(r.amountCents) && r.amountCents > 0 && r.amountCents <= total
    && typeof r.canRetry === 'boolean';
}

export function validSummary(value: unknown, paymentId: string, total: number): value is RefundSummary {
  if (!value || typeof value !== 'object') return false;
  const p = value as RefundSummary;
  return p.id === paymentId && p.amount_total === total && p.currency?.toLowerCase() === 'usd'
    && Number.isSafeInteger(p.refunded_amount ?? 0) && (p.refunded_amount ?? 0) >= 0
    && (p.refunded_amount ?? 0) <= total && typeof p.payment_status === 'string';
}

export function isPending(r: RefundRequest): boolean {
  return r.status === 'pending' || r.status === 'requires_action';
}

export function recoveryKey(actorId: string, paymentId: string, apiScope: string): string {
  return `pantopus:refund:v1:${encodeURIComponent(apiScope)}:${actorId}:${paymentId}`;
}

export function sameTerms(left: RefundAttempt, right: RefundAttempt): boolean {
  return left.requestedAmountCents === right.requestedAmountCents
    && left.reason === right.reason && left.description === right.description;
}

// Only the nonsecret identity and original numeric/reason-code terms of a
// locally requested operation survive restart. Provider secrets never enter it.
export function readAttempt(key: string): RefundAttempt | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const stored: unknown = JSON.parse(raw);
  if (!validAttempt(stored)) throw new Error('Saved refund recovery is unavailable.');
  return stored;
}

export function saveAttempt(key: string, attempt: RefundAttempt): void {
  // Requests recovered from the server already have durable history; avoid
  // storing a description supplied through another client on this device.
  if (attempt.description) return;
  localStorage.setItem(key, JSON.stringify(attempt));
}

export function centsInput(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const [dollars, fraction = ''] = value.trim().split('.');
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export const money = (cents: number): string => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
}).format(cents / 100);

export function receiptText(r: RefundRequest): string {
  const amount = money(r.amountCents);
  if (r.operation === 'release') {
    if (r.status === 'succeeded') return `${amount} authorization hold released. This was not a captured charge.`;
    if (r.status === 'failed' || r.status === 'canceled') return 'The authorization hold release did not complete.';
    return `${amount} authorization hold release is pending.`;
  }
  if (r.status === 'succeeded') return `${amount} refund completed. Your bank may take additional time to show it.`;
  if (r.status === 'requires_action') return `${amount} refund needs additional action. Check its status or contact support.`;
  if (r.status === 'failed' || r.status === 'canceled') return `${amount} refund did not complete.`;
  return `${amount} refund is pending.`;
}
