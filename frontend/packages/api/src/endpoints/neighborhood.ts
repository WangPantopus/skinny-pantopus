// ============================================================
// NEIGHBORHOOD — the density-gated door (four-tab IA, wedge Phase 1)
//
// One endpoint, one honest number: how many verified neighbors are
// around the viewer's primary home, against the unlock threshold that
// opens the neighborhood surfaces (Pulse, Marketplace, Tasks).
//
//   GET /api/neighborhood/meter   (authenticated)
//
// Privacy contract (mirrors backend/routes/neighborhood.js): below the
// k-anon floor the exact count is withheld — verified_count is null and
// the state reads 'forming', so the first few residents of a cell can
// never be singled out.
// ============================================================

import { get } from '../client';

export type NeighborhoodMeterState = 'no_place' | 'forming' | 'growing' | 'unlocked';

export interface NeighborhoodMeter {
  state: NeighborhoodMeterState;
  /** Exact aggregate count — null below `k_anon_min` (privacy floor). */
  verified_count: number | null;
  k_anon_min: number;
  /** Verified neighbors needed before the neighborhood opens. */
  threshold: number;
  unlocked: boolean;
  area: { city: string | null; state: string | null } | null;
}

export async function getNeighborhoodMeter(): Promise<NeighborhoodMeter> {
  return get<NeighborhoodMeter>('/api/neighborhood/meter');
}
