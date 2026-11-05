// Server component, in the app layout's `@firstcontent` slot: holds a tab document's
// first bytes until the tab's first reads answer (shared with its page, once per
// request), or until their short deadline (lib/server/firstContent.ts).
//
// It sits outside the app shell's Suspense boundaries, so the response's first bytes
// wait for it. By then the screen, which renders inside the shell's boundary from
// the same answer, is finished too, and goes out inline with the frame: nothing is
// revealed later (React throttles reveals to 300 ms after the first paint). Without
// a session to read for, it renders nothing at once.
import { FIRST_CONTENT_ENABLED } from '@/lib/firstContent';
import { tabFirstContent } from '@/lib/server/firstContentReads';
import type { FirstContentSearchParams } from './FirstContent';

export default async function FirstContentHold({ route, searchParams }: {
  route: string;
  searchParams: FirstContentSearchParams;
}) {
  if (!FIRST_CONTENT_ENABLED || Object.keys(await searchParams).length > 0) return null;
  await tabFirstContent(route);
  // The screen this answer unblocked renders on the server's next turn; let it finish first.
  await new Promise((resolve) => setImmediate(resolve));
  return null;
}
