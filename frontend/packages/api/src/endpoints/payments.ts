// ============================================================
// PAYMENT ENDPOINTS
// Stripe Connect, payments, payouts, balance
// ============================================================

import { get, post, put, del } from '../client';
import type { StripeAccount, Payment, PaymentStateInfo, ApiResponse } from '@pantopus/types';

/**
 * Connect Stripe account (onboarding).
 * Creates the Connect account if needed, then returns the onboarding link.
 */
export async function connectStripeAccount(): Promise<{ 
  accountLink: string;
  accountId: string;
}> {
  // Step 1: Create the Connect Express account (no-op if already exists)
  let accountId = '';
  try {
    const createResult = await post<{
      account?: unknown;
      stripeAccountId?: string;
      message?: string;
      error?: string;
    }>('/api/payments/connect/account', {});
    accountId = createResult.stripeAccountId || '';
  } catch (err: unknown) {
    // 400 = "already exists" → that's fine, continue to onboarding
    // Anything else (500, network) → rethrow
    const statusCode = (err as any)?.statusCode;
    if (statusCode !== 400) {
      throw err;
    }
  }

  // Step 2: Get the onboarding link
  const linkResult = await post<{ onboardingUrl: string; expiresAt: string }>(
    '/api/payments/connect/onboarding',
    {}
  );

  return {
    accountLink: linkResult.onboardingUrl,
    accountId,
  };
}

/**
 * Get Stripe account status
 */
export async function getStripeAccount(): Promise<{ 
  account: StripeAccount;
}> {
  return get<{ account: StripeAccount }>('/api/payments/connect/account');
}

/**
 * Refresh Stripe account link (if expired or continuing onboarding)
 */
export async function refreshStripeAccountLink(): Promise<{ 
  accountLink: string;
}> {
  const result = await post<{ onboardingUrl: string; expiresAt: string }>(
    '/api/payments/connect/onboarding',
    {}
  );
  return { accountLink: result.onboardingUrl };
}

/**
 * Create payment intent for a gig
 */
export async function createPaymentIntent(data: {
  gig_id: string;
  amount: number;
  currency?: string;
  payment_type?: 'gig_payment' | 'deposit';
  description?: string;
}): Promise<{ 
  clientSecret: string;
  paymentIntentId: string;
}> {
  return post<{ 
    clientSecret: string; 
    paymentIntentId: string;
  }>('/api/payments/intent', data);
}

/** @deprecated Use wallet.getWallet() instead — same endpoint, canonical location. */
export async function getBalance(): Promise<{
  wallet: {
    id: string;
    balance: number;
    currency: string;
    frozen: boolean;
    lifetime_withdrawals: number;
    lifetime_received: number;
  };
}> {
  return get<{
    wallet: {
      id: string;
      balance: number;
      currency: string;
      frozen: boolean;
      lifetime_withdrawals: number;
      lifetime_received: number;
    };
  }>('/api/wallet');
}

/** @deprecated Use wallet.withdraw() instead. This function duplicates wallet.ts:withdraw(). */
export async function requestPayout(amount: number, idempotencyKey?: string): Promise<{
  success: boolean;
  transaction: any;
  message: string;
}> {
  return post<{
    success: boolean;
    transaction: any;
    message: string;
  }>('/api/wallet/withdraw', { amount, idempotencyKey });
}

/**
 * Get payment history
 */
