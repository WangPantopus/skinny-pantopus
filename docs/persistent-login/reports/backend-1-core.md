# Backend stage 1 (core) — progress report

Status: DONE (2026-08-18, completed on 3rd resume)
Layer: backend (schema, middleware, services, /api/auth router, unit tests). No users.js/verifyToken hooks (stage 2).

## On-disk state found at 3rd resume (uncommitted)
- M  backend/app.js — mounts `app.use('/api/auth', require('./routes/authDevices'))` after userRoutes
- M  backend/package.json + pnpm-lock.yaml — `jose ^5` (5.10.0 installed)
- M  backend/services/pushService.js — saveToken accepts opts.deviceId → PushToken.device_id; new removeTokensForDevice, sendToUserExcludingDevice, sendToDevice
- M  backend/tests/__mocks__/pushService.js — mocks for the new pushService fns
- M  backend/tests/__mocks__/supabaseAdmin.js — AUTH_UNIQUE_KEYS 23505 emulation + auth.admin.getUserById mock
- ?? backend/config/authPolicy.js (137 lines) — env flags/constants
- ?? backend/database/migrations/160_auth_devices.sql (264) + supabase/migrations/20260818000000_auth_devices.sql (identical mirror)
- ?? backend/middleware/dpop.js (285), backend/middleware/stepUp.js (217)
- ?? backend/services/authDeviceService.js (1466), authSessionService.js (601), authNotifyService.js (371)
- ?? backend/routes/authDevices.js (513)
- ?? backend/tests/authDpop.test.js (328 lines), tests/authStepUp.test.js (310), tests/authDeviceService.test.js (1175, 60+ cases) — authDeviceService tests NOT yet confirmed run

