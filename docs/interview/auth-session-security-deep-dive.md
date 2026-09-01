# Pantopus Auth Session Security Deep Dive

This document explains the current repository behavior around mobile bearer
tokens, web httpOnly cookies, CSRF, refresh-token rotation, logout, role caches,
web middleware, Socket.IO auth, and session-fixation defenses.

It is written as an interview-ready security and reliability deep dive. It
describes what the code does today, why it likely exists, what abuse it prevents,
and where residual risk remains.

## Source Map

Primary code paths:

- `backend/routes/users.js`
  - Auth cookie helpers: `setAuthCookies`, `clearAuthCookies`, `applyAuthTransport`
  - Login, OAuth callback/token login, refresh, logout
- `backend/middleware/verifyToken.js`
  - Bearer/cookie token extraction
  - Supabase JWT verification
  - in-memory role/account-type cache
  - CSRF handoff
- `backend/middleware/csrfProtection.js`
  - CSRF enforcement for cookie-authenticated unsafe methods
- `backend/utils/csrf.js`
  - HMAC CSRF generation and verification
- `frontend/packages/api/src/client.ts`
  - shared API client
  - web/mobile auth transport split
  - `__session__` sentinel
  - refresh mutex and 401 handling
- `frontend/apps/mobile/src/config/api.ts`
  - React Native API client configuration
  - SecureStore-backed token storage
- `frontend/apps/mobile/src/lib/authSession.ts`
  - mobile session persistence, reinstall guard, invalidation behavior
- `frontend/apps/mobile/src/contexts/AuthContext.tsx`
  - mobile boot/foreground refresh, logout, invalid-session behavior
- `frontend/apps/web/src/middleware.ts`
  - Next.js route auth redirects based on auth cookies
- `frontend/apps/web/next.config.js`
  - same-origin API and Socket.IO rewrites for web cookies
- `frontend/apps/web/src/contexts/SocketContext.tsx`
  - web Socket.IO auth with `__session__` and cookies
- `frontend/apps/mobile/src/contexts/SocketContext.tsx`
  - mobile Socket.IO auth with bearer token
- `backend/socket/chatSocketio.js`
  - Socket.IO token/cookie verification
- `supabase/config.toml`
  - JWT expiry and refresh-token rotation settings

Relevant tests:

- `backend/tests/unit/verifyTokenCookie.test.js`
- `backend/tests/unit/csrfProtection.test.js`
- `backend/tests/unit/verifyTokenCache.test.js`
- `backend/tests/unit/oauthRoutes.test.js`
- `backend/tests/unit/optionalAuth.test.js`
- `backend/tests/integration/auth-exploits.test.js`
- `frontend/apps/mobile/src/lib/__tests__/authSession.test.ts`

## Executive Summary

Pantopus deliberately uses two auth transports:

- Web uses httpOnly cookies for access and refresh tokens.
- Mobile uses bearer tokens stored in the native app session store.

The split is a practical security tradeoff. Browser JavaScript should not be
able to read bearer tokens because XSS would turn into token exfiltration.
Native mobile clients do not have first-party browser cookie semantics and need
explicit `Authorization: Bearer` transport. The backend supports both, but
always prefers an explicit Bearer header when both are present. That preference
is important because mobile platforms can retain stale cookies in their native
cookie jars.

CSRF is enforced only for cookie-authenticated unsafe methods. The web client
sends a JS-readable `pantopus_csrf` token as `x-csrf-token`. The server checks
that header and cookie match, then checks that the token is an HMAC bound to the
authenticated user id. Bearer/mobile requests intentionally bypass CSRF because
cross-site browsers cannot attach an app's bearer token.

The most important reliability caveat is in the web middleware. It treats
`pantopus_session=1` plus a missing `pantopus_access` cookie as stale and
redirects `/app/*` to login, clearing cookies. Because `pantopus_refresh` is
path-scoped to `/api/users/refresh`, page middleware generally cannot see a
valid refresh cookie. That means a direct reload or navigation after access-token
expiry may force login even though the refresh cookie could have recovered the
session via the API refresh endpoint.

The most important security caveat is the 60-second role/account-type cache.
It reduces database lookups, but a role or account-type downgrade can remain
warm in one Node process for up to 60 seconds, and invalidation is not
distributed across processes.

## Core Concepts

### Token Types

Pantopus relies on Supabase auth sessions:

- Access token: short-lived JWT used to authenticate API and Socket.IO requests.
- Refresh token: longer-lived rotating secret used to mint a new access token
  and a new refresh token.

The Supabase local config shows:

- `jwt_expiry = 3600`, so access tokens last about 1 hour.
- `enable_refresh_token_rotation = true`.
- `refresh_token_reuse_interval = 10`, so Supabase permits a short reuse grace
  window around rotation.

### Auth Transports

Pantopus has two ways to send the access token:

- Bearer transport: `Authorization: Bearer <access-token>`.
- Cookie transport: httpOnly `pantopus_access` cookie.

The transport is not just an implementation detail. It controls whether CSRF is
relevant.

Bearer transport:

- Used by mobile.
- Token is explicitly added by the app.
- Cross-site browser forms/images cannot add the mobile bearer token.
- CSRF is not meaningful for this transport.

Cookie transport:

- Used by web.
- Browser automatically includes cookies on same-site/same-origin requests.
- Cross-site requests can sometimes carry cookies depending on cookie attributes
  and request shape.
- CSRF protection is required for unsafe state-changing requests.

