'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { ArrowUp, ArrowDown, Wallet, Star, Undo2, Settings, X, BarChart3 } from 'lucide-react';
import { wallet as walletApi } from '@pantopus/api';
import { WALLET_TX_TYPE_CONFIG } from '@pantopus/ui-utils';

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  direction: 'credit' | 'debit';
  balance_before: number;
  balance_after: number;
  description: string | null;
  status: string;
  counterparty?: { id: string; username: string; name: string; profile_picture_url: string | null } | null;
  created_at: string;
}

const TX_ICONS: Record<string, ReactNode> = {
  ArrowUp:   <ArrowUp className="w-4 h-4" />,
  ArrowDown: <ArrowDown className="w-4 h-4" />,
  Wallet:    <Wallet className="w-4 h-4" />,
  Star:      <Star className="w-4 h-4" />,
  Undo2:     <Undo2 className="w-4 h-4" />,
  Settings:  <Settings className="w-4 h-4" />,
  X:         <X className="w-4 h-4" />,
};

const FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'gig_income', label: 'Task Income' },
  { value: 'tip_income', label: 'Tips Received' },
  { value: 'withdrawal', label: 'Withdrawals' },
  { value: 'refund', label: 'Refunds' },
];

export default function WalletTransactionList() {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('');
  const limit = 20;

  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const result = await walletApi.getTransactions({
        type: filter || undefined,
        limit,
        offset,
      });
      setTransactions(result.transactions);
      setTotal(result.total);
    } catch (err: any) {
      // Only show error if no existing data. Use functional updater
      // to read current state without stale closure.
      setTransactions((prev) => {
        if (prev.length === 0) {
          setError(err?.message || 'Failed to load transactions');
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setOffset(0);
  };

  if (error && transactions.length === 0) {
    return (
      <button
        onClick={loadTransactions}
        className="w-full bg-app-surface rounded-xl border border-red-200 p-6 text-center hover:bg-red-50 transition"
      >
        <p className="text-sm font-medium text-red-800">{error}</p>
        <p className="text-xs text-red-600 mt-1">Click to retry</p>
      </button>
    );
  }

  if (loading && transactions.length === 0) {
    return (
      <div className="bg-app-surface rounded-xl border border-app-border p-6 text-center text-app-text-secondary text-sm">
        Loading transactions...
      </div>
    );
  }

  return (
    <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
      {/* Header with filter */}
      <div className="p-4 border-b border-app-border-subtle flex items-center justify-between">
        <h3 className="font-semibold text-app-text">Transaction History</h3>
        <select
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="text-sm border border-app-border rounded-lg px-3 py-1.5 text-app-text-secondary focus:ring-2 focus:ring-emerald-500 outline-none"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {transactions.length === 0 ? (
        <div className="p-10 text-center">
          <div className="flex justify-center mb-3 text-app-text-muted"><BarChart3 className="w-10 h-10" /></div>
          <p className="font-medium text-app-text-strong">No transactions yet</p>
          <p className="text-sm text-app-text-secondary mt-1">
            {filter ? 'No transactions match this filter.' : 'Your transaction history will appear here.'}
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-app-border-subtle">
            {transactions.map((tx) => {
              const txStyle = WALLET_TX_TYPE_CONFIG[tx.type] || WALLET_TX_TYPE_CONFIG.adjustment;
              const config = { ...txStyle, icon: TX_ICONS[txStyle.iconName] || TX_ICONS.Settings };
              const isCredit = tx.direction === 'credit';

              return (
                <div key={tx.id} className="px-4 py-3 flex items-center gap-3 hover:bg-app-hover transition">
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${config.color}`}>
                    {config.icon}
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-app-text">{config.label}</span>
                      {tx.status !== 'completed' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          tx.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-app-surface-sunken text-app-text-secondary'
                        }`}>
                          {tx.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-app-text-muted truncate">
                      {tx.description || config.label}
                      {tx.counterparty && ` • ${tx.counterparty.name || tx.counterparty.username}`}
                    </p>
                    <p className="text-xs text-gray-300">
                      {new Date(tx.created_at).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isCredit ? '+' : '-'}${(tx.amount / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-app-text-muted">
                      bal: ${(tx.balance_after / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="p-4 border-t border-app-border-subtle flex items-center justify-between">
              <p className="text-xs text-app-text-muted">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-3 py-1 text-sm border border-app-border rounded-lg disabled:opacity-30 hover:bg-app-hover"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="px-3 py-1 text-sm border border-app-border rounded-lg disabled:opacity-30 hover:bg-app-hover"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
