# Pantopus Anchor — device-bound sessions with remembered accounts

THESIS: Keep Supabase Auth as the only session authority and add one thin Pantopus-owned layer around it: an `AuthDevice` registry keyed by a hardware key (Secure Enclave on iOS, Android Keystore/StrongBox on Android) whose ES256 "DPoP" proof is required to refresh, plus a `sessions_valid_after` watermark and a `revoke_auth_session()` RPC so we can list, revoke and time-out sessions that Supabase's admin API cannot. Reinstall is never a silent auto-login and never a forced wipe: on iOS the refresh token and SE key survive uninstall (an install marker detects the reinstall) and the user gets "Continue as X" behind Face ID/passcode; on Android nothing survives, so a single-use, hashed, hardware-key-redeemable resume grant lives in Block Store and is redeemed behind BiometricPrompt via a server-minted magic-link session; when even that is gone the OS remembers the account (Password AutoFill/passkeys, Credential Manager Sign in with Google, native Sign in with Apple). Every phase reuses KeychainStore/TokenStorage/TokenAuthenticator//refresh//logout as-is and ships behind a flag with legacy clients still working until an enforcement date.

# Pantopus Anchor — architecture

## 0. Goals / non-goals

Goals
- G1 Same-install cold start is silent (Level 1) and never pays the 401 -> refresh -> replay tax (proactive refresh from `expiresAt`).
- G2 Delete + reinstall on the same device: back in with ONE gesture ("Continue as Ying" + Face ID / Touch ID / passcode / BiometricPrompt), no password, in < 2 s.
- G3 A refresh token is useless off the device that minted it: every mobile session is bound to a non-exportable hardware key and refresh requires a signed proof.
- G4 Users can see "Where you're logged in", revoke one device, revoke everything; password change/reset kills other sessions; TOKEN_REUSE / device mismatch kills the session and notifies; account deletion kills everything before the auth user is deleted.
- G5 Ships on Supabase Auth + Express with no fork of GoTrue and no custom crypto (only platform key APIs + ES256 JWTs); each phase is independently shippable and testable; legacy clients keep working until an enforcement date.

Non-goals
- Migrating a *session* to a new device (backup restore / D2D). Only a non-secret account hint travels; the user re-authenticates with an OS-held credential.
- DPoP on every resource request (Phase 4 option); MFA/TOTP; phone auth; definitive jailbreak/root detection; web device-bound sessions (DBSC).

## 1. The three UX levels and when each applies

| Level | What survives on the device | Gesture | Used when |
|---|---|---|---|
| L1 "Still logged in" | access+refresh token, device key, install marker all match | none (silent) | normal cold start / foreground on the same install |
| L2 "App remembers account" | iOS: refresh token + SE key + cachedUser in Keychain, install marker missing. Android: Block Store `AccountHint{resumeGrant}` | tap "Continue as X" + OS presence check (LAContext `.deviceOwnerAuthentication` / BiometricPrompt STRONG or DEVICE_CREDENTIAL) | reinstall on the same device; also L1 when App Lock is enabled |
| L3 "OS remembers account" | only an optional display hint (name/avatar/masked email) | one tap in a system sheet | Android reinstall without Backup services, new device, keychain wiped, after explicit sign-out, "Use a different account" |

Policy decisions (opinionated):
1. Reinstall is NEVER Level 1. Uninstall is a weak signal that the device or intent changed; we require presence. This supersedes the RN-era "install sentinel wipes Keychain" decision (docs/07 §381-418, deep-dive §7): we now *keep* the credential but *gate* it.
2. If the device has no passcode/screen lock (`LAContext.canEvaluatePolicy(.deviceOwnerAuthentication)==false`, `BiometricManager.canAuthenticate(...)!=SUCCESS`), L2 is disabled: the user goes to L3. No OS lock => no one-tap resume.
3. Explicit sign-out revokes server-side and deletes tokens/grants but keeps a non-secret display hint so the login screen can pre-fill "Continue as X ->" (L3). "Not you? / Remove account" wipes the hint.
4. Server enforcement is the key binding + revocation; the biometric is a client gate (Tier 1 UX), because the DPoP key is deliberately NOT biometry-gated so background refresh (push-triggered fetch, socket reconnect) still works. A separate biometry-gated *step-up* key (Phase 3) gives server-verifiable "user is present" for sensitive actions.

## 2. Components

```
                iOS app                                   Android app
  +-----------------------------------+      +-------------------------------------+
  | AuthManager (state machine)       |      | AuthRepository (state machine)      |
  |  .unknown/.signedOut/.resumable/  |      |  Unknown/SignedOut/Resumable/       |
  |  .signedIn                        |      |  SignedIn                           |
  | DeviceKey  (SE P-256, Keychain    |      | DeviceKeyStore (Keystore EC P-256,  |
  |   dataRepresentation, survives    |      |   StrongBox if avail; dies with     |
  |   reinstall)                      |      |   uninstall)                        |
  | InstallMarker (sandbox file)      |      | AccountHintStore (Block Store:      |
  | KeychainStore (+deviceId,         |      |   hint + single-use resumeGrant)    |
  |   deviceKey, expiresAt, hint)     |      | TokenStorage (+expires_at,session)  |
  | DPoPProofBuilder (ES256 JWT)      |      | DPoPProofBuilder (ES256 JWT)        |
  | APIClient: X-Device-Id, DPoP on   |      | AuthInterceptor: X-Device-Id;       |
  |   /refresh, proactive refresh     |      |   TokenAuthenticator: DPoP refresh  |
  | AppLockManager (pref -> Keychain) |      | AppLockManager (BiometricPrompt)    |
  +----------------+------------------+      +-----------------+-------------------+
                   |  Bearer + X-Device-Id (+ DPoP on /refresh, /resume, /login)   |
                   v                                                               v
  +------------------------------------------------------------------------------------+
  | Express backend                                                                    |
  |  routes/users.js  /login /oauth/* /refresh /logout /password /reset-password       |
  |                   /reauthenticate DELETE /account   (hooks added, contracts kept)  |
  |  routes/authDevices.js  /api/auth/devices, /sessions/revoke-*, /resume,           |
  |                   /devices/register, /step-up, /challenge                          |
  |  middleware/verifyToken.js  getUser (immediate revocation) + JWT claims decode     |
  |                   (session_id, iat) + sessions_valid_after check                   |
  |  middleware/dpop.js  verify ES256 proof, jti replay, htu/htm, iat window           |
  |  middleware/stepUp.js  require X-Step-Up (HMAC, 5 min)                             |
  |  services/authDeviceService.js  upsert/bind/revoke devices, attestation levels     |
  |  services/authSessionService.js revoke_auth_session RPC, signOut scopes,           |
  |                   sessions_valid_after, resume-grant mint/redeem                   |
  |  services/authNotifyService.js  new-device / device-removed / reuse emails, push   |
  +---------------------------+------------------------------------+-------------------+
                              |                                    |
                              v                                    v
  +----------------------------------------+   +--------------------------------------+
  | Supabase Auth (GoTrue) - unchanged     |   | Postgres (public schema, service role)|
  |  signInWithPassword, exchangeCode,     |   |  AuthDevice, AuthResumeGrant,         |
  |  refreshSession (rotation on),         |   |  AuthDpopJti, AuthSecurityEvent,      |
  |  admin.signOut(jwt,'local|others|      |   |  User.sessions_valid_after,           |
  |  global'), admin.generateLink +        |   |  PushToken.device_id,                 |
  |  verifyOtp (mint session), getUser     |   |  fn revoke_auth_session(uuid),        |
  |  (fails with session_not_found once    |   |  fn revoke_user_sessions(uuid)        |
  |  auth.sessions row is gone)            |   |  (SECURITY DEFINER over auth.*)       |
  +----------------------------------------+   +--------------------------------------+
```

Where Supabase forces a custom layer (and how we stay thin):
- No admin "list/revoke a user's sessions" endpoint -> `AuthDevice.current_session_id` + `revoke_auth_session()` RPC that deletes the `auth.sessions` row (refresh tokens cascade). `auth.getUser(jwt)` then fails with `session_not_found`, so verifyToken revocation is immediate.
- Refresh tokens are pure bearer secrets -> we bind them at OUR /refresh proxy with a DPoP proof (RFC 9449) against the registered device key; GoTrue never sees the proof.
- No way to mint a session from a custom credential (Android resume grant, later passkeys) -> `admin.generateLink({type:'magiclink'})` + `verifyOtp({type:'magiclink', token_hash})` on a per-request anon client (same pattern /register already uses for signup links).
- No inactivity timeout on Free plan -> enforced at /refresh via `AuthDevice.last_refresh_at` (90 days).