### Web Cookie Names

The backend sets four web cookies:

- `pantopus_access`
  - httpOnly
  - path `/`
  - sameSite `lax`
  - max age 1 hour
  - contains the Supabase access token
- `pantopus_refresh`
  - httpOnly
  - path `/api/users/refresh`
  - sameSite `lax`
  - max age 7 days
  - contains the Supabase refresh token
- `pantopus_csrf`
  - not httpOnly
  - path `/`
  - sameSite `lax`
  - max age 24 hours
  - contains a session/user-bound HMAC token that JS can read and echo in a
    header
- `pantopus_session`
  - not httpOnly
  - path `/`
  - sameSite `lax`
  - max age 30 days
  - contains only the value `1`
  - is a client-side session flag, not authority

## End-to-End Flows

### Web Login

1. Browser submits `/api/users/login` through the Next.js same-origin API proxy.
2. The shared API client marks the request with `x-token-transport: cookie`.
3. Backend signs in with Supabase using a non-persistent server auth client.
4. Backend calls `applyAuthTransport`.
5. Because transport is cookie, backend sets:
   - `pantopus_access`
   - `pantopus_refresh`
   - `pantopus_csrf`
   - `pantopus_session`
6. Backend omits `accessToken` and `refreshToken` from the JSON body.
7. Browser JavaScript receives user/profile data but no readable auth token.

Security purpose:

- A successful XSS cannot simply read access or refresh tokens from JS memory or
  localStorage.
- CSRF remains possible in principle because cookies are automatic, so CSRF
  protection is added for unsafe methods.

### Mobile Login

1. React Native configures the shared API client with `platform: 'mobile'`.
2. Mobile login receives `accessToken`, `refreshToken`, and expiry metadata in
   the JSON response.
3. The API client stores them in the mobile auth-session store.
4. Future API requests include `Authorization: Bearer <access-token>`.
5. The backend clears auth cookies on mobile transport so stale native cookie
   jars do not influence future requests.

Security purpose:

- Native apps need explicit token transport.
- SecureStore-style persistence is the mobile equivalent of keeping secrets out
  of ordinary JS/browser storage.
- Clearing old cookies reduces mixed-mode confusion.

### Web API Request

1. The shared API client uses relative URLs, so requests go through the same
   origin.
2. Browser sends httpOnly auth cookies automatically.
3. The client adds `x-token-transport: cookie`.
4. For `POST`, `PUT`, `PATCH`, and `DELETE`, the client reads
   `pantopus_csrf` and sends it as `x-csrf-token`.
5. Backend `verifyToken` sees no Bearer header and uses `pantopus_access`.
6. Backend sets `req._authMethod = 'cookie'`.
7. Backend verifies the access token with Supabase.
8. Backend loads or caches `User.role` and `User.account_type`.
9. Backend calls CSRF middleware.
10. CSRF middleware enforces CSRF only because auth method is cookie and method
    is unsafe.

### Mobile API Request

1. The shared API client reads the cached mobile access token.
2. It sets `Authorization: Bearer <token>`.
3. Backend `verifyToken` uses the Bearer header before any cookie.
4. Backend sets `req._authMethod = 'bearer'`.
5. Backend verifies the token with Supabase.
6. Backend loads or caches role/account type.
7. CSRF middleware sees bearer auth and bypasses.

The Bearer-first rule is critical. If a mobile platform has a stale
`pantopus_access` cookie in its native cookie jar and a fresh bearer token in
the request, the bearer token must win.

### Web Refresh

1. A request receives 401 or the app explicitly calls refresh.
2. The shared API client calls `/api/users/refresh`.
3. Web sends `x-token-transport: cookie` and an empty body.
4. Browser automatically sends `pantopus_refresh`, because the request path is
   `/api/users/refresh`.
5. Backend uses the refresh token from the cookie.
6. Supabase rotates the session.
7. Backend sets fresh httpOnly access and refresh cookies.
8. Backend responds `{ ok: true }`, omitting tokens from JSON.
9. The frontend interprets `{ ok: true }` as a successful web refresh and returns
   the `__session__` sentinel internally.

### Mobile Refresh

1. Mobile checks whether the stored session expires soon, or hits 401.
2. The shared API client calls `/api/users/refresh` with `{ refreshToken }` in
   the JSON body.
3. Backend ignores stale refresh cookies for non-cookie transport and uses the
   body refresh token.
4. Supabase rotates the session.
5. Backend clears cookies for mobile transport.
6. Backend returns fresh `accessToken`, `refreshToken`, and expiry metadata in
   JSON.
7. Mobile persists the updated session.

### Logout

1. Client posts to `/api/users/logout`.
2. Backend does not require `verifyToken` or CSRF.
3. Backend clears all auth cookies.
4. Backend best-effort revokes the local Supabase session if it can find an
   access token from Bearer, request body, or cookie.
5. Client clears local/mobile session state.

Logout is designed to work even when access auth is expired or CSRF is stale.
The tradeoff is that logout remains CSRF-able as a forced sign-out.

### Socket.IO

Mobile:

1. Mobile Socket.IO provider reads the mobile access token.
2. It connects with `auth: { token: <real-access-token> }`.
3. Backend verifies the token with Supabase.

Web:

1. Web Socket.IO provider calls `getAuthToken()`.
2. Because web JS cannot read httpOnly `pantopus_access`, this usually returns
   `__session__` if `pantopus_session=1`.
