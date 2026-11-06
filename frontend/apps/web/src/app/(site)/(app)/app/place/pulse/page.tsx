'use client';

// ============================================================
// /app/place/pulse — Today's Pulse, the full ranked stream (W2.5).
// Thin route: the PulseStream container owns fetching, the auth gate,
// the page states, and the ranked-stream / all-clear rendering. The
// feed sibling to the structured dashboard, expanded from its hero.
// ============================================================

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PulseStream from '@/components/place/pulse/PulseStream';
import { PlaceHomeContext, placeHomeParam } from '@/components/archetypes/place';

function PlacePulseRoute() {
  const switchedHome = placeHomeParam(useSearchParams()?.get('home'));
  return (
    <PlaceHomeContext.Provider value={switchedHome}>
      <PulseStream />
    </PlaceHomeContext.Provider>
  );
}

export default function PlacePulsePage() {
  return (
    <Suspense>
      <PlacePulseRoute />
    </Suspense>
  );
}
