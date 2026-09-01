# Backend stage 2 (hooks) — progress report

Status: DONE (2026-08-18)
Layer: backend — hooks into routes/users.js, middleware/verifyToken.js (+optionalAuth), socket/chatSocketio.js, routes/notifications.js, jobs, tests. Nothing outside backend/ touched.

## Verification
- `cd backend && pnpm test` → Test Suites: 1 skipped, 219 passed; Tests: 16 skipped, 3425 passed (full run after the last edit).
- `cd backend && pnpm test:privacy` → OK — all privacy gates passed.
- Real-module load check (no jest mapper): `SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… STRIPE_SECRET_KEY=… node -e "require('./routes/users'); require('./routes/notifications'); require('./middleware/verifyToken'); require('./middleware/optionalAuth'); require('./socket/chatSocketio'); require('./jobs/index')"` → loads (no circular requires).
- New/changed tests: tests/authUsersHooks.test.js (57, supertest through the REAL users router), tests/unit/verifyTokenSession.test.js (12), tests/unit/chatSocketSessionRevoke.test.js (8), tests/unit/notificationsDeviceId.test.js (5), tests/unit/oauthRoutes.test.js (/oauth/token now rotates the pair: 1 updated + 2 new), tests/authDevicesRoutes.test.js (+1 strongest-method case). Stage-1 suites still green.

## Files changed (stage 2)
| File | What |
|---|---|
| routes/users.js | see "Route lines" below — /login, /reauthenticate, /password, /refresh, /reset-password, /oauth/token, /oauth/callback, NEW /oauth/native, DELETE /account, /logout + helpers |
| middleware/verifyToken.js | after getUser: decode JWT → `req.session = {id, iat, aal, context}`; AuthSession revoked (15-s cache) → 401 `SESSION_REVOKED`; `User.sessions_valid_after` folded into the 60-s role cache (3-column select with legacy 2-column fallback) → 401 `SESSION_REVOKED` when `iat` older; exports `decodeSessionClaims`, `checkSessionPolicy`, `SESSION_REVOKED_MESSAGE`; subscribes `authEvents 'watermark_updated'` → `invalidateRoleCache` |
| middleware/optionalAuth.js | revoked AuthSession ⇒ anonymous (soft; same 15-s cache) |
| services/authSessionService.js | + `getSessionStateCached` (15 s, evicted in-process by `emitRevoked`), `invalidateSessionStateCache`, `_sessionStateCache`, `pruneExpiredAuthRows`; `setSessionsValidAfter` emits `watermark_updated` |
| services/authDeviceService.js | `checkRefresh({… cookieTransport})` — web cookie transport is never refused with DPOP_REQUIRED (browsers cannot present a proof); `availableStepUpMethods({… purpose})` + `PASSWORD_FIRST_PURPOSES=['delete_account']` (password-only when the account has a password) |
| middleware/stepUp.js | `reject()` advertises purpose-aware methods |
| routes/authDevices.js | `/step-up` refuses `device_key` for `delete_account` when the account has a password (403 STEP_UP_REQUIRED methods:[password]) |
| socket/chatSocketio.js | handshake decodes session_id/iat (`authSessionService.sessionClaimsFromAccessToken` — the helper `verifyToken.decodeSessionClaims` delegates to; the socket cannot require `../middleware/verifyToken` because jest maps that path to the stub), refuses revoked / pre-watermark tokens; `authEvents 'session_revoked'` → emit `auth:session_revoked {sessionId, reason, code:'SESSION_REVOKED'}` + `disconnect(true)`; user-wide reasons (`lockdown|password_reset|account_deleted|global`) drop every socket of the user; exports `kickRevokedSessions`, `connectedUsers` |
| routes/notifications.js | `deviceIdFromRequest` (body.deviceId, else `X-Device-Id`; UUID only, otherwise ignored) → `pushService.saveToken(…, { deviceId })` on `/register` and `/push-token` |
| jobs/authRegistryPrune.js (new) + jobs/index.js | hourly at :50 — deletes expired AuthDpopJti / AuthChallenge rows |
| tests/__mocks__/supabaseAdmin.js | + `auth.admin.updateUserById` |
| scripts/ci/check-legacy-identity-aliases.js | line-keyed allowlist `backend/routes/users.js:298` → `:304` (the persistent-login requires shifted `serializeCompatibilitySearchUser`) |
| .env.example | documents AUTH_DEVICE_BINDING, AUTH_RESUME_GRANTS, DPOP_CUTOVER, PUBLIC_API_BASE_URL, STEP_UP_SECRET, AUTH_INACTIVITY_DAYS_*, AUTH_RESUME_GRANT_DAYS |

