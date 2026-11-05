'use client';

// The profile switcher's menu (ProfileToggle.tsx): loaded on its first open, so
// every page's first scripts leave it out. It is there only while open.

import { useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Check, Shield } from 'lucide-react';
import { IdentityIcons } from '@/lib/icons';
import { launchFeatures } from '@/lib/featureFlags';
import type { BusinessOption, HomeOption, ProfessionalOption } from './ProfileToggle';

// Dropdown dimensions (w-64 = 16rem = 256px)
const DROPDOWN_WIDTH = 256;
const VIEWPORT_PADDING = 8;

export default function ProfileMenu({
  compact,
  buttonRef,
  onClose,
  onSwitch,
  homes,
  homesLoading,
  homesFailed,
  onRetryHomes,
  businesses,
  loading,
  hasSeats,
  professional,
  activeHomeId,
  activeBusinessId,
  isHomeMode,
  isBusinessMode,
  isProfessionalMode,
}: {
  compact: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSwitch?: (homeId: string | null) => void;
  homes: HomeOption[];
  homesLoading: boolean;
  homesFailed: boolean;
  onRetryHomes: () => void;
  businesses: BusinessOption[];
  loading: boolean;
  hasSeats: boolean;
  professional: ProfessionalOption | null;
  activeHomeId?: string | null;
  activeBusinessId?: string | null;
  isHomeMode: boolean;
  isBusinessMode: boolean;
  isProfessionalMode: boolean;
}) {
  const router = useRouter();
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number } | null>(null);

  // Position dropdown when open (useLayoutEffect so position is set before paint)
  useLayoutEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxLeft = window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_PADDING;
    let left = compact
      ? rect.right + 8
      : rect.left + rect.width / 2 - DROPDOWN_WIDTH / 2;
    left = Math.max(VIEWPORT_PADDING, Math.min(left, maxLeft));
    setDropdownStyle({
      top: rect.bottom + 8,
      left,
    });
  }, [compact, buttonRef]);

  // Rendered via portal to escape sidebar overflow-hidden
  if (typeof document === 'undefined' || !dropdownStyle) return null;
  return createPortal(
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[70]" onClick={() => onClose()} aria-hidden />

          <div
            className="fixed w-64 bg-surface border border-app rounded-xl shadow-lg z-[80] overflow-hidden max-h-[70vh] overflow-y-auto"
            style={{ top: dropdownStyle.top, left: dropdownStyle.left }}
          >
            {/* Personal */}
            <button
              onClick={() => {
                onSwitch?.(null);
                onClose();
                router.push('/app');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover-bg-app transition ${
                !isHomeMode && !isBusinessMode && !isProfessionalMode ? 'bg-blue-50 dark:bg-primary-900/30' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <IdentityIcons.personal className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-app">Personal</div>
                <div className="text-xs text-app-muted">Your profile & tasks</div>
              </div>
              {!isHomeMode && !isBusinessMode && !isProfessionalMode && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </button>

            {/* Professional */}
            {/* Launch cuts #2 + #4: switching to the Professional profile is hidden. */}
            {launchFeatures.personas && launchFeatures.openGigs && <button
              onClick={() => {
                onSwitch?.(null);
                onClose();
                router.push('/app/professional');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover-bg-app transition ${
                isProfessionalMode ? 'bg-amber-50 dark:bg-amber-900/30' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <IdentityIcons.professional className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-app">Professional</div>
                <div className="text-xs text-app-muted">
                  {professional?.isActive
                    ? `${professional.isPublic ? 'Public' : 'Private'}${professional.verificationTier ? ` · Tier ${professional.verificationTier}` : ''}`
                    : 'Enable pro mode'}
                </div>
              </div>
              {isProfessionalMode && (
                <Check className="w-4 h-4 text-amber-600" />
              )}
            </button>}

            {/* Divider + Homes header */}
            {homes.length > 0 && (
              <div className="px-3 py-1.5 border-t border-app">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-app-muted">
                  Your Homes
                </span>
              </div>
            )}

            {/* Home items */}
            {homesLoading ? (
              <div className="px-3 py-3 text-xs text-app-muted">Loading…</div>
            ) : (
              homes.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    onSwitch?.(h.id);
                    onClose();
                    router.push(`/app/homes/${h.id}/dashboard`);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover-bg-app transition ${
                    activeHomeId === h.id ? 'bg-emerald-50 dark:bg-emerald-900/30' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <IdentityIcons.home className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-app truncate">{h.label}</div>
                    <div className="text-xs text-app-muted truncate">{h.city || h.role}</div>
                  </div>
                  {activeHomeId === h.id && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </button>
              ))
            )}

            {homesFailed && (
              <button onClick={onRetryHomes} className="px-3 py-3 text-xs text-app-muted">
                Couldn’t load your homes. Try again.
              </button>
            )}

            {/* Add home */}
            <button
              onClick={() => { onClose(); router.push('/app/homes/new'); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover-bg-app transition"
            >
              <div className="w-8 h-8 rounded-lg bg-app-surface-sunken flex items-center justify-center">
                <IdentityIcons.add className="w-4 h-4 text-app-text-muted" />
              </div>
              <div className="text-sm font-medium text-app-muted">Add a home</div>
            </button>

            {/* Divider + Businesses header */}
            <div className="px-3 py-1.5 border-t border-app">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-app-muted">
                  Your Businesses
                </span>
                {hasSeats && (
                  <Shield className="w-3 h-3 text-violet-400" />
                )}
              </div>
            </div>

            {/* Business items */}
            {loading ? (
              <div className="px-3 py-3 text-xs text-app-muted">Loading…</div>
            ) : (
              businesses.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onSwitch?.(null);
                    onClose();
                    router.push(`/app/businesses/${b.id}/dashboard`);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover-bg-app transition ${
                    activeBusinessId === b.id ? 'bg-violet-50 dark:bg-violet-900/30' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <IdentityIcons.business className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-app truncate">{b.label}</div>
                    <div className="text-xs text-app-muted truncate capitalize">
                      {b.seatDisplayName
                        ? `${b.seatDisplayName} · ${b.seatRole || b.role}`
                        : `${b.type} · ${b.role}`}
                    </div>
                  </div>
                  {activeBusinessId === b.id && (
                    <Check className="w-4 h-4 text-violet-600" />
                  )}
                </button>
              ))
            )}

            {/* Create business */}
            <button
              onClick={() => { onClose(); router.push('/app/businesses/new'); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left border-t border-app hover-bg-app transition"
            >
              <div className="w-8 h-8 rounded-lg bg-app-surface-sunken flex items-center justify-center">
                <IdentityIcons.add className="w-4 h-4 text-app-text-muted" />
              </div>
              <div className="text-sm font-medium text-app-muted">Create a business</div>
            </button>
          </div>
        </>,
        document.body
  );
}
