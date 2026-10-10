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

import { useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import type { PlaceSwitcherHome } from '@/components/archetypes/place';
import { PlaceHomeContext, placeHomeQuery } from '@/components/archetypes/place';
import ErrorState from '@/components/ui/ErrorState';
import SavedPlaceContext from './SavedPlaceContext';
import { placeSlugsNotForViewer } from './detail/sections';
import PlaceDashboardView from './PlaceDashboardView';
import PlaceDashboardSkeleton from './PlaceDashboardSkeleton';
import PlaceShell from './PlaceShell';
import SetupBanner from '@/components/hub/SetupBanner';
import { usePrimaryHome } from '@/lib/primaryHome';
import { myHomesQuery as sharedMyHomesQuery } from '@/lib/myHomes';
import { PLACE_FRESH_MS, gatedStaleTime, placeCopyGate, useAfterRecheck } from '@/lib/householdCopy';

const REDIRECT_TO = encodeURIComponent('/app/place');

// Comfortable reading column on mobile; at lg+ the shared PlaceShell
// adds the persistent section rail beside a wider content column.
function Shell({ hidden, children }: { hidden?: string[]; children: React.ReactNode }) {
  return (
    <PlaceShell active="overview" hidden={hidden}>
      <div className="px-4 sm:px-5 py-5 sm:py-6">{children}</div>
    </PlaceShell>
  );
}

export default function PlaceDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  // The place the dashboard is showing — null until the resident picks
  // one in the switcher, then it overrides the primary home. The pick is
  // kept in the URL as ?home= so the section pages, Pulse and the rail
  // follow it; the URL is the source of truth once it catches up.
  const switchedHome = useContext(PlaceHomeContext);
  const [pickedHomeId, setPickedHomeId] = useState<string | null>(null);
  useEffect(() => { setPickedHomeId(null); }, [switchedHome]);
  const selectedHomeId = pickedHomeId ?? switchedHome;

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

  // The setup checklist (Hub absorption): read from the hub payload, shown
  // above the dashboard until every step is done. Best effort — a hub
  // failure never blocks the place page.
  const hubQuery = useQuery({
    queryKey: ['hub', 'setup'],
    queryFn: () => api.hub.getHub(),
    enabled: authed,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const setupSteps = hubQuery.data?.setup?.steps ?? [];

  // 1) Resolve the resident's primary home (the default place).
  const homeQuery = usePrimaryHome({ enabled: authed });

  // 1b) The resident's full list of places — powers the multi-home
  // switcher. Supplementary: it never gates the dashboard, so if it
  // fails the dashboard still renders (without the switch affordance).
  const myHomesQuery = useQuery({ ...sharedMyHomesQuery(), enabled: authed });

  // The resident's own private setup is their place too until they share a
  // household: the server answers it with public readings only (tier T1).
  const privateSetupId = useMemo(
    () => (myHomesQuery.data?.homes ?? []).find((h) => h.access_kind === 'private_setup')?.id ?? null,
    [myHomesQuery.data],
  );

  // The active home: an explicit switch wins, then the primary home, then
  // the private setup.
  const homeId = selectedHomeId ?? homeQuery.data?.home?.id ?? privateSetupId;
  // Links carry the place only when it isn't the primary home.
  const linkHomeId = homeId !== homeQuery.data?.home?.id ? homeId : null;

  // Places for the switcher. Verified mirrors the dashboard tier (T4):
  // a verified occupancy or a verified owner; everything else is claimed.
  const switchHomes = useMemo<PlaceSwitcherHome[]>(
    () =>
      (myHomesQuery.data?.homes ?? []).filter(h => h.has_home_access === true).map((h) => {
        const unit = h.unit_number?.replace(/^#/, '').trim();
        const verified =
          h.occupancy?.verification_status === 'verified' || h.ownership_status === 'verified';
        return {
          id: h.id,
          line1: unit && h.address ? `${h.address} #${unit}` : h.address || h.name || 'Home',
          city: [h.city, h.state].filter(Boolean).join(', '),
          status: verified ? 'verified' : 'claimed',
        };
      }),
    [myHomesQuery.data],
  );

  // 2) Fetch its PlaceIntelligence (dependent on the active home id).
  // Switching homes changes the key, which re-queries the contract.
  const showsCopy = placeCopyGate(myHomesQuery.data?.homes.find((home) => home.id === homeId));
  const intelQuery = useQuery({
    queryKey: homeId ? queryKeys.placeIntelligence(homeId) : ['place', 'intelligence', 'none'],
    queryFn: async () => api.place.getPlaceIntelligence(homeId as string),
    enabled: authed && !!homeId,
    staleTime: gatedStaleTime(PLACE_FRESH_MS, showsCopy),
  });
  // A guest's or service provider's copy shows only once the re-check answers (decision 3).
  const { data: intelligence, waiting: intelWaiting } = useAfterRecheck(intelQuery, showsCopy);

  // ── States ───────────────────────────────────────────────
  // Coming back to Place shows what this tab already loaded in the first frame; the skeleton is
  // only for nothing at all (a fresh page load starts with an empty cache, like the server).
  const kept = intelligence !== undefined;
  if (!kept && (!mounted || !authed)) {
    return <Shell><PlaceDashboardSkeleton /></Shell>;
  }

  // A failed refresh keeps the place on screen (contract §3); errors show only with nothing to show.
  if (homeQuery.isError && !kept) {
    return (
      <Shell>
        <ErrorState message="We couldn't load your place. Check your connection and try again." onRetry={() => homeQuery.refetch()} />
      </Shell>
    );
  }

  // No home yet: saved addresses, or a pointer to adding one (the funnel
  // claims/verifies elsewhere). Wait for the Home list first, so a private
  // setup doesn't flash the no-home view.
  if (homeQuery.isSuccess && !homeId) {
    return (
      <Shell>
        {myHomesQuery.isPending ? <PlaceDashboardSkeleton /> : <SavedPlaceContext />}
      </Shell>
    );
  }

  if (!kept && (homeQuery.isPending || intelQuery.isPending || intelWaiting)) {
    return <Shell><PlaceDashboardSkeleton /></Shell>;
  }

  if (!intelligence) {
    // A 403 means this account can't see the place (e.g. ?home= from another
    // account): not a connection problem, and a retry can't change it.
    const denied = (intelQuery.error as { statusCode?: number } | null)?.statusCode === 403;
    return (
      <Shell>
        {denied ? (
          <ErrorState title="This place isn't available" message="You don't have permission to view this place." />
        ) : (
          <ErrorState message="We couldn't load your place. Check your connection and try again." onRetry={() => intelQuery.refetch()} />
        )}
      </Shell>
    );
  }

  return (
    <Shell hidden={placeSlugsNotForViewer(intelligence)}>
      {/* Hub absorption (Phase 1 follow-up): the setup checklist lives on the
          place page now, in wedge order (claim → verify → profile). */}
      {setupSteps.length > 0 && !setupSteps.every((s) => s.done) ? (
        <div className="px-4 pt-4"><SetupBanner steps={setupSteps} /></div>
      ) : null}
      <div className="mb-4"><button className="text-sm text-primary-700 dark:text-primary-300" onClick={() => router.push('/app/place?savedPlace=all')}>Saved address previews</button></div>
      <PlaceDashboardView
        intelligence={intelligence}
        homeId={homeId as string}
        onOpenSection={(slug) => router.push(`/app/place/${slug}${placeHomeQuery(linkHomeId)}`)}
        onOpenPulse={() => router.push(`/app/place/pulse${placeHomeQuery(linkHomeId)}`)}
        onRetry={() => { void intelQuery.refetch(); }}
        retrying={intelQuery.isFetching}
        switchHomes={switchHomes}
        activeHomeId={homeId}
        moveInDate={intelligence.move_in_date ?? null}
        onSwitchHome={(id) => {
          setPickedHomeId(id);
          router.replace(`/app/place${placeHomeQuery(id === homeQuery.data?.home?.id ? null : id)}`);
        }}
        onAddPlace={() => router.push('/app/homes/new')}
        onVerifyByMail={() => router.push(`/app/homes/${homeId}/verify-postcard?return=place`)}
      />
    </Shell>
  );
}
