'use client';

import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { IdentityIcons } from '@/lib/icons';
import { Check, ChevronDown, Shield } from 'lucide-react';
import type { MySeat } from '@pantopus/types';

type HomeOption = {
  id: string;
  label: string;
  city?: string;
  role?: string;
};

type BusinessOption = {
  id: string;
  label: string;
  type?: string;
  role?: string;
  /** Seat-based: display name from BusinessSeat */
  seatDisplayName?: string;
  /** Seat-based: role from BusinessSeat */
  seatRole?: string;
};

type ProfessionalOption = {
  isActive: boolean;
  isPublic: boolean;
  verificationTier?: number;
};

export default function ProfileToggle({
  activeHomeId,
  activeBusinessId,
  onSwitch,
  compact = false,
}: {
  activeHomeId?: string | null;
  activeBusinessId?: string | null;
  onSwitch?: (homeId: string | null) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [homes, setHomes] = useState<HomeOption[]>([]);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [professional, setProfessional] = useState<ProfessionalOption | null>(null);
  const [hasSeats, setHasSeats] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [homesRes, bizRes, proRes, seatsRes] = await Promise.allSettled([
          api.homes.getMyHomes(),
          api.businesses.getMyBusinesses(),
          api.professional.getMyProfile(),
          api.businessSeats.getMySeats(),
        ]);

        // Load seats first to enrich business list
        let seatsByBusiness: Record<string, MySeat> = {};
        if (seatsRes.status === 'fulfilled') {
          const seatList: MySeat[] = (seatsRes.value as Record<string, unknown>)?.seats as MySeat[] ?? [];
          if (seatList.length > 0) {
            setHasSeats(true);
            seatsByBusiness = Object.fromEntries(
              seatList.map((s) => [s.business_user_id, s])
            );
          }
        }

        if (homesRes.status === 'fulfilled') {
          const list = (homesRes.value as Record<string, unknown>)?.homes as Record<string, unknown>[] ?? [];
          setHomes(
            list.map((h: Record<string, unknown>) => ({
              id: h.id as string,
              label: (h.name as string) || [h.address, h.address2].filter(Boolean).join(' ') || 'Home',
              city: [h.city, h.state].filter(Boolean).join(', '),
              role: (h.occupancy as Record<string, unknown>)?.role as string || 'member',
            }))
          );
        }

        if (bizRes.status === 'fulfilled') {
          const list = (bizRes.value as Record<string, unknown>)?.businesses as Record<string, unknown>[] ?? [];
          setBusinesses(
            list.map((m: Record<string, unknown>) => {
              const seat = seatsByBusiness[m.business_user_id as string];
              return {
                id: m.business_user_id as string,
                label: (m.business as Record<string, unknown>)?.name as string || (m.business as Record<string, unknown>)?.username as string || 'Business',
                type: (m.profile as Record<string, unknown>)?.business_type as string || 'general',
                role: m.role_base as string || 'viewer',
                seatDisplayName: seat?.display_name,
                seatRole: seat?.role_base,
              };
            })
          );
        }

        if (proRes.status === 'fulfilled') {
          const p = (proRes.value as Record<string, unknown>)?.profile as Record<string, unknown> | undefined;
          if (p?.is_active) {
            setProfessional({
              isActive: true,
              isPublic: Boolean(p?.is_public),
              verificationTier: typeof p?.verification_tier === 'number' ? p.verification_tier : 0,
            });
          } else {
            setProfessional(null);
          }
        } else {
          setProfessional(null);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Dropdown dimensions (w-64 = 16rem = 256px)
  const DROPDOWN_WIDTH = 256;
  const VIEWPORT_PADDING = 8;

  // Position dropdown when open (useLayoutEffect so position is set before paint)
  useLayoutEffect(() => {
    if (!open || typeof document === 'undefined' || typeof window === 'undefined') return;
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
  }, [open, compact]);

  const activeHome = homes.find((h) => h.id === activeHomeId);
  const activeBusiness = businesses.find((b) => b.id === activeBusinessId);
  const isHomeMode = !!activeHomeId && !!activeHome;
  const isBusinessMode = !!activeBusinessId && !!activeBusiness;
  const isProfessionalMode = pathname.startsWith('/app/professional');

  const CurrentIcon = isProfessionalMode ? IdentityIcons.professional : isBusinessMode ? IdentityIcons.business : isHomeMode ? IdentityIcons.home : IdentityIcons.personal;
  const currentLabel = isProfessionalMode
    ? 'Professional'
    : isBusinessMode
    ? activeBusiness.label
    : isHomeMode
    ? activeHome.label
    : 'Personal';
  const currentColor = isProfessionalMode
    ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 hover:border-amber-300 dark:hover:border-amber-500'
    : isBusinessMode
    ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-700 hover:border-violet-300 dark:hover:border-violet-500'
    : isHomeMode
    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 hover:border-emerald-300 dark:hover:border-emerald-500'
    : 'bg-surface-muted border-app hover-bg-app';

  // Compact icon-only button color
  const compactIconColor = isProfessionalMode
    ? 'text-amber-600'
    : isBusinessMode
    ? 'text-violet-600'
    : isHomeMode
    ? 'text-emerald-600'
    : 'text-primary-600';

  const compactBgColor = isProfessionalMode
    ? 'bg-amber-50 dark:bg-amber-900/30'
    : isBusinessMode
    ? 'bg-violet-50 dark:bg-violet-900/30'
    : isHomeMode
    ? 'bg-emerald-50 dark:bg-emerald-900/30'
    : 'bg-blue-50 dark:bg-primary-900/30';

  return (
    <div className="relative">
      {/* Toggle Button */}
      {compact ? (
        <button
          ref={buttonRef}
          onClick={() => setOpen(!open)}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition hover-bg-app ${compactBgColor}`}
          title={currentLabel}
        >
          <CurrentIcon className={`w-5 h-5 ${compactIconColor}`} />
        </button>
      ) : (
        <button
          ref={buttonRef}
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition text-left ${currentColor}`}
        >
          <CurrentIcon className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-semibold text-app truncate max-w-[120px]">
            {currentLabel}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-app-muted flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Dropdown — rendered via portal to escape sidebar overflow-hidden */}
      {open && typeof document !== 'undefined' && dropdownStyle && createPortal(
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} aria-hidden />

          <div
            className="fixed w-64 bg-surface border border-app rounded-xl shadow-lg z-[80] overflow-hidden max-h-[70vh] overflow-y-auto"
            style={{ top: dropdownStyle.top, left: dropdownStyle.left }}
          >
            {/* Personal */}
            <button
              onClick={() => {
                onSwitch?.(null);
                setOpen(false);
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
            <button
              onClick={() => {
                onSwitch?.(null);
                setOpen(false);
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
            </button>

            {/* Divider + Homes header */}
            {homes.length > 0 && (
              <div className="px-3 py-1.5 border-t border-app">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-app-muted">
                  Your Homes
                </span>
              </div>
            )}

            {/* Home items */}
            {loading ? (
              <div className="px-3 py-3 text-xs text-app-muted">Loading…</div>
            ) : (
              homes.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    onSwitch?.(h.id);
                    setOpen(false);
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

            {/* Add home */}
            <button
              onClick={() => { setOpen(false); router.push('/app/homes/new'); }}
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
                    setOpen(false);
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
              onClick={() => { setOpen(false); router.push('/app/businesses/new'); }}
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
      )}
    </div>
  );
}
