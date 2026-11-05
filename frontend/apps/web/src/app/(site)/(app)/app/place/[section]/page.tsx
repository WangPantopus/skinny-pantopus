'use client';

// ============================================================
// /app/place/[section] — a Place group-detail page (W2.3).
// Thin route: the PlaceSectionDetail container owns fetching, the
// auth gate, the page states, and dispatching the matching view.
// Slugs: today · your-home · risk · block · money · civic · identity.
// ============================================================

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import PlaceSectionDetail from '@/components/place/detail/PlaceSectionDetail';
import { PlaceHomeContext, placeHomeParam } from '@/components/archetypes/place';

function PlaceSectionRoute() {
  const params = useParams<{ section: string }>();
  const section = Array.isArray(params.section) ? params.section[0] : params.section;
  const switchedHome = placeHomeParam(useSearchParams()?.get('home'));
  return (
    <PlaceHomeContext.Provider value={switchedHome}>
      <PlaceSectionDetail section={section ?? ''} />
    </PlaceHomeContext.Provider>
  );
}

export default function PlaceSectionPage() {
  return (
    <Suspense>
      <PlaceSectionRoute />
    </Suspense>
  );
}
