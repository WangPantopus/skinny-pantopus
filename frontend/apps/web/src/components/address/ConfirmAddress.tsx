'use client';

/**
 * ConfirmAddress — Shows the validated/normalized address for user confirmation.
 *
 * Renders:
 *  - Normalized address in a card
 *  - Small map preview with pin (Leaflet + OpenStreetMap)
 *  - Confidence badge (High / Medium / Low)
 *  - "Change" link to go back
 *  - "Continue" primary CTA
 */

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { AddressVerdict, NormalizedAddress } from '@pantopus/api';

// Lazy-load Leaflet map to avoid SSR issues
const AddressMap = dynamic(() => import('./AddressMap'), { ssr: false });

type Props = {
  verdict: AddressVerdict;
  addressId: string | null;
  onContinue: () => void;
  onBack: () => void;
};

// ── Confidence badge ────────────────────────────────────────

type ConfidenceLevel = 'high' | 'medium' | 'low';

function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'High confidence' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium confidence' },
  low: { bg: 'bg-red-100', text: 'text-red-700', label: 'Low confidence' },
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = getConfidenceLevel(confidence);
  const style = CONFIDENCE_STYLES[level];

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        level === 'high' ? 'bg-emerald-500' : level === 'medium' ? 'bg-amber-500' : 'bg-red-500'
      }`} />
      {style.label}
    </span>
  );
}

// ── Address card ────────────────────────────────────────────

function formatAddress(n: NormalizedAddress): { line1: string; line2: string } {
  const line1 = [n.line1, n.line2].filter(Boolean).join(', ');
  const line2 = [n.city, `${n.state} ${n.zip}${n.plus4 ? `-${n.plus4}` : ''}`].join(', ');
  return { line1, line2 };
}

// ── Main component ──────────────────────────────────────────

export default function ConfirmAddress({ verdict, onContinue, onBack }: Props) {
  const normalized = verdict.normalized;
  const formatted = useMemo(
    () => normalized ? formatAddress(normalized) : null,
    [normalized],
  );

  if (!normalized || !formatted) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">No normalized address available.</p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          &larr; Try a different address
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Map preview */}
      <div className="rounded-xl overflow-hidden border border-app-border shadow-sm">
        <AddressMap lat={normalized.lat} lng={normalized.lng} />
      </div>

      {/* Address card */}
      <div className="rounded-xl border border-app-border bg-app-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-app-text-secondary">Verified address</span>
            </div>
            <p className="text-lg font-semibold text-app-text">{formatted.line1}</p>
            <p className="text-sm text-app-text-secondary">{formatted.line2}</p>
          </div>
          <ConfidenceBadge confidence={verdict.confidence} />
        </div>

        {/* Deliverability info */}
        {verdict.deliverability && (
          <div className="mt-3 pt-3 border-t border-app-border-subtle flex items-center gap-3 text-xs text-app-text-secondary">
            <span className={`px-2 py-0.5 rounded-full ${
              verdict.deliverability.rdi_type === 'residential'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-app-surface-sunken text-app-text-secondary'
            }`}>
              {verdict.deliverability.rdi_type === 'residential' ? 'Residential' : 'Commercial'}
            </span>
            {verdict.deliverability.dpv_match_code === 'Y' && (
              <span className="text-emerald-600">USPS deliverable</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          &larr; Change address
        </button>

        <button
          type="button"
          onClick={onContinue}
          className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