## Done (stage 1 complete)
- Migration 160 (+ supabase mirror 20260818000000_auth_devices.sql, identical), authPolicy, dpop.js, stepUp.js, authSessionService, authDeviceService, authNotifyService, routes/authDevices.js (mounted at /api/auth in app.js), pushService additions.
- Tests: tests/authDpop.test.js 33, tests/authStepUp.test.js 22, tests/authDeviceService.test.js 64, tests/authDevicesRoutes.test.js 29 → 148 PASS.
- Full `pnpm test`: 215 suites passed (1 skipped), 3340 tests passed / 16 skipped. `pnpm test:privacy`: all gates OK. All new modules `node --check` clean; the router loads with the real modules (no circular requires).
- NOT done in this stage (by design — stage 2): hooks in routes/users.js (/login /oauth/* /oauth/native /refresh /logout /password /reset-password /reauthenticate DELETE /account), middleware/verifyToken.js session/watermark checks, socket kick, routes/notifications.js deviceId passthrough. Nothing outside backend/ + supabase/migrations touched.

## Log (append after every file touched)
- (resume 1) report rewritten from git status; reviewed files vs CONTRACT; checkRefresh: bound session with no proof → DEVICE_MISMATCH.
- (resume 1) tests/__mocks__/supabaseAdmin.js: AUTH_UNIQUE_KEYS + adminGetUserById.
- (resume 1) tests/authDpop.test.js CREATED — 33 tests PASS.
- (resume 1) tests/authStepUp.test.js CREATED — 22 tests PASS.
- (resume 2) services/authDeviceService.js: isInteractiveContext; checkRefresh: bound session whose device row cannot be loaded → 503 AUTH_UNAVAILABLE.
- (resume 2) tests/authDeviceService.test.js CREATED (1175 lines) — run status unknown at cutoff.
- (resume 3) report rewritten; all files re-read; starting test run.

## Deviations from design (deliberate, documented)
- Migration: `authdevice_key_idx` is a NON-unique index on key_thumbprint (design had UNIQUE(device_id,key_thumbprint)); the registry is per (user, device) so one physical key may back rows for several accounts (WORKLOG decision 4). AuthChallenge has an extra `challenge` text column (raw nonce for step_up/attestation; NULL for consumed step-up jtis).
- Pre-registry sessions (no AuthSession row) get a row created on first successful /refresh (auth_method 'legacy', issued_at=now) — such rows are never adoptable once DPOP_CUTOVER is in the past (contract rule), so those users re-login when the mode flips to `required`.
- (resume 3) tests/authDeviceService.test.js: fixed expired-grant case (mutate the table row, not the returned copy) — 64/64 PASS; authDpop 33 + authStepUp 22 PASS (119 total).
- (resume 3) routes/authDevices.js: validate() before requireDpop() on register/resume/step-up-key (malformed body never burns a jti); /step-up password refuses 403 STEP_UP_REQUIRED+methods for OAuth-only accounts; IP limiters use the library default key. services/authDeviceService.js: promoteSessionToInteractive also stamps device.trusted_at (first interactive credential on the key).
- (resume 3) tests/__mocks__/verifyToken.js: optional x-test-user-email header → req.user.email (additive). tests/authDevicesRoutes.test.js CREATED (supertest against the real /api/auth router) — running.
- (resume 3) tests/authDevicesRoutes.test.js — 29/29 PASS (limiter config, challenge, register, list, delete+one-shot, revoke-others/all, resume, step-up password/device_key, step-up-key, prefs, events).

## Commands
- `cd backend && npx jest tests/authDpop.test.js tests/authStepUp.test.js tests/authDeviceService.test.js tests/authDevicesRoutes.test.js` → 148 passed
- `cd backend && pnpm test` → Test Suites: 1 skipped, 215 passed; Tests: 16 skipped, 3340 passed
- `cd backend && pnpm test:privacy` → OK

## Env / flags (config/authPolicy.js)
AUTH_DEVICE_BINDING=off|optional|required (default optional), AUTH_RESUME_GRANTS=on|off (on), DPOP_CUTOVER (ISO, default 9999-01-01), PUBLIC_API_BASE_URL (optional), STEP_UP_SECRET (required in production; else CSRF_SECRET with a warning; else per-process random), AUTH_INACTIVITY_DAYS_TRUSTED=90, AUTH_INACTIVITY_DAYS_UNVERIFIED=30, AUTH_RESUME_GRANT_DAYS=90.

## Stage-2 integration guide (signatures — all in backend/services + middleware)

### middleware/dpop.js
- `await verifyDpop(req, { required?, refreshToken?, ignoreMode? })` → `{ok:true, dpop|null}` | `{ok:false, status:401, code:'DPOP_REQUIRED'|'DPOP_INVALID'|'DPOP_REPLAY', error}`; sets `req.dpop = {jwk, thumbprint, jti, htm, htu, rth}` or null. Mode `off` ⇒ proofs ignored (unless ignoreMode). Pass `refreshToken` on /refresh and /logout so `rth` is REQUIRED and checked.
- `optionalDpop(opts)` middleware (for /login, /oauth/*, /oauth/native, /refresh, /logout) — verifies when present, 401 only when invalid or when mode=required and missing. `requireDpop()` — always mandatory (used by /api/auth/resume, /devices/register, /step-up-key).
- Helpers: `refreshTokenHash(token)`, `thumbprintEquals(a,b)`, `jwkThumbprint(jwk)`, `expectedHtu(req)`, `verifyProofString(proof,{htm,htu,refreshToken})` (socket layer).

### middleware/stepUp.js
- `requireStepUp(purpose)` — after verifyToken; needs `req.user.id`; reads `X-Step-Up`; uses `req.session.id`/`req.session.context` when verifyToken (stage 2) sets them, else decodes the Bearer/cookie JWT and looks up AuthSession. 403 `{error, code:'STEP_UP_REQUIRED', purpose, methods, reason}`. One-shot for delete_account|revoke_device|revoke_sessions. Sets `req.stepUp = {uid,sid,purpose,method,jti}`.
- `mintStepUpToken({uid, sid, purpose, method, ttlSec?})` → `{token, expiresAt, payload}`. **/reauthenticate (stage 2)**: `mintStepUpToken({uid:req.user.id, sid:<session_id claim of the Bearer/cookie JWT>, purpose:'generic', method:'password'})` and return `{verified:true, stepUpToken, expiresAt, purpose:'generic'}`. `DELETE /account`: `requireStepUp('delete_account')`. `/logout` scope others/global: `requireStepUp('revoke_sessions')`.

### services/authSessionService.js
- `sessionClaimsFromAccessToken(jwt)` → `{id:session_id, iat, exp, sub, aal}` (decode only — call after getUser accepted the token). verifyToken (stage 2): `req.session = {id, iat, context}`; then `getSessionById(id)` → 401 SESSION_REVOKED if `revoked_at`; `getSessionsValidAfter(userId)` → 401 SESSION_REVOKED if `iat*1000 < watermark`.
- `authEvents.on('session_revoked', ({userId, sessionIds, reason}) => …)` — socket/chatSocketio.js subscribes to disconnect matching sockets (decode session_id with `sessionClaimsFromAccessToken`).
- `signOutSupabase(jwt, scope)`, `setSessionsValidAfter(userId)`, `hashToken`, `insertSession`, `revokeSessionRow`, `revokeSessionsForUser`, `mintSessionForUser({userId,email})`, resume-grant primitives, `recordSecurityEvent`, `listSecurityEvents`.

### services/authDeviceService.js — the stage-2 hooks
- **/login, /oauth/callback, /oauth/token, /oauth/native** (after profile checks, before applyAuthTransport):
  `const bind = await authDeviceService.bindAtIssue({ userId, session: <supabase session>, device: req.body.device, dpop: req.dpop, req, authMethod: 'password'|'oauth_google'|'oauth_apple'|'siwa_native'|'google_native', context: 'interactive' })`
  → `{ sessionId, session:{id,context}, device: {id,deviceId,isNew,trustLevel,trustedAt,requireStepUp}|null, sessionRow }`. Never throws. Add `sessionId`, `session`, `device` to the bearer JSON; cookie transport adds `sessionId` only. Run `optionalDpop()` before the handler.
- **/refresh** (order per CONTRACT): `optionalDpop({refreshToken})` (only when a refreshToken is present — cookie or body) → `const check = await authDeviceService.checkRefresh({ refreshToken, sessionId: req.body.sessionId, accessToken: <expired bearer if any>, dpop: req.dpop, req })`; if `!check.ok` → `res.status(check.status).json({error:check.error, code:check.code})` (401 codes: TOKEN_REUSE/DEVICE_MISMATCH/DEVICE_REVOKED/SESSION_REVOKED/SESSION_EXPIRED_INACTIVE/DPOP_REQUIRED; 503 AUTH_UNAVAILABLE = retry, not a wipe). Then `refreshSession`; on the existing TOKEN_REUSE branch also `await authDeviceService.markReuse({ session: check.session, req })`. On success: `const rec = await authDeviceService.recordRefresh({ session: check.session, newSession, oldRefreshToken: refreshToken, dpop: req.dpop, adopt: check.adopt, deviceId: req.body.deviceId, device: req.body.device, req })` → `{sessionId, session:{id,context}, device|null}`; add `sessionId`, `session` to the response.
- **/logout**: keep cookie clearing + `revokeSessionByAccessToken(token,'local')`. `scope:'local'`: `optionalDpop({refreshToken: req.body.refreshToken})` then `await authDeviceService.logoutLocal({ userId: <from a verified Bearer or null>, bearerSessionId: <session_id claim of that Bearer or null>, deviceId: req.body.deviceId, refreshToken: req.body.refreshToken, dpop: req.dpop, req })` → `{proof:'bearer'|'refresh'|null, revokedSession, deviceRowId}`. NOTE: the route must verify the Bearer itself (supabase.auth.getUser) before passing userId — logoutLocal trusts `userId`. `scope:'others'`: verifyToken + requireStepUp('revoke_sessions') → `revokeOthers({ userId, currentSessionId, accessToken, req })` → `{revoked, revokedDevices}`. `scope:'global'`: same gate → `revokeAll({ userId, accessToken, req, reason:'lockdown', eventType:'lockdown' })`.
- **/password** (after updateUserById): `await authDeviceService.onPasswordChanged({ userId, currentSessionId, accessToken, req })` (revokes others + email).
- **/reset-password** (after update, before revoking the recovery session): `await authDeviceService.onPasswordReset({ userId, accessToken: <recovery session access token>, req })` (revokeAll + watermark + email).
- **DELETE /account** (before admin.deleteUser): `requireStepUp('delete_account')` then `await authDeviceService.onAccountDeleted({ userId, accessToken, req })`.
- **notifications /register, /push-token**: pass `deviceId: req.body.deviceId || req.get('X-Device-Id')` in `pushService.saveToken(userId, token, { platform, provider, deviceId })`.
- Helpers for routes: `sessionRowFromRequest(req)`, `tokenFromRequest(req)`, `platformFromRequest(req)`, `normalizeDeviceDescriptor(raw)`, `promoteSessionToInteractive(sessionRow)` (call after a fresh interactive credential on a restored session), `SECURITY_MESSAGES`, `codeForRevokedSession(row)`.

### Notes / gotchas for stage 2
- verifyToken must keep `supabase.auth.getUser` as the authority; the AuthSession lookup is additive (pre-registry sessions have no row → allow).
- Cookie transport: `X-Step-Up` routes under /api/auth already run verifyToken (CSRF enforced for cookies by verifyToken).
- express-rate-limit stores are in-memory (same as users.js) — move to a shared store before flipping `required` on a multi-instance fleet.
- The `AuthDpopJti` / `AuthChallenge` tables need a prune job (expires_at index exists) — hook into the existing jobs runner in stage 2 or later (`DELETE … WHERE expires_at < now()`).
- redeemResumeGrant consumes the grant BEFORE minting; a GoTrue outage during mint returns 503 RESUME_UNAVAILABLE and the client falls back to a full login (single-use is never weakened).
