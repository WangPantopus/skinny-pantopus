'use client';

/**
 * Test fixture page for address verification E2E tests.
 *
 * Mounts AddressEntryFlow and optionally MailVerificationFlow so
 * Playwright can exercise the complete address verification pipeline
 * without requiring a real backend.
 *
 * Routes: /app/address-verify
 */

import { useState } from 'react';
import type { AddressClaim, NormalizedAddress } from '@pantopus/api';
import AddressEntryFlow from '@/components/address/AddressEntryFlow';
import MailVerificationFlow from '@/components/address/MailVerificationFlow';

type FlowState =
  | { step: 'address' }
  | { step: 'mail-verify'; addressId: string; normalized: NormalizedAddress }
  | { step: 'confirmed'; addressId: string; normalized: NormalizedAddress; confidence: number }
  | { step: 'business-redirect' }
  | { step: 'conflict-pending' }
  | { step: 'household-created'; claim: AddressClaim | null };

export default function AddressVerifyPage() {
  const [flow, setFlow] = useState<FlowState>({ step: 'address' });

  // ── Address confirmed → proceed to home setup ──────────
  const handleConfirm = (data: { addressId: string; normalized: NormalizedAddress; confidence: number }) => {
    setFlow({ step: 'confirmed', ...data });
  };

  // ── Business redirect → business onboarding ───────────
  const handleCreateBusiness = () => {
    setFlow({ step: 'business-redirect' });
  };

  // ── Mail verification chosen ──────────────────────────
  const handleChooseVerification = (
    method: 'landlord_invite' | 'mail_code' | 'doc_upload',
    data: { addressId: string; normalized: NormalizedAddress },
  ) => {
    if (method === 'mail_code') {
      setFlow({ step: 'mail-verify', addressId: data.addressId, normalized: data.normalized });
    }
  };

  // ── Conflict action ───────────────────────────────────
  const handleConflictAction = (action: 'request_join' | 'claim_owner' | 'claim_manager') => {
    if (action === 'request_join') {
      setFlow({ step: 'conflict-pending' });
    }
  };

  // ── Mail verification success ─────────────────────────
  const handleVerified = (claim: AddressClaim | null) => {
    setFlow({ step: 'household-created', claim });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-app-text mb-6" data-testid="page-title">
        Address Verification
      </h1>

      {flow.step === 'address' && (
        <AddressEntryFlow
          onConfirm={handleConfirm}
          onCreateBusiness={handleCreateBusiness}
          onClaimAsHome={() => {}}
          onChooseVerification={handleChooseVerification}
          onSkipUnit={(data) => handleConfirm({ ...data, confidence: data.confidence })}
          onSaveLater={() => {}}
          onConflictAction={handleConflictAction}
        />
      )}

      {flow.step === 'mail-verify' && (
        <MailVerificationFlow
          addressId={flow.addressId}
          normalized={flow.normalized}
          onVerified={handleVerified}
          onSwitchToLandlord={() => {}}
          onSwitchMethod={() => {}}
          onBack={() => setFlow({ step: 'address' })}
        />
      )}

      {flow.step === 'confirmed' && (
        <div data-testid="home-setup-screen">
          <h2 className="text-xl font-semibold text-app-text mb-2">Set up your home</h2>
          <p className="text-sm text-app-text-secondary mb-4">
            Your address has been verified. Continue setting up your home.
          </p>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="font-medium text-emerald-800">
              {flow.normalized.line1}, {flow.normalized.city}, {flow.normalized.state} {flow.normalized.zip}
            </p>
            <p className="text-sm text-emerald-600 mt-1">
              Confidence: {Math.round(flow.confidence * 100)}%
            </p>
          </div>
        </div>
      )}

      {flow.step === 'business-redirect' && (
        <div data-testid="business-onboarding-screen">
          <h2 className="text-xl font-semibold text-app-text mb-2">Create your business</h2>
          <p className="text-sm text-app-text-secondary">
            You&apos;re being redirected to business onboarding.
          </p>
        </div>
      )}

      {flow.step === 'conflict-pending' && (
        <div data-testid="conflict-pending-screen">
          <h2 className="text-xl font-semibold text-app-text mb-2">Request pending</h2>
          <p className="text-sm text-app-text-secondary">
            Your request to join has been sent. You&apos;ll be notified when the household responds.
          </p>
        </div>
      )}

      {flow.step === 'household-created' && (
        <div data-testid="household-created-screen">
          <h2 className="text-xl font-semibold text-emerald-800 mb-2">Household created!</h2>
          <p className="text-sm text-app-text-secondary">
            Your address has been verified and your household is now set up.
          </p>
        </div>
      )}
    </div>
  );
}