export async function getPaymentHistory(filters?: {
  type?: 'sent' | 'received' | 'all';
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ 
  payments: Payment[];
  total: number;
}> {
  return get<{ 
    payments: Payment[]; 
    total: number;
  }>('/api/payments', filters);
}

/**
 * Get combined payments + payouts history.
 */
export async function getTransactionHistory(filters?: {
  limit?: number;
  offset?: number;
}): Promise<{
  transactions: Array<Record<string, any>>;
  total: number;
  limit: number;
  offset: number;
}> {
  return get<{
    transactions: Array<Record<string, any>>;
    total: number;
    limit: number;
    offset: number;
  }>('/api/payments/history', filters);
}

/**
 * Get a specific payment
 */
export async function getPayment(paymentId: string): Promise<{ 
  payment: Payment;
}> {
  return get<{ payment: Payment }>(`/api/payments/${paymentId}`);
}

export type PaymentRefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'work_not_completed' | 'other';
export type PaymentRefundStatus = 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'canceled';

export interface PaymentRefundRequest {
  requestId: string;
  paymentId: string;
  operation: 'refund' | 'release';
  amountCents: number;
  currency: string;
  status: PaymentRefundStatus;
  providerRefundId: string | null;
  canRetry: boolean;
  reversalStatus: string | null;
  requestedAmountCents: number | null;
  reason: PaymentRefundReason;
  description: string | null;
}

export interface PaymentRefundReceipt {
  stripe_refund_id: string;
  payment_id: string;
  amount: number;
  currency: string;
  refund_status: PaymentRefundStatus;
  refund_succeeded_at: string | null;
}

export type RefundPaymentSummary = Pick<Payment,
  'id' | 'payment_status' | 'amount_total' | 'refunded_amount' | 'currency' | 'captured_at'
  | 'payee_release_status' | 'wallet_settlement'>;

export interface PaymentRefundHistory {
  requests: PaymentRefundRequest[];
  refunds: PaymentRefundReceipt[];
  payment: RefundPaymentSummary;
}

export interface PaymentRefundResult {
  success: boolean;
  refundRequest: PaymentRefundRequest;
  refund: PaymentRefundReceipt | null;
  payment: RefundPaymentSummary;
}

/** Read current payer/admin receipts without starting a provider operation. */
export async function getPaymentRefunds(paymentId: string): Promise<PaymentRefundHistory> {
  return get<PaymentRefundHistory>(`/api/payments/${paymentId}/refunds`);
}

/** Keep requestId and original terms unchanged after any uncertain result. */
export async function refundPayment(
  paymentId: string,
  reason: string,
  amount?: number,
  options?: { requestId: string; description?: string },
): Promise<PaymentRefundResult> {
  return post<PaymentRefundResult>(`/api/payments/${paymentId}/refund`, { reason, amount, ...options });
}

/**
 * Add payment method
 */
export async function addPaymentMethod(data: {
  paymentMethodId: string; // From Stripe Elements (pm_xxx)
}): Promise<ApiResponse> {
  return post<ApiResponse>('/api/payments/methods', data);
}

/**
 * Get saved payment methods
 */
export async function getPaymentMethods(): Promise<{ 
  paymentMethods: Array<{
    id: string;
    type: string;
    last4: string;
    brand?: string;
    exp_month?: number;
    exp_year?: number;
    is_default: boolean;
  }>;
}> {
  return get<{ paymentMethods: any[] }>('/api/payments/methods');
}

/**
 * Delete payment method
 */
export async function deletePaymentMethod(paymentMethodId: string): Promise<ApiResponse> {
  return del<ApiResponse>(`/api/payments/methods/${paymentMethodId}`);
}

/**
 * Set default payment method
 */
export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<ApiResponse> {
  return put<ApiResponse>(`/api/payments/methods/${paymentMethodId}/default`);
}

// ============================================================
// GIG PAYMENT LIFECYCLE ENDPOINTS
// ============================================================

/**
 * Get the payment record associated with a gig.
 */
export async function getPaymentForGig(gigId: string): Promise<{
  payment: Payment | null;
  stateInfo: PaymentStateInfo | null;
}> {
  return get<{ payment: Payment | null; stateInfo: PaymentStateInfo | null }>(
    `/api/gigs/${gigId}/payment`
  );
}

/**
 * Complete the SetupIntent flow (card saved for future gig).
 * Called after frontend confirms the SetupIntent.
 */
export async function completePaymentSetup(gigId: string): Promise<{
  success: boolean;
  payment: Payment;
}> {
  return post<{ success: boolean; payment: Payment }>(
    `/api/gigs/${gigId}/complete-payment-setup`
  );
}

/** Exact displayed terms required before resuming an assigned payment. */
export interface AssignedAuthorizationTerms {
  expectedActorId: string;
  expectedSessionScope: string;
  expectedPaymentId: string;
  expectedPayerId: string;
  expectedAmountCents: number;
  expectedPayeeId: string;
  currency: 'usd';
}

export interface AssignedAuthorizationProgress {
  gigId: string;
  actorId: string;
  sessionScope: string;
  paymentId: string;
  payerId: string;
  payeeId: string;
  authorizationAttemptId: string;
  paymentIntentId: string | null;
  amountCents: number;
  currency: 'usd';
  paymentStatus: string;
  providerStatus: string | null;
  authorizationReady: boolean;
  alreadyAuthorized: boolean;
  cancellationPending: boolean;
  authorizationAvailableAt: string | null;
  recoveryState: 'ready' | 'action_required' | 'pending' | 'needs_review';
  canRetry: boolean;
  clientSecret?: string;
}

/** Resume the exact assigned authorization without replacing an active intent. */
export async function retryAuthorization(
  gigId: string, terms: AssignedAuthorizationTerms,
): Promise<AssignedAuthorizationProgress> {
  return post(`/api/gigs/${gigId}/retry-authorization`, terms);
}

export async function continueAuthorization(
  gigId: string, terms: AssignedAuthorizationTerms,
): Promise<AssignedAuthorizationProgress> {
  return post(`/api/gigs/${gigId}/continue-authorization`, terms);
}

/** Read provider state and reconcile its exact receipt; never creates an intent. */
export async function refreshPaymentStatus(gigId: string): Promise<AssignedAuthorizationProgress> {
  return post(`/api/gigs/${gigId}/refresh-payment-status`);
}

/**
 * Create a tip payment for a completed gig.
 *
 * On-session (no paymentMethodId): response includes `clientSecret`, `customer`,
 * `ephemeralKey`, and `publishableKey` so mobile can present the Stripe
 * PaymentSheet with saved cards visible. Web ignores these extra fields.
 *
 * Off-session (with paymentMethodId): server charges the saved card directly.
 */
export async function createTip(
  gigId: string,
  amount: number,
  paymentMethodId?: string
): Promise<{
  clientSecret?: string | null;
  paymentId: string;
  paymentIntentId?: string | null;
  customer?: string | null;
  ephemeralKey?: string | null;
  publishableKey?: string | null;
  success: boolean;
}> {
  return post<{
    clientSecret?: string | null;
    paymentId: string;
    paymentIntentId?: string | null;
    customer?: string | null;
    ephemeralKey?: string | null;
    publishableKey?: string | null;
    success: boolean;
  }>('/api/payments/tip', {
    gigId,
    amount,
    paymentMethodId,
  });
}

/**
 * Refresh/reconcile a tip payment status with Stripe.
 * Used after mobile PaymentSheet succeeds so wallet/history reflect the tip
 * even if webhook delivery is delayed.
 */
export async function refreshTipPaymentStatus(paymentId: string): Promise<{
  paymentStatus: string;
  previousPaymentStatus: string;
  changed: boolean;
  stripeStatus?: string | null;
}> {
  return post<{
    paymentStatus: string;
    previousPaymentStatus: string;
    changed: boolean;
    stripeStatus?: string | null;
  }>(`/api/payments/tip/${paymentId}/refresh-status`);
}

/**
 * Get user's earnings summary
 */
export async function getEarnings(): Promise<{ earnings: any }> {
  return get<{ earnings: any }>('/api/payments/earnings');
}

/**
 * Get user's spending summary
 */
export async function getSpending(): Promise<{ spending: any }> {
  return get<{ spending: any }>('/api/payments/spending');
}

/**
 * Open Stripe Express dashboard
 */
export async function connectStripeDashboard(): Promise<{ dashboardUrl: string }> {
  return post<{ dashboardUrl: string }>('/api/payments/connect/dashboard');
}

/**
 * Get params for Stripe mobile PaymentSheet.
 */
export async function getPaymentSheetParams(gigId: string): Promise<{
  paymentIntent: string;
  ephemeralKey: string;
  customer: string;
  isSetupIntent: boolean;
  publishableKey: string;
}> {
  return post<{
    paymentIntent: string;
    ephemeralKey: string;
    customer: string;
    isSetupIntent: boolean;
    publishableKey: string;
  }>('/api/payments/payment-sheet-params', { gigId });
}

/**
 * Get params for Stripe mobile PaymentSheet in setup mode (add card).
 */
export async function getAddCardSheetParams(): Promise<{
  setupIntent: string;
  ephemeralKey: string;
  customer: string;
  publishableKey: string;
}> {
  return post<{
    setupIntent: string;
    ephemeralKey: string;
    customer: string;
    publishableKey: string;
  }>('/api/payments/payment-sheet-add-card');
}
