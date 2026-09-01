'use client';

// ============================================================
// /app/place/[section] — a Place group-detail page (W2.3).
// Thin route: the PlaceSectionDetail container owns fetching, the
// auth gate, the page states, and dispatching the matching view.
// Slugs: today · your-home · risk · block · money · civic · identity.
// ============================================================

import { useParams } from 'next/navigation';
import PlaceSectionDetail from '@/components/place/detail/PlaceSectionDetail';

export default function PlaceSectionPage() {
  const params = useParams<{ section: string }>();
  const section = Array.isArray(params.section) ? params.section[0] : params.section;
  return <PlaceSectionDetail section={section ?? ''} />;
}
