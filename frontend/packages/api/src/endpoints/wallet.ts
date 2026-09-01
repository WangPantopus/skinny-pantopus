// ============================================================
// WALLET ENDPOINTS
// Earnings-only wallet: balance, withdrawals, transactions.
//
// NOTE: No deposit or pay-from-wallet endpoints.
// Balance comes from gig income, tips, and refunds only.
// Users can withdraw earned funds to their bank.
// ============================================================

import { get, post } from '../client';

// ============ TYPES ============

export interface Wallet {
  id: string;
  balance: number;        // in cents
  currency: string;
  frozen: boolean;
  lifetime_withdrawals: number;
  lifetime_received: number;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: 'withdrawal' | 'gig_income' | 'tip_income' | 'refund' | 'adjustment' | 'cancellation_fee';
  amount: number;
  direction: 'credit' | 'debit';
  balance_before: number;
  balance_after: number;
  description: string | null;
  currency: string;
  payment_id: string | null;
  gig_id: string | null;
  counterparty_id: string | null;
  counterparty?: {
    id: string;
    username: string;
    name: string;
    profile_picture_url: string | null;
  };
  stripe_transfer_id: string | null;
  status: 'completed' | 'pending' | 'failed' | 'reversed';
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============ WALLET BALANCE ============

/**
 * Get wallet balance and summary. Creates wallet on first access.
 */
export async function getWallet(): Promise<{ wallet: Wallet }> {
  return get<{ wallet: Wallet }>('/api/wallet');
}

// ============ WITHDRAWALS ============

/**
 * Withdraw earned funds from wallet to bank account.
 */
export async function withdraw(amount: number, idempotencyKey?: string): Promise<{
  success: boolean;
  transaction: WalletTransaction;
  message: string;
}> {
  return post<{
    success: boolean;
    transaction: WalletTransaction;
    message: string;
  }>('/api/wallet/withdraw', { amount, idempotencyKey });
}

// ============ TRANSACTIONS ============

/**
 * Get paginated transaction history.
 */
export async function getTransactions(filters?: {
  type?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}): Promise<{
  transactions: WalletTransaction[];
  total: number;
  limit: number;
  offset: number;
}> {
  return get<{
    transactions: WalletTransaction[];
    total: number;
    limit: number;
    offset: number;
  }>('/api/wallet/transactions', filters);
}

// ============ PENDING RELEASE ============

export interface PendingRelease {
  in_review_cents: number;
  releasing_soon_cents: number;
  total_pending_cents: number;
  in_review_count: number;
  releasing_soon_count: number;
}

/**
 * Get breakdown of pending funds not yet in wallet:
 * - in_review: still in cooling-off period
 * - releasing_soon: past cooling-off, awaiting next transfer job run
 */
export async function getPendingRelease(): Promise<PendingRelease> {
  return get<PendingRelease>('/api/wallet/pending-release');
}
