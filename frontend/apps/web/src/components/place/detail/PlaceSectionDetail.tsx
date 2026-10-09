// ============================================================
// PlaceSectionDetail — the authed container for /app/place/[section].
//
// Resolves the resident's primary home + its PlaceIntelligence (the
// same queries the dashboard uses, so it's a warm cache hit on
// tap-through), owns the page states (auth gate, shimmer, error,
// no-place), then dispatches the matching group-detail view.
// Mobile-web-first single column with a comfortable desktop max-width.
// ============================================================

'use client';

import { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { MapPinned } from 'lucide-react';
import type { PlaceGroup, PlaceViewer } from '@pantopus/types';
import { queryKeys } from '@/lib/query-keys';
import { useMe } from '@/lib/me';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { ShimmerBlock } from '@/components/ui/Shimmer';
import { DetailHeader, PlaceHomeContext, placeHomeQuery } from '@/components/archetypes/place';
import PlaceShell from '../PlaceShell';
import { PLACE_DETAIL_BY_SLUG, placeSlugsNotForViewer } from './sections';
import TodayDetail from './TodayDetail';
import YourHomeDetail from './YourHomeDetail';
import RiskDetail from './RiskDetail';
import BlockDetail from './BlockDetail';
import MoneyDetail from './MoneyDetail';
import CivicDetail from './CivicDetail';
import IdentityDetail from './IdentityDetail';
import { usePrimaryHome } from '@/lib/primaryHome';

function DetailShell({ section, hidden, children }: { section: string; hidden?: string[]; children: React.ReactNode }) {
  return <PlaceShell active={section} hidden={hidden}>{children}</PlaceShell>;
}

// What a viewer is told on a page that isn't part of their view of a Home.
function notForViewer(group: PlaceGroup, role: PlaceViewer['role']): { title: string; description: string } {
  if (role === 'nonresident') {
    return {
      title: group === 'money_signals' ? 'Money signals are for the household' : 'Home records are for the household',
      description: "Guests and service providers see this address's public information: today, risk and readiness, the block and civic details.",
    };
  }
  return {
    title: 'Money signals are for the owner or renter',
    description: "Bill comparisons, rent and property-tax checks belong to whoever owns or rents this home. Your Place still shows the home's details, its risks and today's conditions.",
  };
}

function DetailSkeleton() {
  return (
    <div className="px-4 sm:px-5 pt-1 pb-16" role="status">
      <span className="sr-only">Loading section details…</span>
      <div aria-hidden="true">
        <div className="h-3 w-24 mt-6 mb-2"><ShimmerBlock className="h-3 w-24" /></div>
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
              <div className="flex items-center gap-3 mb-3">
                <ShimmerBlock className="w-11 h-11 rounded-xl" />
                <div className="flex-1 flex flex-col gap-2">
                  <ShimmerBlock className="h-4 w-1/3" />
                  <ShimmerBlock className="h-3 w-1/2" />
                </div>
              </div>
              <ShimmerBlock className="h-3 w-5/6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlaceSectionDetail({ section }: { section: string }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const meta = PLACE_DETAIL_BY_SLUG[section];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !getAuthToken()) {
      router.replace(`/login?redirectTo=${encodeURIComponent(`/app/place/${section}`)}`);
    }
  }, [mounted, router, section]);

  const authed = mounted && !!getAuthToken();
  const valid = !!meta;

  const homeQuery = usePrimaryHome({ enabled: authed && valid });

  // The switcher's place (?home=) when there is one, else the primary home,
  // else the resident's own private setup (as on the overview).
  const switchedHome = useContext(PlaceHomeContext);
  const noSharedHome = homeQuery.isSuccess && !homeQuery.data?.home && !switchedHome;
  const myHomesQuery = useQuery({
    queryKey: queryKeys.placeMyHomes(),
    queryFn: async () => api.homes.getMyHomes(),
    enabled: authed && valid && noSharedHome,
    staleTime: 60_000,
  });
  const privateSetupId = (myHomesQuery.data?.homes ?? []).find((h) => h.access_kind === 'private_setup')?.id ?? null;
  const homeId = switchedHome ?? homeQuery.data?.home?.id ?? privateSetupId;

  // Without any home, a saved address still deserves a straight answer.
  const savedQuery = useQuery({
    queryKey: ['place', 'saved-places'],
    queryFn: async () => api.savedPlaces.getSavedPlaces(),
    enabled: authed && valid && noSharedHome && myHomesQuery.isFetched && !privateSetupId,
    staleTime: 60_000,
  });
  const savedPlace = savedQuery.data?.savedPlaces?.[0] ?? null;

  const intelQuery = useQuery({
    queryKey: homeId ? queryKeys.placeIntelligence(homeId) : ['place', 'intelligence', 'none'],
    queryFn: async () => api.place.getPlaceIntelligence(homeId as string),
    enabled: authed && valid && !!homeId,
    staleTime: 60_000,
  });

  // Resident name is only needed by the Identity detail.
  const userQuery = useMe({ enabled: authed && valid && section === 'identity' });

  // ── Unknown section ───────────────────────────────────────
  if (!valid) {
    return (
      <DetailShell section={section}>
        <DetailHeader title="Not found" />
        <div className="px-4 sm:px-5">
          <EmptyState
            icon={MapPinned}
            title="That section doesn't exist"
            description="Head back to your Place to pick up where you left off."
            actionLabel="Back to your Place"
            onAction={() => router.push(`/app/place${placeHomeQuery(switchedHome)}`)}
          />
        </div>
      </DetailShell>
    );
  }

  if (!mounted || !authed) {
    return (
      <DetailShell section={section}>
        <DetailHeader title={meta.title} />
        <DetailSkeleton />
      </DetailShell>
    );
  }

  if (homeQuery.isError) {
    return (
      <DetailShell section={section}>
        <DetailHeader title={meta.title} />
        <div className="px-4 sm:px-5">
          <ErrorState message="We couldn't load your place. Check your connection and try again." onRetry={() => homeQuery.refetch()} />
        </div>
      </DetailShell>
    );
  }

  if (homeQuery.isSuccess && !homeId) {
    if (myHomesQuery.isError || savedQuery.isError) {
      return (
        <DetailShell section={section}>
          <DetailHeader title={meta.title} />
          <div className="px-4 sm:px-5">
            <ErrorState
              message="We couldn't load your place. Check your connection and try again."
              onRetry={() => { void (myHomesQuery.isError ? myHomesQuery.refetch() : savedQuery.refetch()); }}
            />
          </div>
        </DetailShell>
      );
    }
    if (myHomesQuery.isPending || savedQuery.isPending) {
      return (
        <DetailShell section={section}>
          <DetailHeader title={meta.title} />
          <DetailSkeleton />
        </DetailShell>
      );
    }
    return (
      <DetailShell section={section}>
        <DetailHeader title={meta.title} />
        <div className="px-4 sm:px-5">
          {savedPlace ? (
            <EmptyState
              icon={MapPinned}
              title="Set up this home to see this"
              description={`You saved ${savedPlace.label}. Its public information is on the overview; ${meta.title} needs the home set up.`}
              actionLabel="Set up this home"
              headingLevel={2}
              onAction={() => router.push(`/app/homes/new?savedPlace=${encodeURIComponent(savedPlace.id)}`)}
            />
          ) : (
            <EmptyState
              icon={MapPinned}
              title="You haven't added a place yet"
              description="Claim your address to see flood risk, today's air, your home's value, and your verified neighbors."
              actionLabel="Add your place"
              headingLevel={2}
              onAction={() => router.push('/app/homes')}
            />
          )}
        </div>
      </DetailShell>
    );
  }

  if (homeQuery.isPending || intelQuery.isPending) {
    return (
      <DetailShell section={section}>
        <DetailHeader title={meta.title} />
        <DetailSkeleton />
      </DetailShell>
    );
  }

  if (intelQuery.isError || !intelQuery.data) {
    // A 403 means this account can't see the place: say so, without a retry.
    const denied = (intelQuery.error as { statusCode?: number } | null)?.statusCode === 403;
    return (
      <DetailShell section={section}>
        <DetailHeader title={meta.title} />
        <div className="px-4 sm:px-5">
          {denied ? (
            <ErrorState title="This place isn't available" message="You don't have permission to view this place." />
          ) : (
            <ErrorState message="We couldn't load your place. Check your connection and try again." onRetry={() => intelQuery.refetch()} />
          )}
        </div>
      </DetailShell>
    );
  }

  const intelligence = intelQuery.data;
  const residentName = userQuery.data?.name || userQuery.data?.firstName || '';
  const hidden = placeSlugsNotForViewer(intelligence);

  // The server leaves out the groups that don't apply to this viewer; a
  // link or bookmark to one gets a straight answer, not empty cards.
  if (hidden.includes(section) && intelligence.viewer) {
    const copy = notForViewer(meta.group, intelligence.viewer.role);
    return (
      <DetailShell section={section} hidden={hidden}>
        <DetailHeader title={meta.title} />
        <div className="px-4 sm:px-5">
          <EmptyState
            icon={MapPinned}
            title={copy.title}
            description={copy.description}
            actionLabel="Back to your Place"
            headingLevel={2}
            onAction={() => router.push(`/app/place${placeHomeQuery(switchedHome)}`)}
          />
        </div>
      </DetailShell>
    );
  }

  return (
    <DetailShell section={section} hidden={hidden}>
      {meta.group === 'today' && <TodayDetail intelligence={intelligence} homeId={homeId} />}
      {meta.group === 'your_home' && <YourHomeDetail intelligence={intelligence} homeId={homeId} />}
      {meta.group === 'risk_readiness' && <RiskDetail intelligence={intelligence} homeId={homeId} />}
      {meta.group === 'your_block' && <BlockDetail intelligence={intelligence} homeId={homeId} />}
      {meta.group === 'money_signals' && <MoneyDetail intelligence={intelligence} homeId={homeId} />}
      {meta.group === 'civic' && <CivicDetail intelligence={intelligence} />}
      {meta.group === 'identity' && <IdentityDetail intelligence={intelligence} homeId={homeId} residentName={residentName} />}
    </DetailShell>
  );
}
