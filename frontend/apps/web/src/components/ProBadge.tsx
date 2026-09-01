'use client';

import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import { IdentityIcons } from '@/lib/icons';

/**
 * Inline "Pro" pill shown in Personal-zone gig surfaces when the user has
 * an active UserProfessionalProfile. Replaces the old Professional mode
 * badge from ProfileToggle. Per unified-IA §3.5: Pro is a flag inside
 * Personal, not a separate mode.
 */
export function ProBadge({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.professional.getMyProfile();
        if (!cancelled) setActive(!!(res as { profile?: { is_active?: boolean } } | null)?.profile?.is_active);
      } catch {
        // silently fail — non-Pro users get the empty state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!active) return null;

  if (compact) {
    return (
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
        title="Pro mode active"
        data-testid="pro-badge"
      >
        <IdentityIcons.professional className="w-3 h-3" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
      data-testid="pro-badge"
    >
      <IdentityIcons.professional className="w-3 h-3" />
      Pro
    </span>
  );
}

export default ProBadge;
