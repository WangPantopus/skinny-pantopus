'use client';

import { useEffect, useState } from 'react';
import {
  DollarSign,
  TrendingDown,
  Plus,
  Minus,
  Timer,
  PenLine,
} from 'lucide-react';
import * as api from '@pantopus/api';
import type { GigChangeOrder } from '@pantopus/types';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import { formatTimeAgo as timeAgo, CHANGE_ORDER_STATUS_STYLES, statusClasses } from '@pantopus/ui-utils';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

// ─── Types ───

interface ChangeOrdersSectionProps {
  gigId: string;
  isMyGig: boolean;
  iAmWorker: boolean;
  currentUserId?: string;
}

// ─── Constants ───

const CHANGE_ORDER_TYPES = [
  { value: 'price_increase', label: 'Price Increase', icon: <DollarSign className="w-4 h-4" />, hint: 'More work discovered than expected' },
  { value: 'price_decrease', label: 'Price Decrease', icon: <TrendingDown className="w-4 h-4" />, hint: 'Less work needed than expected' },
  { value: 'scope_addition', label: 'Add to Scope', icon: <Plus className="w-4 h-4" />, hint: 'Additional tasks or requirements' },
  { value: 'scope_reduction', label: 'Reduce Scope', icon: <Minus className="w-4 h-4" />, hint: 'Remove some tasks' },
  { value: 'timeline_extension', label: 'Need More Time', icon: <Timer className="w-4 h-4" />, hint: 'Extend the deadline' },
  { value: 'other', label: 'Other', icon: <PenLine className="w-4 h-4" />, hint: 'Something else' },
];

// ─── Component ───

