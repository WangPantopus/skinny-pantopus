// @ts-nocheck
'use client';

/**
 * Verdict screen components — one per AddressVerdictStatus.
 *
 * Each screen receives the verdict + common callbacks, and presents
 * the user with appropriate actions based on the validation result.
 *
 * MISSING_UNIT          → prompt for unit number with helper chips, re-validate
 * MISSING_STREET_NUMBER → address has no street number, prompt user to re-enter
 * MULTIPLE_MATCHES      → list candidates for user to choose
 * BUSINESS        → two option cards: create business profile or claim as home
 * MIXED_USE       → three verification options (landlord invite, mail code, doc upload)
 * UNDELIVERABLE   → inline suggestions based on reasons, edit address CTA
 * LOW_CONFIDENCE  → warn about low confidence, offer to continue
 * SERVICE_ERROR   → retry + save-and-finish-later
 * CONFLICT        → request to join / claim as owner / claim as manager
 */

import Link from 'next/link';
import type {
  AddressVerdict,
  AddressCandidate,
} from '@pantopus/api';

// ── Shared layout ───────────────────────────────────────────

function VerdictLayout({
  icon,
  title,
  description,
  children,
  onBack,
  backLabel = 'Try a different address',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="rounded-xl border border-app-border bg-app-surface p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 mt-0.5">{icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-app-text">{title}</h3>
            <p className="text-sm text-app-text-secondary mt-1">{description}</p>
          </div>
        </div>
        {children}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
      >
        &larr; {backLabel}
      </button>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────

const ICONS = {
  warning: (
    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    </div>
  ),
  list: (
    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
    </div>
  ),
  building: (
    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
      </svg>
    </div>
  ),
  error: (
    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    </div>
  ),
  info: (
    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    </div>
  ),
  gear: (
    <div className="w-10 h-10 rounded-full bg-app-surface-sunken flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-app-text-secondary" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    </div>
  ),
};

// ── MISSING_UNIT ────────────────────────────────────────────

const UNIT_CHIPS = ['Apt', 'Unit', '#', 'Suite', 'Floor'] as const;

export function FixMissingUnit({
  verdict,
  onSubmit,
  onSkipUnit,
  onBack,
  loading,
  error,
}: {
  verdict: AddressVerdict;
  addressId: string | null;
  onSubmit: (unit: string) => void;
  onSkipUnit?: () => void;
  onBack: () => void;
  loading?: boolean;
  error?: string | null;
}) {
  const [unit, setUnit] = useState('');
  const [prefix, setPrefix] = useState('');
  const addr = verdict.normalized;

  const handleChip = (chip: string) => {
    if (prefix === chip) {
      setPrefix('');
      // Remove prefix from unit if it starts with it
      if (unit.startsWith(chip + ' ')) {
        setUnit(unit.slice(chip.length + 1));
      }
    } else {
      const cleanUnit = prefix && unit.startsWith(prefix + ' ')
        ? unit.slice(prefix.length + 1)
        : unit;
      setPrefix(chip);
      setUnit(chip + (cleanUnit ? ' ' + cleanUnit : ' '));
    }
  };

  const handleUnitChange = (value: string) => {
    setUnit(value);
    // Clear prefix selection if user modifies the beginning
    if (prefix && !value.startsWith(prefix)) {
      setPrefix('');
    }
  };

  return (
    <VerdictLayout
      icon={ICONS.warning}
      title="Add your Apt / Unit"
      description={`This looks like a multi-unit building${addr ? ` at ${addr.line1}` : ''}. We need your specific unit to verify your address.`}
      onBack={onBack}
    >
      <div className="mt-4 space-y-3">
        {/* Helper chips */}
        <div className="flex flex-wrap gap-2">
          {UNIT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleChip(chip)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                prefix === chip
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'bg-app-surface border-app-border text-app-text-secondary hover:border-app-border hover:bg-app-hover'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Unit input */}
        <div>
          <label htmlFor="unit-input" className="sr-only">
            Unit / Apt / Suite
          </label>
          <input
            id="unit-input"
            type="text"
            value={unit}
            onChange={(e) => handleUnitChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && unit.trim()) onSubmit(unit.trim());
            }}
            placeholder="e.g. 4B, 12, 200"
            className="w-full px-4 py-3 border border-app-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-app-text placeholder:text-app-text-muted"
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Primary CTA */}
        <button
          type="button"
          onClick={() => unit.trim() && onSubmit(unit.trim())}
          disabled={!unit.trim() || loading}
          className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Validating...
            </span>
          ) : (
            'Confirm Unit'
          )}
        </button>

        {/* Secondary: skip */}
        {onSkipUnit && (
          <button
            type="button"
            onClick={onSkipUnit}
            className="w-full text-center text-sm text-app-text-secondary hover:text-app-text-strong transition-colors py-1"
          >
            My home doesn&apos;t have a unit number
          </button>
        )}
      </div>
    </VerdictLayout>
  );
}