3. The client connects with `auth: { token: '__session__' }` and
   `withCredentials: true`.
4. In production, Next rewrites `/socket.io/*` to the backend on the same
   origin, so cookies are available on the handshake.
5. Backend treats missing token or `__session__` as "look for
   `pantopus_access` in the handshake cookie header".
6. Backend verifies the final token with Supabase and attaches `socket.userId`.

## Question 1: Explain the split between mobile Bearer tokens and web httpOnly cookies.

The split is intentional and correct for the threat models of web and native
mobile.

Web browser threat model:

- The main token-exfiltration risk is XSS.
- If access and refresh tokens are in `localStorage` or readable JS memory, XSS
  can steal them and replay them from another machine.
- httpOnly cookies cannot be read by JavaScript, so XSS cannot directly exfiltrate
  the token values.
- However, cookies are sent automatically by browsers, so CSRF must be addressed.

Mobile/native threat model:

- The app controls outgoing requests.
- There is no normal browser cookie model for API auth.
- The app needs explicit transport and stores session state in the mobile secure
  session store.
- CSRF is not relevant to a native bearer-token request because a third-party web
  page cannot cause the native app to attach its bearer token to a malicious
  request.

Pantopus implementation:

- The shared API client detects platform mode.
- Web mode:
  - uses relative URLs through Next.js same-origin rewrites
  - sets `x-token-transport: cookie`
  - does not set `Authorization`
  - sends CSRF headers for unsafe methods
- Mobile mode:
  - uses a configured backend base URL
  - reads tokens from mobile session storage
  - sends `Authorization: Bearer <token>`
  - stores refreshed tokens from JSON

Backend implementation:

- `verifyToken` prefers Bearer over cookie.
- If Bearer is present, `_authMethod` is `bearer`.
- Else if `pantopus_access` is present, `_authMethod` is `cookie`.
- The auth method then controls CSRF enforcement.

Why Bearer wins:

- Native clients can accumulate stale cookies from prior cookie-mode flows,
  redirects, development testing, or CFNetwork behavior.
- A user may have a stale cookie and a fresh mobile bearer token.
- If the backend preferred cookie auth, it could authenticate the wrong session,
  incorrectly require CSRF, or fail a valid mobile request.
- Preferring Bearer makes explicit app intent win over ambient cookies.

Reliability benefit:

- Avoids mixed-mode failures where mobile requests are treated as web requests.
- Allows mobile refresh to ignore stale cookie refresh tokens and use the body
  token.

Security benefit:

- Prevents stale cookies from shadowing a current bearer session.
- Reduces session-fixation and session-confusion risk across transports.

Residual risks:

- Mobile bearer tokens are still bearer secrets. If device compromise, rooted
  inspection, logging, or debug tooling exposes them, they are replayable.
- Web httpOnly cookies reduce token theft through XSS, but XSS can still perform
  actions in the victim's browser while the page is open.
- The backend supports both transports on many routes, so every auth-sensitive
  code path must preserve the Bearer-first rule.

## Question 2: Why does the API return a `__session__` sentinel for web auth?

Strictly speaking, the backend does not return `__session__` as an auth token in
normal web login JSON. The frontend API client manufactures this sentinel.

The reason is that web JavaScript cannot read `pantopus_access`. That is the
point of httpOnly cookies. But frontend code still needs a way to answer:

- "Should this client-side guard consider the user maybe authenticated?"
- "Should Socket.IO attempt a connection?"
- "Did a web refresh succeed even though no access token appeared in JSON?"

The shared API client uses the readable `pantopus_session=1` cookie as a session
flag. If there is no readable token but `pantopus_session=1`, `getAuthToken()`
returns `__session__`.

Important properties:

- `__session__` is not a JWT.
- It is not accepted as authority by normal HTTP routes.
- It should never be set as `Authorization: Bearer __session__`.
- It means only "the browser has a session flag, so rely on httpOnly cookies for
  real auth".

Where it is used:

- Client-side auth guards can avoid redirecting immediately after page refresh
  when JS memory is empty but cookies exist.
- Web Socket.IO can send `__session__`; the backend then falls back to the
  `pantopus_access` cookie from the handshake.
- Web refresh can return success without JSON tokens; the client uses
  `__session__` internally to represent that refreshed-cookie state.

Why not return the real token to web:

- Returning the access token to web JSON would undo the benefit of httpOnly
  cookies.
- A malicious script could read the response body or client memory and exfiltrate
  the token.

Why the sentinel must be treated carefully:

- The readable `pantopus_session` flag is not cryptographic proof.
- It can outlive the access cookie.
- It can exist when a refresh cookie is expired or missing.
- It is safe only because backend APIs still verify `pantopus_access` or
  `pantopus_refresh` server-side.

Interview answer:

`__session__` is an application-level marker that lets frontend code represent a
web cookie session without exposing the httpOnly token to JavaScript. It is a
control-plane hint, not a data-plane credential.

## Question 3: How does CSRF protection work with `pantopus_csrf`, and which requests intentionally bypass it?

Pantopus uses a double-submit CSRF pattern with an additional user-bound HMAC
check.

On web login or refresh:

1. Backend generates `pantopus_csrf = HMAC_SHA256(CSRF_SECRET, userId)`.
2. Backend sets it as a non-httpOnly cookie.
3. Browser JavaScript can read this cookie.

On unsafe web requests:

1. The shared API client reads `pantopus_csrf`.
2. It sends the same value as `x-csrf-token`.
3. Browser automatically sends the `pantopus_csrf` cookie.
4. Backend verifies:
   - method is unsafe
   - auth method is cookie
   - CSRF cookie exists
   - CSRF header exists
   - CSRF cookie equals CSRF header
   - CSRF token verifies as HMAC for `req.user.id`

Why double submit works here:

- A cross-site attacker can often cause a browser to send cookies.
- But a cross-site attacker cannot normally read the victim site's
  `pantopus_csrf` cookie.
- A cross-site form cannot add the custom `x-csrf-token` header.
- Therefore, ambient cookies alone are not enough to mutate state.

Why the HMAC check matters:

- Plain double-submit can be vulnerable if an attacker can inject a cookie for
  the target site or subdomain.
- The HMAC binds the CSRF token to the authenticated user id.
- A token generated for attacker A will not verify for victim B.

Requests that bypass CSRF by design:

- Safe methods:
  - `GET`
  - `HEAD`
  - `OPTIONS`
- Bearer-authenticated requests:
  - mobile API calls
  - any request where `Authorization: Bearer` was used and verified
- Unauthenticated auth routes:
  - login
  - register
  - forgot password
  - reset password
  - verify email
  - OAuth URL/callback/token login
- Refresh:
  - `/api/users/refresh`
  - It must work when access auth is expired.
  - It rotates tokens but should not perform user-chosen state mutation beyond
    refreshing that session.
- Logout:
  - `/api/users/logout`
  - It must clear state even when auth or CSRF is stale.
- Webhook/internal raw routes mounted before normal JSON/auth middleware:
  - Stripe webhook
  - Lob webhook
  - internal email inbound webhook
  - other internal routes that use their own auth mechanisms
- Special safe read paths:
  - e.g. chat file download can accept token in query for contexts where headers
    cannot be set, but it is a `GET` and still verifies auth before issuing a
    signed URL.

Subtle limitation:

- The CSRF token is deterministic per user, not per login session.
- That is acceptable for basic CSRF, but it means rotating sessions does not
  produce a truly new CSRF secret for the same user.
- If the token leaks, it may remain useful until `CSRF_SECRET` changes or the
  design moves to per-session CSRF state.

Another limitation:

- CSRF is not an XSS defense.
- If attacker JavaScript runs on the Pantopus origin, it can read
  `pantopus_csrf` and send same-origin requests. httpOnly still protects token
  exfiltration, but actions from the infected browser remain possible.

## Question 4: Why is logout allowed without CSRF? What abuse is still possible?

Logout intentionally avoids `verifyToken` and CSRF. The code comment states the
reason: logout must work even when the access token is expired or the CSRF cookie
is stale.

This is a common design choice. Logout is primarily a cleanup operation:

- Clear `pantopus_access`.
- Clear `pantopus_refresh`.
- Clear `pantopus_csrf`.
- Clear `pantopus_session`.
- Best-effort revoke the current Supabase local session if an access token is
  available.

Why requiring CSRF would hurt reliability:

- If the access token expires, `verifyToken` would reject before clearing cookies.
- If the CSRF cookie is stale or corrupted, the user could be stuck with a broken
  session.
- If the frontend is in a partial-auth state, logout should still get the user
  out cleanly.

What abuse remains:

- Forced logout CSRF.
- An attacker can attempt to cause the victim browser to POST to logout.
- The victim may be signed out unexpectedly.

What abuse does not follow from this:

- The attacker does not receive tokens.
- The attacker does not mutate user data other than ending the session.
- The attacker does not gain authenticated access.

Severity:

- Usually low to medium, depending on product context.
- It is denial of service against the user session.
- It can be annoying or disruptive, especially during critical workflows.

Mitigations already present:

- Logout route is rate-limited.
- Cookies are SameSite Lax.
- Session revocation is local-scope best effort.

Possible improvement:

- Support both paths:
  - CSRF-protected logout when the session is healthy.
  - unauthenticated "clear local cookies only" fallback.
- That said, the current design is pragmatic and commonly defensible if forced
  logout is accepted as low-severity.

## Question 5: How are refresh-token reuse and stale sessions detected?

Refresh-token reuse detection relies on Supabase refresh-token rotation.

Supabase behavior:

- Refresh-token rotation is enabled.
- When a refresh token is used, Supabase issues a new access token and a new
  refresh token.
- The old refresh token should not be reused except inside a small configured
  reuse interval.

Backend behavior:

1. `/api/users/refresh` extracts the refresh token:
   - web: from `pantopus_refresh` cookie only when `x-token-transport: cookie`
   - mobile: from request body, ignoring stale cookies
2. Backend calls Supabase `refreshSession`.
3. If Supabase returns an error whose message matches `already used` or
   `not found`, backend treats it as token reuse/stale invalid refresh.
4. Backend logs `auth.refresh_token_reuse`.
5. Backend clears auth cookies.
6. Backend returns 401 with code `TOKEN_REUSE`.

Why this detects reuse:

- In a rotated refresh-token scheme, a second use of an old refresh token can
  indicate that an old token was stolen and replayed.
- It can also indicate the client retried incorrectly, multiple tabs raced
  outside the allowed interval, or a stale token was persisted.

Frontend stale-session handling:

- The API client has a refresh mutex, so concurrent 401s reuse one refresh
  promise instead of stampeding `/refresh`.
- If refresh succeeds:
  - mobile stores new tokens
  - web accepts `{ ok: true }` and relies on updated cookies
  - original request is retried