## 3. Data model (backend/database/migrations/160_auth_devices.sql, mirrored under supabase/migrations)

```sql
-- One row per (user, installation key). iOS keeps the same row across reinstall
-- (SE key survives); Android gets a new row (Keystore key dies with uninstall).
CREATE TABLE "AuthDevice" (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id          text NOT NULL,                       -- client UUIDv4, generated with the key
  platform           text NOT NULL CHECK (platform IN ('ios','android','web')),
  public_key_jwk     jsonb,                               -- {kty:'EC',crv:'P-256',x,y}; NULL for web
  key_thumbprint     text,                                -- RFC 7638 SHA-256 of the JWK
  key_backing        text NOT NULL DEFAULT 'none'         -- none|software|tee|strongbox|secure_enclave
                     CHECK (key_backing IN ('none','software','tee','strongbox','secure_enclave')),
  attestation_level  text NOT NULL DEFAULT 'none'         -- none|key_attest|app_attest|play_basic|play_device|play_strong
                     CHECK (attestation_level IN ('none','key_attest','app_attest','play_basic','play_device','play_strong')),
  attestation        jsonb,                               -- app attest keyId+receipt digest / keystore chain summary / play verdict
  install_id         text,                                -- per-install random; rotates on reinstall
  name               text, model text, os_version text, app_version text,
  current_session_id uuid,                                -- auth.sessions.id from the JWT session_id claim
  session_bound_at   timestamptz,
  trusted_at         timestamptz,                         -- first interactive login on this key
  last_seen_at       timestamptz, last_ip inet, last_user_agent text,
  last_refresh_at    timestamptz,
  last_resumed_at    timestamptz,                         -- reinstall resume
  resumed_from_device uuid REFERENCES "AuthDevice"(id),   -- Android: previous row
  revoked_at         timestamptz, revoked_reason text,    -- user|password_change|reuse|mismatch|inactivity|account_deleted
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
CREATE INDEX authdevice_session_idx ON "AuthDevice"(current_session_id);
CREATE INDEX authdevice_user_active_idx ON "AuthDevice"(user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX authdevice_key_idx ON "AuthDevice"(device_id, key_thumbprint) WHERE key_thumbprint IS NOT NULL;

-- Android reinstall resume (Block Store). Single-use, hashed, 90-day, revocable.
CREATE TABLE "AuthResumeGrant" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id     uuid REFERENCES "AuthDevice"(id) ON DELETE SET NULL,   -- issuing device
  grant_hash    text NOT NULL UNIQUE,            -- sha256(grant); grant = 32 random bytes base64url
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,            -- created_at + 90d
  used_at       timestamptz, revoked_at timestamptz
);
CREATE INDEX authresumegrant_user_idx ON "AuthResumeGrant"(user_id) WHERE used_at IS NULL AND revoked_at IS NULL;

-- DPoP replay cache (small, TTL-pruned by a cron/interval job).
CREATE TABLE "AuthDpopJti" (jti text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE INDEX authdpopjti_exp_idx ON "AuthDpopJti"(expires_at);

-- Security timeline that feeds "Where you're logged in" and emails.
CREATE TABLE "AuthSecurityEvent" (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id  uuid REFERENCES "AuthDevice"(id) ON DELETE SET NULL,
  type       text NOT NULL,   -- login|oauth_login|resume|refresh_reuse|device_mismatch|device_revoked|revoke_others|revoke_all|password_changed|password_reset|logout|inactivity_expired|account_deleted|step_up
  ip inet, user_agent text, meta jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX authsecurityevent_user_idx ON "AuthSecurityEvent"(user_id, created_at DESC);

ALTER TABLE "User" ADD COLUMN sessions_valid_after timestamptz;      -- watermark: JWT iat < this => 401 SESSION_REVOKED
ALTER TABLE "PushToken" ADD COLUMN device_id text;                     -- links APNs/FCM token to AuthDevice.device_id
CREATE INDEX pushtoken_device_idx ON "PushToken"(user_id, device_id);

-- The two things Supabase's admin API cannot do (service role only).
CREATE FUNCTION public.revoke_auth_session(p_session_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = auth, public AS
$$ DELETE FROM auth.sessions WHERE id = p_session_id; $$;
CREATE FUNCTION public.revoke_user_sessions(p_user_id uuid, p_except uuid DEFAULT NULL) RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = auth, public AS
$$ WITH d AS (DELETE FROM auth.sessions WHERE user_id = p_user_id AND (p_except IS NULL OR id <> p_except) RETURNING 1) SELECT count(*) FROM d; $$;
REVOKE ALL ON FUNCTION public.revoke_auth_session(uuid), public.revoke_user_sessions(uuid,uuid) FROM PUBLIC, anon, authenticated;
-- RLS: all four tables service_role only (same pattern as 086_push_tokens.sql).
```

## 4. Wire contracts

### 4.1 DPoP proof (header `DPoP: <jwt>`), used on POST /api/users/login, /oauth/callback, /oauth/token, /refresh, /api/auth/resume, /api/auth/devices/register
```
header : {"typ":"dpop+jwt","alg":"ES256","jwk":{"kty":"EC","crv":"P-256","x":"...","y":"..."}}
payload: {"jti":"<uuid>","htm":"POST","htu":"https://api.pantopus.com/api/users/refresh","iat":1755500000}
```
Server (middleware/dpop.js): verify signature with the embedded jwk (jose `jwtVerify` with `EmbeddedJWK`), `htm`/`htu` match (htu compared against `PUBLIC_API_BASE_URL` + `req.originalUrl` sans query, so proxies do not matter), `|now-iat| <= 300 s`, `jti` unseen (insert into AuthDpopJti with 10-min TTL, PK conflict => 401 `DPOP_REPLAY`), compute `key_thumbprint`. Attaches `req.dpop = {jwk, thumbprint}`. Missing header is allowed while `AUTH_DEVICE_BINDING=optional`; rejected (`401 DPOP_REQUIRED`) once `required`.

### 4.2 Device descriptor (`device` object in login/oauth/resume/register bodies)
```json
{"deviceId":"uuidv4","platform":"ios","installId":"hex32","name":"Ying's iPhone","model":"iPhone16,2",
 "osVersion":"18.5","appVersion":"1.4.0 (312)",
 "keyBacking":"secure_enclave|strongbox|tee|software",
 "attestation":{"type":"android_key_attest","chain":["b64der",...]} | {"type":"app_attest","keyId":"..","attestation":"b64cbor"} | {"type":"play_integrity","token":"..."} }
```
Login/OAuth responses gain: `"device":{"id":"uuid","deviceId":"...","isNew":true,"trustedAt":"..."}, "sessionId":"uuid"`. All existing fields unchanged.

### 4.3 Endpoint table

Existing routes (routes/users.js), behaviour added, contracts backward compatible:
| Route | Added |
|---|---|
| POST /api/users/login | optional `device` + `DPoP`; after profile checks and before `applyAuthTransport` (users.js:1603): `authDeviceService.bindLogin(userId, sessionId, device, req.dpop)` -> upsert AuthDevice, `trusted_at`, `current_session_id`; new-device email if first login on this key; response adds `device`, `sessionId` |
| POST /api/users/oauth/callback, /oauth/token | same hook (users.js:3925 / 3857). /oauth/token now calls `refreshSession({refresh_token})` and returns the *new* pair only if `user.id` matches the verified access token (closes the unpaired-refresh-token gap) |
| POST /api/users/oauth/native (new) | `{provider:'apple'|'google', idToken, nonce?, accessToken?, device}` -> `signInWithIdToken` (native SIWA / Credential Manager Google); same profile bootstrap as OAuth; same device hook |
| POST /api/users/refresh | body `{refreshToken, deviceId?}` + `DPoP`. Order: (1) if deviceId+DPoP: load AuthDevice by (device_id, thumbprint), must be unrevoked; inactivity check `last_refresh_at > now()-90d` else revoke + `401 SESSION_EXPIRED_INACTIVE`; (2) `refreshSession`; on error keep existing TOKEN_REUSE branch but ALSO: find AuthDevice by the old session (client sends `X-Session-Id`? no — we look up by deviceId), mark `revoked_reason='reuse'`, `revoke_auth_session` (belt and braces), AuthSecurityEvent, email; (3) decode new access JWT `session_id`; if device row exists: assert `row.user_id == user.id` and (`current_session_id IS NULL` (legacy adoption) or `== session_id`), else `admin.signOut(newAccessToken,'local')` + revoke device + `401 DEVICE_MISMATCH` + event + email; (4) update `current_session_id`, `last_refresh_at`, `last_seen_at`, `last_ip`; (5) response unchanged + `sessionId` |
| POST /api/users/logout | body `{scope:'local'|'others'|'global', deviceId?}`; `local` (default, still unauthenticated & no CSRF) = today's behaviour + `authDeviceService.signOut(deviceId)`: clear `current_session_id`, delete PushToken rows for device_id, revoke that device's resume grants; `others`/`global` require verifyToken (+CSRF for cookie transport) and call `admin.signOut(bearer, scope)` + `revoke_user_sessions(user, except)` + mark other devices revoked + revoke all grants + event; `global` also sets `sessions_valid_after=now()` |
| POST /api/users/password | after `updateUserById` (users.js:1869): `admin.signOut(bearer,'others')`, `revoke_user_sessions(user, currentSession)`, revoke other devices (`password_change`), revoke all grants, event, email "password changed, other devices signed out" |
| POST /api/users/reset-password | after update: `revoke_user_sessions(user)` (global), `sessions_valid_after=now()`, revoke all devices+grants, then revoke recovery session as today |
| POST /api/users/reauthenticate | returns `{verified:true, stepUpToken, expiresAt}`; `stepUpToken = base64url(HMAC-SHA256(STEP_UP_SECRET, userId|sessionId|exp))` + payload, 5 min |
| DELETE /api/users/account | requires `X-Step-Up` (middleware/stepUp.js); before `deleteUser` (users.js:4140): `revoke_user_sessions(user)`, delete PushToken by user, event `account_deleted`; AuthDevice/grants cascade with auth.users |