// ── MISSING_STREET_NUMBER ────────────────────────────────────

export function MissingStreetNumber({
  verdict,
  onBack,
}: {
  verdict: AddressVerdict;
  onBack: () => void;
}) {
  const addr = verdict.normalized;
  return (
    <VerdictLayout
      icon={ICONS.error}
      title="Street number missing"
      description={`We couldn't find a street number for this address${addr ? ` ("${addr.line1}")` : ''}. A valid home address needs a house or building number.`}
      onBack={onBack}
      backLabel="Edit address"
    >
      <div className="mt-4 space-y-3">
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800 font-medium mb-1">Common fixes:</p>
          <ul className="text-sm text-amber-700 space-y-1 list-disc pl-4">
            <li>Include the house or building number (e.g., <strong>123</strong> Main St)</li>
            <li>If you selected from autocomplete, try typing more of your address</li>
            <li>PO Boxes are not accepted — use your physical street address</li>
          </ul>
        </div>

        {verdict.reasons.length > 0 && (
          <ul className="space-y-1">
            {verdict.reasons.map((r, i) => (
              <li key={i} className="text-xs text-app-text-secondary flex items-start gap-1.5">
                <span className="mt-0.5 text-app-text-muted">&bull;</span>
                {r}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onBack}
          className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
        >
          Edit Address
        </button>
      </div>
    </VerdictLayout>
  );
}

// ── MULTIPLE_MATCHES ────────────────────────────────────────

export function ChooseExactMatch({
  verdict,
  onSelect,
  onBack,
}: {
  verdict: AddressVerdict;
  onSelect: (candidate: AddressCandidate) => void;
  onBack: () => void;
}) {
  return (
    <VerdictLayout
      icon={ICONS.list}
      title="Which one is yours?"
      description="We found several addresses that closely match what you entered. Select the correct one to continue."
      onBack={onBack}
    >
      <div className="mt-4 space-y-2">
        {verdict.candidates.map((c, i) => {
          const { line1, line2, city, state, zip, plus4 } = c.address;
          const zipDisplay = plus4 ? `${zip}-${plus4}` : zip;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(c)}
              className="w-full text-left p-4 rounded-xl border border-app-border hover:border-primary-300 hover:bg-primary-50/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5 text-gray-300 group-hover:text-primary-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-app-text">
                    {line1}
                    {line2 ? <span className="text-app-text-secondary">, {line2}</span> : null}
                  </p>
                  <p className="text-sm text-app-text-secondary mt-0.5">
                    {city}, {state} {zipDisplay}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </VerdictLayout>
  );
}

// ── BUSINESS ────────────────────────────────────────────────

export function BusinessDetected({
  verdict,
  onCreateBusiness,
  onClaimAsHome,
  onBack,
}: {
  verdict: AddressVerdict;
  onCreateBusiness?: () => void;
  onClaimAsHome?: () => void;
  onBack: () => void;
}) {
  return (
    <VerdictLayout
      icon={ICONS.building}
      title="This looks like a business address"
      description="Our records indicate this address is registered as a commercial property. That's okay — here are your options."
      onBack={onBack}
    >
      <div className="mt-4 space-y-3">
        {/* Option 1: Create business profile */}
        {onCreateBusiness && (
          <button
            type="button"
            onClick={onCreateBusiness}
            className="w-full text-left p-4 rounded-xl border-2 border-primary-200 bg-primary-50/50 hover:bg-primary-50 hover:border-primary-300 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-app-text group-hover:text-primary-900">Create a Business Profile</p>
                <p className="text-sm text-app-text-secondary mt-0.5">
                  Set up your business on Pantopus with this address.
                </p>
              </div>
            </div>
          </button>
        )}

        {/* Option 2: Claim as home */}
        {onClaimAsHome && (
          <button
            type="button"
            onClick={onClaimAsHome}
            className="w-full text-left p-4 rounded-xl border border-app-border hover:border-app-border hover:bg-app-hover transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-app-surface-sunken flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-app-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-app-text">This is my home</p>
                <p className="text-sm text-app-text-secondary mt-0.5">
                  I live here (e.g., live/work space, home office). Additional verification will be required.
                </p>
              </div>
            </div>
          </button>
        )}

        {/* If neither callback provided, show fallback text */}
        {!onCreateBusiness && !onClaimAsHome && (
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-700">
              If this is actually your home (e.g., a live/work space), please try re-entering
              with your residential unit number, or contact support.
            </p>
          </div>
        )}
      </div>

      {verdict.reasons.length > 0 && (
        <ul className="mt-3 space-y-1">
          {verdict.reasons.map((r, i) => (
            <li key={i} className="text-xs text-app-text-secondary flex items-start gap-1.5">
              <span className="mt-0.5 text-app-text-muted">&bull;</span>
              {r}
            </li>
          ))}
        </ul>
      )}
    </VerdictLayout>
  );
}

// ── MIXED_USE ───────────────────────────────────────────────

type VerificationMethod = 'landlord_invite' | 'mail_code' | 'doc_upload';

const VERIFICATION_OPTIONS: {
  method: VerificationMethod;
  title: string;
  description: string;
  time: string;
  icon: React.ReactNode;
}[] = [
  {
    method: 'landlord_invite',
    title: 'Landlord Invite',
    description: 'Ask your landlord or property manager to confirm you live here.',
    time: 'Usually within 24 hours',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
      </svg>
    ),
  },
  {
    method: 'mail_code',
    title: 'Mail Code',
    description: 'We\'ll mail a verification code to this address. Enter it when it arrives.',
    time: '3 - 5 business days',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
      </svg>
    ),
  },
  {
    method: 'doc_upload',
    title: 'Utility Bill Upload',
    description: 'Upload a recent utility bill showing your name at this address.',
    time: 'Reviewed within 1 - 2 business days',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export function MixedUseVerification({
  onChooseMethod,
  onContinue,
  onBack,
}: {
  verdict: AddressVerdict;
  onChooseMethod?: (method: VerificationMethod) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <VerdictLayout
      icon={ICONS.info}
      title="Mixed-use address"
      description="This address contains both residential and commercial units. We need to verify that you actually live here before we can set up your home."
      onBack={onBack}
    >
      {onChooseMethod ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-app-text-strong">Choose a verification method:</p>
          {VERIFICATION_OPTIONS.map((opt) => (
            <button
              key={opt.method}
              type="button"
              onClick={() => onChooseMethod(opt.method)}
              className="w-full text-left p-4 rounded-xl border border-app-border hover:border-primary-300 hover:bg-primary-50/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-app-surface-sunken group-hover:bg-primary-100 flex items-center justify-center text-app-text-secondary group-hover:text-primary-600 transition-colors">
                  {opt.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-app-text">{opt.title}</p>
                    <span className="text-xs text-app-text-muted whitespace-nowrap">{opt.time}</span>
                  </div>
                  <p className="text-sm text-app-text-secondary mt-0.5">{opt.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
          >
            Continue anyway
          </button>
        </div>
      )}
    </VerdictLayout>
  );
}

// ── UNDELIVERABLE ───────────────────────────────────────────

/** Map common reason strings to inline suggestions */
function getSuggestionForReason(reason: string): string | null {
  const lower = reason.toLowerCase();
  if (lower.includes('unit') || lower.includes('secondary') || lower.includes('apt'))
    return 'Try adding or correcting the unit number.';
  if (lower.includes('zip') || lower.includes('postal'))
    return 'Double-check the ZIP code.';
  if (lower.includes('street') || lower.includes('primary'))
    return 'Verify the street name and number.';
  if (lower.includes('city') || lower.includes('state'))
    return 'Check the city and state are correct.';
  if (lower.includes('vacant') || lower.includes('decommission'))
    return 'This address may no longer be active.';
  return null;
}

export function NotDeliverable({
  verdict,
  onBack,
}: {
  verdict: AddressVerdict;
  onBack: () => void;
}) {
  const reasons = verdict.reasons || [];
  const suggestions = reasons
    .map((r) => ({ reason: r, suggestion: getSuggestionForReason(r) }))
    .filter((s) => s.suggestion !== null);

  return (
    <VerdictLayout
      icon={ICONS.error}
      title="Address not deliverable"
      description="USPS records indicate this address can't receive mail. This usually means the address doesn't exist or has been decommissioned."
      onBack={onBack}
      backLabel="Edit address"
    >
      {/* Reasons with inline suggestions */}
      {reasons.length > 0 && (
        <div className="mt-3 space-y-2">
          {reasons.map((r, i) => {
            const suggestion = getSuggestionForReason(r);
            return (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 text-red-400 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <p className="text-app-text-strong">{r}</p>
                  {suggestion && (
                    <p className="text-app-text-secondary mt-0.5">{suggestion}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggestions summary if no specific reasons had suggestions */}
      {suggestions.length === 0 && reasons.length > 0 && (
        <div className="mt-4 p-3 bg-app-surface-raised rounded-lg">
          <p className="text-sm text-app-text-secondary">
            Double-check the address for typos, including street number, name, and ZIP code.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onBack}
          className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
        >
          Edit Address
        </button>
        <p className="text-center text-xs text-app-text-muted">
          Still having trouble?{' '}
          <Link href="/support" className="text-primary-600 hover:text-primary-700 underline">
            Contact support
          </Link>
        </p>
      </div>
    </VerdictLayout>
  );
}

// ── LOW_CONFIDENCE ──────────────────────────────────────────

export function LowConfidence({
  verdict,
  onContinue,
  onBack,
}: {
  verdict: AddressVerdict;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <VerdictLayout
      icon={ICONS.info}
      title="Low confidence match"
      description="We couldn't precisely match this address. The location on file may be approximate. You can still continue, but mail verification will be required."
      onBack={onBack}
    >
      {verdict.reasons.length > 0 && (
        <ul className="mt-3 space-y-1">
          {verdict.reasons.map((r, i) => (
            <li key={i} className="text-xs text-app-text-secondary flex items-start gap-1.5">
              <span className="mt-0.5 text-app-text-muted">&bull;</span>
              {r}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onContinue}
          className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
        >
          Continue with this address
        </button>
      </div>
    </VerdictLayout>
  );
}

// ── SERVICE_ERROR ───────────────────────────────────────────

export function ServiceError({
  onRetry,
  onSaveLater,
  onBack,
}: {
  verdict: AddressVerdict;
  onRetry: () => void;
  onSaveLater?: () => void;
  onBack: () => void;
}) {
  return (
    <VerdictLayout
      icon={ICONS.gear}
      title="Verification service unavailable"
      description="We couldn't verify this address right now due to a temporary service issue. This is on our end, not yours."
      onBack={onBack}
    >
      <div className="mt-4 space-y-3">
        <button
          type="button"
          onClick={onRetry}
          className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors inline-flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          Retry
        </button>

        {onSaveLater && (
          <button
            type="button"
            onClick={onSaveLater}
            className="w-full px-4 py-3 border border-app-border text-app-text-strong rounded-xl font-medium hover:bg-app-hover transition-colors"
          >
            Save and finish later
          </button>
        )}
      </div>
    </VerdictLayout>
  );
}

