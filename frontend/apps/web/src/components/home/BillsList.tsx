'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { Home, Landmark, Zap, Flame, Droplets, Pipette, Trash2, Satellite, Tv, Building2, ShieldCheck, Package, CreditCard, Banknote, Mail, Check } from 'lucide-react';
import { BILL_STATUS, statusClasses } from '@/components/statusColors';

const BILL_ICON: Record<string, ReactNode> = {
  rent: <Home className="w-4 h-4" />,
  mortgage: <Landmark className="w-4 h-4" />,
  electric: <Zap className="w-4 h-4" />,
  gas: <Flame className="w-4 h-4" />,
  water: <Droplets className="w-4 h-4" />,
  sewer: <Pipette className="w-4 h-4" />,
  trash: <Trash2 className="w-4 h-4" />,
  internet: <Satellite className="w-4 h-4" />,
  cable: <Tv className="w-4 h-4" />,
  hoa: <Building2 className="w-4 h-4" />,
  insurance: <ShieldCheck className="w-4 h-4" />,
  subscription: <Package className="w-4 h-4" />,
  other: <CreditCard className="w-4 h-4" />,
};

export default function BillsList({
  bills,
  onAdd,
  onMarkPaid,
  homeId,
  highlightBillId,
}: {
  bills: Record<string, any>[];
  onAdd?: () => void;
  onMarkPaid?: (billId: string) => void;
  homeId?: string;
  highlightBillId?: string;
}) {
  useEffect(() => {
    if (!highlightBillId) return;
    const target = document.getElementById(`home-bill-${highlightBillId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightBillId]);

  const unpaid = bills.filter((b) => b.status === 'due' || b.status === 'overdue');
  const totalDue = unpaid.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  // Sort: overdue first, then by due_date ASC
  const sorted = [...bills].sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    return new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
  });

  const isOverdue = (bill: Record<string, any>) => {
    if (bill.status === 'paid' || bill.status === 'canceled') return false;
    if (!bill.due_date) return false;
    return new Date(bill.due_date) < new Date();
  };

  return (
    <div className="bg-app-surface rounded-xl border border-app-border shadow-sm">
      <div className="px-5 py-4 border-b border-app-border-subtle flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-app-text">Bills</h3>
          <p className="text-xs text-app-text-secondary mt-0.5">
            {unpaid.length > 0 ? (
              <>
                <span className="font-semibold text-app-text-strong">${totalDue.toFixed(2)}</span> due
              </>
            ) : (
              'All paid up!'
            )}
          </p>
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
          >
            + Add
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="mb-2"><Banknote className="w-8 h-8 mx-auto text-app-text-muted" /></div>
          <p className="text-sm text-app-text-secondary">No bills tracked yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-app-border-subtle">
          {sorted.slice(0, 8).map((bill) => {
            const overdue = isOverdue(bill);
            const sourceMailId =
              bill?.details?.sourceMailId ||
              bill?.details?.source_mail_id ||
              null;
            return (
              <div
                id={`home-bill-${bill.id}`}
                key={bill.id}
                className={`px-5 py-3.5 flex items-center gap-3 transition ${
                  bill.id === highlightBillId
                    ? 'bg-emerald-50 ring-1 ring-emerald-300'
                    : overdue
                      ? 'bg-red-50/30'
                      : 'hover:bg-app-hover/50'
                }`}
              >
                <span className="flex-shrink-0">
                  {BILL_ICON[bill.bill_type] || BILL_ICON.other}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-app-text capitalize">
                    {bill.provider_name || bill.bill_type?.replace('_', ' ')}
                  </div>
                  <div className="text-xs text-app-text-secondary">
                    {bill.due_date
                      ? `Due ${new Date(bill.due_date).toLocaleDateString()}`
                      : 'No due date'}
                    {bill.period_start && bill.period_end && (
                      <span className="text-app-text-muted ml-2">
                        ({new Date(bill.period_start).toLocaleDateString('en-US', { month: 'short' })} –{' '}
                        {new Date(bill.period_end).toLocaleDateString('en-US', { month: 'short' })})
                      </span>
                    )}
                  </div>
                  {sourceMailId && homeId && (
                    <div className="mt-1">
                      <Link
                        href={`/app/mailbox/${sourceMailId}?scope=home&homeId=${homeId}`}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200"
                      >
                        <Mail className="w-3 h-3" /> From Mail
                      </Link>
                    </div>
                  )}
                </div>

                <span className="text-sm font-semibold text-app-text flex-shrink-0">
                  ${Number(bill.amount).toFixed(2)}
                </span>

                <span
                  className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                    overdue
                      ? statusClasses(BILL_STATUS, 'overdue')
                      : statusClasses(BILL_STATUS, bill.status)
                  }`}
                >
                  {overdue ? 'Overdue' : BILL_STATUS[bill.status]?.label || bill.status}
                </span>

                {onMarkPaid && (bill.status === 'due' || bill.status === 'overdue') && (
                  <button
                    onClick={() => onMarkPaid(bill.id)}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium flex-shrink-0"
                  >
                    <Check className="w-3 h-3 inline" /> Paid
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
