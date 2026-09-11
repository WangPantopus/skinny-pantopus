'use client';

import { useMemo, type ReactNode } from 'react';
import { Home, Landmark, Zap, Flame, Droplets, Globe, Smartphone, ShieldCheck, Trash2, ShowerHead, Building2, Tv, FileText, Wallet, CheckCircle, ChevronLeft } from 'lucide-react';
import DashboardCard from '../DashboardCard';
import VisibilityChip from '../VisibilityChip';
import { formatHomeBillAmount, formatHomeBillDate, parseHomeBillDate } from '../homeBillAmount';

const BILL_ICON: Record<string, ReactNode> = {
  rent: <Home className="w-4 h-4" />, mortgage: <Landmark className="w-4 h-4" />, electric: <Zap className="w-4 h-4" />, gas: <Flame className="w-4 h-4" />, water: <Droplets className="w-4 h-4" />,
  internet: <Globe className="w-4 h-4" />, phone: <Smartphone className="w-4 h-4" />, insurance: <ShieldCheck className="w-4 h-4" />, trash: <Trash2 className="w-4 h-4" />, sewer: <ShowerHead className="w-4 h-4" />,
  hoa: <Building2 className="w-4 h-4" />, subscription: <Tv className="w-4 h-4" />, other: <FileText className="w-4 h-4" />,
};

// ---- Preview ----

export function BillsBudgetCardPreview({
  bills,
  billsDueCount,
  onExpand,
}: {
  bills: Record<string, any>[];
  billsDueCount: number;
  onExpand: () => void;
}) {
  const nextBill = bills
    .filter((b) => b.status === 'due' || b.status === 'overdue')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  return (
    <DashboardCard
      title="Bills & Budget"
      icon={<Wallet className="w-5 h-5" />}
      count={billsDueCount}
      badge={billsDueCount > 0 ? `${billsDueCount} due` : undefined}
      onClick={onExpand}
    >
      {nextBill ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-app-text-secondary">Next due:</span>
            <span className="text-xs font-medium text-app-text-strong">
              {formatHomeBillDate(nextBill.due_date)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>{BILL_ICON[nextBill.bill_type] || <FileText className="w-4 h-4" />}</span>
            <span className="text-sm font-medium text-app-text truncate">{nextBill.provider_name || nextBill.bill_type}</span>
            <span className="text-sm font-bold text-app-text ml-auto">{formatHomeBillAmount(nextBill.amount, nextBill.currency)}</span>
          </div>
          {bills.filter((b) => b.status === 'due' || b.status === 'overdue').length > 1 && (
            <p className="text-xs text-app-text-muted">
              +{bills.filter((b) => b.status === 'due' || b.status === 'overdue').length - 1} more bills due
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="mb-1"><CheckCircle className="w-5 h-5 mx-auto text-app-text-muted" /></div>
          <p className="text-xs text-app-text-muted">No bills due</p>
        </div>
      )}
    </DashboardCard>
  );
}

// ---- Expanded ----

export default function BillsBudgetCard({
  bills,
  homeId: _homeId,
  members,
  onAddBill,
  onMarkBillPaid,
  onBack,
  highlightBillId,
  canManage = false,
}: {
  bills: Record<string, any>[];
  homeId: string;
  members: Record<string, any>[];
  onAddBill: () => void;
  onMarkBillPaid: (billId: string) => void;
  onBack: () => void;
  highlightBillId?: string;
  canManage?: boolean;
}) {
  const { dueSoon, allBills, subscriptions, now } = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      dueSoon: bills
        .filter((b) => {
          const dueDate = parseHomeBillDate(b.due_date);
          return (b.status === 'due' || b.status === 'overdue') && dueDate !== null && dueDate <= sevenDays;
        })
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
      allBills: [...bills]
        .sort((a, b) => {
          if (a.status === 'overdue' && b.status !== 'overdue') return -1;
          if (b.status === 'overdue' && a.status !== 'overdue') return 1;
          return new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
        }),
      subscriptions: bills.filter((b) => b.bill_type === 'subscription' || b.recurring),
      now,
    };
  }, [bills]);

  const getMemberName = (userId: string) => {
    const m = members.find((m) => m.user_id === userId);
    return m?.display_name || m?.username || null;
  };

  const renderBillRow = (bill: Record<string, any>) => {
    const dueDate = parseHomeBillDate(bill.due_date);
    const isOverdue = bill.status === 'overdue' || (bill.status === 'due' && dueDate !== null && dueDate < now);

    return (
      <div
        key={bill.id}
        id={`bill-${bill.id}`}
        className={`px-4 py-3 flex items-center gap-3 hover:bg-app-hover/50 transition ${
          bill.id === highlightBillId ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''
        }`}
      >
        <span className="flex-shrink-0">{BILL_ICON[bill.bill_type] || <FileText className="w-4 h-4" />}</span>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-app-text">{bill.provider_name || bill.bill_type?.replace('_', ' ')}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {bill.due_date && (
              <span className={`text-[10px] ${isOverdue ? 'text-red-600 font-semibold' : 'text-app-text-secondary'}`}>
                Due {formatHomeBillDate(bill.due_date)}
              </span>
            )}
            {bill.responsible_member && (
              <span className="text-[10px] text-app-text-muted">{getMemberName(bill.responsible_member)}</span>
            )}
            {bill.visibility && <VisibilityChip visibility={bill.visibility} />}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold text-app-text">{formatHomeBillAmount(bill.amount, bill.currency)}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${
            isOverdue ? 'bg-red-100 text-red-700' :
            bill.status === 'paid' ? 'bg-green-100 text-green-700' :
            bill.status === 'canceled' ? 'bg-app-surface-sunken text-app-text-secondary' :
            'bg-amber-100 text-amber-700'
          }`}>
            {isOverdue ? 'overdue' : bill.status}
          </span>
          {canManage && (bill.status === 'due' || bill.status === 'overdue') && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkBillPaid(bill.id); }}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-600 text-white hover:bg-green-700 transition"
            >
              Mark Paid
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-app-text-secondary hover:text-app-text-strong transition flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2"><Wallet className="w-5 h-5" /> Bills & Budget</h2>
        </div>
        {canManage && <button
          onClick={onAddBill}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
        >
          + Add Bill
        </button>}
      </div>

      {/* Bills Due Soon */}
      {dueSoon.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Due Soon</h3>
          <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
            {dueSoon.map(renderBillRow)}
          </div>
        </div>
      )}

      {/* All Bills */}
      <div>
        <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">All Bills</h3>
        <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
          {allBills.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="mb-2"><Wallet className="w-8 h-8 mx-auto text-app-text-muted" /></div>
              <p className="text-sm text-app-text-secondary">No bills tracked yet</p>
            </div>
          ) : (
            allBills.map(renderBillRow)
          )}
        </div>
      </div>

      {/* Subscriptions */}
      {subscriptions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Subscriptions</h3>
          <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
            {subscriptions.map(renderBillRow)}
          </div>
        </div>
      )}
    </div>
  );
}
