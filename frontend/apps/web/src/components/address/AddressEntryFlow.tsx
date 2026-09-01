'use client';

/**
 * AddressEntryFlow — Orchestrator for the complete address entry & verification flow.
 *
 * Flow:
 *  1. User types in AddressSearch, selects a structured suggestion
 *  2. Structured address is sent to POST /api/v1/address/validate
 *  3. Loading spinner while validation runs
 *  4. Based on verdict.status, renders the appropriate screen:
 *     - OK                  → ConfirmAddress
 *     - MISSING_STREET_NUMBER → MissingStreetNumber (re-enter with street number)
 *     - MISSING_UNIT         → FixMissingUnit (unit chips + input)
 *     - MULTIPLE_MATCHES     → ChooseExactMatch (candidate list)
 *     - BUSINESS      → BusinessDetected (create biz / claim as home)
 *     - MIXED_USE     → MixedUseVerification (verification method picker)
 *     - UNDELIVERABLE → NotDeliverable (inline suggestions)
 *     - LOW_CONFIDENCE → LowConfidence (continue with warning)
 *     - SERVICE_ERROR → ServiceError (retry / save later)
 *     - CONFLICT      → AlreadyClaimed (join / owner / manager)
 */

import { useCallback } from 'react';
import type { AddressCandidate } from '@pantopus/api';
import { useAddressValidation } from '@/hooks/useAddressValidation';
import AddressSearch from './AddressSearch';
import ConfirmAddress from './ConfirmAddress';
import {
  FixMissingUnit,
  MissingStreetNumber,
  ChooseExactMatch,
  BusinessDetected,
  MixedUseVerification,
  NotDeliverable,
  LowConfidence,
  ServiceError,
} from './VerdictScreens';
import AlreadyClaimed from './AlreadyClaimed';

type StructuredAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
};

type ConfirmData = {
  addressId: string;
  normalized: { line1: string; line2?: string; city: string; state: string; zip: string; lat: number; lng: number };
  confidence: number;
};

type Props = {
  /** Called when the user confirms an OK address and is ready to proceed */
  onConfirm: (data: ConfirmData) => void;

  /** Called when a BUSINESS verdict offers "Create a Business Profile" */
  onCreateBusiness?: (data: ConfirmData) => void;

  /** Called when a BUSINESS verdict offers "This is my home" — triggers re-validation with residential flag */
  onClaimAsHome?: (data: ConfirmData) => void;

  /** Called when MIXED_USE user picks a verification method */
  onChooseVerification?: (method: 'landlord_invite' | 'mail_code' | 'doc_upload', data: ConfirmData) => void;

  /** Called when MISSING_UNIT user clicks "My home doesn't have a unit" */
  onSkipUnit?: (data: ConfirmData) => void;

  /** Called when SERVICE_ERROR user clicks "Save and finish later" */
  onSaveLater?: () => void;

  /** Called when CONFLICT user selects an action (request_join / claim_owner / claim_manager) */
  onConflictAction?: (action: 'request_join' | 'claim_owner' | 'claim_manager', message?: string) => void;
};

