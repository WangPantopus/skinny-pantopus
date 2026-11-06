'use client';

import { useEffect, useMemo, useState, useRef, type ComponentProps, type ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { myHomesQuery } from '@/lib/myHomes';
import { showsMyHomesCopy, useAfterRecheck } from '@/lib/householdCopy';
import { queryKeys } from '@/lib/query-keys';
import { IdentityIcons } from '@/lib/icons';
import { ChevronDown } from 'lucide-react';
import type { MySeat } from '@pantopus/types';
import { launchFeatures } from '@/lib/featureFlags';
import { afterInboxRows, useShellReadsReleased } from '@/lib/shellReads';

export type HomeOption = {
  id: string;
  label: string;
  city?: string;
  role?: string;
};

export type BusinessOption = {
  id: string;
  label: string;
  type?: string;
  role?: string;
  /** Seat-based: display name from BusinessSeat */
  seatDisplayName?: string;
  /** Seat-based: role from BusinessSeat */
  seatRole?: string;
};

export type ProfessionalOption = {
  isActive: boolean;
  isPublic: boolean;
  verificationTier?: number;
};

/** Fired after a Home's name is saved, so the switcher shows it without a reload. */
export const HOMES_CHANGED_EVENT = 'pantopus:homes-changed';

export function notifyHomesChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HOMES_CHANGED_EVENT));
}

type MenuComponent = ComponentType<ComponentProps<typeof import('./ProfileMenu').default>>;

// The menu loads on its first open, and hovering or focusing the button fetches it
// ahead, so every page's first scripts leave it out. A failed load (offline, say)
// is tried again on the next open.
let menuModule: Promise<{ default: MenuComponent }> | null = null;
function loadMenu() {
  menuModule ??= import('./ProfileMenu').catch((error: unknown) => {
    menuModule = null;
    throw error;
  });
  return menuModule;
}

function toHomeOptions(list: Record<string, unknown>[]): HomeOption[] {
  return list.map((h: Record<string, unknown>) => ({
    id: h.id as string,
    label: (h.name as string) || [h.address, h.address2].filter(Boolean).join(' ') || 'Home',
    city: [h.city, h.state].filter(Boolean).join(', '),
    role: (h.occupancy as Record<string, unknown>)?.role as string || 'member',
  }));
}

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
  const pathname = usePathname();
  // Your homes: the entry Place reads too (lib/myHomes.ts), so the switcher shows them at once and
  // follows changes (a rename, the `homes` signal) without its own reads. A cold Messages inbox
  // paints its rows first (lib/shellReads.ts).
  const queryClient = useQueryClient();
  const shellReadsReleased = useShellReadsReleased();
  const homesQuery = useQuery({ ...myHomesQuery(), enabled: shellReadsReleased });
  const [homeOpenedAt, setHomeOpenedAt] = useState(() => Date.now());
  const { data: checkedHomes } = useAfterRecheck(homesQuery, showsMyHomesCopy);
  const homesReply = checkedHomes && (showsMyHomesCopy(checkedHomes) || homesQuery.dataUpdatedAt >= homeOpenedAt)
    ? checkedHomes : undefined;
  const homes = useMemo(
    () => toHomeOptions(((homesReply as Record<string, unknown> | undefined)?.homes as Record<string, unknown>[] | undefined) ?? []),
    [homesReply],
  );
  const homesLoading = !homesReply && (homesQuery.isPending || homesQuery.isFetching);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [professional, setProfessional] = useState<ProfessionalOption | null>(null);
  const [hasSeats, setHasSeats] = useState(false);
  const [open, setOpen] = useState(false);
  const [Menu, setMenu] = useState<MenuComponent | null>(null);
  const toggleOpen = () => {
    if (!open) {
      setHomeOpenedAt(Date.now());
      if (!showsMyHomesCopy(homesQuery.data)) void homesQuery.refetch();
      if (!Menu) loadMenu().then((loaded) => setMenu(() => loaded.default), () => setOpen(false));
    }
    setOpen(!open);
  };
  const preloadMenu = () => { void loadMenu().catch(() => {}); };
  const [loading, setLoading] = useState(true);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => afterInboxRows(() => {
    (async () => {
      try {
        const [bizRes, proRes, seatsRes] = await Promise.allSettled([
          api.businesses.getMyBusinesses(),
          // Professional mode is a launch cut (#2 + #4): no profile to read while it's off.
          launchFeatures.personas && launchFeatures.openGigs ? api.professional.getMyProfile() : Promise.resolve(null),
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
  }), []);

  // A rename saved elsewhere in the app reads the Homes again; a failed read keeps the last list.
  useEffect(() => {
    const reread = () => { void queryClient.invalidateQueries({ queryKey: queryKeys.placeMyHomes() }); };
    window.addEventListener(HOMES_CHANGED_EVENT, reread);
    return () => window.removeEventListener(HOMES_CHANGED_EVENT, reread);
  }, [queryClient]);

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
          onClick={toggleOpen}
          onPointerEnter={preloadMenu}
          onFocus={preloadMenu}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition hover-bg-app ${compactBgColor}`}
          title={currentLabel}
        >
          <CurrentIcon className={`w-5 h-5 ${compactIconColor}`} />
        </button>
      ) : (
        <button
          ref={buttonRef}
          onClick={toggleOpen}
          onPointerEnter={preloadMenu}
          onFocus={preloadMenu}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition text-left ${currentColor}`}
        >
          <CurrentIcon className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-semibold text-app truncate max-w-[120px]">
            {currentLabel}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-app-muted flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {open && Menu && (
        <Menu
          compact={compact}
          buttonRef={buttonRef}
          onClose={() => setOpen(false)}
          onSwitch={onSwitch}
          homes={homes}
          homesLoading={homesLoading}
          homesFailed={!homesReply && homesQuery.isError}
          onRetryHomes={() => void homesQuery.refetch()}
          businesses={businesses}
          loading={loading}
          hasSeats={hasSeats}
          professional={professional}
          activeHomeId={activeHomeId}
          activeBusinessId={activeBusinessId}
          isHomeMode={isHomeMode}
          isBusinessMode={isBusinessMode}
          isProfessionalMode={isProfessionalMode}
        />
      )}
    </div>
  );
}
