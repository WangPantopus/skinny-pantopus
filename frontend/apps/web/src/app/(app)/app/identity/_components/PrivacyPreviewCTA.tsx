'use client';

/**
 * Persistent "Privacy preview" CTA for the unified Profiles & Privacy
 * surface (unified-IA §8.1: "always-visible CTA"). P2.7 makes this a
 * full-page navigation to /app/identity/preview where the user can
 * cycle through all 7 viewer modes against the real serializers.
 *
 * Step 7's onboarding-time target (≤ 30s to verify "what does my
 * neighbor see") depends on this being one tap from the page header.
 */

import Link from 'next/link';
import { Eye } from 'lucide-react';

interface PrivacyPreviewCTAProps {
  /** Optional click hook (e.g. trigger an analytics event). */
  onOpen?: () => void;
}

export function PrivacyPreviewCTA({ onOpen }: PrivacyPreviewCTAProps) {
  return (
    <Link
      href="/app/identity/preview"
      data-testid="profiles-privacy-preview-cta"
      onClick={() => { onOpen?.(); }}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
    >
      <Eye className="h-4 w-4" aria-hidden />
      Privacy preview
    </Link>
  );
}

export default PrivacyPreviewCTA;
