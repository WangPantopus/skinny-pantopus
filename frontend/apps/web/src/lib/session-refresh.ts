/**
 * Web session recovery (persistent login, design §11 / docs/01 §1.5).
 *
 * Shared between `src/middleware.ts` (Edge) and the client route
 * `src/app/session/refresh/page.tsx`. Keep this file dependency-free and
 * Edge-safe (no DOM, no Node built-ins).
 */

/** Same-origin route the middleware hands stale sessions to. NOT covered by the AASA/applinks paths. */
export const SESSION_REFRESH_PATH = '/session/refresh';

/** sessionStorage key used by the refresh page to break redirect loops. */
export const SESSION_REFRESH_GUARD_KEY = 'pantopus:session-refresh-attempt';

/**
 * Two hand-offs for the same target within this window mean the refresh
 * "succeeded" but the access cookie still did not appear (misconfigured
 * proxy, cookie domain mismatch, third-party cookie policy…). The page then
 * stops retrying and sends the user to sign in instead of looping.
 */
export const SESSION_REFRESH_LOOP_WINDOW_MS = 15_000;

export interface RefreshGuardRecord {
  target: string;
  at: number;
}

/** Pure loop-detector: true when a previous attempt for the same target is too recent. */
export function isRefreshLoop(
  previous: RefreshGuardRecord | null | undefined,
  target: string,
  now: number,
  windowMs: number = SESSION_REFRESH_LOOP_WINDOW_MS,
): boolean {
  if (!previous || previous.target !== target) return false;
  const age = now - previous.at;
  return age >= 0 && age < windowMs;
}

/**
 * Validate a same-origin path for the `onFail` fallback (public twins like
 * `/gigs/:id` or `/`). Stricter than "any string", looser than
 * `safeRedirectPath` (which only admits `/app/*` and invites).
 */
export function safeLocalPath(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback;
  let decoded = candidate.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* use raw */
  }
  if (!decoded.startsWith('/')) return fallback;
  if (decoded.startsWith('//') || decoded.startsWith('/\\')) return fallback; // protocol-relative
  if (decoded.includes('\\') || decoded.includes('..')) return fallback;
  if (/^\/[^/?#]*:/.test(decoded)) return fallback; // "/javascript:…" style tricks
  if (/\s/.test(decoded)) return fallback; // whitespace
  for (let i = 0; i < decoded.length; i += 1) {
    const code = decoded.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return fallback; // control characters
  }
  return decoded;
}

/**
 * Full-page navigation (replace, so the refresh hop is not in history). Kept
 * here so tests can stub it — jsdom does not allow redefining `location`.
 */
export function hardNavigate(href: string): void {
  if (typeof window === 'undefined') return;
  window.location.replace(href);
}

export function parseRefreshGuard(raw: string | null | undefined): RefreshGuardRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RefreshGuardRecord>;
    if (typeof parsed?.target === 'string' && typeof parsed?.at === 'number') {
      return { target: parsed.target, at: parsed.at };
    }
  } catch {
    /* ignore malformed */
  }
  return null;
}
