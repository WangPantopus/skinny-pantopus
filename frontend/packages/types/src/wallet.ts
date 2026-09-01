// ============================================================
// WALLET & TRANSACTION TYPES
// Based on backend/database/schema.sql tables:
// Wallet, WalletTransaction, EarnWallet
// ============================================================

// ─── Wallet ─────────────────────────────────────────────────

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency?: string;
  frozen?: boolean;
  lifetime_deposits?: number;
  lifetime_withdrawals?: number;
  lifetime_received?: number;
  lifetime_spent?: number;
  created_at?: string;
  updated_at?: string;
}

// ─── WalletTransaction ─────────────────────────────────────

export type WalletTransactionType =
  | 'deposit' | 'withdrawal' | 'withdrawal_reversal' | 'gig_income' | 'gig_payment'
  | 'tip_income' | 'tip_sent' | 'refund' | 'adjustment'
  | 'transfer_in' | 'transfer_out' | 'cancellation_fee';

export type WalletTransactionDirection = 'credit' | 'debit';

export type WalletTransactionStatus = 'completed' | 'pending' | 'failed' | 'reversed';

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: WalletTransactionType;
  amount: number;
  direction: WalletTransactionDirection;
  balance_before: number;
  balance_after: number;
  description?: string | null;
  currency?: string;
  payment_id?: string | null;
  gig_id?: string | null;
  counterparty_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_transfer_id?: string | null;
  idempotency_key?: string | null;
  status: WalletTransactionStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ─── EarnWallet ─────────────────────────────────────────────

/** @deprecated Use `Wallet` instead. Legacy EarnWallet surfaces now redirect to Settings → Payments. */
export type EarnWithdrawalMethod = 'pantopus_credit' | 'bank_transfer' | 'gift_card';

/** @deprecated Use `Wallet` instead. Legacy EarnWallet surfaces now redirect to Settings → Payments. */
export interface EarnWallet {
  user_id: string;
  available_balance: number;
  pending_balance: number;
  lifetime_earned: number;
  lifetime_saved: number;
  withdrawal_method?: EarnWithdrawalMethod | null;
  withdrawal_threshold?: number;
  created_at?: string;
  updated_at?: string;
}

// ─── EarningsSummary / SpendingSummary ──────────────────────

export interface EarningsSummary {
  total_earned: number;
  this_month: number;
  pending: number;
  available: number;
  recent_transactions?: WalletTransaction[];
}

export interface SpendingSummary {
  total_spent: number;
  this_month: number;
  pending: number;
  recent_transactions?: WalletTransaction[];
}
