// ============================================================
// PlaceDashboard — the authed container for /app/place.
//
// Resolves the resident's primary home, then fetches its
// PlaceIntelligence and hands it to the presentational view. Owns the
// page states: auth gate, shimmer skeleton (loading), error (retry),
// and the no-place empty state. Responsive single column, mobile-web
// first with a comfortable desktop max-width.
// ============================================================

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { MapPinned } from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import type { PlaceSwitcherHome } from '@/components/archetypes/place';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import PlaceDashboardView from './PlaceDashboardView';
import PlaceDashboardSkeleton from './PlaceDashboardSkeleton';
import PlaceShell from './PlaceShell';

const REDIRECT_TO = encodeURIComponent('/app/place');

// Comfortable reading column on mobile; at lg+ the shared PlaceShell
// adds the persistent section rail beside a wider content column.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PlaceShell active="overview">
      <div className="px-4 sm:px-5 py-5 sm:py-6">{children}</div>
    </PlaceShell>
  );
}

export default function PlaceDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  // The place the dashboard is showing — null until the resident picks
  // one in the switcher, then it overrides the primary home.
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // getAuthToken gate (middleware also guards /app/*; this is the client guard).
  useEffect(() => {
    if (mounted && !getAuthToken()) {
      router.replace(`/login?redirectTo=${REDIRECT_TO}`);
    }
  }, [mounted, router]);

  const authed = mounted && !!getAuthToken();

  // 1) Resolve the resident's primary home (the default place).
  const homeQuery = useQuery({
    queryKey: queryKeys.placePrimaryHome(),
    queryFn: async () => api.homes.getPrimaryHome(),
    enabled: authed,
    staleTime: 60_000,
  });

  // 1b) The resident's full list of places — powers the multi-home
  // switcher. Supplementary: it never gates the dashboard, so if it
  // fails the dashboard still renders (without the switch affordance).
  const myHomesQuery = useQuery({
    queryKey: queryKeys.placeMyHomes(),
    queryFn: async () => api.homes.getMyHomes(),
    enabled: authed,
    staleTime: 60_000,
  });

  // The active home: an explicit switch wins, else the primary home.
  const homeId = selectedHomeId ?? homeQuery.data?.home?.id ?? null;

  // Places for the switcher. Verified mirrors the dashboard tier (T4):
  // a verified occupancy or a verified owner; everything else is claimed.
  const switchHomes = useMemo<PlaceSwitcherHome[]>(
    () =>
      (myHomesQuery.data?.homes ?? []).map((h) => {
        const unit = h.unit_number?.replace(/^#/, '').trim();
        const verified =
          h.occupancy?.verification_status === 'verified' || h.ownership_status === 'verified';
        return {
          id: h.id,
          line1: unit ? `${h.address} #${unit}` : h.address,
          city: [h.city, h.state].filter(Boolean).join(', '),
          status: verified ? 'verified' : 'claimed',
        };
      }),
    [myHomesQuery.data],
  );

  // 2) Fetch its PlaceIntelligence (dependent on the active home id).
  // Switching homes changes the key, which re-queries the contract.
  const intelQuery = useQuery({
    queryKey: homeId ? queryKeys.placeIntelligence(homeId) : ['place', 'intelligence', 'none'],
    queryFn: async () => api.place.getPlaceIntelligence(homeId as string),
    enabled: authed && !!homeId,
    staleTime: 60_000,
  });

  // ── States ───────────────────────────────────────────────
  if (!mounted || !authed) {
    return <Shell><PlaceDashboardSkeleton /></Shell>;
  }

  if (homeQuery.isError) {
    return (
      <Shell>
        <ErrorState message="We couldn't load your place. Check your connection and try again." onRetry={() => homeQuery.refetch()} />
      </Shell>
    );
  }

  // No claimed home yet — point at adding one (the funnel claims/verifies elsewhere).
  if (homeQuery.isSuccess && !homeId) {
    return (
      <Shell>
        <EmptyState
          icon={MapPinned}
          title="You haven't added a place yet"
          description="Claim your address to see flood risk, today's air, your home's value, and your verified neighbors."
          actionLabel="Add your place"
          onAction={() => router.push('/app/homes')}
        />
      </Shell>
    );
  }

  if (homeQuery.isPending || intelQuery.isPending) {
    return <Shell><PlaceDashboardSkeleton /></Shell>;
  }

  if (intelQuery.isError || !intelQuery.data) {
    return (
      <Shell>
        <ErrorState message="We couldn't load your place. Check your connection and try again." onRetry={() => intelQuery.refetch()} />
      </Shell>
    );
  }

  return (
    <Shell>
      <PlaceDashboardView
        intelligence={intelQuery.data}
        homeId={homeId as string}
        onOpenSection={(slug) => router.push(`/app/place/${slug}`)}
        onOpenPulse={() => router.push('/app/place/pulse')}
        switchHomes={switchHomes}
        activeHomeId={homeId}
        onSwitchHome={setSelectedHomeId}
        onAddPlace={() => router.push('/app/homes/new')}
        onClaim={() => router.push('/app/homes')}
      />
    </Shell>
  );
}