- If refresh returns 400 or 401:
  - frontend emits invalidation telemetry
  - clears local session state
  - calls unauthorized handling or redirects to login
- If refresh has transient failure:
  - frontend emits a transient refresh failure
  - does not clear session immediately

Mobile stale-session handling:

- Mobile stores `expiresAt`.
- On boot and foreground, it refreshes if the session is near expiry.
- If refresh is invalid, it clears the session.
- If refresh is transient, it can keep the session and retry profile/API later.
- On invalidation, it best-effort posts logout with the expired access token to
  revoke server-side state, then clears SecureStore.

Web stale-session handling:

- Client-side API requests recover through 401 -> refresh -> retry.
- Next middleware detects `pantopus_session=1` without `pantopus_access` as stale
  and redirects app pages to login.

Important caveat:

- The backend currently treats `already used` and `not found` similarly.
- That is safe from a session-containment perspective, but the log label
  `auth.refresh_token_reuse` may include benign stale/expired-token cases.
- Security dashboards should distinguish "confirmed reuse" from "invalid refresh
  token" if precision matters.

## Question 6: What happens if role/account type changes while the user role cache is warm?

`verifyToken` caches `User.role` and `User.account_type` in an in-memory Map.

Cache characteristics:

- Key: user id.
- Value: role and account type.
- TTL: 60 seconds.
- Max size: 1000 entries.
- Scope: one Node.js process only.

When cache is warm:

1. Backend verifies the Supabase access token.
2. Backend checks `_roleCache` by user id.
3. If cache hit and not expired, it uses cached `role` and `accountType`.
4. It does not query the `User` table for fresh role/account type.

If the user's `User.role` changes:

- Any request served by a process with the old cached value continues to see the
  old `req.user.role` until TTL expiry or explicit invalidation.
- Admin checks based on `req.user.role === 'admin'` can be stale.
- Feature-flag checks that use internal roles can be stale.

If the user's `User.account_type` changes:

- Routes that branch on `req.user.accountType` can be stale.
- For example, curator/business restrictions may continue to use the old value.

Invalidation today:

- `invalidateRoleCache(userId)` exists.
- Some home/business IAM role update paths call it after changing membership
  roles.
- But those membership roles are not the same as `User.role`.
- Some account-type changes, such as soft-deleting a business by updating
  `User.account_type` to `individual`, do not appear to invalidate this cache.

Distributed concern:

- Invalidation is local to one process.
- If the app runs multiple Node processes or containers, invalidating in one does
  not clear the same user's cache in another.
- TTL eventually bounds the issue, but does not eliminate the stale window.

Security impact:

- A demoted platform admin could retain admin authorization for up to 60 seconds
  on a warm process.
- An account-type downgrade could lag for up to 60 seconds.
- A newly promoted admin may be denied for up to 60 seconds if the old user role
  is cached.

Recommended improvements:

- Add explicit invalidation to every path that mutates `User.role` or
  `User.account_type`.
- Use a distributed cache or pub/sub invalidation if running more than one
  backend process.
- Consider a role version or `authz_version` column checked against token claims
  or cache entries.
- For high-risk admin routes, consider bypassing the 60-second cache and reading
  fresh role state.

## Question 7: Why is the auth cache TTL 60 seconds? What risk does that introduce?

The 60-second TTL is a performance and reliability tradeoff.

Why it exists:

- Every authenticated API request already calls Supabase auth to verify the JWT.
- Without caching, every request would also query the application `User` table
  for `role` and `account_type`.
- Pantopus likely has many chat, feed, notification, location, and dashboard
  requests.
- Caching reduces database load and tail latency.

Why 60 seconds is understandable:

- It is short enough that stale authorization usually self-heals quickly.
- It is long enough to collapse repeated request bursts.
- It avoids hard dependency on application DB reads for every request after JWT
  verification.

Risk introduced:

- Authorization state can be stale for up to 60 seconds per process.
- Downgrades are the dangerous case:
  - admin -> user
  - staff -> user
  - curator/business -> individual
  - any account type used for access restrictions
- Upgrades are a reliability issue:
  - newly granted access may not work immediately.

Severity depends on how `req.user.role` and `req.user.accountType` are used:

- For ordinary UI personalization, 60 seconds is low risk.
- For platform admin, payment operations, moderation, feature flag management, or
  identity/security controls, 60 seconds can be material.

Stronger pattern:

- Cache low-risk profile data broadly.
- Re-read high-risk authorization state on high-impact routes.
- Use evented invalidation for role changes.
- Keep a short TTL as a fallback, not the primary safety mechanism.

## Question 8: How do web middleware redirects handle expired access tokens but valid refresh cookies?

Today, the web middleware does not refresh sessions.

It computes:

- `hasSessionFlag = pantopus_session === '1'`
- `hasAccessCookie = Boolean(pantopus_access)`
- `isAuthenticated = hasSessionFlag && hasAccessCookie`
- `hasStaleSession = hasSessionFlag && !hasAccessCookie`

Behavior:

- If `/app/*` and `isAuthenticated` is false:
  - redirect to `/login?redirectTo=...`
- If `hasStaleSession` and `/app/*`:
  - redirect to login
  - clear auth cookies
- If stale session on root/auth pages:
  - clear cookies and continue
- If root and authenticated:
  - redirect to `/app/hub`
- If login/register and authenticated:
  - redirect to `/app/hub`

The reliability problem:

