// Server component: a tab page's first content (lib/firstContent.ts).
//
// The app shell's fallback (its frame, AppShell) streams at once; the shell and
// the screen stream in when the screen's first reads answer, rendered from them.
// There is no Suspense boundary of its own here: the page hydrates in the same
// pass as the shell, so the shell's own reads find the content (FirstContentBoundary).
// Without a session to read for (a client navigation, a prefetch, an expired
// session being recovered, first content off), or when the reads fail, the
// screen renders as before and loads in the browser.
import type { ReactNode } from 'react';
import type { DehydratedState } from '@tanstack/react-query';
import { FIRST_CONTENT_ENABLED } from '@/lib/firstContent';
import { firstContentSession, type FirstContentSession } from '@/lib/server/firstContent';
import FirstContentBoundary from './FirstContentBoundary';

export type FirstContentRead = (session: FirstContentSession) => Promise<DehydratedState | null>;
export type FirstContentSearchParams = Promise<Record<string, string | string[] | undefined>>;

async function WithFirstContent({ read, searchParams, children }: {
  read: FirstContentRead;
  searchParams: FirstContentSearchParams;
  children: ReactNode;
}) {
  const session = await firstContentSession();
  // A tab address with a query (a deep link, a switched home, a preview) loads as before.
  const state = session && Object.keys(await searchParams).length === 0 ? await read(session).catch(() => null) : null;
  return <FirstContentBoundary state={state} tag={session?.tag ?? ''}>{children}</FirstContentBoundary>;
}

export default function FirstContent({ read, searchParams, children }: {
  read: FirstContentRead;
  searchParams: FirstContentSearchParams;
  children: ReactNode;
}) {
  if (!FIRST_CONTENT_ENABLED) return children;
  return <WithFirstContent read={read} searchParams={searchParams}>{children}</WithFirstContent>;
}
