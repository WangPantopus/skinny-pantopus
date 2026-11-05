/**
 * Server-rendered first content (founder decision, 2026-11-05).
 *
 * A tab's document request with a live session carries its first screen's data:
 * the server reads it with that session (src/lib/server/firstContent.ts) and hands
 * it to React Query (components/first-content), so the screen paints from the HTML
 * instead of waiting for the scripts. Only the document does: client navigations,
 * prefetches and recoveries get no data, so the payloads the router keeps
 * (next.config.js staleTimes) never carry account data, and a request without the
 * access cookie (an expired session, recovered in place) renders as before.
 *
 * Keep this file dependency-free: the middleware (Edge), the server pages, the
 * layout's inline script and the browser all read it.
 */

/** Set by the middleware on a tab's document request; removed from every other request. */
export const FIRST_CONTENT_HEADER = 'x-pantopus-first-content';

/**
 * `NEXT_PUBLIC_WEB_FIRST_CONTENT=off` at build time turns it off: the tabs are
 * prerendered and load their data in the browser exactly as before.
 */
export const FIRST_CONTENT_ENABLED = process.env.NEXT_PUBLIC_WEB_FIRST_CONTENT !== 'off';

/**
 * The tabs whose documents carry their first content, each with the early reads
 * (lib/early-reads.ts) that content replaces. A tab's address with a query (a
 * deep link, a switched home, a preview) renders as before.
 */
export const FIRST_CONTENT_ROUTES: Record<string, string[]> = {
  '/app/place': ['/api/homes/my-homes', '/api/hub'],
  '/app/today': ['/api/hub/today', '/api/homes/my-homes'],
  '/app/chat': [],
  '/app/feed': ['/api/location/resolve', '/api/posts/feed-preferences'],
};

export function isFirstContentRoute(pathname: string): boolean {
  return FIRST_CONTENT_ENABLED && Object.prototype.hasOwnProperty.call(FIRST_CONTENT_ROUTES, pathname);
}

/**
 * Which account a document's first content was read for: a short digest of the
 * CSRF cookie, which the API sets with every session's cookies as an HMAC of the
 * account's id (backend routes/users.js setAuthCookies). The browser compares it
 * with its own cookie before using the content, so content read for one account
 * is never shown after another signed in. Never the cookie itself.
 */
export function firstContentTag(csrf: string | null | undefined): string {
  const value = csrf || '';
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