- `pantopus_refresh` has path `/api/users/refresh`.
- Next.js middleware running for page routes like `/app/hub` generally cannot
  observe that path-scoped cookie.
- Therefore middleware cannot distinguish:
  - "access cookie expired but refresh cookie is still valid"
  - "all auth is dead"
- It treats both as stale and clears/redirects.

Result:

- In-app XHR/fetch behavior can recover via 401 -> refresh -> retry.
- Direct page navigation or reload after access-token expiry may not recover,
  because middleware intercepts before the client can call `/api/users/refresh`.

Security posture:

- This is conservative from a route-protection standpoint.
- It does not allow unauthenticated app-page access.

Reliability posture:

- It can cause avoidable logouts.
- It weakens the value of a 7-day refresh cookie on web for direct navigations.

Possible fixes:

1. Middleware refresh endpoint handoff:
   - If `pantopus_session=1` and no access cookie, redirect to an internal
     refresh page/route that calls `/api/users/refresh`, then returns to
     `redirectTo`.
2. Broaden refresh cookie path:
   - Set `pantopus_refresh` path `/` so middleware can see it.
   - This increases ambient cookie exposure to more paths, so the security trade
     must be reviewed.
3. Server-side refresh in middleware:
   - Middleware could call refresh if it can access the refresh token.
   - This is limited by path scoping and edge/runtime constraints.
4. Do not clear immediately:
   - Redirect to login only after a refresh attempt fails.
   - Avoid deleting potentially valid refresh cookies before recovery.

Best interview phrasing:

The API client handles expired access tokens correctly once the app is loaded.
The Next middleware does not currently perform refresh recovery on page
navigation, so a valid path-scoped refresh cookie can be missed. That is a
reliability issue, not a direct auth bypass.

## Question 9: How do Socket.IO connections authenticate with both cookie and token transport?

Socket.IO supports both transports by using the same conceptual split as REST.

Mobile Socket.IO:

- Reads the current mobile access token from memory/session.
- Connects to backend URL.
- Sends `auth: { token: accessToken }`.
- Does not rely on cookies.

Web Socket.IO:

- Calls `getAuthToken()`.
- If JS has no readable token but `pantopus_session=1`, it receives
  `__session__`.
- Connects with:
  - `auth: { token: '__session__' }`
  - `withCredentials: true`
  - websocket and polling transports
- In production, `/socket.io/*` is same-origin through Next rewrites, so
  `pantopus_access` is sent on the handshake.

Backend Socket.IO auth:

1. Reads `socket.handshake.auth.token`.
2. If token is missing or equals `__session__`, parses the handshake cookie
   header for `pantopus_access`.
3. If no token exists after fallback, rejects.
4. Verifies token with Supabase.
5. Attaches:
   - `socket.userId`
   - `socket.userEmail`
6. Connection then joins chat rooms and tracks online sockets.

Security implications:

- `__session__` cannot authenticate by itself.
- Web Socket.IO still requires a real httpOnly `pantopus_access` cookie in the
  handshake.
- Mobile Socket.IO uses a real access token.
- Token verification is centralized through Supabase.

Reliability caveats:

- In local development, web Socket.IO may connect directly to `API_BASE_URL`
  because rewrites do not reliably proxy websocket upgrades.
- Direct cross-origin Socket.IO plus cookies depends on CORS/credentials and
  cookie SameSite/secure behavior.
- If the web access cookie expires, Socket.IO connection attempts fail until an
  API refresh updates cookies or the page reload/login flow recovers.

Security caveats:

- Existing Socket.IO connections are authenticated at connect time.
- If a user's role/account type changes, socket permissions are not automatically
  re-evaluated unless event handlers perform fresh authorization checks.
- If the access token is revoked after connection, the existing socket may remain
  connected unless the server actively disconnects it or checks token/session
  state per sensitive event.

## Question 10: How do you protect against session fixation across web/mobile auth modes?

Session fixation here means an attacker tries to force the victim/client into
using an attacker-chosen session or stale ambient session across transports.

Existing defenses:

### 1. Bearer wins over cookie

The backend chooses an explicit Bearer header before `pantopus_access`.

This protects mobile and mixed-mode clients:

- stale cookie cannot override fresh bearer token
- malicious or old ambient cookie cannot force a mobile request into cookie auth
- CSRF cannot be incorrectly required for a mobile bearer request

### 2. Mobile transport clears cookies

When the backend identifies non-cookie/mobile transport, it clears auth cookies.

This reduces cross-mode residue:

- old web cookies are removed from mobile responses
- future mobile refreshes are less likely to be affected by stale native cookie
  jars

### 3. Mobile refresh ignores stale refresh cookies

For refresh:

- web cookie transport uses `pantopus_refresh`
- mobile transport uses the body `refreshToken`

This matters because a native HTTP stack may send cookies even when the app is
using bearer auth. The body token is explicit and should win for mobile.

### 4. Web tokens are not exposed in JSON

When `x-token-transport: cookie` is present:

- login responses omit access/refresh token fields
- refresh responses omit token fields and return only `{ ok: true }`

This prevents a web XSS from simply stealing freshly returned auth tokens from
JSON.

### 5. CSRF token is user-bound

`pantopus_csrf` is not just random double-submit state. It verifies as an HMAC
for the authenticated user id.

This blocks an attacker from setting their own CSRF cookie/header pair and using
it against a victim session.

### 6. Server Supabase clients do not persist sessions

Login, refresh, and OAuth use server Supabase clients configured with:

- `persistSession: false`
- `autoRefreshToken: false`

