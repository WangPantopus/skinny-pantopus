// Server component: a tab page's first content (lib/firstContent.ts).
//
// The screen renders from its first reads (lib/server/firstContentReads.ts, once
// per request, with a short deadline). No Suspense boundary sits between it and the
// document (PrerenderSuspense leaves the shell's out of these tabs), so the first
// bytes wait for the reads and carry the frame and the finished screen together,
// and the page hydrates in the same pass as the shell, so the shell's own reads find
// the content (FirstContentBoundary).
// Without a session to read for (a client navigation, a prefetch, an expired
// session being recovered, first content off), or when the reads fail, the
// screen renders as before and loads in the browser.
import type { ReactNode } from 'react';
import { FIRST_CONTENT_ENABLED } from '@/lib/firstContent';
import { tabFirstContent } from '@/lib/server/firstContentReads';
import FirstContentBoundary from './FirstContentBoundary';

export type FirstContentSearchParams = Promise<Record<string, string | string[] | undefined>>;

async function WithFirstContent({ route, searchParams, children }: {
  route: string;
  searchParams: FirstContentSearchParams;
  children: ReactNode;
}) {
  // A tab address with a query (a deep link, a switched home, a preview) loads as before.
  const first = Object.keys(await searchParams).length === 0 ? await tabFirstContent(route) : null;
  return <FirstContentBoundary state={first?.state ?? null} tag={first?.tag ?? ''}>{children}</FirstContentBoundary>;
}

export default function FirstContent({ route, searchParams, children }: {
  route: string;
  searchParams: FirstContentSearchParams;
  children: ReactNode;
}) {
  if (!FIRST_CONTENT_ENABLED) return children;
  return <WithFirstContent route={route} searchParams={searchParams}>{children}</WithFirstContent>;
}