export default function ChangeOrdersSection({
  gigId, isMyGig, iAmWorker, currentUserId,
}: ChangeOrdersSectionProps) {
  const [orders, setOrders] = useState<GigChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formTime, setFormTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadOrders = async () => {
    try {
      const data = await api.gigs.getChangeOrders(gigId);
      setOrders(data.change_orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [gigId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!formType || formDesc.trim().length < 5) return;
    setSubmitting(true);
    try {
      await api.gigs.createChangeOrder(gigId, {
        type: formType,
        description: formDesc.trim(),
        amount_change: formAmount ? parseFloat(formAmount) : undefined,
        time_change_minutes: formTime ? parseInt(formTime) : undefined,
      });
      setShowForm(false);
      setFormType('');
      setFormDesc('');
      setFormAmount('');
      setFormTime('');
      await loadOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit change request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (orderId: string) => {
    try {
      await api.gigs.approveChangeOrder(gigId, orderId);
      await loadOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (orderId: string) => {
    const reason = prompt('Reason for declining (optional):') || '';
    try {
      await api.gigs.rejectChangeOrder(gigId, orderId, reason || undefined);
      await loadOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to decline');
    }
  };

  const handleWithdraw = async (orderId: string) => {
    const yes = await confirmStore.open({ title: 'Withdraw this change request?', confirmLabel: 'Withdraw', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.gigs.withdrawChangeOrder(gigId, orderId);
      await loadOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to withdraw');
    }
  };

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="bg-app-surface rounded-xl p-6 border border-app-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-app-text">
          Change Orders {orders.length > 0 && <span className="text-sm text-app-text-muted font-normal">({orders.length})</span>}
        </h2>
        {pendingCount > 0 && (
          <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Pending banner */}
      {pendingCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-yellow-800 font-medium">
            {isMyGig ? 'The worker has requested changes — review below.' : iAmWorker ? 'Your change request is awaiting review.' : 'Change requests pending review.'}
          </p>
        </div>
      )}

      {/* Orders list */}
      {loading ? (
        <p className="text-sm text-app-text-secondary text-center py-3">Loading...</p>
      ) : orders.length > 0 ? (
        <div className="space-y-3 mb-4">
	          {orders.map((o) => {
	            const typeInfo = CHANGE_ORDER_TYPES.find((t) => t.value === o.type);
	            const isMyOrder = currentUserId && String(o.requested_by) === String(currentUserId);
	            const canApproveReject = o.status === 'pending' && !isMyOrder;
	            const canWithdraw = o.status === 'pending' && isMyOrder;
	            const amountChange = o.amount_change ?? 0;
	            const timeChangeMinutes = o.time_change_minutes ?? 0;

            return (
              <div key={o.id} className="border border-app-border-subtle rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{typeInfo?.icon || <PenLine className="w-4 h-4" />}</span>
                    <span className="text-sm font-medium text-app-text">{typeInfo?.label || o.type}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusClasses(CHANGE_ORDER_STATUS_STYLES, o.status)}`}>
                    {o.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-app-text-strong mt-1">{o.description}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-app-text-muted">
	                  {amountChange !== 0 && (
	                    <span className={amountChange > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
	                      {amountChange > 0 ? '+' : ''}${Number(amountChange).toFixed(2)}
	                    </span>
	                  )}
	                  {timeChangeMinutes > 0 && (
	                    <span>+{timeChangeMinutes}min</span>
	                  )}
                  {o.requester?.username ? (
                    <UserIdentityLink
                      userId={o.requester?.id || null}
                      username={o.requester.username}
                      displayName={o.requester?.name || o.requester?.username || 'Someone'}
                      avatarUrl={o.requester?.profile_picture_url || null}
                      city={o.requester?.city || null}
                      state={o.requester?.state || null}
                      textClassName="text-xs text-app-text-secondary hover:underline"
                    />
                  ) : (
                    <span>{o.requester?.name || o.requester?.username || 'Someone'}</span>
                  )}
                  <span>{o.created_at ? timeAgo(o.created_at) : ''}</span>
                </div>
                {o.rejection_reason && (
                  <p className="text-xs text-red-500 mt-1 italic">Reason: {o.rejection_reason}</p>
                )}

                {/* Action buttons */}
                {(canApproveReject || canWithdraw) && (
                  <div className="flex gap-2 mt-2">
                    {canApproveReject && (
                      <>
                        <button
                          onClick={() => handleApprove(o.id)}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(o.id)}
                          className="text-xs bg-app-surface border border-app-border text-app-text-strong px-3 py-1 rounded-md hover:bg-app-hover font-medium"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {canWithdraw && (
                      <button
                        onClick={() => handleWithdraw(o.id)}
                        className="text-xs text-app-text-secondary hover:text-app-text-strong underline"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-app-text-secondary text-center py-2 mb-3">No change orders yet.</p>
      )}

      {/* New change order form */}
      {showForm ? (
        <div className="border border-app-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-app-text-strong">Request a Change</p>

          {/* Type picker */}
          <div className="grid grid-cols-2 gap-1.5">
            {CHANGE_ORDER_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setFormType(t.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition ${
                  formType === t.value
                    ? 'border-primary-400 bg-primary-50 text-primary-800'
                    : 'border-app-border hover:border-app-border text-app-text-secondary'
                }`}
              >
                <span>{t.icon}</span>
                <span className="font-medium">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Description */}
          <textarea
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder="Describe the change and why it's needed..."
            rows={3}
            maxLength={2000}
            className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
          />

          {/* Amount + Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-app-text-secondary mb-0.5 block">Price change ($)</label>
              <input
                type="number"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="e.g. 25 or -10"
                className="w-full border border-app-border rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-app-text-secondary mb-0.5 block">Extra time (min)</label>
              <input
                type="number"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                placeholder="e.g. 60"
                className="w-full border border-app-border rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowForm(false); setFormType(''); setFormDesc(''); setFormAmount(''); setFormTime(''); }}
              className="text-xs text-app-text-secondary hover:text-app-text-strong px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !formType || formDesc.trim().length < 5}
              className="text-xs bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-app-surface-raised border border-app-border text-app-text-secondary py-2 rounded-lg hover:bg-app-hover text-sm font-medium"
        >
          + Request a Change
        </button>
      )}
    </div>
  );
}
