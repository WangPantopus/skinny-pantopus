'use client';

/**
 * LandlordVerificationFlow — Tenant-facing landlord verification states.
 *
 * Five states:
 *  1. landlord_exists  — Landlord verified, tenant can request approval
 *  2. no_landlord      — No landlord on file, alternate verification paths
 *  3. pending_approval — Request submitted, waiting for landlord
 *  4. approved         — Lease approved, welcome home!
 *  5. denied           — Request denied, show reason + alternate options
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { tenant } from '@pantopus/api';
import { confirmStore } from '@/components/ui/confirm-store';

// ── Tier badge config ───────────────────────────────────────

const TIER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  weak: { label: 'Unverified', bg: 'bg-app-surface-sunken', text: 'text-app-text-secondary' },
  standard: { label: 'Standard', bg: 'bg-blue-100', text: 'text-blue-700' },
  strong: { label: 'Strong', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  legal: { label: 'Legal', bg: 'bg-purple-100', text: 'text-purple-700' },
};

// ── Props ───────────────────────────────────────────────────

type Props = {
  homeId: string;
  /** Called after the tenant is approved — parent should reload permissions */
  onApproved?: () => void;
  /** Called when user wants to navigate away */
  onBack?: () => void;
};

// ── Main component ──────────────────────────────────────────

