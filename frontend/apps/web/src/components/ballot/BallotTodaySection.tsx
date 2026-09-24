// ============================================================
// Today — loads the primary home's civic_election section (the Ballot
// P0 fields arrive only when ballot_p0 is on for this user) and shows
// the ballot-week card and the "Moved this year?" well when either
// applies. Best effort: a failure here never touches the rest of Today.
// ============================================================

'use client';

import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import { isBallotCard } from './BallotCard';
import BallotTodayCard, { hasBallotToday } from './BallotTodayCard';

export default function BallotTodaySection({ enabled = true, className = '' }: { enabled?: boolean; className?: string }) {
  const homeQuery = useQuery({
    queryKey: queryKeys.placePrimaryHome(),
    queryFn: async () => api.homes.getPrimaryHome(),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  const homeId = homeQuery.data?.home?.id ?? null;

  const ballotQuery = useQuery({
    queryKey: homeId ? queryKeys.placeBallot(homeId) : ['place', 'intelligence', 'none', 'civic_election'],
    queryFn: async () => api.place.getPlaceIntelligence(homeId as string, ['civic_election']),
    enabled: enabled && !!homeId,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const section = ballotQuery.data?.groups.flatMap((g) => g.sections).find((s) => s.id === 'civic_election');
  const data = section && section.status === 'ready' && isBallotCard(section.data) ? section.data : null;
  if (!data || !hasBallotToday(data)) return null;

  return (
    <div className={className}>
      <BallotTodayCard data={data} ballotHref="/app/place" />
    </div>
  );
}
