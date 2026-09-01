'use client';

import type { EarnWallet } from '@/types/mailbox';

type WalletBalanceHeaderProps = {
  wallet: EarnWallet;
  onWithdraw?: () => void;
};

export default function WalletBalanceHeader({
  wallet,
  onWithdraw,
}: WalletBalanceHeaderProps) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-primary-600 to-primary-800 text-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/70 font-medium">
            Available balance
          </p>
          <p className="text-3xl font-bold mt-1">
            ${wallet.available_balance.toFixed(2)}
          </p>
        </div>
        {onWithdraw && wallet.available_balance > 0 && (
          <button
            type="button"
            onClick={onWithdraw}
            className="px-4 py-2 bg-glass/20 hover:bg-glass/30 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Withdraw
          </button>
        )}
      </div>

      {/* Pending */}
      {wallet.pending_balance > 0 && (
        <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/60">Pending</p>
            <p className="text-sm font-semibold">${wallet.pending_balance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/60">Lifetime</p>
            <p className="text-sm font-semibold">${wallet.lifetime_earned.toFixed(2)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
