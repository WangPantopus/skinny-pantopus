'use client';

/**
 * RequestsTab — Pending tenant requests with approve/deny/ask-for-info actions.
 * Shows requesting user avatar + name, unit, proposed dates.
 */

import Image from 'next/image';
import { useState, useCallback } from 'react';
import * as api from '@pantopus/api';
import type { landlord } from '@pantopus/api';

type Props = {
  homeId: string;
  authorityId: string;
  requests: landlord.TenantRequest[];
  onRefresh: () => void;
};

// ── Approve modal ───────────────────────────────────────────

function ApproveModal({
  request,
  authorityId,
  onClose,
  onSuccess,
}: {
  request: landlord.TenantRequest;
  authorityId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [startAt, setStartAt] = useState(
    request.start_at ? new Date(request.start_at).toISOString().split('T')[0] : '',
  );
  const [endAt, setEndAt] = useState(
    request.end_at ? new Date(request.end_at).toISOString().split('T')[0] : '',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    setLoading(true);
    setError('');
    try {
      await api.landlord.approveLease(request.id, authorityId);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-app-surface rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-app-text mb-1">Confirm Lease Dates</h3>
        <p className="text-sm text-app-text-secondary mb-4">
          Approve {request.primary_resident?.name || 'tenant'}&apos;s request and confirm the lease period.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Start date</label>
            <input
              type="date"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">End date <span className="text-app-text-muted font-normal">(optional)</span></label>
            <input
              type="date"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-app-text-secondary hover:text-app-text">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40"
          >
            {loading ? 'Approving...' : 'Approve Lease'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Request card ────────────────────────────────────────────

function RequestCard({
  request,
  authorityId: _authorityId,
  onApprove,
  onDeny,
  onRefresh: _onRefresh,
}: {
  request: landlord.TenantRequest;
  authorityId: string;
  onApprove: () => void;
  onDeny: () => void;
  onRefresh: () => void;
}) {
  const resident = request.primary_resident;
  const message = (request.metadata as Record<string, any>)?.message;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      {/* Header: avatar + name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          {resident?.profile_picture_url ? (
            <Image
              src={resident.profile_picture_url}
              alt={resident.name}
              className="w-10 h-10 rounded-full object-cover"
              width={40}
              height={40}
              sizes="40px"
              quality={75}
            />
          ) : (
            <span className="text-sm font-semibold text-primary-600">
              {(resident?.name || '?')[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-app-text">{resident?.name || 'Unknown'}</p>
          <p className="text-xs text-app-text-secondary">{resident?.email || ''}</p>
        </div>
        <span className="text-xs text-app-text-muted">
          {formatDate(request.created_at)}
        </span>
      </div>

      {/* Proposed dates */}
      <div className="flex items-center gap-4 mb-3 text-sm">
        <div className="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-app-text-muted" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
          <span className="text-app-text-strong">
            {formatDate(request.start_at)}
            {request.end_at ? ` \u2013 ${formatDate(request.end_at)}` : ' \u2013 Open'}
          </span>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="mb-4 p-3 rounded-lg bg-app-surface-raised border border-app-border-subtle">
          <p className="text-sm text-app-text-strong italic">&ldquo;{message}&rdquo;</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onApprove}
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={onDeny}
          className="px-4 py-2 border border-app-border text-app-text-strong rounded-xl text-sm font-medium hover:bg-app-hover transition-colors"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────

export default function RequestsTab({ homeId: _homeId, authorityId, requests, onRefresh }: Props) {
  const [approveTarget, setApproveTarget] = useState<landlord.TenantRequest | null>(null);

  const handleDeny = useCallback(async (leaseId: string) => {
    const reason = prompt('Reason for denial (optional):');
    try {
      await api.landlord.denyLease(leaseId, authorityId, reason || undefined);
      onRefresh();
    } catch (err: unknown) {
      console.error('Deny failed:', err);
    }
  }, [authorityId, onRefresh]);

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-app-surface-sunken flex items-center justify-center mx-auto mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-app-text-muted" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-sm text-app-text-secondary">No pending requests. All caught up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-app-text-strong">
        {requests.length} pending request{requests.length === 1 ? '' : 's'}
      </p>

      {requests.map((req) => (
        <RequestCard
          key={req.id}
          request={req}
          authorityId={authorityId}
          onApprove={() => setApproveTarget(req)}
          onDeny={() => handleDeny(req.id)}
          onRefresh={onRefresh}
        />
      ))}

      {approveTarget && (
        <ApproveModal
          request={approveTarget}
          authorityId={authorityId}
          onClose={() => setApproveTarget(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
