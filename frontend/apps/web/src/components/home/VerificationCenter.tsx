'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHomePermissions } from './useHomePermissions';
import { post } from '@pantopus/api';
import * as api from '@pantopus/api';
import LandlordVerificationFlow from './LandlordVerificationFlow';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

interface VerificationCenterProps {
  homeId: string;
}

export default function VerificationCenter({ homeId }: VerificationCenterProps) {
  const router = useRouter();
  const { access, reload } = useHomePermissions();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Landlord check ──────────────────────────────────────
  const [landlordCheck, setLandlordCheck] = useState<{
    checked: boolean;
    hasLandlord: boolean;
    hasLease: boolean;
  }>({ checked: false, hasLandlord: false, hasLease: false });

  const handleMoveOut = useCallback(async () => {
    const yes = await confirmStore.open({ title: 'Move out', description: 'This will remove you from this home. You can request to join again later. Continue?', confirmLabel: 'Move out', variant: 'destructive' });
    if (!yes) return;
    setActionLoading('move-out');
    try {
      await post(`/api/homes/${homeId}/move-out`);
      router.push('/app');
    } catch {
      toast.error('Failed to process move-out. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }, [homeId, router]);

  const handleResendPostcard = useCallback(async () => {
    setActionLoading('resend');
    try {
      await post(`/api/homes/${homeId}/request-postcard`);
      toast.success('A new code has been requested. Please allow 3-7 business days for delivery.');
    } catch {
      toast.error('Failed to request a new code. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }, [homeId]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await api.tenant.getTenantHomeStatus(homeId);
        if (canceled) return;
        setLandlordCheck({
          checked: true,
          hasLandlord: res.landlord.has_landlord,
          hasLease: res.lease.state !== 'none',
        });
      } catch {
        // Endpoint not available — fall through to standard flow
        if (!canceled) {
          setLandlordCheck({ checked: true, hasLandlord: false, hasLease: false });
        }
      }
    })();
    return () => { canceled = true; };
  }, [homeId]);

  // Show landlord flow when a landlord authority exists or tenant has a lease relationship
  if (landlordCheck.checked && (landlordCheck.hasLandlord || landlordCheck.hasLease)) {
    return (
      <LandlordVerificationFlow
        homeId={homeId}
        onApproved={reload}
        onBack={() => router.push('/app')}
      />
    );
  }

  const status = access?.verification_status || 'unverified';
  // When claim was rejected (or needs more info), show that instead of generic "under review"
  const effectiveStatus = access?.ownership_claim_state === 'rejected'
    ? 'claim_rejected'
    : access?.ownership_claim_state === 'needs_more_info'
      ? 'claim_needs_more_info'
      : status;
  const config = getStatusConfig(effectiveStatus, access);

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      {/* Status icon */}
      <div className="flex justify-center mb-6">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl ${config.iconBg}`}>
          {config.icon}
        </div>
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-app-text text-center mb-3">
        {config.title}
      </h2>

      {/* Body */}
      <p className="text-app-text-secondary text-center text-[15px] leading-relaxed mb-8 max-w-sm mx-auto">
        {config.body}
      </p>

      {/* Rejected / needs more info subtitle */}
      {(effectiveStatus === 'claim_rejected' || effectiveStatus === 'claim_needs_more_info') && (
        <p className="text-center text-sm text-red-600 dark:text-red-400 mb-6">
          This ownership claim is {effectiveStatus === 'claim_rejected' ? 'rejected' : 'awaiting more information'}.
        </p>
      )}

      {/* Postcard countdown */}
      {status === 'pending_postcard' && access?.postcard_expires_at && (
        <div className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4 mb-5">
          <span className="text-xl">&#128340;</span>
          <div>
            <p className="text-sm text-app-text-secondary">Code expires</p>
            <p className="text-sm font-semibold text-app-text">
              {new Date(access.postcard_expires_at).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
        </div>
      )}

      {/* Challenge window countdown */}
      {status === 'provisional' && access?.is_in_challenge_window && access?.challenge_window_ends_at && (
        <div className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4 mb-5">
          <span className="text-xl">&#9203;</span>
          <div>
            <p className="text-sm text-app-text-secondary">Full access unlocks</p>
            <p className="text-sm font-semibold text-app-text">
              {new Date(access.challenge_window_ends_at).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
        </div>
      )}

      {/* Provisional bootstrap — feature list */}
      {status === 'provisional_bootstrap' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-medium text-amber-800 mb-2">Available with limited access:</p>
          <ul className="text-sm text-amber-700 space-y-1">
            <li className="flex items-center gap-2"><span>&#10003;</span> View and create tasks</li>
            <li className="flex items-center gap-2"><span>&#10003;</span> View calendar</li>
          </ul>
          <p className="text-xs text-amber-600 mt-3">Verify your address to unlock all features.</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {/* Enter postcard code */}
        {status === 'pending_postcard' && (
          <>
            <ActionButton
              label="Enter verification code"
              description="Enter the code from your postcard"
              icon="&#128273;"
              onClick={() => router.push(`/app/homes/${homeId}/verify-postcard`)}
            />
            <ActionButton
              label="Resend code"
              description="Request a new code by mail"
              icon="&#128231;"
              onClick={handleResendPostcard}
              loading={actionLoading === 'resend'}
            />
          </>
        )}

        {/* Upload documents — show when under review, needs more info, or rejected (so they can try again) */}
        {(status === 'provisional_bootstrap' || status === 'pending_doc' || status === 'provisional' || effectiveStatus === 'claim_rejected' || effectiveStatus === 'claim_needs_more_info') && (
          <ActionButton
            label="Upload proof"
            description={effectiveStatus === 'claim_rejected' ? 'Upload new or additional documentation if you believe this was an error.' : 'Speed up verification with a document'}
            icon="&#128228;"
            onClick={() => router.push(`/app/homes/${homeId}/claim-owner/evidence`)}
          />
        )}

        {/* Request mailed code */}
        {status === 'provisional_bootstrap' && (
          <ActionButton
            label="Mail me a code"
            description="Receive a verification code at this address"
            icon="&#128235;"
            onClick={() => router.push(`/app/homes/${homeId}/verify-postcard`)}
          />
        )}

        {/* Verify by mail (for statuses that allow it, including rejected/needs_more_info) */}
        {(status === 'provisional' || status === 'pending_doc' || effectiveStatus === 'claim_rejected' || effectiveStatus === 'claim_needs_more_info') && (
          <ActionButton
            label="Verify with mailed code"
            description="Receive a code at this address"
            icon="&#128235;"
            onClick={() => router.push(`/app/homes/${homeId}/verify-postcard`)}
          />
        )}
      </div>

      {/* Always-visible actions */}
      <div className="mt-8 space-y-2">
        <button
          onClick={handleMoveOut}
          disabled={actionLoading === 'move-out'}
          className="w-full flex items-center justify-center gap-2 py-3 text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
        >
          {actionLoading === 'move-out' ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full" />
          ) : (
            <span>&#128682;</span>
          )}
          This isn&apos;t my home / I made a mistake
        </button>

        <button
          onClick={() => router.push(`/app/homes/${homeId}/messages`)}
          className="w-full flex items-center justify-center gap-2 py-3 text-app-text-secondary hover:text-app-text text-sm font-medium"
        >
          <span>&#128172;</span>
          Message household admin
        </button>

        <button
          onClick={() => window.open('mailto:help@pantopus.com?subject=Verification%20Help', '_blank')}
          className="w-full flex items-center justify-center gap-2 py-2 text-app-text-muted hover:text-app-text-secondary text-xs"
        >
          Request help
        </button>
      </div>

      {/* Refresh hint */}
      <p className="text-center text-xs text-app-text-muted mt-8">
        <button onClick={reload} className="underline hover:text-app-text-secondary">
          Check for updates
        </button>
      </p>
    </div>
  );
}

// ============================================================
// Action button
// ============================================================

function ActionButton({
  label,
  description,
  icon,
  onClick,
  loading = false,
}: {
  label: string;
  description: string;
  icon: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4 text-left hover:border-app-border hover:shadow-sm transition-all disabled:opacity-50"
    >
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-app-text">{label}</p>
        <p className="text-xs text-app-text-secondary mt-0.5">{description}</p>
      </div>
      {loading ? (
        <span className="animate-spin inline-block w-4 h-4 border-2 border-app-border border-t-gray-600 rounded-full flex-shrink-0" />
      ) : (
        <span className="text-app-text-muted flex-shrink-0">&#8250;</span>
      )}
    </button>
  );
}

// ============================================================
// Status configuration
// ============================================================

interface StatusConfig {
  icon: string;
  iconBg: string;
  title: string;
  body: string;
}

function getStatusConfig(
  status: string,
  access: { is_in_challenge_window?: boolean } | null,
): StatusConfig {
  switch (status) {
    case 'claim_rejected':
      return {
        icon: '\uD83D\uDEAB',
        iconBg: 'bg-red-100 dark:bg-red-900/30',
        title: 'Your ownership claim was rejected',
        body: 'You can upload new or additional proof if you believe this was an error, or request help below.',
      };
    case 'claim_needs_more_info':
      return {
        icon: '\uD83D\uDCC4',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        title: 'More information needed',
        body: 'Our team needs additional documentation. Please upload proof or use the options below.',
      };
    case 'pending_postcard':
      return {
        icon: '\u2709\uFE0F',
        iconBg: 'bg-blue-100',
        title: 'Check your mailbox',
        body: 'A verification code is being mailed to your address. Expected arrival: 3-7 business days.',
      };
    case 'provisional_bootstrap':
      return {
        icon: '\uD83D\uDEE1\uFE0F',
        iconBg: 'bg-amber-100',
        title: 'You have limited access',
        body: 'Verify your address to unlock all home management features.',
      };
    case 'pending_approval':
      return {
        icon: '\u23F3',
        iconBg: 'bg-blue-100',
        title: 'Waiting for approval',
        body: 'A household member needs to approve your request. This page will update automatically.',
      };
    case 'pending_doc':
      return {
        icon: '\uD83D\uDCC4',
        iconBg: 'bg-amber-100',
        title: 'Your document is under review',
        body: 'Usually reviewed within 24 hours. We\u2019ll notify you when it\u2019s complete.',
      };
    case 'provisional':
      if (access?.is_in_challenge_window) {
        return {
          icon: '\u23F1\uFE0F',
          iconBg: 'bg-blue-100',
          title: 'Your access is being confirmed',
          body: 'Existing members have a window to review your access. Full features unlock when the window closes.',
        };
      }
      return {
        icon: '\uD83D\uDEE1\uFE0F',
        iconBg: 'bg-amber-100',
        title: 'Provisional access',
        body: 'Verify your address to unlock full home management features.',
      };
    case 'suspended_challenged':
      return {
        icon: '\u26A0\uFE0F',
        iconBg: 'bg-red-100',
        title: 'Access suspended',
        body: 'Your access has been challenged by a household member. Contact support if you believe this is an error.',
      };
    default:
      return {
        icon: '\uD83D\uDD12',
        iconBg: 'bg-app-surface-sunken',
        title: 'Verification required',
        body: 'Complete verification to access this home.',
      };
  }
}
