'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { IdentityIcons } from '@/lib/icons';

type ProState =
  | { kind: 'loading' }
  | { kind: 'inactive' }
  | { kind: 'active'; tier: number; isPublic: boolean };

/**
 * Pro mode entry-point card for the Personal-zone profile page.
 *
 * Replaces the old "switch into Professional mode" affordance from the
 * 4-mode ProfileToggle. Per unified-IA §3.5, Pro is now a flag inside
 * Personal — this card is the discoverable opt-in or "manage" surface.
 */
export function ProModeCard() {
  const router = useRouter();
  const [state, setState] = useState<ProState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.professional.getMyProfile();
        if (cancelled) return;
        const profile = (res as { profile?: Record<string, unknown> | null } | null)?.profile;
        if (profile && profile.is_active) {
          setState({
            kind: 'active',
            tier: typeof profile.verification_tier === 'number' ? (profile.verification_tier as number) : 0,
            isPublic: Boolean(profile.is_public),
          });
        } else {
          setState({ kind: 'inactive' });
        }
      } catch {
        if (!cancelled) setState({ kind: 'inactive' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') {
    return null;
  }

  if (state.kind === 'active') {
    const tierLabel = state.tier ? `Tier ${state.tier}` : 'Active';
    const visibility = state.isPublic ? 'Public' : 'Private';
    return (
      <div
        className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5"
        data-testid="pro-mode-card-active"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <IdentityIcons.professional className="w-5 h-5 text-amber-600 dark:text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-app">Pro mode</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                {tierLabel}
              </span>
            </div>
            <p className="text-sm text-app-muted mt-1">
              {visibility} · Earning gigs as a verified pro.
            </p>
          </div>
          <button
            onClick={() => router.push('/app/professional')}
            className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 whitespace-nowrap"
          >
            Manage →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-surface rounded-xl border border-app p-5"
      data-testid="pro-mode-card-inactive"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
          <IdentityIcons.professional className="w-5 h-5 text-amber-600 dark:text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-app">Pro mode</h3>
          <p className="text-sm text-app-muted mt-1">
            Earn from gigs as a verified pro.
          </p>
        </div>
        <button
          onClick={() => router.push('/app/professional')}
          className="text-sm font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 whitespace-nowrap"
          data-testid="pro-mode-setup-cta"
        >
          Set up Pro mode →
        </button>
      </div>
    </div>
  );
}

export default ProModeCard;