New router `backend/routes/authDevices.js` mounted `app.use('/api/auth', require('./routes/authDevices'))` next to app.js:306:
| Method/Path | Auth | Request | Response |
|---|---|---|---|
| POST /api/auth/challenge | none, `challengeLimiter` 30/15m/IP | `{}` | `{challenge:"b64url32", expiresAt}` (for Android key attestation / App Attest, 10-min TTL, stored in AuthDpopJti-style table `AuthChallenge`) |
| POST /api/auth/devices/register | verifyToken + DPoP | `{device}` + push `{pushToken?, provider?}` | `{device:{id,deviceId,trustedAt,attestationLevel}}` — idempotent upsert; called after login/resume, on app update, when APNs/FCM token changes |
| GET /api/auth/devices | verifyToken | — | `{devices:[{id,deviceId,platform,name,model,osVersion,appVersion,isCurrent,trustedAt,lastSeenAt,lastLocation:{city,country}?,attestationLevel,createdAt}], events:[last 20 AuthSecurityEvent]}` (`isCurrent` = `current_session_id == req.session.id`) |
| DELETE /api/auth/devices/:id | verifyToken + stepUp | — | `{ok:true}`; `revoke_auth_session(current_session_id)`, `revoked_at/reason='user'`, delete PushToken by device_id, revoke grants, event, email "device removed", socket kick |
| POST /api/auth/sessions/revoke-others | verifyToken + stepUp | `{}` | `{revoked:n}` — `admin.signOut(bearer,'others')` + RPC + devices marked |
| POST /api/auth/sessions/revoke-all | verifyToken + stepUp | `{}` | `{ok:true}` — global + `sessions_valid_after=now()`; client signs itself out |
| POST /api/auth/resume | none, `resumeLimiter` 5/15m/IP + per-grant, DPoP required | `{grant, device}` | login-shaped `{accessToken,refreshToken,expiresIn,expiresAt,user,device,sessionId,resumeGrant:"<new>"}`; steps: hash+lookup grant (unused, unexpired, unrevoked, user not banned/deleted), require `key_backing != 'software'` (policy), mint session via `generateLink(magiclink)`+`verifyOtp`, create AuthDevice (`resumed_from_device`, `trusted_at=now`), mark grant used, issue new grant, event `resume`, email if `platform/model` differs from issuing device |
| POST /api/auth/step-up | verifyToken, `stepUpLimiter` 10/15m | `{method:'password', password}` or `{method:'device_key', challenge, signature}` (Phase 3 biometric key) | `{stepUpToken, expiresAt}` |
| GET /api/auth/security-events | verifyToken | `?limit` | `{events:[...]}` |

Error codes clients must distinguish (all 401 JSON `{error, code}`): `TOKEN_REUSE`, `DEVICE_MISMATCH`, `DEVICE_REVOKED`, `SESSION_REVOKED`, `SESSION_EXPIRED_INACTIVE`, `DPOP_REQUIRED`, `DPOP_INVALID`, `DPOP_REPLAY`, `RESUME_GRANT_INVALID`, `STEP_UP_REQUIRED` (403). Clients wipe local state on the first six and show "You were signed out for security. Sign in again." (never a generic expiry).

### 4.4 verifyToken changes (middleware/verifyToken.js)
After `supabase.auth.getUser(token)` succeeds: decode payload (base64url, no re-verify) -> `req.session={id:session_id, iat, aal}`; load `sessions_valid_after` in the same 60-s role cache; if `iat*1000 < sessions_valid_after` -> `401 SESSION_REVOKED`. `optionalAuth` keeps its 15-s cache (accepted lag). Socket middleware (chatSocketio.js:154) gets the same decode; on device revoke the service emits `auth:session_revoked {sessionId}` and the socket server disconnects matching sockets.

## 5. Client primitives

