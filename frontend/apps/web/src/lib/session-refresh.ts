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
 * Short-lived, JS-readable hint the middleware sets on an app document whose
 * session flag is set while the 1-hour access cookie is gone. Its value is the
 * public fallback for a failed recovery (`onFail`), or `1` when there is none.
 * It carries no credential: the refresh cookie stays httpOnly and path-scoped.
 */
export const SESSION_RECOVER_COOKIE = 'pantopus_recover';
export const SESSION_RECOVER_MAX_AGE_S = 30;

/**
 * Runs as the app document is parsed, before any bundle downloads (rendered by
 * src/app/(app)/app/layout.tsx). With the hint present it clears it and starts
 * the same refresh request the API client makes (POST /api/users/refresh with
 * the httpOnly refresh cookie), so recovering an expired access cookie costs
 * one request alongside the page's own loading instead of a separate page.
 * @pantopus/api adopts the pending result as its single-flight refresh and
 * holds the page's API requests until it settles. A refused or failed refresh
 * hands off to SESSION_REFRESH_PATH, which signs out, retries or explains,
 * exactly as before. Outcomes follow the API client's: 2xx with `ok` is
 * success, 400/401 is invalid, anything else is transient.
 */
export const SESSION_RECOVERY_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|;\\s*)${SESSION_RECOVER_COOKIE}=([^;]*)/);if(!m)return;
document.cookie='${SESSION_RECOVER_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
var f='';try{f=m[1]==='1'?'':decodeURIComponent(m[1]);}catch(e){}
var r=window.__pantopusRecovery={handedOff:false};
r.promise=fetch('/api/users/refresh',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','x-token-transport':'cookie'},body:'{}'})
.then(function(x){if(x.ok)return x.json().then(function(b){return b&&b.ok?{status:'success',accessToken:'__session__'}:{status:'invalid',statusCode:x.status};},function(){return{status:'transient',statusCode:x.status};});
return{status:x.status===400||x.status===401?'invalid':'transient',statusCode:x.status};},function(){return{status:'transient'};})
.then(function(o){if(o.status!=='success'){r.handedOff=true;var t=location.pathname+location.search+location.hash;
location.replace('${SESSION_REFRESH_PATH}?redirectTo='+encodeURIComponent(t)+(f?'&onFail='+encodeURIComponent(f):''));}return o;});
}catch(e){}})();`;

/**
 * sessionStorage key that carries the account-deletion outcome to /login as
 * `deleted:<ms>` (the DELETE succeeded) or `unconfirmed:<ms>` (this session
 * ended while the DELETE was still pending). The server signs every session
 * out before it deletes the account, and the deletion can still fail after
 * that; the client's own sign-out reloads the page, so the outcome has to
 * outlive that navigation.
 */
export const ACCOUNT_DELETED_NOTICE_KEY = 'pantopus:account-deleted';

/** An older account-deleted notice is stale and not shown. */
export const ACCOUNT_DELETED_NOTICE_MAX_AGE_MS = 120_000;

/**
 * sessionStorage key that tells /login why the session ended while the page
 * was open: `revoked:<ms>` (signed out from another device, Sign out
 * everywhere, this device removed) or `password:<ms>` (a password change or
 * reset). Same staleness rule as the account-deleted notice.
 */
export const SESSION_ENDED_NOTICE_KEY = 'pantopus:session-ended';

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
