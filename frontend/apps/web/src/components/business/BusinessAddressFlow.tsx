'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { Store, Building2, Factory, Home, Truck, Mailbox } from 'lucide-react';
import dynamic from 'next/dynamic';
import * as api from '@pantopus/api';
import type {
  BusinessAddressVerdict,
  BusinessAddressDecisionStatus,
  LocationIntent,
} from '@pantopus/types';
import AddressAutocomplete from '@/components/AddressAutocomplete';

const MapPreview = dynamic(() => import('./MapPreview'), { ssr: false });

// ---- Flow state machine ----

type FlowState =
  | 'IDLE'
  | 'SEARCHING'
  | 'VALIDATING'
  | 'DECISION_RECEIVED'
  | 'COLLECTING_SUITE'
  | 'COLLECTING_INTENT'
  | 'CMRA_OPTIONS'
  | 'CONFLICT_OPTIONS'
  | 'CREATING'
  | 'DONE'
  | 'ERROR';

// ---- Intent options ----

const INTENT_OPTIONS: { value: LocationIntent; label: string; icon: ReactNode }[] = [
  { value: 'CUSTOMER_FACING', label: 'Customers visit this location', icon: <Store className="w-5 h-5" /> },
  { value: 'OFFICE_NOT_PUBLIC', label: 'Office / not open to public', icon: <Building2 className="w-5 h-5" /> },
  { value: 'WAREHOUSE', label: 'Warehouse / storage', icon: <Factory className="w-5 h-5" /> },
  { value: 'HOME_BASED_PRIVATE', label: 'I work from home', icon: <Home className="w-5 h-5" /> },
  { value: 'SERVICE_AREA_ONLY', label: 'I travel to customers', icon: <Truck className="w-5 h-5" /> },
  { value: 'MAILING_ONLY', label: 'Mailing address only', icon: <Mailbox className="w-5 h-5" /> },
];

// ---- Resolved address from autocomplete ----

type ResolvedAddress = {
  address: string;
  city: string;
  state: string;
  zipcode: string;
  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;
  verified: boolean;
  source: string;
};

// ---- Component ----

