'use client';

import { useState, useEffect, useCallback } from 'react';
import { wallet as walletApi } from '@pantopus/api';

interface WalletData {
  id: string;
  balance: number;
  currency: string;
  frozen: boolean;
  lifetime_withdrawals: number;
  lifetime_received: number;
}

interface WalletBalanceCardProps {
  /** Compact mode for sidebar/header display */
  compact?: boolean;
  /** Show withdraw button */
  showActions?: boolean;
  onWithdraw?: () => void;
  /** Called after wallet data loads */
  onLoad?: (wallet: WalletData) => void;
}

export default function WalletBalanceCard({
  compact = false,
  showActions = true,
  onWithdraw,
  onLoad,
}: WalletBalanceCardProps) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [pendingRelease, setPendingRelease] = useState<{ in_review_cents: number; releasing_soon_cents: number; total_pending_cents: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    try {
      setError(null);
      const [walletRes, pendingRes] = await Promise.allSettled([
        walletApi.getWallet(),
        walletApi.getPendingRelease(),
      ]);
      if (walletRes.status === 'fulfilled') {
        setWalletData(walletRes.value.wallet);
        onLoad?.(walletRes.value.wallet);
      } else if ((walletRes.reason as any)?.statusCode !== 404) {
        setError((walletRes.reason as any)?.message || 'Failed to load wallet');
      }
      if (pendingRes.status === 'fulfilled') {
        setPendingRelease(pendingRes.value);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, [onLoad]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  if (loading) {
    return compact ? null : (
      <div className="animate-pulse bg-app-surface-sunken rounded-xl h-32" />
    );
  }

  if (error) {
    return compact ? null : (
      <button
        onClick={loadWallet}
        className="w-full bg-red-50 border border-red-200 rounded-xl p-6 text-center hover:bg-red-100 transition"
      >
        <p className="text-sm font-medium text-red-800">{error}</p>
        <p className="text-xs text-red-600 mt-1">Click to retry</p>
      </button>
    );
  }

  const balance = walletData?.balance ?? 0;
  const formattedBalance = `$${(balance / 100).toFixed(2)}`;

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg">
        <span className="text-sm text-emerald-600 font-medium">Earnings</span>
        <span className="text-sm font-bold text-emerald-700">{formattedBalance}</span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-6 text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-emerald-100 text-sm font-medium">Earnings Balance</p>
          <p className="text-3xl font-bold mt-1">{formattedBalance}</p>
          {walletData?.frozen && (
            <p className="text-red-200 text-xs mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
              </svg>
              Wallet frozen
            </p>
          )}
        </div>
        <div className="w-10 h-10 bg-emerald-500 bg-opacity-50 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
      </div>

      {/* Lifetime stats */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="bg-emerald-500 bg-opacity-30 rounded-lg px-3 py-2">
          <p className="text-emerald-200 text-xs">Total Earned</p>
          <p className="font-semibold text-sm">${((walletData?.lifetime_received ?? 0) / 100).toFixed(2)}</p>
        </div>
        <div className="bg-emerald-500 bg-opacity-30 rounded-lg px-3 py-2">
          <p className="text-emerald-200 text-xs">Withdrawn</p>
          <p className="font-semibold text-sm">${((walletData?.lifetime_withdrawals ?? 0) / 100).toFixed(2)}</p>
        </div>
      </div>

      {/* Pending release breakdown */}
      {pendingRelease && pendingRelease.total_pending_cents > 0 && (
        <div className="mt-4 bg-emerald-500 bg-opacity-20 rounded-lg px-3 py-2.5">
          <p className="text-emerald-100 text-xs font-medium mb-1.5">Pending Release</p>
          <div className="flex justify-between text-xs">
            <span className="text-emerald-200">In review ({pendingRelease.in_review_cents > 0 ? `${Math.ceil((pendingRelease as any).in_review_count)} payment${(pendingRelease as any).in_review_count === 1 ? '' : 's'}` : 'none'})</span>
            <span className="font-medium">${(pendingRelease.in_review_cents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs mt-0.5">
            <span className="text-emerald-200">Releasing soon</span>
            <span className="font-medium">${(pendingRelease.releasing_soon_cents / 100).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Withdraw button */}
      {showActions && !walletData?.frozen && (
        <div className="mt-5">
          <button
            onClick={onWithdraw}
            disabled={balance === 0}
            className="w-full px-4 py-2.5 bg-app-surface text-emerald-700 rounded-lg font-medium text-sm hover:bg-emerald-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {balance > 0 ? `Withdraw ${formattedBalance} to Bank` : 'No funds to withdraw'}
          </button>
        </div>
      )}
    </div>
  );
}