export default function AddressEntryFlow({
  onConfirm,
  onCreateBusiness,
  onClaimAsHome,
  onChooseVerification,
  onSkipUnit,
  onSaveLater,
  onConflictAction,
}: Props) {
  const validation = useAddressValidation();
  const {
    phase,
    verdict,
    status,
    addressId,
    error,
    input,
    validate,
    validateWithUnit,
    reset,
  } = validation;

  // ── Helpers to build ConfirmData from current state ──────
  const buildConfirmData = useCallback((): ConfirmData | null => {
    if (!verdict?.normalized || !addressId) return null;
    return {
      addressId,
      normalized: verdict.normalized,
      confidence: verdict.confidence,
    };
  }, [verdict, addressId]);

  // ── Handle address selection from autocomplete ─────────────
  const handleSelect = useCallback(
    async (addr: StructuredAddress) => {
      await validate(addr);
    },
    [validate],
  );

  // ── Handle "Continue" on ConfirmAddress (OK/LOW_CONFIDENCE) ──
  const handleConfirm = useCallback(() => {
    const data = buildConfirmData();
    if (data) onConfirm(data);
  }, [buildConfirmData, onConfirm]);

  // ── Handle unit submission for MISSING_UNIT ───────────────
  const handleUnitSubmit = useCallback(
    async (unit: string) => {
      if (!addressId) return;
      await validateWithUnit(addressId, unit);
    },
    [addressId, validateWithUnit],
  );

  // ── Handle "My home doesn't have a unit" ──────────────────
  const handleSkipUnit = useCallback(() => {
    if (!onSkipUnit) return;
    const data = buildConfirmData();
    if (data) onSkipUnit(data);
  }, [onSkipUnit, buildConfirmData]);

  // ── Handle retry for SERVICE_ERROR ────────────────────────
  const handleRetry = useCallback(() => {
    if (input) validate(input);
  }, [input, validate]);

  // ── Handle candidate selection for MULTIPLE_MATCHES ───────
  const handleCandidateSelect = useCallback(
    async (candidate: AddressCandidate) => {
      const addr = candidate.address;
      await validate({
        line1: addr.line1,
        line2: addr.line2,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
      });
    },
    [validate],
  );

  // ── Handle "Create a Business Profile" for BUSINESS ───────
  const handleCreateBusiness = useCallback(() => {
    if (!onCreateBusiness) return;
    const data = buildConfirmData();
    if (data) onCreateBusiness(data);
  }, [onCreateBusiness, buildConfirmData]);

  // ── Handle "This is my home" for BUSINESS ─────────────────
  const handleClaimAsHome = useCallback(() => {
    if (!onClaimAsHome) return;
    const data = buildConfirmData();
    if (data) onClaimAsHome(data);
  }, [onClaimAsHome, buildConfirmData]);

  // ── Handle verification method for MIXED_USE ──────────────
  const handleChooseMethod = useCallback(
    (method: 'landlord_invite' | 'mail_code' | 'doc_upload') => {
      if (!onChooseVerification) return;
      const data = buildConfirmData();
      if (data) onChooseVerification(method, data);
    },
    [onChooseVerification, buildConfirmData],
  );

  // ── Render ────────────────────────────────────────────────

  // Phase: idle — show search
  if (phase === 'idle') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-app-text mb-1">Enter your address</h2>
          <p className="text-sm text-app-text-secondary">
            Search and select your address. We&apos;ll verify it through multiple services.
          </p>
        </div>

        <AddressSearch onSelect={handleSelect} />

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Phase: validating — loading spinner
  if (phase === 'validating') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-10 h-10 border-3 border-app-border border-t-primary-500 rounded-full animate-spin" />
        <p className="text-sm text-app-text-secondary font-medium">Validating your address...</p>
        <p className="text-xs text-app-text-muted">Checking with Google, USPS, and local records</p>
      </div>
    );
  }

  // Phase: result — render based on verdict status
  if (!verdict || !status) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">Something went wrong. No verdict received.</p>
        <button
          type="button"
          onClick={reset}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          &larr; Try again
        </button>
      </div>
    );
  }

  switch (status) {
    case 'OK':
      return (
        <ConfirmAddress
          verdict={verdict}
          addressId={addressId}
          onContinue={handleConfirm}
          onBack={reset}
        />
      );

    case 'MISSING_STREET_NUMBER':
      return (
        <MissingStreetNumber
          verdict={verdict}
          onBack={reset}
        />
      );

    case 'MISSING_UNIT':
      return (
        <FixMissingUnit
          verdict={verdict}
          addressId={addressId}
          onSubmit={handleUnitSubmit}
          onSkipUnit={onSkipUnit ? handleSkipUnit : undefined}
          onBack={reset}
          loading={false}
          error={error}
        />
      );

    case 'MULTIPLE_MATCHES':
      return (
        <ChooseExactMatch
          verdict={verdict}
          onSelect={handleCandidateSelect}
          onBack={reset}
        />
      );

    case 'BUSINESS':
      return (
        <BusinessDetected
          verdict={verdict}
          onCreateBusiness={onCreateBusiness ? handleCreateBusiness : undefined}
          onClaimAsHome={onClaimAsHome ? handleClaimAsHome : undefined}
          onBack={reset}
        />
      );

    case 'MIXED_USE':
      return (
        <MixedUseVerification
          verdict={verdict}
          onChooseMethod={onChooseVerification ? handleChooseMethod : undefined}
          onContinue={handleConfirm}
          onBack={reset}
        />
      );

    case 'UNDELIVERABLE':
      return <NotDeliverable verdict={verdict} onBack={reset} />;

    case 'LOW_CONFIDENCE':
      return (
        <LowConfidence
          verdict={verdict}
          onContinue={handleConfirm}
          onBack={reset}
        />
      );

    case 'SERVICE_ERROR':
      return (
        <ServiceError
          verdict={verdict}
          onRetry={handleRetry}
          onSaveLater={onSaveLater}
          onBack={reset}
        />
      );

    case 'CONFLICT':
      return (
        <AlreadyClaimed
          verdict={verdict}
          onAction={onConflictAction}
          onBack={reset}
        />
      );

    default:
      return (
        <div className="space-y-4">
          <p className="text-sm text-app-text-secondary">
            Unexpected verdict: <code className="text-xs bg-app-surface-sunken px-1 py-0.5 rounded">{status}</code>
          </p>
          <button type="button" onClick={reset} className="text-sm text-primary-600 font-medium">
            &larr; Try again
          </button>
        </div>
      );
  }
}
