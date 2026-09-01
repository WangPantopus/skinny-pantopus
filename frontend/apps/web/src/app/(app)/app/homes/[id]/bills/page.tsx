'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Receipt,
  Check,
  Trash2,
} from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

type BillTab = 'upcoming' | 'paid' | 'all';

const formatCurrency = (cents?: number | null) =>
  cents != null ? `$${(cents / 100).toFixed(2)}` : '';

function BillsContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BillTab>('upcoming');
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [creating, setCreating] = useState(false);

  // Auth check
  useEffect(() => {
    if (!getAuthToken()) router.push('/login');
  }, [router]);

  const fetchBills = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeProfile.getHomeBills(homeId);
      setBills((res as any)?.bills || []);
    } catch {
      toast.error('Failed to load bills');
    }
  }, [homeId]);

  useEffect(() => {
    setLoading(true);
    fetchBills().finally(() => setLoading(false));
  }, [fetchBills]);

  // Filters
  const now = new Date();
  const isOverdue = (b: any) => b.status !== 'paid' && b.status !== 'canceled' && b.due_date && new Date(b.due_date) < now;
  const upcomingBills = bills.filter((b) => b.status !== 'paid' && b.status !== 'canceled');
  const paidBills = bills.filter((b) => b.status === 'paid');
  const currentList = tab === 'upcoming' ? upcomingBills : tab === 'paid' ? paidBills : bills;

  // Sort: overdue first, then by due date
  const sorted = [...currentList].sort((a, b) => {
    if (isOverdue(a) && !isOverdue(b)) return -1;
    if (!isOverdue(a) && isOverdue(b)) return 1;
    return new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
  });

  const totalDue = upcomingBills.reduce((sum, b) => sum + Number(b.amount_cents ?? b.amount ?? 0), 0);

  const handleMarkPaid = useCallback(async (billId: string) => {
    try {
      await api.homeProfile.updateHomeBill(homeId!, billId, { status: 'paid', paid_at: new Date().toISOString() });
      toast.success('Bill marked as paid');
      await fetchBills();
    } catch {
      toast.error('Failed to mark bill as paid');
    }
  }, [homeId, fetchBills]);

  const handleDelete = useCallback(async (billId: string) => {
    const yes = await confirmStore.open({
      title: 'Delete Bill',
      description: 'Are you sure you want to delete this bill?',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!yes) return;
    try {
      await api.homeProfile.updateHomeBill(homeId!, billId, { status: 'cancelled' });
      toast.success('Bill deleted');
      await fetchBills();
    } catch {
      toast.error('Failed to delete bill');
    }
  }, [homeId, fetchBills]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await api.homeProfile.createHomeBill(homeId!, {
        bill_type: 'other',
        provider_name: newTitle.trim(),
        amount: newAmount ? Math.round(parseFloat(newAmount) * 100) : 0,
      });
      setNewTitle('');
      setNewAmount('');
      setShowCreate(false);
      toast.success('Bill added');
      await fetchBills();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create bill');
    } finally {
      setCreating(false);
    }
  }, [homeId, newTitle, newAmount, fetchBills]);

  const TABS: { key: BillTab; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Upcoming', count: upcomingBills.length },
    { key: 'paid', label: 'Paid', count: paidBills.length },
    { key: 'all', label: 'All', count: bills.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-app-text" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-app-text">Bills & Payments</h1>
            {totalDue > 0 && (
              <p className="text-sm text-app-text-secondary">
                <span className="font-semibold text-app-text-strong">{formatCurrency(totalDue)}</span> total due
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition"
        >
          <Plus className="w-4 h-4" /> Add Bill
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-app-surface border border-app-border rounded-xl p-4 mb-4 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Bill name"
            className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <input
            type="text"
            inputMode="decimal"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="Amount ($)"
            className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newTitle.trim()}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {creating ? 'Adding...' : 'Add Bill'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-app-border mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-app-text-secondary hover:text-app-text'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Bill list */}
      {sorted.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">No bills here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((bill) => {
            const overdue = isOverdue(bill);
            const amount = bill.amount_cents ?? bill.amount;
            return (
              <div
                key={bill.id}
                className={`flex items-center gap-3 bg-app-surface border rounded-xl p-4 ${
                  overdue ? 'border-l-4 border-l-red-500 border-app-border' : 'border-app-border'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-app-text truncate">
                      {bill.title || bill.provider_name || bill.bill_type || 'Bill'}
                    </p>
                    {amount != null && (
                      <span className="text-sm font-bold text-app-text flex-shrink-0 ml-2">
                        {formatCurrency(amount)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {bill.due_date && (
                      <span className={`text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-app-text-secondary'}`}>
                        {overdue ? 'Overdue · ' : ''}Due {new Date(bill.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {bill.status === 'paid' && (
                      <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded uppercase">
                        Paid
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {bill.status !== 'paid' && bill.status !== 'canceled' && (
                    <button
                      onClick={() => handleMarkPaid(bill.id)}
                      title="Mark as paid"
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(bill.id)}
                    title="Delete bill"
                    className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BillsPage() {
  return (
    <Suspense>
      <BillsContent />
    </Suspense>
  );
}
