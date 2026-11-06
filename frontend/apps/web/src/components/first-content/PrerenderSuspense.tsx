'use client';

// A Suspense boundary that only the prerendered /app pages need, left out of a tab
// document that carries its first content (lib/firstContent.ts).
//
// The app's other pages are prerendered once for everyone. Their prerender cannot
// know the address's query (AppShell and some screens read it), so it bails out to
// the nearest boundary and the prerendered HTML holds that boundary's fallback. A
// first-content tab renders per request, so its server render needs no boundary,
// and one would cost it: React sends a finished boundary larger than about 12 KB
// after the frame and reveals it from a script, which waits until 300 ms after the
// frame's first paint. A warm reload with cached styles paints the frame first, so
// the screen showed 300 ms late. Outside every boundary, the screen is part of the
// frame's own HTML.
//
// Decided once, when the boundary first renders: in a document, from the address
// the server rendered, so the browser's first render matches the server's. It
// never changes afterwards, so client navigations keep the same tree and nothing
// above the page remounts.
import { Suspense, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isFirstContentRoute } from '@/lib/firstContent';

// `next build` (which sets NEXT_PHASE, as next/constants' PHASE_PRODUCTION_BUILD)
// tries to prerender the tabs too, and only their reads tell it they render per
// request: that attempt needs the boundaries like any prerender. Unset when serving
// and in the browser.
const BUILD_PRERENDER = process.env.NEXT_PHASE === 'phase-production-build';

export default function PrerenderSuspense({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [inline] = useState(() => !BUILD_PRERENDER && isFirstContentRoute(pathname ?? ''));
  return inline ? children : <Suspense fallback={fallback}>{children}</Suspense>;
}
