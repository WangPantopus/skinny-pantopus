// ============================================================
// Today — loads the primary home's civic_election section (the Ballot
// P0 fields arrive only when ballot_p0 is on for this user) and shows
// the ballot-week card and the "Moved this year?" well when either
// applies. Best effort: a failure here never touches the rest of Today.
//
// The loading is a hook the Today page calls at its top, so the reads
// start with the page instead of after the briefing arrives. They start
// only for a viewer who has ballot_p0 (one small flag read, cached for a
// minute); everyone else sends no home or election request at all.
// ============================================================

'use client';

import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { PlaceBallotElectionData } from '@pantopus/types';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';
import { queryKeys } from '@/lib/query-keys';
import { ballotCardData } from './BallotCard';
import BallotTodayCard, { hasBallotToday } from './BallotTodayCard';

/** The Ballot P0 card data for the primary home, or null (flag off, no home, nothing to show, a failure). */
export function useBallotToday(enabled = true): PlaceBallotElectionData | null {
  const flag = useFeatureFlagState('ballot_p0', { enabled });
  const allowed = enabled && flag.enabled;

  const homeQuery = useQuery({
    queryKey: queryKeys.placePrimaryHome(),
    queryFn: async () => api.homes.getPrimaryHome(),
    enabled: allowed,
    staleTime: 60_000,
    retry: false,
  });
  const homeId = homeQuery.data?.home?.id ?? null;

  const ballotQuery = useQuery({
    queryKey: homeId ? queryKeys.placeBallot(homeId) : ['place', 'intelligence', 'none', 'civic_election'],
    queryFn: async () => api.place.getPlaceIntelligence(homeId as string, ['civic_election']),
    enabled: allowed && !!homeId,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const section = ballotQuery.data?.groups.flatMap((g) => g.sections).find((s) => s.id === 'civic_election');
  return section && section.status === 'ready' ? ballotCardData(section.data) : null;
}

export default function BallotTodaySection({ data, className = '' }: { data: PlaceBallotElectionData | null; className?: string }) {
  if (!data || !hasBallotToday(data)) return null;

  return (
    <div className={className}>
      <BallotTodayCard data={data} ballotHref="/app/place" />
    </div>
  );
}