export default function LandlordVerificationFlow({ homeId, onApproved, onBack }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<tenant.TenantHomeStatus | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.tenant.getTenantHomeStatus(homeId);
      setStatus(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load landlord status');
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ── Loading ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-3 border-app-border border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm text-app-text-secondary mt-4">Checking landlord status...</p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────
  if (error || !status) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700 mb-3">{error || 'Unable to check landlord status'}</p>
          <button
            type="button"
            onClick={loadStatus}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Route to the correct state ──────────────────────────
  const { landlord, lease } = status;

  // State: Approved
  if (lease.state === 'active' && lease.lease) {
    return (
      <ApprovedState
        lease={lease.lease}
        homeId={homeId}
        onContinue={() => {
          onApproved?.();
          router.refresh();
        }}
      />
    );
  }

  // State: Denied
  if (lease.state === 'denied' && lease.lease) {
    return (
      <DeniedState
        lease={lease.lease}
        homeId={homeId}
        onRetry={loadStatus}
        onMailVerify={() => router.push(`/app/homes/${homeId}/verify-postcard`)}
        onUploadLease={() => router.push(`/app/homes/${homeId}/claim-owner/evidence`)}
      />
    );
  }

  // State: Pending Approval
  if (lease.state === 'pending' && lease.lease) {
    return (
      <PendingApprovalState
        lease={lease.lease}
        landlord={landlord}
        homeId={homeId}
        onCanceled={loadStatus}
        onRefresh={loadStatus}
      />
    );
  }

  // State: Landlord Exists (no lease yet)
  if (landlord.has_landlord) {
    return (
      <LandlordExistsState
        landlord={landlord}
        homeId={homeId}
        onRequested={loadStatus}
      />
    );
  }

  // State: No Landlord
  return (
    <NoLandlordState
      homeId={homeId}
      onInviteLandlord={() => router.push(`/app/homes/${homeId}/invite-landlord`)}
      onMailVerify={() => router.push(`/app/homes/${homeId}/verify-postcard`)}
      onUploadLease={() => router.push(`/app/homes/${homeId}/claim-owner/evidence`)}
      onBack={onBack}
    />
  );
}

// ============================================================
// State 1: Landlord Exists
// ============================================================

function LandlordExistsState({
  landlord,
  homeId,
  onRequested,
}: {
  landlord: tenant.LandlordInfo;
  homeId: string;
  onRequested: () => void;
}) {
  const [message, setMessage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const tier = TIER_BADGE[landlord.verification_tier || 'weak'] || TIER_BADGE.weak;

  const handleRequest = async () => {
    setLoading(true);
    setError('');
    try {
      await api.tenant.requestApproval({
        home_id: homeId,
        start_at: startDate || null,
        message: message.trim() || null,
      });
      onRequested();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12 animate-fade-in">
      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-app-text text-center mb-3">
        This property has a landlord
      </h2>
      <p className="text-app-text-secondary text-center text-[15px] leading-relaxed mb-8 max-w-sm mx-auto">
        Your landlord manages this property. Request their approval to verify your tenancy.
      </p>

      {/* Landlord card */}
      <div className="rounded-xl border border-app-border bg-app-surface p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-app-surface-sunken flex items-center justify-center flex-shrink-0">
            {landlord.landlord_entity_type === 'business' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-app-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-app-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-app-text">
                {landlord.landlord_name_masked || 'Property Manager'}
              </p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${tier.bg} ${tier.text}`}>
                {tier.label}
              </span>
            </div>
            <p className="text-xs text-app-text-secondary capitalize mt-0.5">
              {landlord.landlord_entity_type === 'business' ? 'Property Management Company' :
               landlord.landlord_entity_type === 'trust' ? 'Trust / Estate' : 'Individual Landlord'}
            </p>
          </div>
        </div>
      </div>

      {/* Request form */}
      <div className="space-y-4 mb-6">
        {/* Optional details toggle */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm text-app-text-secondary hover:text-app-text-strong transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-90' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          Add a message or move-in date (optional)
        </button>

        {showDetails && (
          <div className="space-y-3 animate-fade-in">
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">Move-in date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">Message to landlord</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Hi, I'm a new tenant at..."
                className="w-full px-4 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
              <p className="text-[10px] text-app-text-muted mt-1 text-right">{message.length}/1000</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={handleRequest}
        disabled={loading}
        className="w-full px-4 py-3.5 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Sending request...
          </span>
        ) : (
          'Request Approval'
        )}
      </button>

      <p className="text-center text-xs text-app-text-muted mt-4">
        Your landlord will be notified and can approve or deny your request.
      </p>
    </div>
  );
}

// ============================================================
// State 2: No Landlord
// ============================================================

function NoLandlordState({
  homeId: _homeId,
  onInviteLandlord,
  onMailVerify,
  onUploadLease,
  onBack,
}: {
  homeId: string;
  onInviteLandlord: () => void;
  onMailVerify: () => void;
  onUploadLease: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 py-12 animate-fade-in">
      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-app-text text-center mb-3">
        No landlord on file
      </h2>
      <p className="text-app-text-secondary text-center text-[15px] leading-relaxed mb-8 max-w-sm mx-auto">
        This property doesn&apos;t have a verified landlord yet. You can still verify your tenancy using one of these options:
      </p>

      {/* Three paths */}
      <div className="space-y-3 mb-8">
        {/* Path 1: Invite landlord */}
        <button
          type="button"
          onClick={onInviteLandlord}
          className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4 text-left hover:border-app-border hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-app-text">Invite your landlord</p>
            <p className="text-xs text-app-text-secondary mt-0.5">Send them a link to verify ownership and approve you.</p>
          </div>
          <span className="text-app-text-muted flex-shrink-0">&rsaquo;</span>
        </button>

        {/* Path 2: Mail code verification */}
        <button
          type="button"
          onClick={onMailVerify}
          className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4 text-left hover:border-app-border hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-app-text">Verify with a mailed code</p>
            <p className="text-xs text-app-text-secondary mt-0.5">Receive a verification code at this address (3-7 days).</p>
          </div>
          <span className="text-app-text-muted flex-shrink-0">&rsaquo;</span>
        </button>

        {/* Path 3: Upload lease */}
        <button
          type="button"
          onClick={onUploadLease}
          className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4 text-left hover:border-app-border hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-app-text">Upload your lease</p>
            <p className="text-xs text-app-text-secondary mt-0.5">Provide a copy of your lease agreement for review.</p>
          </div>
          <span className="text-app-text-muted flex-shrink-0">&rsaquo;</span>
        </button>
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-full flex items-center justify-center gap-2 py-3 text-app-text-secondary hover:text-app-text-strong text-sm font-medium"
        >
          &larr; Back
        </button>
      )}
    </div>
  );
}

// ============================================================
// State 3: Pending Approval
// ============================================================

function PendingApprovalState({
  lease,
  landlord,
  homeId: _homeId,
  onCanceled,
  onRefresh,
}: {
  lease: tenant.TenantLease;
  landlord: tenant.LandlordInfo;
  homeId: string;
  onCanceled: () => void;
  onRefresh: () => void;
}) {
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const submittedAt = new Date(lease.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const handleCancel = async () => {
    const yes = await confirmStore.open({ title: 'Cancel approval request', description: 'You can submit a new one later.', confirmLabel: 'Cancel request', variant: 'destructive' });
    if (!yes) return;
    setCanceling(true);
    setCancelError('');
    try {
      await api.tenant.cancelRequest(lease.id);
      onCanceled();
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel request');
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12 animate-fade-in">
      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {/* Pulsing dot */}
          <div className="absolute -top-0.5 -right-0.5">
            <span className="flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500" />
            </span>
          </div>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-app-text text-center mb-3">
        Waiting for approval
      </h2>
      <p className="text-app-text-secondary text-center text-[15px] leading-relaxed mb-8 max-w-sm mx-auto">
        Your request has been sent to the landlord. They&apos;ll review and approve your tenancy.
      </p>

      {/* Status badge */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Pending Approval
        </span>
      </div>

      {/* Details card */}
      <div className="rounded-xl border border-app-border bg-app-surface p-4 space-y-3 mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-app-text-secondary">Submitted</span>
          <span className="font-medium text-app-text">{submittedAt}</span>
        </div>
        {landlord.landlord_name_masked && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-app-text-secondary">Landlord</span>
            <span className="font-medium text-app-text">{landlord.landlord_name_masked}</span>
          </div>
        )}
        {lease.start_at && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-app-text-secondary">Requested start</span>
            <span className="font-medium text-app-text">
              {new Date(lease.start_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}
        {lease.metadata?.message && (
          <div className="pt-2 border-t border-app-border-subtle">
            <p className="text-xs text-app-text-secondary mb-1">Your message</p>
            <p className="text-sm text-app-text-strong italic">&ldquo;{lease.metadata.message}&rdquo;</p>
          </div>
        )}
      </div>

      {cancelError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4">
          <p className="text-sm text-red-700">{cancelError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={onRefresh}
          className="w-full px-4 py-3 bg-app-surface border border-app-border rounded-xl text-sm font-semibold text-app-text hover:bg-app-hover transition-colors"
        >
          Check for updates
        </button>

        <button
          type="button"
          onClick={handleCancel}
          disabled={canceling}
          className="w-full flex items-center justify-center gap-2 py-3 text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
        >
          {canceling ? (
            <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
          ) : null}
          Cancel request
        </button>
      </div>

      <p className="text-center text-xs text-app-text-muted mt-6">
        This page will update when your landlord responds.
      </p>
    </div>
  );
}

// ============================================================
// State 4: Approved
// ============================================================

function ApprovedState({
  lease,
  homeId: _homeId,
  onContinue,
}: {
  lease: tenant.TenantLease;
  homeId: string;
  onContinue: () => void;
}) {
  const startDate = new Date(lease.start_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const endDate = lease.end_at
    ? new Date(lease.end_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-12 animate-fade-in">
      {/* Celebration icon */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          {/* Celebration rings */}
          <div className="absolute inset-0 -m-2 rounded-full border-2 border-emerald-200 animate-ping opacity-30" />
          <div className="absolute inset-0 -m-4 rounded-full border border-emerald-100 animate-ping opacity-20" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-app-text text-center mb-3">
        Welcome home!
      </h2>
      <p className="text-app-text-secondary text-center text-[15px] leading-relaxed mb-8 max-w-sm mx-auto">
        Your landlord has approved your tenancy. You now have full access to your home.
      </p>

      {/* Verified badge */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Verified Tenant
        </span>
      </div>

      {/* Lease dates card */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 mb-8">
        <h4 className="text-sm font-semibold text-app-text mb-2">Your Lease</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-app-text-secondary">Start date</span>
            <span className="font-medium text-app-text">{startDate}</span>
          </div>
          {endDate && (
            <div className="flex items-center justify-between">
              <span className="text-app-text-secondary">End date</span>
              <span className="font-medium text-app-text">{endDate}</span>
            </div>
          )}
          {!endDate && (
            <div className="flex items-center justify-between">
              <span className="text-app-text-secondary">End date</span>
              <span className="text-xs text-app-text-muted">Month-to-month</span>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onContinue}
        className="w-full px-4 py-3.5 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition-colors"
      >
        Continue to Dashboard
      </button>
    </div>
  );
}

// ============================================================
// State 5: Denied
// ============================================================

function DeniedState({
  lease,
  homeId: _homeId,
  onRetry,
  onMailVerify,
  onUploadLease,
}: {
  lease: tenant.TenantLease;
  homeId: string;
  onRetry: () => void;
  onMailVerify: () => void;
  onUploadLease: () => void;
}) {
  const deniedReason = lease.metadata?.denied_reason;

  return (
    <div className="max-w-lg mx-auto px-4 py-12 animate-fade-in">
      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-app-text text-center mb-3">
        Request denied
      </h2>
      <p className="text-app-text-secondary text-center text-[15px] leading-relaxed mb-6 max-w-sm mx-auto">
        Your landlord has declined your approval request. You can try alternative verification methods.
      </p>

      {/* Reason card */}
      {deniedReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-xs text-red-500 mb-1 font-medium">Reason provided</p>
          <p className="text-sm text-red-800">{deniedReason}</p>
        </div>
      )}

      {/* Status */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 text-red-700 text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Denied
        </span>
      </div>

      {/* Alternate verification options */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-app-text mb-3">Try another way</h4>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onMailVerify}
            className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4 text-left hover:border-app-border hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-app-text">Verify with a mailed code</p>
              <p className="text-xs text-app-text-secondary mt-0.5">Prove you live here with a code mailed to this address.</p>
            </div>
            <span className="text-app-text-muted flex-shrink-0">&rsaquo;</span>
          </button>

          <button
            type="button"
            onClick={onUploadLease}
            className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4 text-left hover:border-app-border hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-app-text">Upload your lease</p>
              <p className="text-xs text-app-text-secondary mt-0.5">Submit a lease document for manual review.</p>
            </div>
            <span className="text-app-text-muted flex-shrink-0">&rsaquo;</span>
          </button>
        </div>
      </div>

      {/* Support */}
      <div className="text-center space-y-2">
        <button
          type="button"
          onClick={onRetry}
          className="text-sm text-app-text-secondary hover:text-app-text-strong font-medium"
        >
          Check status again
        </button>
        <p className="text-xs text-app-text-muted">
          Think this is a mistake?{' '}
          <a
            href="mailto:help@pantopus.com?subject=Tenant%20Approval%20Denied"
            className="underline hover:text-app-text-secondary"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