This avoids a shared in-process server auth session that could bleed between
requests.

### 7. Mobile reinstall guard

Mobile session storage includes an install sentinel/guard:

- iOS keychain/SecureStore can survive app uninstall.
- AsyncStorage typically does not.
- If the app sees the durable secure marker without the volatile install
  sentinel, it wipes persisted auth data.

This prevents old sessions from silently surviving reinstall in cases where that
would surprise users.

### 8. Logout token precedence

Logout chooses:

1. Bearer access token
2. body access token
3. cookie access token

This lets mobile revoke the intended current bearer session even if a stale
cookie exists.

Remaining session-fixation risks or gaps:

- CSRF token is user-bound, not per-session-bound. It prevents cross-user cookie
  injection but does not distinguish two sessions for the same user.
- `pantopus_session` is readable and not authoritative. It must never be treated
  as proof by backend code.
- Role/account cache is process-local and time-bound, so authorization state can
  lag behind session or role changes.
- Web middleware may clear a recoverable refresh session before attempting
  refresh.
- Socket.IO authenticates at connection time; long-lived sockets need event-level
  authorization for sensitive actions.

## Threat Model Notes

### XSS

What httpOnly cookies protect:

- direct reading of `pantopus_access`
- direct reading of `pantopus_refresh`
- token exfiltration through simple JS reads

What httpOnly cookies do not protect:

- malicious JS can still send same-origin requests from the victim browser
- malicious JS can read `pantopus_csrf`
- malicious JS can use the live browser session to perform actions

Therefore:

- CSRF is not an XSS mitigation.
- Output encoding, CSP, dependency hygiene, and server-side authorization remain
  necessary.

### CSRF

The current CSRF design is solid for ordinary browser CSRF:

- unsafe methods only
- cookie transport only
- header echo required
- user-bound HMAC check

Things to watch:

- Any state-changing `GET` route would bypass CSRF by method. State-changing GET
  must be avoided.
- Any route mounted without `verifyToken` and mutating user state needs its own
  anti-abuse design.
- Any endpoint relying on cookie auth outside `verifyToken` would bypass this
  CSRF middleware unless explicitly protected.

### Refresh Token Theft

If a refresh token is stolen:

- Attacker can try to refresh.
- Supabase rotation should invalidate older refresh tokens.
- Reuse detection can catch use of old tokens.
- Backend clears cookies and forces re-auth on reuse-like errors.

Limitations:

- A stolen current refresh token used first by the attacker can still win the
  rotation race.
- The legitimate client then sees reuse/invalid token on its next refresh.
- This is inherent to bearer refresh tokens unless sender-constrained tokens,
  device binding, or additional proof-of-possession is used.

### Session Revocation

Logout calls Supabase admin signout with scope `local` when it has an access
token.

Implications:

- It aims to revoke only the current session, not every device.
- If access token is missing or already invalid, cookie clearing still succeeds.
- Refresh-token reuse or invalid refresh also clears local cookies/session state.

Potential improvement:

- Add a server-side session table or revocation version if immediate, reliable
  revocation across REST and Socket.IO is required.

## Reliability Notes

### Refresh Mutex

The shared API client uses a single `_refreshPromise`.

Why it matters:

- Without a mutex, a burst of 401 responses can cause parallel refresh calls.
- Parallel refresh calls with rotating refresh tokens can create false reuse
  failures.
- The mutex makes later 401s await the first refresh attempt.

Residual concern:

- Mutex is per JS runtime/tab/app instance.
- Multiple browser tabs, multiple mobile app instances, or background tasks may
  still race unless storage coordination or server grace handles it.

### Web Middleware and Refresh

The middleware issue is the biggest product reliability gap in this auth path.

If the access cookie expires:

- Browser page navigation to `/app/hub` sees no `pantopus_access`.
- Middleware cannot see path-scoped `pantopus_refresh`.
- It clears cookies and redirects to login.

But if the app had already loaded and an API request 401s:

- The API client can call `/api/users/refresh`.
- The refresh cookie is sent because the request path matches.
- Cookies are refreshed and the original request is retried.

This creates inconsistent behavior:

- in-app request: recoverable
- direct navigation/reload: potentially forced login

### Mobile Boot and Foreground

Mobile improves reliability by refreshing before expiry:

- boot refresh if expiring soon
- foreground refresh if expiring soon
- keep session on transient refresh/profile failures
- clear session on confirmed invalid refresh/profile 401

This avoids logging users out for temporary network failures.

## Security Findings and Recommended Hardening

### Finding 1: Web middleware can discard valid refresh sessions

Type: reliability with auth UX impact.

Current behavior:

- `/app/*` route with `pantopus_session=1` and no `pantopus_access` redirects to
  login and clears cookies.

Why it matters:

- A valid refresh cookie can exist but be invisible to middleware because it is
  path-scoped to `/api/users/refresh`.

Recommendation:

- Add a web refresh recovery handoff before clearing cookies.
- Avoid clearing refresh state until refresh is attempted and fails.

### Finding 2: Role/account cache is process-local and stale for up to 60 seconds

Type: authorization freshness risk.

Current behavior:

- Role/account type cache TTL is 60 seconds.
- Invalidation exists but is not comprehensive and not distributed.

Recommendation:

- Invalidate on every `User.role` and `User.account_type` mutation.
- Use distributed invalidation if horizontally scaled.
- Bypass cache for platform-admin and payment/security-sensitive routes.

