'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type {
  AddressCheckResult,
  AttomPropertyDetailPayload,
  NormalizedAddress as VerifiedNormalizedAddress,
  ValidateAddressResponse,
} from '@pantopus/api';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import MailVerificationFlow from '@/components/address/MailVerificationFlow';
import PrivacyPromise from '@/components/place/PrivacyPromise';
import AttomStructuredFields from '@/components/homes/AttomStructuredFields';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type NormalizedAddress = {
  address: string;
  city: string;
  state: string;
  zipcode: string;
  zip_code?: string;
  latitude: number;
  longitude: number;
  label?: string;
};

type AutocompleteNormalizedAddress = {
  address: string;
  city: string;
  state: string;
  zipcode: string;
  zip_code?: string;
  latitude?: number | null;
  longitude?: number | null;
  label?: string;
  verified: boolean;
  source: string;
};

type AddressStepUpRequirement = {
  addressId: string;
  reason: string | null;
};

function buildAddressLabel(address: string, city: string, state: string, zipcode: string, unit?: string) {
  const cityStateZip = [city, [state, zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [address, unit, cityStateZip].filter(Boolean).join(', ');
}

function getApiErrorCode(error: unknown): string | null {
  const err = error as { code?: unknown; data?: { code?: unknown } };
  if (typeof err?.code === 'string') return err.code;
  if (typeof err?.data?.code === 'string') return err.data.code;
  return null;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as {
    message?: unknown;
    data?: { message?: unknown; error?: unknown };
  };

  if (typeof err?.data?.message === 'string' && err.data.message.trim()) return err.data.message;
  if (typeof err?.data?.error === 'string' && err.data.error.trim()) return err.data.error;
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return fallback;
}

const HOME_TYPES = [
  { value: 'house', label: 'House', icon: '🏠' },
  { value: 'apartment', label: 'Apartment', icon: '🏢' },
  { value: 'condo', label: 'Condo', icon: '🏬' },
  { value: 'townhouse', label: 'Townhouse', icon: '🏘️' },
  { value: 'studio', label: 'Studio', icon: '🛏️' },
  { value: 'rv', label: 'RV', icon: '🚐' },
  { value: 'mobile_home', label: 'Mobile Home', icon: '🏡' },
  { value: 'trailer', label: 'Trailer', icon: '🏕️' },
  { value: 'multi_unit', label: 'Multi-Unit', icon: '🏗️' },
  { value: 'other', label: 'Other', icon: '📍' },
];

const AMENITIES_OPTIONS = [
  { key: 'washer_dryer', label: 'Washer / Dryer', icon: '🧺' },
  { key: 'dishwasher', label: 'Dishwasher', icon: '🍽️' },
  { key: 'garage', label: 'Garage', icon: '🚗' },
  { key: 'pool', label: 'Pool', icon: '🏊' },
  { key: 'yard', label: 'Yard', icon: '🌳' },
  { key: 'ac', label: 'A/C', icon: '❄️' },
  { key: 'fireplace', label: 'Fireplace', icon: '🔥' },
  { key: 'ev_charger', label: 'EV Charger', icon: '⚡' },
  { key: 'security_system', label: 'Security System', icon: '🔒' },
  { key: 'pet_friendly', label: 'Pet Friendly', icon: '🐾' },
  { key: 'basement', label: 'Basement', icon: '🏚️' },
  { key: 'attic', label: 'Attic', icon: '🏠' },
];

const STEPS = [
  { id: 1, label: 'Location', icon: '📍' },
  { id: 2, label: 'Details', icon: '🏠' },
  { id: 3, label: 'Setup', icon: '⚙️' },
  { id: 4, label: 'Review', icon: '✅' },
];

export default function NewHomePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // "My home doesn't have a unit number" — survives the revalidate it triggers,
  // resets with the address. Sent to the server as no_unit_attestation.
  const [noUnitAttested, setNoUnitAttested] = useState(false);

  // Step 1 — Location
  const [addressText, setAddressText] = useState('');
  const [normalized, setNormalized] = useState<NormalizedAddress | null>(null);
  const [unit, setUnit] = useState('');
  const [validatedAddressId, setValidatedAddressId] = useState<string | null>(null);
  const [addressCheckResult, setAddressCheckResult] = useState<AddressCheckResult | null>(null);
  const [existingHomeId, setExistingHomeId] = useState<string | null>(null);
  const [isClaimingExistingHome, setIsClaimingExistingHome] = useState(false);
  const [addressStepUpRequirement, setAddressStepUpRequirement] = useState<AddressStepUpRequirement | null>(null);

  // Step 2 — Home Details
  const [homeType, setHomeType] = useState<NonNullable<Parameters<typeof api.homes.createHome>[0]['home_type']>>('house');
  const [name, setName] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [sqft, setSqft] = useState('');
  const [lotSqft, setLotSqft] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [description, setDescription] = useState('');
  const [amenities, setAmenities] = useState<Record<string, boolean>>({});
  const [propertySuggestionNote, setPropertySuggestionNote] = useState('');
  const [attomPropertyDetail, setAttomPropertyDetail] = useState<AttomPropertyDetailPayload | null>(null);
  const [showAttomJson, setShowAttomJson] = useState(false);

  // Step 3 — Your Setup
  const [isOwner, setIsOwner] = useState(true);
  const [moveInDate, setMoveInDate] = useState('');
  const [wifiName, setWifiName] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [entryInstructions, setEntryInstructions] = useState('');
  const [parkingInstructions, setParkingInstructions] = useState('');

  // Parsers
  const parsedBedrooms = useMemo(() => {
    const n = parseInt(bedrooms, 10);
    return Number.isFinite(n) ? n : undefined;
  }, [bedrooms]);

  const parsedBathrooms = useMemo(() => {
    const n = parseFloat(bathrooms);
    return Number.isFinite(n) ? n : undefined;
  }, [bathrooms]);

  const parsedSqft = useMemo(() => {
    const n = parseInt(sqft, 10);
    return Number.isFinite(n) ? n : undefined;
  }, [sqft]);

  const parsedYearBuilt = useMemo(() => {
    const n = parseInt(yearBuilt, 10);
    return Number.isFinite(n) && n >= 1600 && n <= 2100 ? n : undefined;
  }, [yearBuilt]);

  const parsedLotSqft = useMemo(() => {
    const n = parseInt(lotSqft, 10);
    return Number.isFinite(n) ? n : undefined;
  }, [lotSqft]);

  const attomJsonPreview = useMemo(() => {
    if (!attomPropertyDetail) return '';
    if (attomPropertyDetail.full_response != null) {
      return JSON.stringify(attomPropertyDetail.full_response, null, 2);
    }
    return JSON.stringify(attomPropertyDetail, null, 2);
  }, [attomPropertyDetail]);

  const resetAddressValidation = () => {
    setValidatedAddressId(null);
    setNoUnitAttested(false);
    setAddressCheckResult(null);
    setExistingHomeId(null);
    setIsClaimingExistingHome(false);
    setAddressStepUpRequirement(null);
    setAttomPropertyDetail(null);
    setLotSqft('');
  };

  // Geolocation
  const useCurrent = async () => {
    if (!navigator.geolocation) { setError('Geolocation is not supported in this browser.'); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const res = await fetch(`${API_BASE}/api/geo/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` }
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const n = data?.normalized;
        if (!n?.address) throw new Error('Could not resolve address');
        resetAddressValidation();
        setNormalized({ address: n.address, city: n.city, state: n.state, zipcode: n.zipcode || n.zip_code, latitude: n.latitude, longitude: n.longitude, label: n.label });
        setAddressText(n.label || n.address);
        setFieldErrors((prev) => {
          if (!prev.location) return prev;
          const next = { ...prev };
          delete next.location;
          return next;
        });
      } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to reverse geocode current location.'); }
    }, (err) => { setError(err?.message || 'Failed to get location.'); }, { enableHighAccuracy: true, timeout: 12000 });
  };

  const onSelectNormalized = (n: AutocompleteNormalizedAddress | null) => {
    resetAddressValidation();
    const zipcode = n?.zipcode || n?.zip_code;
    if (!n?.address || !zipcode || n?.latitude == null || n?.longitude == null) { setNormalized(null); return; }
    setNormalized({ address: n.address, city: n.city, state: n.state, zipcode, latitude: n.latitude, longitude: n.longitude, label: n.label || n.address });
    setFieldErrors((prev) => {
      if (!prev.location) return prev;
      const next = { ...prev };
      delete next.location;
      return next;
    });
  };

  const toggleAmenity = (key: string) => {
    setAmenities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getVerifiedNormalizedAddress = (): VerifiedNormalizedAddress | undefined => {
    if (!normalized) return undefined;

    return {
      line1: normalized.address,
      line2: unit.trim() || undefined,
      city: normalized.city,
      state: normalized.state,
      zip: normalized.zipcode,
      lat: normalized.latitude,
      lng: normalized.longitude,
    };
  };

  const buildCreateHomePayload = (): Parameters<typeof api.homes.createHome>[0] | null => {
    if (!normalized || !validatedAddressId) return null;

    return {
      address_id: validatedAddressId || undefined,
      address: normalized.address,
      unit_number: unit.trim() || undefined,
      no_unit_attestation: noUnitAttested || undefined,
      city: normalized.city,
      state: normalized.state,
      zip_code: normalized.zipcode,
      country: 'US',
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      name: name.trim() || undefined,
      home_type: homeType,
      bedrooms: parsedBedrooms,
      bathrooms: parsedBathrooms,
      sq_ft: parsedSqft,
      lot_sq_ft: parsedLotSqft,
      year_built: parsedYearBuilt,
      description: description.trim() || undefined,
      attom_property_detail: attomPropertyDetail || undefined,
      amenities: Object.fromEntries(Object.entries(amenities).filter(([, v]) => v)),
      is_owner: isOwner,
      move_in_date: moveInDate || undefined,
      entry_instructions: entryInstructions.trim() || undefined,
      parking_instructions: parkingInstructions.trim() || undefined,
      wifi_name: wifiName.trim() || undefined,
      wifi_password: wifiPassword.trim() || undefined,
    };
  };

  const handleCreateHomeSuccess = (res: Record<string, any> & { home?: { id?: string } }) => {
    const id = res?.home?.id;
    router.push(id ? `/app/homes/${id}/dashboard` : '/app/homes');
  };

  const handleCreateHomeError = (errorValue: unknown, options?: { fromStepUpFlow?: boolean }) => {
    const err = errorValue as {
      validationDetails?: Array<Record<string, string>>;
      data?: {
        address_id?: unknown;
        step_up_reason?: unknown;
      };
    };
    const code = getApiErrorCode(errorValue);

    if (code === 'ADDRESS_STEP_UP_REQUIRED') {
      const nextAddressId =
        typeof err?.data?.address_id === 'string'
          ? err.data.address_id
          : validatedAddressId;

      if (nextAddressId) {
        setAddressStepUpRequirement({
          addressId: nextAddressId,
          reason: typeof err?.data?.step_up_reason === 'string' ? err.data.step_up_reason : null,
        });
        setError('');
        return;
      }
    }

    if (options?.fromStepUpFlow) {
      setAddressStepUpRequirement(null);
    }

    const details = Array.isArray(err?.validationDetails) ? err.validationDetails : [];
    if (details.length > 0) {
      const nextFieldErrors: Record<string, string> = {};
      for (const d of details) {
        const raw = d?.field || '';
        const mapped = raw === 'zip_code' ? 'zipcode' : raw;
        if (mapped && d?.message && !nextFieldErrors[mapped]) {
          nextFieldErrors[mapped] = d.message;
        }
      }
      setFieldErrors(nextFieldErrors);
      setError('Please fix the highlighted fields.');
      if (nextFieldErrors.address || nextFieldErrors.city || nextFieldErrors.state || nextFieldErrors.zipcode || nextFieldErrors.location) {
        setStep(1);
      }
      return;
    }

    setError(getApiErrorMessage(errorValue, 'Failed to create home'));
  };

  const createHomeWithCurrentState = async () => {
    const payload = buildCreateHomePayload();
    if (!payload) {
      setFieldErrors({ address: 'Verify this address to continue.' });
      setError('Please fix the highlighted fields.');
      setStep(1);
      return;
    }

    const res = await api.homes.createHome(payload);
    handleCreateHomeSuccess(res as Record<string, any> & { home?: { id?: string } });
  };

  const handleAddressStepUpVerified = async () => {
    setLoading(true);
    try {
      await createHomeWithCurrentState();
    } catch (e: unknown) {
      handleCreateHomeError(e, { fromStepUpFlow: true });
    } finally {
      setLoading(false);
    }
  };

  const handleAddressStepUpBack = () => {
    setAddressStepUpRequirement(null);
    setError('');
    setStep(1);
  };

  const canProceedStep1 = !!normalized;
  const visibleSteps = isClaimingExistingHome ? STEPS.filter((s) => s.id !== 2) : STEPS;
  const totalSteps = visibleSteps.length;
  const displayStep = Math.max(1, visibleSteps.findIndex((s) => s.id === step) + 1);

  const verifyAddress = async (opts?: { attestNoUnit?: boolean }) => {
    if (!normalized) return false;
    const attestedNoUnit = opts?.attestNoUnit || noUnitAttested;
    if (opts?.attestNoUnit) setNoUnitAttested(true);

    setError('');
    setFieldErrors({});
    setValidatingAddress(true);

    try {
      let conflictFallbackResult: AddressCheckResult | null = null;
      const validation = await api.addressValidation.validateAddress({
        line1: normalized.address,
        line2: unit.trim() || undefined,
        city: normalized.city,
        state: normalized.state.trim().toUpperCase(),
        zip: normalized.zipcode,
      });

      const verdict = validation?.verdict;
      const resolved = verdict?.normalized;
      const resolvedUnit = resolved?.line2 || unit.trim();

      if (resolved) {
        const nextNormalized: NormalizedAddress = {
          address: resolved.line1,
          city: resolved.city,
          state: resolved.state,
          zipcode: resolved.zip,
          latitude: resolved.lat,
          longitude: resolved.lng,
          label: buildAddressLabel(resolved.line1, resolved.city, resolved.state, resolved.zip, resolved.line2),
        };
        setNormalized(nextNormalized);
        setAddressText(nextNormalized.label || nextNormalized.address);
        setUnit(resolved.line2 || '');
      }

      switch (verdict?.status) {
        case 'MISSING_UNIT':
          // USPS expects a secondary here — which is also what a basement,
          // rear, ADU or split-duplex address looks like. With the user's
          // explicit attestation the server accepts the base address, so fall
          // through to the success path instead of looping them forever.
          if (attestedNoUnit) break;
          setValidatedAddressId(null);
          setFieldErrors({ unit_number: 'This address needs a unit or apartment number.' });
          setError('Please fix the highlighted fields.');
          return false;
        case 'BUSINESS':
          setValidatedAddressId(null);
          setFieldErrors({ address: 'This looks like a business or office address, not a home.' });
          setError('Please fix the highlighted fields.');
          return false;
        case 'UNDELIVERABLE':
          setValidatedAddressId(null);
          setFieldErrors({ address: 'This address could not be verified as deliverable.' });
          setError('Please fix the highlighted fields.');
          return false;
        case 'LOW_CONFIDENCE':
          setValidatedAddressId(null);
          setFieldErrors({ address: 'We could not verify this address with enough confidence.' });
          setError('Please fix the highlighted fields.');
          return false;
        case 'MULTIPLE_MATCHES':
          setValidatedAddressId(null);
          setFieldErrors({ address: 'This address matched multiple locations. Please be more specific.' });
          setError('Please fix the highlighted fields.');
          return false;
        case 'CONFLICT': {
          const resolvedLine1 = resolved?.line1 || normalized.address;
          const resolvedLine2 = resolved?.line2 || unit.trim();
          const resolvedCity = resolved?.city || normalized.city;
          const resolvedState = resolved?.state || normalized.state.trim().toUpperCase();
          const resolvedZip = resolved?.zip || normalized.zipcode;

          conflictFallbackResult = {
            status: 'HOME_FOUND_CLAIMED',
            home_id: verdict.existing_household?.home_id,
            is_multi_unit:
              verdict.classification?.building_type === 'multi_unit' ||
              !!resolvedLine2,
            formatted_address: buildAddressLabel(
              resolvedLine1,
              resolvedCity,
              resolvedState,
              resolvedZip,
              resolvedLine2,
            ),
          };
          break;
        }
        case 'SERVICE_ERROR':
          setValidatedAddressId(null);
          setError('Address verification is temporarily unavailable. Please try again.');
          return false;
        case 'PO_BOX':
          setValidatedAddressId(null);
          setFieldErrors({
            address: 'A PO Box can’t be used as a home address. Please enter the street address where you live.',
          });
          setError('Please fix the highlighted fields.');
          return false;
        case 'MISSING_STREET_NUMBER':
          setValidatedAddressId(null);
          setFieldErrors({ address: 'This address is missing a street number.' });
          setError('Please fix the highlighted fields.');
          return false;
        case 'UNVERIFIED_STREET_NUMBER':
          setValidatedAddressId(null);
          setFieldErrors({
            address: 'We couldn’t confirm that street number on this street. Please double-check it.',
          });
          setError('Please fix the highlighted fields.');
          return false;
        case 'MIXED_USE':
          // Deliberately NOT refused here. The server allows MIXED_USE
          // (ALLOWED_HOME_VERDICT_STATUSES in routes/home.js) and, when
          // enforceMixedUseStepUp is on, answers createHome with
          // ADDRESS_STEP_UP_REQUIRED — which handleCreateHomeError already
          // routes into MailVerificationFlow below. Blocking it at step 1
          // made both outcomes unreachable and left every resident of a
          // flat-over-a-shop with an error naming a step the UI never offered.
          // The server is the authority on this verdict.
          break;
        case 'OK':
          break;
        default:
          // SCN-12: previously `default: break`, so any status the client did
          // not recognise — PO_BOX, MISSING_STREET_NUMBER,
          // UNVERIFIED_STREET_NUMBER and MIXED_USE among them — fell through
          // and the home was created as though the address had passed. An
          // unrecognised verdict is a refusal, not a pass: the server knows
          // something the client does not.
          setValidatedAddressId(null);
          setError('We couldn’t verify this address. Please check it and try again.');
          return false;
      }

      if (!validation?.address_id) {
        setValidatedAddressId(null);
        setError('We could not save the verified address. Please try again.');
        return false;
      }

      setValidatedAddressId(validation.address_id);
      const resolvedLine1 = resolved?.line1 || normalized.address;
      const resolvedCity = resolved?.city || normalized.city;
      const resolvedState = resolved?.state || normalized.state.trim().toUpperCase();
      const resolvedZip = resolved?.zip || normalized.zipcode;

      if (resolvedUnit && fieldErrors.unit_number) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.unit_number;
          return next;
        });
      }

      const result = await api.homes.checkAddress({
        address_id: validation.address_id || undefined,
        address: resolvedLine1,
        unit_number: resolvedUnit || undefined,
        city: resolvedCity,
        state: resolvedState,
        zip_code: resolvedZip,
      });
      const resolvedResult =
        result.status === 'HOME_FOUND_CLAIMED' || !conflictFallbackResult
          ? result
          : conflictFallbackResult;

      setAddressCheckResult(resolvedResult);
      setExistingHomeId(resolvedResult.home_id || conflictFallbackResult?.home_id || null);

      if (resolvedResult.is_multi_unit && !resolvedUnit && !attestedNoUnit) {
        setFieldErrors({ unit_number: 'This address needs a unit or apartment number.' });
        setError('Please fix the highlighted fields.');
        return false;
      }

      if (resolvedResult.status === 'HOME_FOUND_CLAIMED' || resolvedResult.status === 'HOME_FOUND_UNCLAIMED') {
        setIsClaimingExistingHome(true);
        return { type: 'existing' as const };
      }

      setIsClaimingExistingHome(false);
      return { type: 'new' as const, validation: validation as ValidateAddressResponse };
    } catch (e: unknown) {
      setValidatedAddressId(null);
      setAddressCheckResult(null);
      setExistingHomeId(null);
      setIsClaimingExistingHome(false);
      setError(e instanceof Error ? e.message : 'Could not verify this address. Please check your connection and try again.');
      return false;
    } finally {
      setValidatingAddress(false);
    }
  };

  const submit = async () => {
    setError('');
    setFieldErrors({});
    const token = getAuthToken();
    if (!token) { router.push('/login'); return; }
    if (!normalized) {
      setFieldErrors({ location: 'Please select an address.' });
      setError('Please fix the highlighted fields.');
      setStep(1);
      return;
    }
    if (!validatedAddressId) {
      setFieldErrors({ address: 'Verify this address to continue.' });
      setError('Please fix the highlighted fields.');
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      const targetHomeId = existingHomeId || addressCheckResult?.home_id || null;
      if (isClaimingExistingHome && targetHomeId) {
        if (isOwner) {
          router.push(`/app/homes/${targetHomeId}/claim-owner/evidence`);
          return;
        }

        await api.homes.submitResidencyClaim(
          targetHomeId,
          normalized?.address || undefined,
          isOwner ? 'owner' : 'renter',
        );
        router.push(`/app/homes/${targetHomeId}`);
        return;
      }

      if (isClaimingExistingHome && !targetHomeId) {
        setError('We could not find the existing home record. Please try that address again.');
        setStep(1);
        return;
      }

      await createHomeWithCurrentState();
    } catch (e: unknown) {
      console.error(e);
      handleCreateHomeError(e);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 ${
      fieldErrors[field] ? 'border-red-300 bg-red-50/40' : 'border-app-border'
    }`;

  /**
   * Spread onto an input so an invalid field is conveyed to assistive tech,
   * not only by a red border.
   *
   * UX-05: error state was signalled with colour alone (WCAG 1.4.1) and no
   * aria-invalid, so a screen reader user was never told which field was
   * rejected — or that one had been.
   */
  const fieldA11y = (field: string) =>
    (fieldErrors[field]
      ? { 'aria-invalid': true as const, 'aria-describedby': `err-${field}` }
      : {});

  // --- Derived display helpers ---
  const homeTypeLabel = HOME_TYPES.find(t => t.value === homeType)?.label || homeType;
  const homeTypeIcon = HOME_TYPES.find(t => t.value === homeType)?.icon || '🏠';
  const activeAmenities = AMENITIES_OPTIONS.filter(a => amenities[a.key]);

  if (addressStepUpRequirement) {
    return (
      <div className="bg-app-surface-raised">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-app-text">Verify Address</h1>
          <div className="text-sm text-app-text-muted">Step {displayStep}/{totalSteps}</div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-center gap-1">
            {visibleSteps.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  s.id <= step ? 'bg-black text-white' : 'bg-app-surface-sunken text-app-text-muted'
                }`}
              >
                <span>{s.icon}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-app-surface rounded-xl border border-app-border p-6">
            <MailVerificationFlow
              addressId={addressStepUpRequirement.addressId}
              unit={unit.trim() || undefined}
              normalized={getVerifiedNormalizedAddress()}
              onVerified={() => {
                void handleAddressStepUpVerified();
              }}
              onBack={handleAddressStepUpBack}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-app-surface-raised">
      {/* Title */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-app-text">Add Home</h1>
        <div className="text-sm text-app-text-muted">Step {displayStep}/{totalSteps}</div>
      </div>

      {/* Progress */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center gap-1">
          {visibleSteps.map((s) => (
            <button
              key={s.id}
              onClick={() => { if (s.id <= step || (s.id === step + 1 && canProceedStep1)) setStep(s.id); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                s.id === step
                  ? 'bg-black text-white'
                  : s.id < step
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-app-surface-sunken text-app-text-muted'
              }`}
            >
              <span>{s.icon}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-app-surface rounded-xl border border-app-border p-6">
          {/*
            UX-05: async verdicts and submit failures were rendered purely
            visually, so a screen reader user got no indication that anything
            had gone wrong — the form simply did not advance. role="alert"
            makes the failure interrupt and be read.
          */}
          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          {/* ============ STEP 1: LOCATION ============ */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-app-text mb-1">Where is your home?</h2>
                <p className="text-sm text-app-text-secondary">
                  Your exact address is only shown to people in your household. Neighbours and
                  tasks see an approximate area, never the street address.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div id="home-address-label" className="text-sm font-semibold text-app-text-strong">
                  Home location
                </div>
                <button
                  type="button"
                  onClick={useCurrent}
                  className={`px-3 py-2 rounded-lg border text-sm font-semibold text-app-text hover:bg-app-hover ${
                    fieldErrors.location ? 'border-red-300 bg-red-50/40' : 'border-app-border'
                  }`}
                >
                  📍 Use current location
                </button>
              </div>

              <AddressAutocomplete
                value={addressText}
                onChange={(value) => {
                  resetAddressValidation();
                  setAddressText(value);
                  setNormalized(null);
                }}
                onSelectNormalized={onSelectNormalized}
                placeholder="Search address…"
                labelId="home-address-label"
              />

              {normalized ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                  <span className="text-emerald-600 font-medium">✓ Selected: </span>
                  <span className="text-emerald-900 font-semibold">{normalized.label || normalized.address}</span>
                </div>
              ) : (
                <p className="text-sm text-app-text-muted">Start typing, then pick a suggestion to verify.</p>
              )}
              {fieldErrors.location ? <p id="err-location" role="alert" className="text-xs text-red-600">{fieldErrors.location}</p> : null}
              {fieldErrors.address ? <p id="err-address" role="alert" className="text-xs text-red-600">{fieldErrors.address}</p> : null}
              {fieldErrors.city ? <p id="err-city" role="alert" className="text-xs text-red-600">{fieldErrors.city}</p> : null}
              {fieldErrors.state ? <p id="err-state" role="alert" className="text-xs text-red-600">{fieldErrors.state}</p> : null}
              {fieldErrors.zipcode ? <p id="err-zipcode" role="alert" className="text-xs text-red-600">{fieldErrors.zipcode}</p> : null}

              <div>
                <label htmlFor="home-unit" className="block text-sm font-medium text-app-text-strong mb-2">
                  Unit / Apt # (optional)
                </label>
                <input
                  id="home-unit"
                  value={unit}
                  onChange={e => {
                    resetAddressValidation();
                    setUnit(e.target.value);
                  }}
                  placeholder="e.g. Apt 12B"
                  className={inputClass('unit_number')}
                  aria-invalid={fieldErrors.unit_number ? true : undefined}
                  aria-describedby={
                    fieldErrors.unit_number ? 'err-unit_number home-unit-hint' : 'home-unit-hint'
                  }
                />
                {/*
                  UX-04: the prompt used to say only "this address needs a unit
                  number", with no indication of the accepted format and no way
                  forward for someone whose home genuinely has none — which is
                  an unbreakable loop for basement, rear, ADU and duplex
                  "Unit 1" addresses that USPS does not list.
                */}
                <p id="home-unit-hint" className="mt-1 text-xs text-app-text-secondary">
                  Apt 12B, Unit 4, Ste 200, #3 — whichever appears on your mail.
                </p>
                {fieldErrors.unit_number ? (
                  <>
                    <p id="err-unit_number" role="alert" className="mt-1 text-xs text-red-600">
                      {fieldErrors.unit_number}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.unit_number;
                          return next;
                        });
                        setError('');
                        void verifyAddress({ attestNoUnit: true });
                      }}
                      className="mt-1 text-xs text-app-text-secondary underline underline-offset-2 hover:text-app-text-strong"
                    >
                      My home doesn&apos;t have a unit number
                    </button>
                  </>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={async () => {
                    const step1Errors: Record<string, string> = {};
                    if (!normalized) step1Errors.location = 'Please select a verified address.';
                    if (!normalized?.address) step1Errors.address = 'Address is required.';
                    if (!normalized?.city) step1Errors.city = 'City is required.';
                    if (!normalized?.state) step1Errors.state = 'State is required.';
                    if (!normalized?.zipcode) step1Errors.zipcode = 'ZIP code is required.';
	                    if (Object.keys(step1Errors).length > 0) {
	                      setFieldErrors((prev) => ({ ...prev, ...step1Errors }));
	                      setError('Please fix the highlighted fields.');
	                      return;
	                    }
	                    const selectedAddress = normalized;
	                    if (!selectedAddress) return;
	                    const ok = await verifyAddress();
                    if (ok && typeof ok === 'object' && ok.type === 'existing') {
                      setError('');
                      setPropertySuggestionNote('');
                      setStep(3);
                    } else if (ok && typeof ok === 'object' && ok.type === 'new') {
                      setError('');
                      setPropertySuggestionNote('');
                      try {
                        const v = ok.validation;
                        const verdict = v?.verdict;
                        const rn = verdict?.normalized;
                        const res = await api.homes.getPropertySuggestions({
	                          address: rn?.line1 || selectedAddress.address,
	                          unit_number: (rn?.line2 || unit).trim() || undefined,
	                          city: rn?.city || selectedAddress.city,
	                          state: rn?.state || selectedAddress.state.trim().toUpperCase(),
	                          zip_code: rn?.zip || selectedAddress.zipcode,
                          address_id: v?.address_id || null,
                          classification: verdict?.classification,
                        });
                        const s = res?.suggestions;
                        setAttomPropertyDetail(res?.attom_property_detail ?? null);
                        if (s?.home_type) {
                          setHomeType(s.home_type as NonNullable<Parameters<typeof api.homes.createHome>[0]['home_type']>);
                        }
                        if (s?.bedrooms != null) setBedrooms(String(s.bedrooms));
                        if (s?.bathrooms != null) setBathrooms(String(s.bathrooms));
                        if (s?.sq_ft != null) setSqft(String(s.sq_ft));
                        if (s?.lot_sq_ft != null) setLotSqft(String(s.lot_sq_ft));
                        if (s?.year_built != null) setYearBuilt(String(s.year_built));
                        if (s?.description) setDescription(s.description);
                        const tiers = res?.tiers_used?.filter(Boolean) || [];
                        if (tiers.length) {
                          setPropertySuggestionNote(
                            'Prefilled using public records and address hints where available — please verify.',
                          );
                        }
                      } catch {
                        setPropertySuggestionNote(
                          'Public records could not be loaded right now. You can continue and fetch them later from Property Details.',
                        );
                      }
                      setStep(2);
                    }
                  }}
                  disabled={!canProceedStep1 || validatingAddress}
                  className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-900 font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {validatingAddress ? 'Verifying…' : 'Next →'}
                </button>
              </div>
            </div>
          )}

          {/* ============ STEP 2: HOME DETAILS ============ */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-app-text mb-1">Tell us about your home</h2>
                <p className="text-sm text-app-text-secondary">All optional — you can always add these later.</p>
                {propertySuggestionNote ? (
                  <p className="text-xs text-emerald-700 mt-2">{propertySuggestionNote}</p>
                ) : null}
              </div>

              {/* Home nickname */}
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-2">Home nickname (optional)</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. The Camas House, My First Apartment"
                  className="w-full px-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20"
                />
                <p className="mt-1 text-xs text-app-text-muted">Makes it easy to identify if you manage multiple homes.</p>
              </div>

              {/* Home type grid */}
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-2">Home type</label>
                <div className="grid grid-cols-5 gap-2">
                  {HOME_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setHomeType(t.value as typeof homeType)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-sm transition-colors ${
                        homeType === t.value
                          ? 'border-black bg-app-surface-raised font-semibold'
                          : 'border-app-border hover:border-app-border'
                      }`}
                    >
                      <span className="text-lg">{t.icon}</span>
                      <span className="text-xs">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bedrooms / Bathrooms / SqFt / Year */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-2">Bedrooms</label>
                  <input type="number" min="0" value={bedrooms} onChange={e => setBedrooms(e.target.value)} placeholder="—"
                    className={inputClass('bedrooms')}
                  {...fieldA11y('bedrooms')} />
                  {fieldErrors.bedrooms ? <p id="err-bedrooms" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.bedrooms}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-2">Bathrooms</label>
                  <input type="number" min="0" step="0.5" value={bathrooms} onChange={e => setBathrooms(e.target.value)} placeholder="—"
                    className={inputClass('bathrooms')}
                  {...fieldA11y('bathrooms')} />
                  {fieldErrors.bathrooms ? <p id="err-bathrooms" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.bathrooms}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-2">Sq ft</label>
                  <input type="number" min="0" value={sqft} onChange={e => setSqft(e.target.value)} placeholder="—"
                    className={inputClass('sq_ft')}
                  {...fieldA11y('sq_ft')} />
                  {fieldErrors.sq_ft ? <p id="err-sq_ft" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.sq_ft}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-2">Year built</label>
                  <input type="number" min="1600" max="2100" value={yearBuilt} onChange={e => setYearBuilt(e.target.value)} placeholder="—"
                    className={inputClass('year_built')}
                  {...fieldA11y('year_built')} />
                  {fieldErrors.year_built ? <p id="err-year_built" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.year_built}</p> : null}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-2">Lot size (sq ft, optional)</label>
                <input
                  type="number"
                  min="0"
                  value={lotSqft}
                  onChange={e => setLotSqft(e.target.value)}
                  placeholder="—"
                  className={inputClass('lot_sq_ft')}
                  {...fieldA11y('lot_sq_ft')}
                />
                {fieldErrors.lot_sq_ft ? <p id="err-lot_sq_ft" role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.lot_sq_ft}</p> : null}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-2">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Corner lot, ranch-style, recently renovated kitchen…"
                  className="w-full px-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 resize-none"
                />
              </div>

              {attomPropertyDetail && attomJsonPreview ? (
                <div className="rounded-lg border border-app-border bg-app-surface-raised p-4 space-y-2">
                  <div className="text-sm font-semibold text-app-text-strong">Public records (ATTOM)</div>
                  <p className="text-xs text-app-text-secondary">
                    County / assessor fields below; full JSON at the bottom. All of this is saved with your home.
                  </p>
                  <AttomStructuredFields attomPropertyDetail={attomPropertyDetail} />
                  <button
                    type="button"
                    onClick={() => setShowAttomJson((v) => !v)}
                    className="text-sm font-medium text-blue-700 hover:text-blue-900 pt-2"
                  >
                    {showAttomJson ? 'Hide raw JSON' : 'Show raw JSON'}
                  </button>
                  {showAttomJson ? (
                    <pre className="text-[10px] leading-snug overflow-auto max-h-72 p-3 rounded-md bg-app-surface-sunken border border-app-border font-mono whitespace-pre text-app-text">
                      {attomJsonPreview}
                    </pre>
                  ) : null}
                </div>
              ) : null}

              {/* Amenities grid */}
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-2">Amenities</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {AMENITIES_OPTIONS.map(a => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => toggleAmenity(a.key)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${
                        amenities[a.key]
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium'
                          : 'border-app-border text-app-text-secondary hover:border-app-border'
                      }`}
                    >
                      <span>{a.icon}</span>
                      <span className="text-xs">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <button onClick={() => setStep(1)} className="px-6 py-3 border border-app-border rounded-lg hover:bg-app-hover font-medium text-app-text-strong">
                  ← Back
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setStep(4)} className="px-4 py-3 text-app-text-secondary hover:text-app-text-strong text-sm font-medium">
                    Skip to review
                  </button>
                  <button onClick={() => setStep(3)} className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-900 font-semibold">
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============ STEP 3: YOUR SETUP ============ */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-app-text mb-1">
                  {isClaimingExistingHome ? 'Claim this home' : 'Your setup'}
                </h2>
                <p className="text-sm text-app-text-secondary">
                  {isClaimingExistingHome
                    ? 'This address already has a home on Pantopus. Choose how you relate to it and we will submit a claim instead of creating a duplicate.'
                    : 'Quick-start info for your household. Everything is optional and private.'}
                </p>
              </div>

              {isClaimingExistingHome ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Existing home found at {addressCheckResult?.formatted_address || normalized?.label || normalized?.address}. Your submission will attach to that home instead of creating a new one.
                </div>
              ) : null}

              {/* Ownership / Move-in */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-2">Your relationship</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOwner(true)}
                      className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                        isOwner ? 'border-black bg-app-surface-raised' : 'border-app-border hover:border-app-border'
                      }`}
                    >
                      🏠 Owner
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOwner(false)}
                      className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                        !isOwner ? 'border-black bg-app-surface-raised' : 'border-app-border hover:border-app-border'
                      }`}
                    >
                      🔑 Renter / Tenant
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-2">Move-in date</label>
                  <input
                    type="date"
                    value={moveInDate}
                    onChange={e => setMoveInDate(e.target.value)}
                    className="w-full px-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                </div>
              </div>

              {/* WiFi */}
              <div className="p-4 bg-app-surface-raised rounded-lg border border-app-border">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📶</span>
                  <span className="text-sm font-semibold text-app-text">WiFi credentials</span>
                  <span className="text-xs bg-app-surface-sunken text-app-text-secondary px-2 py-0.5 rounded-full">Only visible to members</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    value={wifiName}
                    onChange={e => setWifiName(e.target.value)}
                    placeholder="Network name (SSID)"
                    className="px-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                  <div className="relative">
                    <input
                      value={wifiPassword}
                      onChange={e => setWifiPassword(e.target.value)}
                      placeholder="Password"
                      type={showWifiPassword ? 'text' : 'password'}
                      className="w-full px-4 py-2 pr-12 sm:pr-11 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWifiPassword(v => !v)}
                      className="absolute right-0 top-0 bottom-0 flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:right-2 sm:top-1/2 sm:-translate-y-1/2 sm:bottom-auto p-2 sm:p-1 rounded-r-lg sm:rounded text-app-text-secondary hover:text-app-text hover:bg-app-surface-sunken active:bg-app-surface-sunken touch-manipulation"
                      aria-label={showWifiPassword ? 'Hide password' : 'Show password'}
                    >
                      {showWifiPassword ? <EyeOff className="w-5 h-5 sm:w-4 sm:h-4" /> : <Eye className="w-5 h-5 sm:w-4 sm:h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Entry & Parking Instructions */}
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-2">Entry instructions (optional)</label>
                <textarea
                  value={entryInstructions}
                  onChange={e => setEntryInstructions(e.target.value)}
                  rows={2}
                  placeholder="e.g. Use the side gate, code is 1234. Ring doorbell twice."
                  className="w-full px-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-2">Parking instructions (optional)</label>
                <textarea
                  value={parkingInstructions}
                  onChange={e => setParkingInstructions(e.target.value)}
                  rows={2}
                  placeholder="e.g. Driveway on left, or street parking on NE Tacoma Ct."
                  className="w-full px-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 resize-none"
                />
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <button onClick={() => setStep(isClaimingExistingHome ? 1 : 2)} className="px-6 py-3 border border-app-border rounded-lg hover:bg-app-hover font-medium text-app-text-strong">
                  ← Back
                </button>
                <button onClick={() => setStep(4)} className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-900 font-semibold">
                  {isClaimingExistingHome ? 'Review claim →' : 'Review →'}
                </button>
              </div>
            </div>
          )}

          {/* ============ STEP 4: REVIEW & CREATE ============ */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-app-text mb-1">
                  {isClaimingExistingHome ? 'Review your claim' : 'Review your home'}
                </h2>
                <p className="text-sm text-app-text-secondary">
                  {isClaimingExistingHome
                    ? 'You are about to submit a claim for the existing home at this address.'
                    : 'Everything looks good? You can always edit later.'}
                </p>
              </div>

              {/* The privacy promise, again, on the last screen before the
                  address is committed (Wedge v2 §2). */}
              <PrivacyPromise />

              {/* Location summary */}
              <div className="p-4 bg-app-surface-raised rounded-lg border border-app-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-app-text">📍 Location</span>
                  <button onClick={() => setStep(1)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                </div>
                <div className="text-sm text-app-text-strong">
                  {normalized?.label || normalized?.address || '—'}
                  {unit && <span className="text-app-text-muted ml-1">• {unit}</span>}
                </div>
              </div>

              {!isClaimingExistingHome ? (
                <div className="p-4 bg-app-surface-raised rounded-lg border border-app-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-app-text">🏠 Details</span>
                    <button onClick={() => setStep(2)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                  </div>
                  <div className="text-sm text-app-text-strong flex flex-wrap gap-x-4 gap-y-1">
                    <span>{homeTypeIcon} {homeTypeLabel}</span>
                    {parsedBedrooms != null && <span>{parsedBedrooms} bed</span>}
                    {parsedBathrooms != null && <span>{parsedBathrooms} bath</span>}
                    {parsedSqft != null && <span>{parsedSqft.toLocaleString()} sq ft</span>}
                    {parsedLotSqft != null && <span>{parsedLotSqft.toLocaleString()} lot sq ft</span>}
                    {parsedYearBuilt != null && <span>Built {parsedYearBuilt}</span>}
                  </div>
                  {name && <div className="text-sm text-app-text-secondary">&quot;{name}&quot;</div>}
                  {description && <div className="text-sm text-app-text-secondary line-clamp-2">{description}</div>}
                  {activeAmenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {activeAmenities.map(a => (
                        <span key={a.key} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          {a.icon} {a.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Setup summary */}
              <div className="p-4 bg-app-surface-raised rounded-lg border border-app-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-app-text">
                    {isClaimingExistingHome ? '🙋 Claim details' : '⚙️ Setup'}
                  </span>
                  <button onClick={() => setStep(3)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                </div>
                <div className="text-sm text-app-text-strong flex flex-wrap gap-x-4 gap-y-1">
                  <span>{isOwner ? '🏠 Owner' : '🔑 Renter'}</span>
                  {moveInDate && <span>Move-in: {moveInDate}</span>}
                  {!isClaimingExistingHome && wifiName && <span>📶 WiFi: {wifiName}</span>}
                  {!isClaimingExistingHome && entryInstructions && <span>🚪 Entry instructions set</span>}
                  {!isClaimingExistingHome && parkingInstructions && <span>🅿️ Parking instructions set</span>}
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <button onClick={() => setStep(3)} className="px-6 py-3 border border-app-border rounded-lg hover:bg-app-hover font-medium text-app-text-strong">
                  ← Back
                </button>
                <button
                  onClick={submit}
                  disabled={loading || !normalized}
                  className="px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-900 font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {loading ? (isClaimingExistingHome ? 'Submitting…' : 'Creating…') : (isClaimingExistingHome ? '✅ Submit Claim' : '✅ Create Home')}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