## Route lines (routes/users.js, final numbering)
- 20–26 requires (authPolicy, verifyDpop, requireStepUp/mintStepUpToken, authDeviceService, authSessionService).
- 536–621 helpers: `verifyAuthRouteDpop`/`authRouteDpop` (cookie transport without a `DPoP` header is exempt in every mode; native must present one in `required`), `deviceFromBody`, `accessTokenFromRequest`, `currentSessionId`, `sessionFields` (bearer: sessionId+session+device; cookie: sessionId only), `safeHook` (registry failures never fail the auth route), logout scope helpers `logoutScope`/`whenRemoteLogout`.
- 822–842 schemas: `deviceDescriptorSchema` (permissive; the service normalises), `loginSchema.device`, `oauthNativeSchema`.
- 1603 `POST /login` — `authRouteDpop()` middleware; L1712 `bindAtIssue({authMethod:'password', context:'interactive'})` after the profile checks, before `applyAuthTransport`; response spreads `sessionFields`. Cookie (web) logins insert an unbound AuthSession row.
- 1772 `POST /reauthenticate` — L1847 mints `stepUpToken` (purpose generic, method password, sid = caller session), promotes a `restored` session to interactive, records `step_up` event; response adds `{stepUpToken, expiresAt, purpose:'generic'}`.
- 1919 `POST /password` — L2034 `onPasswordChanged({currentSessionId, accessToken})` after `updateUserById` (others revoked + email; current kept).
- 2075 `preCheckRefresh`, 2097 `refreshDpop`, 2102 `POST /refresh` — order: DPoP (rth required when a refresh token is present) → `checkRefresh` (resolve session → revoked → inactivity → bound: proof vs THAT device's key → legacy/adoption; web `cookieTransport` exempt from DPOP_REQUIRED) → 401 `{error, code}` (clears cookies) / 503 `AUTH_UNAVAILABLE` → `refreshSession` → reuse branch keeps `TOKEN_REUSE` and adds `markReuse` → NEW foreign-token guard (rotated pair's user/session_id must equal the resolved row: else `markMismatch` (cross-user), sign out the minted pair, 401 `DEVICE_MISMATCH`) → `recordRefresh` (hashes, last_refresh, adoption when `adopt` + deviceId (body or `X-Device-Id`)) → response `{ok, tokens…, sessionId, session:{id,context}}` (registry fields only when known, so legacy responses are unchanged). Other GoTrue failures now carry `code:'UNAUTHORIZED'`.
- 3520 `POST /reset-password` — L3543 (JWT branch) and L3591 (recovery branch, before the existing recovery-session revoke) `onPasswordReset({accessToken})` (revokeAll + watermark + email).
- 4083 `POST /oauth/token` — `authRouteDpop()`; L4114 refreshes the supplied pair on a per-request anon client, 401 unless it rotates AND belongs to the verified access token's user (minted pair signed out on mismatch); L4142 `bindAtIssue(authMethod 'oauth_apple'|'oauth_google'|'oauth')`; response returns the NEW pair (+expiresIn/expiresAt, additive) + `sessionFields`.
- 4186 `POST /oauth/callback` — `authRouteDpop()`; L4224 `bindAtIssue`; response + `sessionFields`.
- 4274 NEW `POST /oauth/native` — `oauthLimiter`, `validate(oauthNativeSchema)`, `authRouteDpop()`; `signInWithIdToken({provider, token:idToken, nonce?, access_token?})` → email required (session revoked otherwise) → `ensureOAuthUserProfile(source 'native')` → `bindAtIssue(siwa_native|google_native)` → login-shaped response.
- 4373 `requireStrongestStepUpForDeletion`, 4394 `DELETE /account` — `verifyToken, requireStepUp('delete_account'), requireStrongestStepUpForDeletion` (device_key only for OAuth-only accounts; requireStepUp already refuses device_key from restored sessions and one-shots the jti); L4549 `onAccountDeleted` (revokeAll: GoTrue global sign-out, rows, devices, grants, all PushToken rows, socket kick, `account_deleted` event) right before the User row delete (rows are FK'd to auth.users).
- 4708 `POST /logout` — `whenRemoteLogout(verifyToken)`, `whenRemoteLogout(requireStepUp('revoke_sessions'))`; scope `local` (default): cookie clearing + `admin.signOut(local)` ALWAYS (unchanged, response exactly `{success:true}`), then `logoutLocal` ONLY with proof — (a) the presented access token (Bearer / body / httpOnly cookie) verified with `getUser`, or (b) `refreshToken` + `DPoP` (rth) verified inline (invalid/missing proof only forfeits side effects, never fails the logout); `others` → `revokeOthers` → `{success:true, revoked:n}` (caller's cookies NOT cleared); `global` → `revokeAll(lockdown)` + cookies cleared → `{success:true, revoked:n}`; unknown scope → 400.

## Contract clarifications / deviations (deliberate)
- DPOP_CUTOVER: stage-1 semantics kept — a session is adoptable when `bound_at_issue=false AND issued_at < DPOP_CUTOVER`; the default (unset = 9999-01-01) therefore makes EVERY unbound legacy session adoptable on its first DPoP-capable refresh (design §6.3 "issued before the client shipped DPoP"). The CONTRACT parenthetical "default = far future so nothing is adopted until set" contradicts its own rule; set DPOP_CUTOVER to the client ship date to stop adopting sessions issued after it. Tests cover both.
- `required` mode never applies to cookie (web) transport: web cannot present DPoP; `verifyAuthRouteDpop` + `checkRefresh({cookieTransport})` exempt it. Native (bearer) transport gets DPOP_REQUIRED on /login, /oauth/*, /refresh.
- /oauth/token now rotates the client-supplied pair (design §6.3) — response fields unchanged, values are the NEW pair (+expiresIn/expiresAt). Both native clients already persist the returned pair.
- /refresh gained a foreign-token guard (rotated pair user/session_id must match the resolved row) — closes the "plant a stolen refresh token under my own bound session, then rotate it with my key" bypass in `required` mode.
- Strongest-method rule for `delete_account` is enforced at the source too (`/api/auth/step-up` refuses device_key on password accounts, 403 methods:[password]) so clients never get a token that DELETE /account would refuse.
- verifyToken returns `SESSION_REVOKED` for every revoked row (contract §6.4) — the reason-specific codes (DEVICE_REVOKED/TOKEN_REUSE/…) are returned by /refresh only.
- Web logout with an EXPIRED access cookie leaves its AuthSession row active-looking (no proof; the refresh cookie is path-scoped to /refresh so it is not presented) — pre-existing limitation, row ages out via inactivity.

## Notes for the next stage / reviewers
- Client contract for `/logout` local proof: send Bearer (if still valid) AND/OR `refreshToken` + `DPoP` with `rth`; `deviceId` selects the device whose push tokens/grants are removed.
- `auth:session_revoked` socket event: `{ sessionId, reason, code:'SESSION_REVOKED' }` then disconnect — clients should treat it like a 401 SESSION_REVOKED only after a request confirms (push/socket are never the authority).
- express-rate-limit / AuthDpopJti / AuthChallenge stay in-memory / DB — move limiters to a shared store before flipping `required` on a multi-instance fleet (stage-1 note still applies).
- `tests/__mocks__/verifyToken.js` (stub) does not set `req.session`; routes fall back to decoding the Bearer JWT (`currentSessionId`), so stub-based tests still exercise session binding.

## Log (chronological, kept from the run)
- authSessionService: getSessionStateCached / invalidateSessionStateCache / pruneExpiredAuthRows / watermark_updated.
- verifyToken: session policy + watermark; optionalAuth soft check; chatSocketio handshake + kick; notifications deviceId; authDeviceService cookieTransport; users.js hooks (all routes above); jobs/authRegistryPrune; oauthRoutes test update; CI alias allowlist line; supabaseAdmin mock updateUserById; new test files; strongest-method rule at the source; .env.example; full suite + privacy gates green twice (3423 → 3425 tests after the last additions).
