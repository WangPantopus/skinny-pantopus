import type { Payment } from '@pantopus/types';
import type * as api from '@pantopus/api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type Progress = Awaited<ReturnType<typeof api.payments.refreshPaymentStatus>>;
export type Terms = Omit<Parameters<typeof api.payments.continueAuthorization>[1], 'expectedActorId' | 'expectedSessionScope'>;

export function termsFor(payment: Payment | null, gigId: string, payeeId: string | null): Terms {
  if (!payment || !uuid.test(payment.id) || payment.gig_id !== gigId || !uuid.test(payment.payer_id)
    || !payeeId || payment.payee_id !== payeeId || !uuid.test(payeeId)
    || !Number.isSafeInteger(payment.amount_total) || payment.amount_total < 50
    || payment.currency?.toLowerCase() !== 'usd') {
    throw new Error('The assigned payment terms could not be verified. Refresh the gig before continuing.');
  }
  return { expectedPaymentId: payment.id, expectedPayerId: payment.payer_id,
    expectedAmountCents: payment.amount_total, expectedPayeeId: payeeId, currency: 'usd' };
}

export function verifyProgress(value: Progress, gigId: string, actorId: string, terms: Terms, sessionScope: string | null = null): Progress {
  if (!value || value.gigId !== gigId || value.paymentId !== terms.expectedPaymentId
    || value.actorId !== actorId || value.payerId !== terms.expectedPayerId || value.payeeId !== terms.expectedPayeeId
    || typeof value.sessionScope !== 'string' || !/^[a-f0-9]{64}$/.test(value.sessionScope)
    || (sessionScope !== null && value.sessionScope !== sessionScope)
    || value.amountCents !== terms.expectedAmountCents || value.currency !== 'usd'
    || !uuid.test(value.authorizationAttemptId) || typeof value.canRetry !== 'boolean'
    || typeof value.authorizationReady !== 'boolean' || value.alreadyAuthorized !== value.authorizationReady
    || typeof value.cancellationPending !== 'boolean'
    || (value.authorizationAvailableAt !== null && (typeof value.authorizationAvailableAt !== 'string'
      || !Number.isFinite(Date.parse(value.authorizationAvailableAt))))
    || !['ready', 'action_required', 'pending', 'needs_review'].includes(value.recoveryState)
    || (value.paymentIntentId !== null && !/^pi_[a-zA-Z0-9]+$/.test(value.paymentIntentId))) {
    throw new Error('Payment progress could not be verified. Check its status before continuing.');
  }
  if (value.authorizationReady !== (value.recoveryState === 'ready')
    || ((value.cancellationPending || value.authorizationAvailableAt !== null)
      && (value.recoveryState !== 'pending' || value.canRetry || value.clientSecret !== undefined))
    || (value.authorizationAvailableAt !== null && value.paymentIntentId !== null)
    || (value.authorizationReady && (value.providerStatus !== 'requires_capture' || value.paymentStatus !== 'authorized' || !value.paymentIntentId))
    || (value.recoveryState === 'action_required' && (!value.canRetry || !value.paymentIntentId
      || !['requires_action', 'requires_confirmation', 'requires_payment_method'].includes(value.providerStatus ?? '')
      || typeof value.clientSecret !== 'string' || !value.clientSecret.startsWith(`${value.paymentIntentId}_secret_`)))
    || (value.recoveryState !== 'action_required' && value.clientSecret !== undefined)) {
    throw new Error('Payment authorization is not confirmed. Check its status before continuing.');
  }
  return value;
}