### Finding 3: CSRF token is user-bound but not session-bound

Type: defense-in-depth improvement.

Current behavior:

- `pantopus_csrf = HMAC(secret, userId)`.

Benefit:

- Blocks cross-user CSRF cookie injection.

Residual gap:

- Same user gets same CSRF token across sessions.

Recommendation:

- If stronger binding is needed, include a session id, refresh-token family id,
  or server-issued CSRF nonce in the HMAC input.

### Finding 4: Socket.IO may need active revocation handling

Type: long-lived connection authorization freshness.

Current behavior:

- Socket is authenticated at connect.

Recommendation:

- Ensure sensitive socket events re-check room membership/permissions.
- Disconnect sockets on logout/session invalidation if server can observe it.
- Consider token expiry timers on socket connections.

### Finding 5: Refresh reuse telemetry is broad

Type: detection precision.

Current behavior:

- `already used` and `not found` both log as `auth.refresh_token_reuse`.

Recommendation:

- Split telemetry:
  - `refresh_token_reuse_detected`
  - `refresh_token_missing_or_expired`
  - `refresh_token_rotation_race`

This helps incident response avoid over-classifying benign stale clients as
token theft.

## Interview-Style Answers

### "Why cookies on web and bearer on mobile?"

Because browser and native clients have different primary risks. On web, storing
tokens in JavaScript-accessible storage makes XSS a token-theft event, so the
app uses httpOnly cookies and adds CSRF protection. On mobile, the app controls
requests and needs explicit auth transport, so it stores tokens in native secure
session storage and sends Bearer headers. The backend supports both but prefers
Bearer when both are present to avoid stale cookie jars shadowing mobile tokens.

### "What is `__session__`?"

It is not a credential. It is a frontend sentinel meaning "a web cookie session
may exist, but JS cannot read the httpOnly token." Backend APIs still require
real cookies or real bearer tokens. Socket.IO treats `__session__` as a signal
to look for `pantopus_access` in handshake cookies.

### "How does CSRF work?"

Only cookie-authenticated unsafe methods need CSRF. The web client echoes the
readable `pantopus_csrf` cookie in `x-csrf-token`. The backend requires cookie
and header equality and verifies the token is an HMAC for the authenticated user
id. Bearer/mobile requests and safe methods bypass CSRF by design.

### "Why no CSRF on logout?"

Logout must work even when auth or CSRF is broken. The worst normal CSRF outcome
is forced sign-out, not data mutation or token theft. That is a deliberate
availability tradeoff.

### "How is refresh-token reuse detected?"

Supabase rotates refresh tokens. If refresh returns an error like "already used"
or "not found", the backend treats it as invalid/reuse, clears cookies, and
returns a 401 with `TOKEN_REUSE` for reuse-like errors. The client then clears
local session state and forces re-authentication.

### "What if role changes while cache is warm?"

The old role/account type can remain in `req.user` for up to 60 seconds on that
process. Some role mutation paths invalidate cache, but invalidation is local and
not comprehensive for all account-type changes. High-risk routes should not rely
solely on this cache.

### "Why 60 seconds?"

It reduces repeated `User` table reads on every authenticated request while
bounding staleness. The introduced risk is short-lived privilege retention after
downgrade and short-lived denial after upgrade.

### "What happens when web access expires but refresh is valid?"

Loaded client API requests can recover through 401 -> `/api/users/refresh` ->
retry. Page middleware does not refresh. On direct `/app/*` navigation with
`pantopus_session=1` and no `pantopus_access`, it redirects to login and clears
cookies, even though a path-scoped refresh cookie may still be valid.

### "How does Socket.IO auth work?"

Mobile sends the real bearer token in Socket.IO auth. Web sends `__session__`
and credentials; backend then extracts `pantopus_access` from handshake cookies.
In both cases the backend verifies the final access token with Supabase before
accepting the socket.

### "How do you prevent session fixation across modes?"

Bearer takes precedence over cookies, mobile responses clear cookies, mobile
refresh ignores cookie refresh tokens, web never exposes tokens in JSON,
CSRF tokens are user-bound HMACs, and server-side Supabase clients do not persist
shared sessions. Remaining hardening areas are per-session CSRF binding,
distributed role-cache invalidation, and refresh-aware web middleware.

## Checklist for Future Changes

When touching auth code, verify:

- Bearer still wins over cookies.
- Web login/refresh does not return tokens in JSON.
- Mobile login/refresh does return tokens in JSON.
- Mobile refresh ignores stale cookies.
- Web refresh uses only the httpOnly refresh cookie.
- Unsafe cookie-authenticated routes require CSRF.
- Safe `GET` routes do not mutate state.
- Logout still clears cookies even with expired auth.
- `pantopus_session` is never treated as backend authority.
- Socket.IO still verifies a real access token server-side.
- Role/account cache invalidation is updated for any role/account mutation.
- New platform-admin or payment-sensitive routes consider fresh authz reads.

## Suggested Follow-Up Work

1. Add refresh-aware web middleware recovery.
2. Add distributed cache invalidation or route-level fresh authorization for
   platform-admin/security-sensitive paths.
3. Make CSRF tokens per-session instead of only per-user.
4. Split refresh-token telemetry into reuse, missing, expired, and race buckets.
5. Add Socket.IO token-expiry or session-revocation disconnect handling.
6. Add regression tests for access-expired/refresh-valid web navigation.
7. Add tests that account-type changes invalidate or bypass cached authz state.