iOS
- Device key: `SecureEnclave.P256.Signing.PrivateKey()` (CryptoKit, iOS 17 target); `dataRepresentation` stored in Keychain (`SecureStoreKey.deviceKey`, `.afterFirstUnlockThisDeviceOnly`, non-synchronizable) -> survives reinstall on the same device, never migrates. Simulator/no-SE fallback: `P256.Signing.PrivateKey` in Keychain, `keyBacking:'software'` (server: no resume grants, lower trust). Not biometry-gated (see policy 4).
- Install marker: `Library/Application Support/.pantopus-install` containing a random `installId`; also mirrored in Keychain. Missing file (or mismatch) while Keychain has a refresh token => reinstall detected. (Apple's own recommendation for deterministic reinstall behaviour, used to *detect* not to wipe.)
- Keychain keys added: `deviceId`, `deviceKey`, `installId`, `expiresAt`, `sessionId`, `accountHint` (name/avatar/masked email/userId), `appLockEnabled.<uid>` (moved from UserDefaults so App Lock re-arms after reinstall).
- Optional (Phase 3): a *second* Keychain item `accountHint` with `.synchronizable(true)`/`.afterFirstUnlock` so a new iPhone restored from iCloud pre-fills "Continue as X ->" (L3).

Android
- Device key: `KeyGenParameterSpec.Builder("pantopus_device_key", PURPOSE_SIGN).setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1")).setDigests(SHA256).setAttestationChallenge(challenge)`, try `setIsStrongBoxBacked(true)` then fall back (`keyBacking` = strongbox|tee); no `setUserAuthenticationRequired` (background refresh). Dies with uninstall by design.
- Identity: `deviceId` in plain prefs `device_identity` (backup-excluded); regenerated with the key.
- Account hint + resume grant: Block Store key `pantopus.account_hint` (<= 4 KB JSON: `{v:1,userId,displayName,avatarUrl,maskedEmail,resumeGrant,deviceIdHint,platformHint,issuedAt}`), `setShouldBackupToCloud(false)` (same-device reinstall + D2D only). Written on every login/refresh-of-grant, `deleteBytes` on "remove account", grant field cleared on explicit sign-out.
- TokenStorage gains `expires_at`, `session_id`.

## 6. Flows

### 6.1 First interactive login (email/password; OAuth identical after code exchange)
```
 client                                   backend (/api/users/login)                 Supabase
  | ensure deviceId+key (create once)        |                                          |
  | POST {email,password,device}             |                                          |
  |   DPoP: proof(htu=/login)  ------------->| verify DPoP (jwk->thumbprint)            |
  |                                          | signInWithPassword ----------------------->|
  |                                          |<------------- session(access,refresh) ----|
  |                                          | email confirmed? User row? (unchanged)   |
  |                                          | sid = jwt.session_id                     |
  |                                          | AuthDevice upsert (user,deviceId):       |
  |                                          |   jwk,thumbprint,keyBacking,attest,      |
  |                                          |   install_id, current_session_id=sid,    |
  |                                          |   trusted_at=now if new -> event login   |
  |                                          | new key? -> email "New sign-in on X"     |
  |<-- {tokens, user, device, sessionId} ----|                                          |
  | persist tokens+expiresAt+sessionId       |                                          |
  | write install marker (iOS) /             |                                          |
  |   Block Store hint (Android, grant       |                                          |
  |   arrives via /devices/register below)   |                                          |
  | POST /api/auth/devices/register          |                                          |
  |   {device, pushToken} (Bearer+DPoP) ---->| link PushToken.device_id; Android:       |
  |<-- {device, resumeGrant (android)} ------|   mint AuthResumeGrant, return grant     |
```
(Grant minting lives in /devices/register so /login's response shape stays platform-neutral; register is idempotent and re-run on app update.)

### 6.2 Cold start, same install (Level 1)
```
 restore(): tokens present, marker matches ->
   if expiresAt - now < 120 s: refreshIfPossible() (DPoP)          <- proactive, no 401 tax
   GET /api/users/profile (Bearer) -> signedIn(user); AppLock arms if enabled
   on .unauthorized (refresh already failed): read error code
      TOKEN_REUSE / DEVICE_* / SESSION_* -> wipe tokens, keep hint, show "signed out for security"
      plain expiry / SESSION_EXPIRED_INACTIVE -> wipe tokens, keep hint, normal login with prefill
   transient -> stay signedIn on cachedUser (unchanged)
 scenePhase .active / onStart: refresh if < 120 s left; socket reconnect on auth error triggers refreshIfPossible()
```

### 6.3 Reinstall on the same device — iOS (Level 2)
```
 launch: Keychain has refreshToken + deviceKey + cachedUser, install marker MISSING
   -> state .resumable(AccountHint)  -> ContinueAsView "Continue as Ying"
        [Continue]  -> LAContext.evaluatePolicy(.deviceOwnerAuthentication)
                       (no passcode on device? -> go to LoginView prefilled, L3)
                    -> POST /refresh {refreshToken, deviceId} + DPoP
                       server: device row found by (deviceId, thumbprint), unrevoked,
                               < 90 d idle -> refreshSession -> session_id matches
                               current_session_id -> ok; last_resumed_at, install_id updated
                    -> GET /profile -> POST /devices/register {installId new}
                    -> write new install marker; re-arm AppLock from Keychain pref
        [Use a different account] -> LoginView (tokens kept until new login succeeds, then old
                                     session logged out with scope local)
        [Not you? Remove]         -> POST /logout {scope:'local'} + wipe Keychain incl. hint
   Keychain wiped by a future iOS? -> nothing found -> LoginView (L3: AutoFill/passkey/SIWA)
```

### 6.4 Reinstall on the same device — Android (Level 2 via Block Store)
```
 restore(): TokenStorage empty -> AccountHintStore.read() (Block Store)
   hint with resumeGrant present -> State.Resumable(hint) -> ContinueAsScreen
      [Continue] -> BiometricPrompt(BIOMETRIC_STRONG|DEVICE_CREDENTIAL)
                    (no screen lock -> LoginScreen prefilled, L3)
                 -> DeviceKeyStore.getOrCreate() (new key; challenge from /api/auth/challenge)
                 -> POST /api/auth/resume {grant, device} + DPoP
                    server: sha256(grant) lookup, single-use, <90 d, unrevoked;
                            keyBacking in (tee,strongbox); attestation verified (Phase 3)
                            generateLink(magiclink) -> verifyOtp -> session
                            AuthDevice new row (resumed_from_device), grant used_at,
                            new grant issued, event resume (+ email if model changed)
                 <- login-shaped response + resumeGrant'
                 -> persist tokens; Block Store hint rewritten with grant'
   hint without grant (explicit sign-out) -> LoginScreen prefilled (L3: Credential Manager)
   no hint (Backup services off / new device) -> LoginScreen (L3)
```

### 6.5 Token refresh + rotation (steady state)
```
 401 on authed call (or proactive) -> single-flight refresh:
   POST /refresh {refreshToken, deviceId} + DPoP(htu=/refresh, jti, iat)
   server: (1) AuthDevice by (deviceId, thumbprint) & unrevoked & !idle
           (2) refreshSession -> Supabase rotates (10 s reuse grace, parent-token grace)
               error "already used|not found" -> TOKEN_REUSE: revoke device (reason reuse),
                 revoke_auth_session, event, email  -> 401 TOKEN_REUSE
           (3) new jwt.session_id == row.current_session_id (or NULL -> adopt legacy session)
               mismatch -> admin.signOut(newAccess,'local'), revoke device, 401 DEVICE_MISMATCH
           (4) update last_refresh_at/last_seen/ip; return new pair (+sessionId)
   client: persist pair+expiresAt; replay once; reconnect socket
   crash between server rotate and client persist -> Supabase parent-token grace re-issues,
   our row's current_session_id is unchanged (same session), no false alarm
```

### 6.6 Logout
```
 this device:  POST /logout {scope:'local', deviceId} (Bearer if we have it)
               server: admin.signOut(access,'local'); AuthDevice.current_session_id=NULL,
                       PushToken(device_id) deleted, Android grants revoked
               client: wipe tokens/expiresAt/sessionId, keep accountHint (display only),
                       Android: Block Store grant field cleared, clearCredentialState;
                       APNs/FCM: nothing to do (server deleted the row); purge URLCache/OkHttp cache
 all other devices: Settings > Devices > "Sign out of all other devices" -> step-up -> POST /api/auth/sessions/revoke-others
 everywhere:        POST /api/auth/sessions/revoke-all -> global signOut + sessions_valid_after -> client signs itself out
```

### 6.7 Stolen device / remote revoke
```
 owner (web or other phone) -> Settings > Security > Devices -> "Ying's iPhone" > Remove
   -> step-up (password / biometric key) -> DELETE /api/auth/devices/:id
   -> revoke_auth_session(current_session_id): auth.sessions row gone
   -> AuthDevice.revoked_at, PushToken rows deleted, resume grants revoked, socket kicked, email
 stolen phone, next request:  Bearer -> getUser -> session_not_found -> 401
   -> refresh with DPoP -> AuthDevice revoked -> 401 DEVICE_REVOKED -> app wipes tokens+hint,
      shows "Signed out for security"; App Lock (Keychain pref) still gates any cached UI
   -> reinstall on stolen phone: iOS Keychain refresh token dead server-side; Android grant revoked
 owner also can: change password (revokes others) or "Sign out everywhere"; if the account
   itself is compromised: reset password (global revoke + watermark)
```

### 6.8 Password change / reset
```
 change (authed): verify current pw -> updateUserById -> admin.signOut(bearer,'others') ->
                  revoke_user_sessions(user, currentSession) -> other AuthDevices revoked
                  (password_change), grants revoked, event, email
 reset (recovery link): update -> revoke_user_sessions(user) + sessions_valid_after=now ->
                  all devices revoked, grants revoked -> recovery session revoked (unchanged)
                  -> user signs in fresh on their device (new AuthDevice binding)
```

### 6.9 Account deletion
```
 client: Tier-2 biometric -> POST /reauthenticate (or /step-up) -> stepUpToken
      -> DELETE /api/users/account (X-Step-Up)
 server: existing escrow/gig guards -> revoke_user_sessions(user) -> delete PushToken(user)
      -> event account_deleted -> delete User row -> admin.deleteUser (AuthDevice, grants,
         events cascade via auth.users)
 client: wipe Keychain/TokenStorage incl. hint + install marker; Android Block Store deleteBytes
      + clearCredentialState(TYPE_CLEAR_RESTORE_CREDENTIAL when adopted)
```

## 7. Policy constants
- Access JWT 3600 s (unchanged). Refresh rotates on every call (unchanged). Proactive refresh at < 120 s remaining.
- Device inactivity: 90 days without a successful refresh -> device revoked (`inactivity`), next refresh 401 `SESSION_EXPIRED_INACTIVE`. Resume grants: 90 days, single-use, re-issued on every successful resume/register.
- DPoP: `iat` window +/-300 s, `jti` TTL 10 min, `htu` = configured public base URL + path.
- Step-up token: 5 min, bound to (user, session).
- New-device email: first login/resume on a key, or resume from a different model than the issuing device.
- Feature flags (env): `AUTH_DEVICE_BINDING=off|optional|required` (Phase 1 optional -> Phase 3 required), `AUTH_RESUME_GRANTS=on|off`, `AUTH_ATTESTATION=log|enforce`.

## 8. Observability
Log/metric names reuse existing ones and add: `auth.device.bind`, `auth.device.adopt_legacy`, `auth.device.mismatch`, `auth.device.revoked`, `auth.resume.ok|invalid`, `auth.dpop.invalid|replay`, `auth.refresh.inactive`, `auth.stepup.ok|fail`; client events `session_restore_ok`, `session_resume_prompt`, `session_resume_ok|cancel`, `session_invalidated{code}` (names already reserved in docs/07). Dashboards: % refreshes with DPoP (gates the enforcement flip), resume success rate, mismatch/reuse per 10k refreshes.

## Backend changes
- Migration backend/database/migrations/160_auth_devices.sql (+ supabase/migrations/2026081800000_auth_devices.sql): tables AuthDevice, AuthResumeGrant, AuthDpopJti, AuthChallenge, AuthSecurityEvent; User.sessions_valid_after; PushToken.device_id; SECURITY DEFINER functions public.revoke_auth_session(uuid) and public.revoke_user_sessions(uuid, uuid) over auth.sessions; RLS service_role only (pattern from 086_push_tokens.sql).
- New backend/middleware/dpop.js: verifies `DPoP` header (jose EmbeddedJWK ES256), htm/htu against PUBLIC_API_BASE_URL + req.originalUrl, iat +/-300 s, jti replay via AuthDpopJti; sets req.dpop={jwk,thumbprint}; behaviour switched by AUTH_DEVICE_BINDING=off|optional|required. Add `jose` dependency (or reuse if present).
- New backend/middleware/stepUp.js: requires `X-Step-Up` HMAC token (STEP_UP_SECRET, 5 min, bound to req.user.id + req.session.id); 403 STEP_UP_REQUIRED otherwise. Applied to DELETE /api/users/account, DELETE /api/auth/devices/:id, POST /api/auth/sessions/revoke-others|revoke-all.
- New backend/services/authDeviceService.js: bindLogin(userId, accessToken, device, dpop, req) [decode session_id, upsert AuthDevice, trusted_at, new-key detection], bindRefresh(...) [pre-check by (device_id,thumbprint), inactivity 90 d, post-check session match/adopt legacy, DEVICE_MISMATCH handling], signOutDevice(deviceId), revokeDevice(id, reason), revokeOthers/All(userId, exceptSession), listDevices(userId, currentSessionId), attestation-level evaluation (Phase 3: Android key-attestation chain verify vs Google root + CRL, App Attest verify, Play Integrity decodeIntegrityToken).
- New backend/services/authSessionService.js: revokeSession(sessionId) via RPC, revokeUserSessions(userId, except), setSessionsValidAfter(userId), mintSessionForUser(userId) = admin.generateLink({type:'magiclink'}) + scoped verifyOtp({type:'magiclink', token_hash}), mintResumeGrant(userId, deviceRowId) [32 random bytes, store sha256], redeemResumeGrant(grant, ...) [single-use, expiry, revoked, user status].
- New backend/services/authNotifyService.js: emails via existing SMTP for new_device_login, device_removed, password_changed_other_devices, security_signout (TOKEN_REUSE / DEVICE_MISMATCH); optional push to remaining devices; all with a deep link to https://pantopus.com/app/settings/security.
- New backend/routes/authDevices.js mounted at app.js ~L306 as app.use('/api/auth', ...): POST /challenge, POST /devices/register (verifyToken+dpop), GET /devices, DELETE /devices/:id (stepUp), POST /sessions/revoke-others, POST /sessions/revoke-all, POST /resume (resumeLimiter 5/15m/IP + per-grant, dpop required), POST /step-up, GET /security-events; rate limiters added to the users.js block (532-578) or middleware/rateLimiter.js.
- backend/routes/users.js POST /login (before applyAuthTransport at ~1603), POST /oauth/callback (~3925), POST /oauth/token (~3857): accept optional `device` + DPoP, call authDeviceService.bindLogin, add `device` and `sessionId` to the JSON body; /oauth/token now refreshes the supplied pair and only returns the new pair when user ids match.
- backend/routes/users.js new POST /oauth/native: {provider:'apple'|'google', idToken, nonce?, accessToken?, device} -> scoped client auth.signInWithIdToken, ensureOAuthUserProfile, same device hook (enables native Sign in with Apple and Android Credential Manager Google).
- backend/routes/users.js POST /refresh (1912-1958): read deviceId + DPoP; pre-check device row; on TOKEN_REUSE branch also revoke device + session + AuthSecurityEvent + email; post-refresh session_id check (adopt legacy / DEVICE_MISMATCH with immediate admin.signOut of the just-minted token); update last_refresh_at/last_seen/last_ip; return sessionId; new 401 codes DEVICE_REVOKED, DEVICE_MISMATCH, SESSION_EXPIRED_INACTIVE, DPOP_*.
- backend/routes/users.js POST /logout (4263): body {scope, deviceId}; local keeps unauthenticated semantics + authDeviceService.signOutDevice (clear binding, delete PushToken rows for device_id via pushService, revoke that device's grants); scope others/global routed through verifyToken (+CSRF for cookies) -> admin.signOut(bearer, scope) + RPC + device revocation + sessions_valid_after (global).
- backend/routes/users.js POST /password (1869) and POST /reset-password (3285/3324): after the password update revoke other/all sessions (admin.signOut others / revoke_user_sessions), mark devices revoked (password_change / password_reset), revoke resume grants, set sessions_valid_after on reset, emit events + email.
- backend/routes/users.js POST /reauthenticate (1649): additionally mint and return {stepUpToken, expiresAt}. DELETE /account (3970): add stepUp middleware; before admin.deleteUser call revoke_user_sessions + delete PushToken by user + event account_deleted.
- backend/middleware/verifyToken.js: after getUser, base64url-decode the JWT payload into req.session={id,iat,aal}; fold User.sessions_valid_after into the existing 60-s role cache and 401 SESSION_REVOKED when iat is older; export a helper reused by backend/socket/chatSocketio.js (154-172); socket server subscribes to device-revoke events and disconnects sockets whose session_id was revoked.
- backend/routes/notifications.js POST /register + services/pushService.js saveToken: accept optional deviceId and store PushToken.device_id; add removeTokensForDevice(userId, deviceId) used by logout/revoke; account deletion calls removeAllTokens.
- Config: env PUBLIC_API_BASE_URL, STEP_UP_SECRET (required in production like CSRF_SECRET), AUTH_DEVICE_BINDING, AUTH_RESUME_GRANTS, AUTH_ATTESTATION, APPLE_TEAM_ID / IOS_BUNDLE_ID (App Attest), ANDROID_PACKAGE_NAME + Play Integrity service account (Phase 3); GoTrue project settings: enable Apple/Google native ID-token audiences for signInWithIdToken; consider [auth.sessions] inactivity_timeout on Pro as a second line (our 90-day check does not depend on it).
- Web (prerequisite, frontend/apps/web/public/.well-known): regenerate apple-app-site-association for <TEAMID>.app.pantopus.ios with applinks + webcredentials, and assetlinks.json for app.pantopus.android with delegate_permission/common.handle_all_urls AND common.get_login_creds using Play App Signing + upload SHA-256s (keep the legacy Expo entries during transition); add web /app/settings/security page listing GET /api/auth/devices with per-device Remove and Sign out everywhere (cookie transport, CSRF).
- Docs/compliance: update docs/01-authentication-authorization.md §1, docs/mobile/auth-backend-contracts.md §7 (+ new /api/auth contracts and error codes), supersede docs/07 install-sentinel and deep-dive §7 with the new reinstall policy, register device id / device public key / account hint / Block Store item in docs/compliance/privacy-data-inventory.md and regenerate App Store privacy labels + Play Data safety (Device ID: app functionality + security).
- Tests: backend/tests for dpop.js (valid, wrong htu, skewed iat, replayed jti), refresh binding matrix (no device / legacy adopt / match / mismatch / revoked / inactive / TOKEN_REUSE side effects), resume grant lifecycle (single-use, expiry, revoked, software key rejected), logout scopes, password change revoking others, devices list isCurrent, stepUp enforcement on DELETE /account.

## iOS changes
- New Core/Auth/DeviceKey.swift: SecureEnclave.P256.Signing.PrivateKey created once, dataRepresentation persisted via KeychainStore under SecureStoreKey.deviceKey (afterFirstUnlockThisDeviceOnly, non-synchronizable, no biometry so background refresh works); software P256 fallback when SE unavailable (simulator) reported as keyBacking 'software'; exposes jwk, thumbprint, sign(Data). Handles 'key missing/undecodable' by regenerating and forcing re-login.
- New Core/Auth/DPoPProofBuilder.swift: builds the ES256 dpop+jwt (jti UUID, htm, htu = APIClient.baseURL + path, iat) with the embedded JWK; unit-tested with a software key.
- New Core/Auth/InstallMarker.swift: random installId written to Library/Application Support/.pantopus-install (excluded from backup via URLResourceValues.isExcludedFromBackup) and mirrored in Keychain; `isReinstall` = Keychain has refreshToken && (file missing || mismatch).
- New Core/Auth/DeviceDescriptor.swift: builds the `device` payload (deviceId UUID from Keychain, installId, UIDevice name/model via utsname, os/app version, keyBacking, attestation placeholder).
- Core/Auth/KeychainStore.swift: add SecureStoreKey.deviceId, deviceKey, installId, expiresAt, sessionId, accountHint, appLockEnabled(userId:); add a Data-capable set/get (KeychainAccess supports Data) for the SE key blob; optional second Keychain instance `.synchronizable(true)` for the display-only accountHint (Phase 3).
- Core/Auth/AuthManager.swift: AuthState gains `.resumable(AccountHint)`; restoreSession() (152-195) checks InstallMarker first -> `.resumable` instead of silent restore; also attempts a refresh when only a refresh token exists; new resume() = LAContext .deviceOwnerAuthentication (skip to LoginView if canEvaluatePolicy is false) -> refreshIfPossible() -> hydrate -> registerDevice() -> write marker; persistLoginResponse (257-276) stores expiresAt/sessionId/accountHint and calls POST /api/auth/devices/register (with APNs token if known); performRefresh (427-466) sends deviceId + DPoP and surfaces AuthErrorBody.code (TOKEN_REUSE / DEVICE_* / SESSION_*) as `sessionEndedReason`; refreshIfExpiringSoon() for proactive refresh; signOut(scope: .local|.others|.global) calls POST /api/users/logout (or /api/auth/sessions/revoke-*), keeps accountHint on local sign-out, wipes it on removeRememberedAccount(); handleUnauthorized(code:) shows the security banner for revocation codes.
- Core/Networking/APIClient.swift: buildRequest adds `X-Device-Id`; executeWithRetry (170-221) does a pre-flight refresh when Keychain expiresAt - now < 120 s; adds `DPoP` header for endpoints flagged `requiresDPoP` (login, oauth/*, refresh, auth/resume, auth/devices/register); purge URLCache on signOut; MultipartUploader mirrors the pre-flight refresh.
- Core/Networking/Endpoints/AuthEndpoints.swift + Models/Auth/AuthDTOs.swift: LoginRequest.device, RefreshRequest.deviceId, LoginResponse.device/sessionId, RefreshResponse.sessionId; new endpoints logout(scope:deviceId:), registerDevice, devices, revokeDevice(id), revokeOthers, revokeAll, stepUp, reauthenticate (now returns stepUpToken), oauthNative(provider:idToken:nonce:); DeviceDTO, AuthSecurityEventDTO, StepUpResponse; AuthErrorBody.code parsed into a SessionEndReason enum.
- Core/Realtime/SocketClient.swift: on auth/unauthorized error call AuthManager.shared.refreshIfPossible() and reconnect with the rotated token; stop infinite reconnect on DEVICE_REVOKED/SESSION_REVOKED.
- App/PantopusApp.swift: RootView switch adds `.resumable` -> ContinueAsView; scenePhase .active triggers refreshIfExpiringSoon(); AppLock seal reads the Keychain-backed preference so a reinstalled app comes back locked; App/AppDelegate.swift sends deviceId with POST /api/notifications/register and re-registers via /api/auth/devices/register when the APNs token changes.
- New Features/Auth/ContinueAsView.swift (+ ViewModel): avatar/name/masked email from AccountHint, primary 'Continue' (biometric/passcode), 'Use a different account', 'Not you? Remove' (calls signOut local + wipes hint); Features/Auth/LoginView.swift: pre-fill email from hint, `.username` textContentType, Phase 3 native SignInWithAppleButton -> POST /oauth/native, Phase 4 passkey AutoFill via ASAuthorizationPlatformPublicKeyCredentialProvider.performAutoFillAssistedRequests.
- New Features/Settings/Security/DevicesView.swift + DevicesViewModel.swift: list GET /api/auth/devices (current device pinned), swipe/Remove -> Tier-2 SensitiveScreenGuard -> POST /reauthenticate or /step-up -> DELETE /devices/:id, 'Sign out of all other devices', security-events timeline; add row in Settings root; PrivacyViewModel.swift account deletion sends X-Step-Up.
- Core/Security/AppSecurity.swift: AppLockManager.configure(userID:) reads/writes `appLockEnabled.<uid>` in Keychain (migrating the UserDefaults value once) so the lock survives reinstall; expose verifyPresence(reason:) reused by ContinueAsView; Phase 3: StepUpKey (SE key with .biometryCurrentSet | .privateKeyUsage) used by POST /api/auth/step-up {method:'device_key'}.
- Entitlements: add webcredentials:pantopus.com and webcredentials:www.pantopus.com (and .app) to BOTH Pantopus/Resources/Pantopus.entitlements and project.yml entitlements.properties (140-152), and re-add applinks:pantopus.com/www there so `make bootstrap` stops reverting it; Phase 3 add com.apple.developer.applesignin and com.apple.developer.devicecheck.appattest-environment; Info.plist NSFaceIDUsageDescription text updated to mention 'continue signed in'.
- Phase 3 (iOS attestation): Core/Security/AppAttestClient.swift — DCAppAttestService generateKey/attestKey with server challenge at first login/resume (persist keyId in Keychain; regenerate after reinstall since App Attest keys do not survive it), send in device.attestation; assertions optionally on /api/auth/resume.
- Tests: PantopusTests/AuthManagerResumeTests.swift (reinstall detection -> .resumable, resume success/refresh-401 codes/no-passcode fallback, hint kept on local sign-out and wiped on remove), DPoPProofBuilderTests.swift, DeviceKeyTests.swift (software fallback), extend AuthManagerRefreshTests for proactive refresh + deviceId/DPoP presence and AuthManagerTests for logout network call; Fixtures.swift InMemorySecureStore gains Data support.

## Android changes
- Gradle: libs.versions.toml + app/build.gradle.kts add com.google.android.gms:play-services-auth-blockstore:16.4.0 (Phase 2), androidx.credentials:credentials + credentials-play-services-auth (1.5.0+) and com.google.android.libraries.identity.googleid (Phase 3), com.google.android.play:integrity (Phase 3); keep security-crypto 1.1.0-alpha06 for TokenStorage (do not extend MasterKey for the device key).
- New data/auth/DeviceKeyStore.kt: Android Keystore EC P-256 key alias `pantopus_device_key` via KeyGenParameterSpec (PURPOSE_SIGN, SHA-256, setAttestationChallenge(serverChallenge)), setIsStrongBoxBacked(true) with StrongBoxUnavailableException fallback; reports keyBacking tee|strongbox; exports JWK/thumbprint, sign(bytes), attestation certificate chain; regenerates (new deviceId) if the key is gone (KeyPermanentlyInvalidatedException / uninstall).
- New data/auth/DPoPProofBuilder.kt (ES256 dpop+jwt with embedded JWK; unit-testable with a software EC key) and data/auth/DeviceIdentity.kt (deviceId UUID in plain prefs `device_identity`, regenerated with the key; installId; DeviceDescriptor with Build.MODEL/MANUFACTURER, Build.VERSION.RELEASE, BuildConfig version, keyBacking, attestation).
- New data/auth/AccountHintStore.kt (Phase 2): Block Store client (BlockstoreClient.storeBytes/retrieveBytes/deleteBytes) key `pantopus.account_hint`, JSON <= 4 KB {userId, displayName, avatarUrl, maskedEmail, resumeGrant, deviceIdHint, issuedAt}, setShouldBackupToCloud(false); write after login/register/resume, clearGrant() on local sign-out, delete() on remove-account/account-deletion; graceful no-op when GMS unavailable.
- data/auth/TokenStorage.kt: persist expires_at and session_id in save()/updateTokens(); expose expiresAt(); clear() untouched for hint data (hint lives in Block Store/plain prefs, never in secure_auth_tokens).
- data/auth/AuthRepository.kt: State gains Resumable(AccountHint); restore() (175-217): when no access token consult AccountHintStore -> Resumable if a grant exists, else SignedOut with prefill hint; new resume(activity) = BiometricPrompt(BIOMETRIC_STRONG or DEVICE_CREDENTIAL, skip to login when canAuthenticate != SUCCESS) -> POST /api/auth/challenge -> DeviceKeyStore.getOrCreate -> POST /api/auth/resume {grant, device} + DPoP -> persistLoginResponse -> hint rewritten with the new grant; refreshTokens() (448-481) sends deviceId + DPoP and maps error codes (TOKEN_REUSE/DEVICE_*/SESSION_*) into a SessionEndReason flow for UI; refreshIfExpiringSoon(); persistLoginResponse (312-328) stores expiresAt/sessionId then calls POST /api/auth/devices/register (with FCM token) and stores the returned resumeGrant; signOut(scope) calls POST /api/users/logout {scope, deviceId} (or /api/auth/sessions/revoke-*), clears grant, keeps display hint, calls CredentialManager.clearCredentialState (Phase 3), unregisters push; removeRememberedAccount() deletes Block Store entry.
- data/auth/TokenAuthenticator.kt: parse the /refresh error body code in the AuthRejected branch (71-75) and pass it to signOut(reason) so the UI shows 'signed out for security' instead of a silent bounce; data/auth/AuthInterceptor.kt: add X-Device-Id, and pre-flight refresh when TokenStorage.expiresAt is within 120 s (never for the refresh endpoint); di/NetworkModule.kt: DeviceIdentity interceptor on both the main and @Named("authRefresh") clients, DPoP added by AuthRepository for the refresh/login/resume calls (only requests that need it).
- data/api/services/AuthApi.kt + data/api/models/auth/AuthDtos.kt: LoginRequest.device, RefreshRequest.deviceId, LoginResponse.device/sessionId, new endpoints logout(scope), oauthNative, challenge, resume, registerDevice, devices, revokeDevice, revokeOthers, revokeAll, stepUp, reauthenticate (stepUpToken), securityEvents; DeviceDto, AuthSecurityEventDto, ResumeRequest/Response, ErrorBody.code parsing helper.
- ui/navigation/PantopusNavHost.kt (57-78): Resumable -> ContinueAsScreen; new ui/screens/auth/ContinueAsScreen.kt + ContinueAsViewModel.kt (Continue -> biometric -> resume; Use a different account; Not you? Remove); ui/screens/auth/LoginScreen.kt: prefill email from hint, add autofill semantics (ContentType.EmailAddress/Password via Modifier.semantics{contentType}), Phase 3 'Sign in with Google' via CredentialManager.getCredential(GetGoogleIdOption(serverClientId, nonce)) -> POST /oauth/native, later passkeys via GetPublicKeyCredentialOption; ui/screens/RootViewModel.kt: also call refreshIfExpiringSoon() on ON_START.
- New ui/screens/settings/security/DevicesScreen.kt + DevicesViewModel.kt: list/revoke devices with AppLockManager.verifySensitiveAction -> /reauthenticate or /step-up -> DELETE /api/auth/devices/:id; 'Sign out of all other devices'; security events; wire into SettingsScreens.kt; AccountDeleteSheet.kt sends X-Step-Up.
- core/security/AppLockManager.kt: add promptWithCrypto(CryptoObject) variant (Phase 3) for a second Keystore key `pantopus_stepup_key` with setUserAuthenticationRequired(true, AUTH_BIOMETRIC_STRONG) + setInvalidatedByBiometricEnrollment(true) used by POST /api/auth/step-up {method:'device_key'}; expose verifyPresence() reused by ContinueAsScreen; treat KeyPermanentlyInvalidatedException as 'step-up key reset, use password'.
- push/PushTokenSyncer.kt + PantopusMessagingService.kt: include deviceId in registerPushToken and re-run /api/auth/devices/register when the FCM token rotates; on sign-out rely on the server deleting PushToken rows (no client delete needed) but reset PushTokenAckStore.
- AndroidManifest.xml + res/xml/backup_rules.xml + data_extraction_rules.xml: exclude sharedpref/device_identity.xml from backup/transfer (device id must not follow a backup); Phase 3 add <meta-data android:name="asset_statements"> pointing at https://pantopus.com/.well-known/assetlinks.json for Credential Manager; keep allowBackup=false and token exclusions.
- Phase 3 (Android attestation): data/auth/PlayIntegrityClient.kt — StandardIntegrityManager warm-up at app start, requestHash = sha256(challenge) token attached to login/resume device.attestation; server evaluates deviceIntegrity/appIntegrity into attestation_level and gates resume-grant issuance on MEETS_DEVICE_INTEGRITY.
- Tests: DPoPProofBuilderTest.kt, DeviceIdentityTest.kt, AuthRepositoryResumeTest.kt (Resumable state, resume success, grant invalid -> SignedOut with prefill, no screen lock -> login), extend TokenAuthenticatorTest.kt for error-code propagation and pre-flight refresh, AuthRepositoryTest.kt for logout network call + hint retention; instrumented DeviceKeyStoreTest.kt (key survives process restart, StrongBox fallback) and AccountHintStoreTest.kt behind a GMS-available guard.

## Threat model
- Refresh token exfiltrated (device backup, malware, MITM on cleartext dev traffic, log leak) and replayed elsewhere -> /refresh requires an ES256 DPoP proof from the registered Secure Enclave / Keystore key; wrong/no key => 401 DEVICE_MISMATCH/DPOP_REQUIRED, the just-minted session is revoked, device flagged, AuthSecurityEvent + email. Enforced only after AUTH_DEVICE_BINDING=required (Phase 3).
- Refresh-token replay race / cloned client -> Supabase rotation + 10 s reuse window (unchanged) plus our TOKEN_REUSE handler now revokes the device binding and auth.sessions row, records an event, and emails the user; clients show a security-specific message.
- Stolen unlocked device -> App Lock preference now lives in Keychain / survives reinstall (iOS); Tier-2 SensitiveScreenGuard on money surfaces; owner revokes the device from web or another phone (DELETE /api/auth/devices/:id or 'Sign out everywhere'); revocation is immediate because getUser fails with session_not_found once the auth.sessions row is deleted; PushToken rows deleted so no more pushes; socket kicked.
- Stolen locked device + reinstall -> Level 2 resume requires the device passcode/biometric (LAContext / BiometricPrompt DEVICE_CREDENTIAL); devices without an OS lock are excluded from Level 2 entirely; on Android the Block Store grant is E2EE and single-use; server-side the owner can revoke at any time.
- Attacker restores the victim's Google backup on another phone (Android) -> resume grants are not cloud-backed (setShouldBackupToCloud=false); redeem requires a hardware-backed key (software keys rejected), Play Integrity MEETS_DEVICE_INTEGRITY (Phase 3), triggers a 'new device' email, and is single-use so the legit device notices at next resume.
- iOS Keychain persistence changes in a future iOS or the user restores to a new iPhone -> ThisDeviceOnly items become unusable; app degrades to Level 3 (Password AutoFill / passkeys / native SIWA) with only the display hint; nothing breaks, no hard dependency on undocumented Keychain behaviour.
- Compromised app binary / emulator farm / repackaged client abusing /login or /resume -> Phase 3 App Attest (key re-attested after reinstall) and Play Integrity standard verdicts + Android key attestation (hardware chain to Google root, CRL check) recorded as attestation_level; policy gates resume-grant issuance and can gate login; rate limits on /resume (5/15 m/IP + per grant) and /challenge.
- Jailbroken / rooted device -> not fully preventable (App Attest and Play Integrity only signal); the DPoP key stays non-exportable inside SE/TEE so token theft still fails off-device; low integrity => no resume grants, shorter inactivity, extra notifications.
- Password change / password reset by the owner after compromise -> POST /password revokes all *other* sessions (admin.signOut others + revoke_user_sessions), reset revokes *all* and sets User.sessions_valid_after so even not-yet-expired access JWTs are rejected by verifyToken; devices and resume grants revoked.
- Account deletion leaving live sessions/push tokens -> DELETE /account requires X-Step-Up (fresh password or biometric device-key step-up) and revokes all sessions and push tokens before admin.deleteUser; AuthDevice/grants/events cascade with auth.users.
- CSRF/abuse of logout scopes from web -> scope 'local' stays unauthenticated (worst case: log yourself out, as today); 'others'/'global' and all /api/auth/* mutations require verifyToken (+CSRF for cookie transport) and step-up for revocations.
- DPoP proof replay / clock skew -> jti stored in AuthDpopJti (10 min TTL), iat window +/-300 s, htu/htm bound to our public base URL, proof is only accepted with a device row whose thumbprint matches; a captured proof without the refresh token is useless and vice versa.
- Revocation lag -> verifyToken performs getUser per request (immediate once auth.sessions row is gone) + sessions_valid_after watermark; optionalAuth keeps a 15 s cache (accepted for soft-auth reads); sockets get an explicit disconnect on revoke.
- Backend DB leak -> AuthResumeGrant stores only sha256(grant); AuthDevice stores public keys only; step-up tokens are HMAC with a separate STEP_UP_SECRET; Supabase refresh tokens remain in auth.refresh_tokens as today (out of our control).
- Legacy clients / adoption window -> while AUTH_DEVICE_BINDING=optional a refresh without DPoP is accepted and the first DPoP refresh 'adopts' the session onto that key; a stolen legacy token could be adopted by an attacker device during the window (status quo risk), which is why enforcement flips once >=95 % of active installs send DPoP and legacy sessions are force-refreshed by the inactivity rule.
- Device-key loss (SE blob undecodable, Keystore invalidated, biometric re-enrolment for the step-up key) -> DPoP key is not biometry-gated so re-enrolment cannot brick sessions; if the key is missing the client regenerates a key + deviceId and falls back to Level 3; step-up key invalidation just forces password step-up.
- Rate limiting on shared IPs (NAT, campus) -> keep per-IP limiters but add per-account/per-grant keys for /resume and /step-up; recommend rate-limit-redis when >1 instance (open question).

## Rollout
- Phase 0 — Prerequisites and hygiene (about 1 week, no schema change, all behind nothing): (a) regenerate AASA/assetlinks for the native identifiers (<TEAMID>.app.pantopus.ios with webcredentials; app.pantopus.android with handle_all_urls + get_login_creds and Play App Signing SHA-256s), add webcredentials + applinks pantopus.com to project.yml so make bootstrap stops reverting entitlements; (b) both clients call POST /api/users/logout on signOut and purge HTTP caches; (c) persist expiresAt on both platforms and add proactive refresh (<120 s) + socket auth-error -> refresh; (d) surface TOKEN_REUSE distinctly in UI; (e) /oauth/token validates the refresh token pairs with the access token; (f) update privacy inventory + labels for the upcoming device id. Testable: existing refresh/logout tests + new logout-network tests; QA verifies no 401 tax on cold start.
- Phase 1 — Device registry + DPoP-bound refresh in `optional` mode + iOS reinstall Continue-as (2-3 weeks): migration 160, dpop.js, authDeviceService/authSessionService, /login /oauth/* /refresh /logout hooks, /api/auth/devices/register + GET /devices (read-only list, no revoke UI yet), verifyToken req.session + sessions_valid_after; iOS DeviceKey/InstallMarker/ContinueAsView/.resumable, App Lock pref moved to Keychain; Android DeviceKeyStore/DeviceIdentity + DPoP on refresh (reinstall still full login). Ship server first (accepts both), then clients. Testable: backend binding matrix, iOS resume tests, dashboard % refreshes with DPoP; kill switch AUTH_DEVICE_BINDING=off.
- Phase 2 — Trusted-device management + Android resume grants + security notifications (2-3 weeks): DELETE /devices/:id, /sessions/revoke-others|revoke-all, /reauthenticate stepUpToken + stepUp middleware, password change/reset revocation, socket kick, AuthSecurityEvent + emails; iOS/Android DevicesView/DevicesScreen; web /app/settings/security page; Android AccountHintStore (Block Store) + /api/auth/resume + ContinueAsScreen; DELETE /account requires step-up. Testable: revoke-from-web kills phone within one request; Android delete+reinstall on a Backup-enabled device resumes behind BiometricPrompt; e2e email snapshots.
- Phase 3 — Enforcement, attestation, cryptographic step-up, native OS credentials (3-4 weeks, staged): flip AUTH_DEVICE_BINDING=required per platform once >=95 % of active installs send DPoP (legacy sessions age out via the 90-day inactivity rule); Android key-attestation verification + Play Integrity standard verdicts, iOS App Attest at login/resume (ramp gradually to avoid Apple rate limits), attestation_level gates resume grants; biometry-gated step-up keys on both platforms + POST /api/auth/step-up {device_key}; native Sign in with Apple (applesignin entitlement, getCredentialState at launch) and Android Credential Manager Sign in with Google -> POST /oauth/native; iCloud-synced display hint. Testable: attestation verifiers with recorded fixtures, enforcement canary by app version.
- Phase 4 — Passkeys and hardening (opportunistic): Supabase experimental passkeys (auth.experimental.passkey) proxied for Android via /auth/v1/passkeys/* until supabase-kt supports sign-in, iOS ASAuthorizationPlatformPublicKeyCredentialProvider with .conditional automatic upgrades; DPoP `ath`-bound proofs on high-value resource routes (payouts, transfer ownership); web pantopus_device cookie so browsers appear in the devices list; Redis-backed rate limits and jti cache; consider Supabase [auth.sessions] inactivity_timeout as defence in depth.

## Tradeoffs
- Reinstall = Level 2 (gesture required) rather than Level 1 (silent) even on iOS where tokens survive: slightly more friction than Instagram-on-iOS, but a reinstall is a plausible ownership/intent change and it lets us require the OS lock; superseding the RN-era wipe policy buys convenience without silent persistence.
- DPoP key is not biometry-gated so background refresh, push-triggered fetch and socket reconnect keep working; the biometric on Continue-as is therefore a client-enforced gate. Server-verifiable presence is provided by a separate step-up key only for sensitive actions (Phase 3).
- iOS depends on Keychain surviving uninstall, which Apple calls an implementation detail; we make it a graceful optimisation (install marker detects, Level 3 fallback) instead of a contract. Android depends on Block Store which only persists when the user has Backup services on; otherwise the reinstall path is Level 3 (Sign in with Google / passkey / password).
- Binding is enforced at our Express /refresh proxy, not inside GoTrue: an attacker who obtains the raw Supabase URL + anon key + a refresh token could still call /auth/v1/token directly. Mitigate by keeping the anon key server-side (mobile never talks to Supabase directly today) and, on Pro, restricting GoTrue token refresh via network rules; full closure would need GoTrue hooks or a fork, which we reject for a small team.
- Optional-mode adoption window means legacy refresh tokens can be adopted onto any key during Phase 1-2 (status quo risk); the alternative, forcing all users to re-login on the flip day, is worse for retention. Inactivity rule + version gating bound the window.
- Deleting auth.sessions rows via a SECURITY DEFINER function touches Supabase-internal tables (community-documented but not a public API); we isolate it in two small functions and keep admin.signOut scopes as the primary path so a GoTrue schema change only affects per-device revoke.
- Android resume grant is a second bearer secret (hashed, single-use, hardware-key-redeemable, 90 d) held by Google's Block Store; strictly weaker than 'nothing survives', strictly stronger than storing the refresh token itself; software-backed keys and non-Backup devices are excluded and cloud backup of the grant is off, at the cost of no cross-device restore.
- Immediate revocation relies on the existing per-request getUser network call (which we keep) instead of local JWT verification; cheaper latency-wise would be local HS256/JWKS verification + a revocation cache, but that reintroduces up-to-60 s lag; we accept the round trip already paid today.
- Native Sign in with Apple / Credential Manager Google add real client and Apple-Developer-portal work (Services ID audiences for signInWithIdToken) but are the only phishing-resistant, one-tap Level 3 paths that survive both reinstall and new devices; browser OAuth stays as fallback.
- Attestation (App Attest, Play Integrity, key attestation) is treated as a graded signal stored on the device row, not a hard gate for login, because it cannot detect compromised OSes definitively and Play Integrity is quota-limited (10k/day default) and unavailable on non-GMS builds.

## Open questions
- Confirm on the hosted project that auth.getUser(jwt) returns session_not_found once the auth.sessions row is deleted (documented error code; verify on the project's GoTrue version) — this is what makes per-device revocation immediate; if not, add a revoked-session cache to verifyToken.
- Which refresh-token algorithm version (v1 parent-token vs v2 counter) is enabled for the Supabase project, and does the response carry sb-auth-refresh-token-reuse headers we can log instead of regexing error text?
- Multi-account on one device: is UNIQUE(user_id, device_id) with one key per install enough, or do we need per-account keys/hints (Instagram-style account switcher)? Current design keeps one hint per device.
- Product decision: should Level 2 be offered on devices with no OS lock (we say no) and should 'Continue as X' after an explicit sign-out require the password (we say yes, hint is display-only)?
- Android Block Store cloud backup: keep setShouldBackupToCloud(false) (same-device + D2D only) or opt in so a new phone restored from Google backup can resume behind biometrics + attestation? Also confirm the exact minimum OS/GMS versions on our device fleet (doc is internally inconsistent about API 28/29).
- iOS: acceptable to store a synchronizable (iCloud Keychain) display-only account hint so a new iPhone pre-fills Continue-as, given the privacy inventory change-control rule?
- Apple developer portal work: obtain DEVELOPMENT_TEAM for the AASA appID, enable App Attest and Sign in with Apple capabilities for app.pantopus.ios, create the Services ID / audiences required by signInWithIdToken; Google: OAuth web client id for Credential Manager Sign in with Google and Play Integrity service account.
- Inactivity window: 90 days for mobile devices vs today's 7-day web refresh cookie — align web to a longer sliding window (and fix the Next middleware clearing cookies before refresh) or document the asymmetry?
- Rate limiting and jti replay cache are single-instance in-memory/Postgres today; when do we move express-rate-limit and AuthDpopJti to Redis (multi-instance deploy)?
- Email/push copy and legal review for security notifications (new device, device removed, signed out for security), plus App Store / Play data-safety label updates for Device ID and hardware key material.
- Do we require step-up for 'Sign out of all other devices' (we say yes, 5-min token) and should biometric device-key step-up be accepted for account deletion, or password only?
- Passkeys: wait for Supabase passkeys to leave experimental and for supabase-kt sign-in support, or proxy /auth/v1/passkeys/* from Express in Phase 4?