export default function BusinessAddressFlow({
  businessId,
  onComplete,
  onSkip,
}: {
  businessId: string;
  onComplete: (locationId: string, decision: BusinessAddressVerdict) => void;
  onSkip: () => void;
}) {
  const [flowState, setFlowState] = useState<FlowState>('IDLE');
  const [error, setError] = useState('');

  // Address fields
  const [addressText, setAddressText] = useState('');
  const [resolved, setResolved] = useState<ResolvedAddress | null>(null);
  const [suite, setSuite] = useState('');
  const [intent, setIntent] = useState<LocationIntent | null>(null);

  // Decision from API
  const [verdict, setVerdict] = useState<BusinessAddressVerdict | null>(null);

  // Already-created location (idempotency)
  const [createdLocationId, setCreatedLocationId] = useState<string | null>(null);

  // ---- Autocomplete handler ----

  const handleAddressSelected = useCallback((n: ResolvedAddress) => {
    setResolved(n);
    setVerdict(null);
    setFlowState('SEARCHING');
    setError('');
  }, []);

  // ---- Validate ----

  const handleValidate = async () => {
    if (!resolved) return;
    if (!intent) {
      setError('Please select what type of location this is.');
      return;
    }

    setFlowState('VALIDATING');
    setError('');
    try {
      const res = await api.businesses.validateBusinessAddress(businessId, {
        address: resolved.address,
        address2: suite.trim() || undefined,
        city: resolved.city,
        state: resolved.state || undefined,
        zipcode: resolved.zipcode || undefined,
        country: 'US',
        place_id: resolved.place_id || undefined,
        location_intent: intent,
      });
      setVerdict(res.verdict);
      routeDecision(res.verdict.decision.status);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Address validation failed');
    }
  };

  const routeDecision = (status: BusinessAddressDecisionStatus) => {
    switch (status) {
      case 'need_suite':
        setFlowState('COLLECTING_SUITE');
        break;
      case 'cmra_detected':
      case 'po_box':
        setFlowState('CMRA_OPTIONS');
        break;
      case 'conflict':
        setFlowState('CONFLICT_OPTIONS');
        break;
      case 'undeliverable':
      case 'low_confidence':
      case 'service_error':
      case 'place_mismatch':
      case 'mixed_use':
      case 'high_risk':
      case 'multiple_matches':
        setFlowState('DECISION_RECEIVED');
        break;
      default:
        // ok
        setFlowState('DECISION_RECEIVED');
    }
  };

  // ---- Create location ----

  const handleCreateLocation = async () => {
    if (!resolved || !intent) return;
    if (createdLocationId && verdict) {
      onComplete(createdLocationId, verdict);
      return;
    }

    setFlowState('CREATING');
    setError('');
    try {
      const res = await api.businesses.createLocationWithDecision(businessId, {
        label: 'Main',
        address: resolved.address,
        address2: suite.trim() || undefined,
        city: resolved.city,
        state: resolved.state || undefined,
        zipcode: resolved.zipcode || undefined,
        country: 'US',
        is_primary: true,
        location_type: verdict?.decision.business_location_type || undefined,
        is_customer_facing: intent === 'CUSTOMER_FACING',
        location_intent: intent,
      });
      const locId = res.location.id;
      setCreatedLocationId(locId);
      setFlowState('DONE');
      onComplete(locId, res.verdict);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create location');
      setFlowState('ERROR');
    }
  };

  // ---- Create mailing address then prompt for real location ----

  const handleUseMailing = async () => {
    if (!resolved) return;
    setFlowState('CREATING');
    setError('');
    try {
      await api.businesses.createMailingAddress(businessId, {
        address: resolved.address,
        address2: suite.trim() || undefined,
        city: resolved.city,
        state: resolved.state || undefined,
        zipcode: resolved.zipcode || undefined,
        country: 'US',
      });
      // Reset flow so user can add a real location or skip
      resetFlow();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save mailing address');
      setFlowState('ERROR');
    }
  };

  // ---- Create service-area-only location ----

  const handleUseServiceArea = async () => {
    if (!resolved || !intent) return;
    setFlowState('CREATING');
    setError('');
    try {
      const res = await api.businesses.createLocationWithDecision(businessId, {
        label: 'Service Area',
        address: resolved.address,
        address2: suite.trim() || undefined,
        city: resolved.city,
        state: resolved.state || undefined,
        zipcode: resolved.zipcode || undefined,
        country: 'US',
        is_primary: true,
        location_type: 'service_area_only',
        is_customer_facing: false,
        location_intent: 'SERVICE_AREA_ONLY',
        service_area: {
          radius_miles: 25,
          center_lat: resolved.latitude ?? 0,
          center_lng: resolved.longitude ?? 0,
        },
      });
      const locId = res.location.id;
      setCreatedLocationId(locId);
      setFlowState('DONE');
      onComplete(locId, res.verdict);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create service area');
      setFlowState('ERROR');
    }
  };

  // ---- Re-validate with suite ----

  const handleRevalidateWithSuite = async () => {
    if (!resolved || !intent || !suite.trim()) return;
    setFlowState('VALIDATING');
    setError('');
    try {
      const res = await api.businesses.validateBusinessAddress(businessId, {
        address: resolved.address,
        address2: suite.trim(),
        city: resolved.city,
        state: resolved.state || undefined,
        zipcode: resolved.zipcode || undefined,
        country: 'US',
        place_id: resolved.place_id || undefined,
        location_intent: intent,
      });
      setVerdict(res.verdict);
      routeDecision(res.verdict.decision.status);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Address validation failed');
      setFlowState('ERROR');
    }
  };

  // ---- Reset ----

  const resetFlow = () => {
    setFlowState('IDLE');
    setAddressText('');
    setResolved(null);
    setSuite('');
    setVerdict(null);
    setError('');
  };

  // ---- Already created ----

  if (createdLocationId && flowState === 'DONE') {
    return (
      <div className="space-y-4" data-testid="address-flow-done">
        <DecisionCard accent="green" title="Location saved">
          <p className="text-sm text-app-text-secondary">
            Your business location has been created. You can update it later from your dashboard.
          </p>
        </DecisionCard>
      </div>
    );
  }

  // ---- Render ----

  return (
    <div className="space-y-5" data-testid="address-flow">
      {/* Skip checkbox */}
      <label className="inline-flex items-center gap-2 text-sm text-app-text-strong" data-testid="address-flow-skip">
        <input type="checkbox" onChange={(e) => { if (e.target.checked) onSkip(); }} />
        Skip for now
      </label>

      {/* Address search */}
      <div data-testid="address-flow-search">
        <label className="block text-sm font-medium text-app-text-strong mb-1">Business address</label>
        <AddressAutocomplete
          value={addressText}
          onChange={setAddressText}
          onSelectNormalized={handleAddressSelected}
          placeholder="Start typing an address…"
        />
      </div>

      {/* Suite / Unit */}
      <div data-testid="address-flow-suite">
        <label className="block text-sm font-medium text-app-text-strong mb-1">
          Suite / Unit <span className="text-app-text-muted font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={suite}
          onChange={(e) => setSuite(e.target.value)}
          placeholder="Apt 4B, Suite 200, etc."
          className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          data-testid="address-flow-suite-input"
        />
      </div>

      {/* Intent selector */}
      <div data-testid="address-flow-intent">
        <label className="block text-sm font-medium text-app-text-strong mb-2">What type of location is this?</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {INTENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setIntent(opt.value)}
              data-testid={`intent-${opt.value}`}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition ${
                intent === opt.value
                  ? 'border-violet-600 bg-violet-50 text-violet-900 ring-1 ring-violet-600'
                  : 'border-app-border bg-app-surface text-app-text-strong hover:border-app-border'
              }`}
            >
              <span className="shrink-0">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Verify button */}
      {resolved && intent && flowState !== 'VALIDATING' && flowState !== 'DECISION_RECEIVED' && flowState !== 'COLLECTING_SUITE' && flowState !== 'CMRA_OPTIONS' && flowState !== 'CONFLICT_OPTIONS' && flowState !== 'CREATING' && (
        <button
          type="button"
          onClick={handleValidate}
          data-testid="address-flow-verify"
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
        >
          Verify Address
        </button>
      )}

      {/* Loading state */}
      {(flowState === 'VALIDATING' || flowState === 'CREATING') && (
        <div className="flex items-center gap-2 text-sm text-app-text-secondary" data-testid="address-flow-loading">
          <Spinner />
          {flowState === 'VALIDATING' ? 'Verifying address…' : 'Saving location…'}
        </div>
      )}

      {/* ---- Decision UIs ---- */}

      {/* OK */}
      {flowState === 'DECISION_RECEIVED' && verdict?.decision.status === 'ok' && (
        <DecisionCard accent="green" title="Address verified" testId="decision-ok">
          <NormalizedAddressBlock verdict={verdict} />
          {verdict.coordinates && (
            <MapPreview lat={verdict.coordinates.lat} lng={verdict.coordinates.lng} className="h-40 mt-3" />
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-block rounded-full bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5">
              {verdict.decision.business_location_type}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCreateLocation}
            data-testid="address-flow-confirm"
            className="mt-3 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
          >
            Confirm &amp; Save Location
          </button>
        </DecisionCard>
      )}

      {/* NEED_SUITE */}
      {flowState === 'COLLECTING_SUITE' && verdict && (
        <DecisionCard accent="amber" title="Add Suite / Unit" testId="decision-need-suite">
          <p className="text-sm text-app-text-secondary">
            This looks like a multi-tenant building. Add your suite so customers and deliveries find you.
          </p>
          <input
            type="text"
            value={suite}
            onChange={(e) => setSuite(e.target.value)}
            autoFocus
            placeholder="Suite 200, Unit B, etc."
            className="mt-2 w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            data-testid="suite-prompt-input"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={handleRevalidateWithSuite}
              disabled={!suite.trim()}
              data-testid="suite-prompt-confirm"
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              Confirm Suite
            </button>
            <button
              type="button"
              onClick={resetFlow}
              data-testid="suite-prompt-edit"
              className="text-sm text-app-text-secondary hover:text-app-text-strong underline"
            >
              This business doesn&apos;t have a suite
            </button>
          </div>
        </DecisionCard>
      )}

      {/* CMRA_DETECTED / PO_BOX */}
      {flowState === 'CMRA_OPTIONS' && verdict && (
        <DecisionCard
          accent="blue"
          title={verdict.decision.status === 'po_box' ? "PO Boxes can't be public locations" : 'This looks like a mail service address'}
          testId="decision-cmra"
        >
          <p className="text-sm text-app-text-secondary">
            {verdict.decision.status === 'po_box'
              ? 'You can use this as a mailing address. Add a physical location or service area to be discoverable.'
              : "It can be used for your mailing address, but it won't show as a public business location on the map."}
          </p>
          <div className="mt-3 space-y-2">
            <OptionCard
              label="Use as Mailing Address"
              description="Save this for receiving mail, then add a real location or service area."
              recommended
              onClick={handleUseMailing}
              testId="cmra-use-mailing"
            />
            <OptionCard
              label="Add a Physical Location"
              description="Start over with a different address."
              onClick={resetFlow}
              testId="cmra-add-physical"
            />
            <OptionCard
              label="Use Service Area Only"
              description="Define a service radius instead of showing a physical pin."
              onClick={handleUseServiceArea}
              testId="cmra-service-area"
            />
          </div>
        </DecisionCard>
      )}

      {/* PLACE_MISMATCH / MIXED_USE / HIGH_RISK */}
      {flowState === 'DECISION_RECEIVED' && verdict && ['place_mismatch', 'mixed_use', 'high_risk'].includes(verdict.decision.status) && (
        <DecisionCard accent="amber" title="Double-check this location" testId="decision-warning">
          <p className="text-sm text-app-text-secondary">
            This address looks like a <strong>{verdict.decision.business_location_type}</strong> location, but you selected <strong>{intent}</strong>.
          </p>
          <div className="mt-3 space-y-2">
            <OptionCard
              label="Pick a different place"
              description="Start the address search over."
              onClick={resetFlow}
              testId="warning-reset"
            />
            <OptionCard
              label="Continue with extra verification"
              description={`Additional verification will be required: ${(verdict.decision.required_verification || []).join(', ') || 'photo or document upload'}.`}
              onClick={handleCreateLocation}
              testId="warning-continue"
            />
            <OptionCard
              label="Switch to Service Area Only"
              description="Define a service radius instead."
              onClick={handleUseServiceArea}
              testId="warning-service-area"
            />
          </div>
        </DecisionCard>
      )}

      {/* CONFLICT */}
      {flowState === 'CONFLICT_OPTIONS' && verdict && (
        <DecisionCard accent="red" title="This location is already managed on Pantopus" testId="decision-conflict">
          <p className="text-sm text-app-text-secondary">
            If you represent this business here, request access or verify ownership.
          </p>
          <div className="mt-3 space-y-2">
            <OptionCard
              label="Request access"
              description="Ask the current manager for team access."
              recommended
              onClick={() => {
                // Placeholder — show coming-soon toast
                setError('Ownership request coming soon. Please use a different address for now.');
              }}
              testId="conflict-request"
            />
            <OptionCard
              label="Use a different address"
              description="Start over with another address."
              onClick={resetFlow}
              testId="conflict-reset"
            />
            <OptionCard
              label="Create at same address with different suite"
              description="If you're in a different unit at this building."
              onClick={() => {
                setSuite('');
                setFlowState('COLLECTING_SUITE');
              }}
              testId="conflict-suite"
            />
          </div>
        </DecisionCard>
      )}

      {/* UNDELIVERABLE */}
      {flowState === 'DECISION_RECEIVED' && verdict?.decision.status === 'undeliverable' && (
        <DecisionCard accent="red" title="We couldn't verify this address" testId="decision-undeliverable">
          <p className="text-sm text-app-text-secondary">
            It may be missing details or formatted differently.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={resetFlow}
              data-testid="undeliverable-edit"
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
            >
              Edit address
            </button>
            <button
              type="button"
              onClick={() => setError("Manual review coming soon. Please try a different format.")}
              data-testid="undeliverable-new-building"
              className="text-sm text-app-text-secondary hover:text-app-text-strong underline"
            >
              I&apos;m in a new building
            </button>
          </div>
        </DecisionCard>
      )}

      {/* LOW_CONFIDENCE */}
      {flowState === 'DECISION_RECEIVED' && verdict?.decision.status === 'low_confidence' && (
        <DecisionCard accent="amber" title="We need a more exact address" testId="decision-low-confidence">
          <p className="text-sm text-app-text-secondary">
            We found the general area but not the exact location.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={resetFlow}
              data-testid="low-confidence-edit"
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
            >
              Edit address
            </button>
            {intent !== 'MAILING_ONLY' && (
              <button
                type="button"
                onClick={handleUseServiceArea}
                data-testid="low-confidence-service-area"
                className="text-sm text-violet-600 hover:text-violet-800 underline"
              >
                Use Service Area Only
              </button>
            )}
          </div>
        </DecisionCard>
      )}

      {/* SERVICE_ERROR */}
      {flowState === 'DECISION_RECEIVED' && verdict?.decision.status === 'service_error' && (
        <DecisionCard accent="gray" title="Verification temporarily unavailable" testId="decision-service-error">
          <p className="text-sm text-app-text-secondary">
            Our verification service is having trouble. Please try again.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={handleValidate}
              data-testid="service-error-retry"
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onSkip}
              data-testid="service-error-skip"
              className="text-sm text-app-text-secondary hover:text-app-text-strong underline"
            >
              Save and finish later
            </button>
          </div>
        </DecisionCard>
      )}

      {/* MULTIPLE_MATCHES — treat like ok, let user confirm */}
      {flowState === 'DECISION_RECEIVED' && verdict?.decision.status === 'multiple_matches' && (
        <DecisionCard accent="amber" title="Multiple matches found" testId="decision-multiple">
          <p className="text-sm text-app-text-secondary">
            We found several possible addresses. Please confirm the correct one or edit your input.
          </p>
          <NormalizedAddressBlock verdict={verdict} />
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={handleCreateLocation}
              data-testid="multiple-confirm"
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
            >
              This is correct
            </button>
            <button
              type="button"
              onClick={resetFlow}
              data-testid="multiple-edit"
              className="text-sm text-app-text-secondary hover:text-app-text-strong underline"
            >
              Edit address
            </button>
          </div>
        </DecisionCard>
      )}

      {/* Error */}
      {flowState === 'ERROR' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="address-flow-error">
          {error || 'Something went wrong.'}
          <button type="button" onClick={handleValidate} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Inline error for validation messages */}
      {error && flowState !== 'ERROR' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="address-flow-inline-error">
          {error}
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function DecisionCard({
  accent,
  title,
  testId,
  children,
}: {
  accent: 'green' | 'amber' | 'red' | 'blue' | 'gray';
  title: string;
  testId?: string;
  children: React.ReactNode;
}) {
  const borderMap = {
    green: 'border-l-green-500',
    amber: 'border-l-amber-500',
    red: 'border-l-red-500',
    blue: 'border-l-blue-500',
    gray: 'border-l-gray-400',
  };
  return (
    <div
      className={`rounded-lg border border-app-border border-l-4 ${borderMap[accent]} bg-app-surface p-4 transition-all`}
      data-testid={testId}
    >
      <h3 className="text-sm font-semibold text-app-text mb-1">{title}</h3>
      {children}
    </div>
  );
}

function OptionCard({
  label,
  description,
  recommended,
  onClick,
  testId,
}: {
  label: string;
  description: string;
  recommended?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="w-full text-left rounded-lg border border-app-border hover:border-violet-300 px-3 py-2.5 transition"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-app-text">{label}</span>
        {recommended && (
          <span className="text-xs bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 font-medium">
            Recommended
          </span>
        )}
      </div>
      <p className="text-xs text-app-text-secondary mt-0.5">{description}</p>
    </button>
  );
}

function NormalizedAddressBlock({ verdict }: { verdict: BusinessAddressVerdict }) {
  const n = verdict.normalized;
  return (
    <div className="mt-2 rounded-md bg-app-surface-raised px-3 py-2 text-sm text-app-text" data-testid="normalized-address">
      <div>{n.line1}</div>
      {n.line2 && <div>{n.line2}</div>}
      <div>{n.city}, {n.state} {n.zip}{n.plus4 ? `-${n.plus4}` : ''}</div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-violet-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
