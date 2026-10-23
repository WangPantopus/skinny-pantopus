# Persistent login — pinned wire contract (v1)

Binding for all implementers (backend, iOS, Android, web). If the design doc
(`persistent-login-design-2026-08-18.md`) and this file disagree, THIS FILE WINS.
Backward compatibility: every existing request/response field keeps its name and
meaning; everything below is additive. Old clients (no `device`, no `DPoP`) must
keep working while `AUTH_DEVICE_BINDING != required`.

## Headers
- `Authorization: Bearer <access>` (unchanged)
- `X-Client-Platform` (unchanged)
- `X-Device-Id: <deviceId uuid>` — sent by native clients on every request once a device identity exists.
- `DPoP: <jwt>` — ES256 `dpop+jwt`, embedded JWK (`{"kty":"EC","crv":"P-256","x","y"}` base64url, no padding).
  payload `{ jti: uuid, htm: "POST", htu: "<scheme>://<host>[:port]<path>" (no query), iat: unix seconds, rth?: base64url(sha256(refreshToken)) }`.
  `rth` REQUIRED on `/api/users/refresh` and `/api/users/logout` when a refreshToken is sent. Signature = raw r||s (64 bytes) base64url.
  Server compares `htu` against `PUBLIC_API_BASE_URL + path`; when `PUBLIC_API_BASE_URL` is unset it derives `<proto>://<host>` from the request (trust proxy already configured). Accept `iat` within ±300 s. `jti` single-use for 10 min.
- `X-Step-Up: <stepUpToken>` — opaque string from `/api/auth/step-up` or `/api/users/reauthenticate`.

Header names are case-insensitive on the wire; use exactly these spellings in code and docs.

## Device descriptor (`device` object)
```json
{ "deviceId": "uuidv4", "platform": "ios|android", "installId": "hex32",
  "name": "Ying's iPhone", "model": "iPhone16,2", "osVersion": "18.5", "appVersion": "1.4.0 (312)",
  "hasOsLock": true, "keyBacking": "secure_enclave|strongbox|tee|software",
  "attestation": null }
```
`attestation` is reserved (`{type, ...}`) — server stores it, `attestation_level` stays `none` in v1.

## Error envelope
`{ "error": "<human message>", "code": "<CODE>" }`.
401 codes: `TOKEN_REUSE`, `DEVICE_MISMATCH`, `DEVICE_REVOKED`, `SESSION_REVOKED`, `SESSION_EXPIRED_INACTIVE`, `DPOP_REQUIRED`, `DPOP_INVALID`, `DPOP_REPLAY`, `RESUME_GRANT_INVALID`, `UNAUTHORIZED` (generic).
403: `STEP_UP_REQUIRED` with `{ "purpose": "...", "methods": ["password","device_key"] }`.
Clients treat `TOKEN_REUSE|DEVICE_MISMATCH|DEVICE_REVOKED|SESSION_REVOKED|SESSION_EXPIRED_INACTIVE|DPOP_REQUIRED` as *security sign-out*: wipe tokens, keep display hint, show "You were signed out for security. Sign in again."

## Existing routes — additive changes
### `POST /api/users/login`, `/oauth/callback`, `/oauth/token`, `POST /api/users/oauth/native` (new)
Request adds optional `device` (+ `DPoP` header). `/oauth/native` body: `{ provider:"apple"|"google", idToken, nonce?, accessToken?, device? }`.
Response (bearer transport) adds: `"sessionId": "<uuid>", "session": { "id": "<uuid>", "context": "interactive" }, "device": { "id": "<uuid>", "deviceId": "<client uuid>", "isNew": true|false, "trustLevel": "trusted|unverified|suspect" } | null`.
Cookie transport (web): backend still inserts an `AuthSession` row (platform web, device null); response unchanged except `sessionId`.

### `POST /api/users/refresh`
Body: `{ refreshToken, deviceId?, sessionId? }` (+ `DPoP` with `rth`). Web: cookie as today.
Response: `{ ok:true, accessToken, refreshToken, expiresIn, expiresAt, sessionId, session:{ id, context } }`.
Server order: resolve session (hash → prev hash → sessionId) → revoked? → inactivity → if bound: verify DPoP against bound key (`rth` must match) → refreshSession → update hashes.
No row found (a pre-registry session, or a rotation whose hashes weren't saved): after refreshSession, the session named by the new pair gets the same checks, as if the token's hash had found it. A revoked or signed-out row is refused, a bound row needs a proof from its key (else `DEVICE_MISMATCH`, session revoked), and the rotation is recorded on that row. Only a session with no row gets a new legacy row. A refusal also signs the new pair out; a row that can't be read answers 503, and the client's retry with its own token gets GoTrue's current one.
Legacy (unbound) sessions: accepted while `AUTH_DEVICE_BINDING=optional`; a legacy session may be adopted onto the presenting key ONLY if `bound_at_issue=false AND issued_at < DPOP_CUTOVER` (env, ISO date). Default = far future, i.e. while unset EVERY unbound legacy session is adoptable (accepted status-quo risk of `optional` mode). Ops sets `DPOP_CUTOVER` to the date the DPoP-capable clients shipped; sessions issued after it are never adoptable and must re-login when the mode flips to `required`.

### `POST /api/users/logout`
Body: `{ scope: "local"|"others"|"global", deviceId?, refreshToken? }`. Optional Bearer, optional `DPoP`.
- `local`: cookie clearing + revoke presented access JWT (today) ALWAYS; row side effects (revoke that session row, clear device binding, delete PushToken rows for `deviceId`, revoke that device's resume grants) ONLY when proof present: valid Bearer whose session is bound to `deviceId`, OR `refreshToken` whose hash resolves to a session bound to a device whose key verifies the `DPoP` (with `rth`).
- `others` / `global`: require verifyToken (+CSRF on cookie transport) AND `X-Step-Up` (purpose `revoke_sessions`).
Response `{ success:true, revoked?: n }`.
Revocation writes must succeed before this response. A storage/provider outage returns
503 `AUTH_UNAVAILABLE`; local cookies are still cleared, but clients must not interpret
that response as confirmed server revocation. A signed access token can retry its own
registry cleanup even when the provider session has already been removed (auth-js
reports GoTrue's `session_not_found` as `AuthSessionMissingError`, status 400; it
counts as already signed out, like 401/403/404).
No client repeats a `local` logout (the apps wipe their tokens and the web clears its
cookies first), so the API process that answered 503 repeats it: verify the token, revoke
the registry session, end the GoTrue session, each step until it succeeds once, with
backoff for about five minutes. Meanwhile that process refuses the verified session's
access token, sockets and refresh; other processes refuse it once the row is saved, and a
restart forgets the retries. A refresh that rotates a token the registry never saw (a
rotation that couldn't be saved) is refused when the session it names was signed out.

### `POST /api/users/reauthenticate`
Response adds `{ stepUpToken, expiresAt, purpose:"generic" }` — token is valid for any purpose EXCEPT it is still refused for `restored` sessions on `delete_account`/`revoke_*` (they must present password — which reauthenticate does, so this is fine) — i.e. reauthenticate == step-up method `password`, purpose wildcard.

### `POST /api/users/password`, `POST /api/users/reset-password`, `DELETE /api/users/account`
As design §6.3. `DELETE /account` requires `X-Step-Up` (purpose `delete_account` or wildcard from reauthenticate). If the user has no password (OAuth-only), `device_key` step-up from an interactive session is accepted.
The backend forwards the verified `currentPassword` as GoTrue's `current_password`.
The hosted Email provider must also enable **Require current password when changing
password**, so direct provider requests enforce the same requirement. This is separate
from the recent-login/nonce setting; see [Supabase password security](https://supabase.com/docs/guides/auth/password-security#require-current-password-when-changing-password).
When the new password is saved but signing out the other sessions fails, `/password` and
`/reset-password` answer 503 `SIGN_OUT_INCOMPLETE` and say the password changed. A
registry outage before anything changes still answers 503 `AUTH_BUSY` (the reset link
keeps working). A failed sign-out hook never stops `DELETE /account`: the auth user is
still deleted, and the missing `User` row already refuses the old sessions.

### Live connections
Sockets close at access-token expiry, checked before every event. The session row and
account watermark are read on connect, when an AuthSession or `sessions_valid_after`
change is signalled for the user (database notifications reach every API process), and
before an event or on a 5-second tick once the last read is older than about 30 s (5 s
while the notification listener is down or for a session without a registry row). The same signal drops other
processes' cached session state and watermark for REST. Unreadable policy closes the
transport so the client can retry. Existing `auth:session_revoked` listeners confirm the
signal with refresh before signing out.

## New router `/api/auth` (backend/routes/authDevices.js)
| Method/path | Auth | Body → Response |
|---|---|---|
| `POST /api/auth/challenge` | none (30/15m/IP) | `{ purpose:"step_up"|"resume"|"attestation" }` → `{ challengeId, challenge (b64url 32 B), expiresAt }` |
| `POST /api/auth/devices/register` | Bearer + DPoP (thumbprint == session's bound key; unbound sessions: 409 `DEVICE_NOT_BOUND`) | `{ device, pushToken?, pushProvider?:"fcm"|"apns" }` → `{ device:{id,deviceId,trustLevel,trustedAt}, resumeGrant?: "<b64url>" (android only, when allowRestoreGrants) }`. Never creates a binding. Idempotent. |
| `GET /api/auth/devices` | Bearer | → `{ devices:[{ id, deviceId, platform, name, model, osVersion, appVersion, isCurrent, trustLevel, trustedAt, lastSeenAt, lastIp?, createdAt }], sessions:[{ id, platform:"web"|…, userAgent, isCurrent, lastSeenAt, issuedAt }], events:[{ id, type, createdAt, deviceId?, meta }] }` |
| `DELETE /api/auth/devices/:id` | Bearer + `X-Step-Up` (`revoke_device`) | → `{ ok:true }` |
| `POST /api/auth/sessions/revoke-others` | Bearer + `X-Step-Up` (`revoke_sessions`) | → `{ revoked:n }` |
| `POST /api/auth/sessions/revoke-all` | Bearer + `X-Step-Up` (`revoke_sessions`) | → `{ ok:true }` (client signs itself out) |
| `POST /api/auth/resume` | none (5/15m/IP + per grant) + DPoP required | `{ grant, device }` → login-shaped `{ accessToken, refreshToken, expiresIn, expiresAt, user, sessionId, session:{id,context:"restored"}, device, resumeGrant:"<new>" }` |
| `POST /api/auth/step-up` | Bearer (10/15m/user) | `{ purpose, method:"password", password }` or `{ purpose, method:"device_key", challengeId, signature }` → `{ stepUpToken, expiresAt, purpose }`; 403 `STEP_UP_REQUIRED`-style `{ methods }` on failure of method availability |
| `POST /api/auth/step-up-key` | Bearer + DPoP (bound key) ; session must be `interactive` | `{ publicKeyJwk, keyBacking }` → `{ ok:true }` (stores `step_key_jwk`, `step_key_enrolled_via:'interactive'`) |
| `GET /api/auth/security-prefs` / `PATCH …` | Bearer (PATCH + `X-Step-Up` `change_security_prefs`) | `{ allowRestoreGrants:bool, newDeviceEmail:bool }` |
| `GET /api/auth/security-events` | Bearer | `?limit=50` → `{ events }` — NOTE: `event.deviceId` is the **AuthDevice row id**, i.e. it joins `devices[].id`, NOT `devices[].deviceId` (the client-generated UUID). |

Step-up purposes: `delete_account`, `revoke_device`, `revoke_sessions`, `change_security_prefs`, `generic` (wildcard, from reauthenticate). Token: `base64url(payloadJson) + "." + base64url(HMAC-SHA256(STEP_UP_SECRET, payloadJson))`, payload `{ uid, sid, purpose, method, jti, exp }`, 5 min, one-shot for `delete_account|revoke_device|revoke_sessions` (jti consumed in `AuthChallenge` table with purpose `stepup_used`).
`device_key` step-up: server verifies ES256 signature over the raw challenge bytes with `AuthDevice.step_key_jwk`; requires `step_key_enrolled_via='interactive'` and current session `context='interactive'`.

## Feature flags / env (backend)
`AUTH_DEVICE_BINDING=off|optional|required` (default `optional`), `AUTH_RESUME_GRANTS=on|off` (default `on`), `DPOP_CUTOVER` (ISO; default `9999-01-01`), `PUBLIC_API_BASE_URL` (optional), `STEP_UP_SECRET` (required in production, else falls back to `CSRF_SECRET` with a warning), `AUTH_INACTIVITY_DAYS_TRUSTED=90`, `AUTH_INACTIVITY_DAYS_UNVERIFIED=30`, `AUTH_RESUME_GRANT_DAYS=90`.

## Client storage keys
iOS Keychain (`KeychainStore`, same service): `deviceId`, `deviceKey` (SE dataRepresentation, Data), `stepUpKey`, `installId`, `expiresAt`, `sessionId`, `sessionContext`, `accountHints` (JSON array, most-recent-first, max 3: `{userId, displayName, avatarUrl, maskedEmail, email?, lastMethod, lastSeenAt}`; cards show `maskedEmail`, `email` only fills in the login form — added 2026-10-08, older hints lack it), `appLockEnabled.<uid>`.
iOS install marker file: `Library/Application Support/.pantopus-install` (contains installId; excluded from backup).
Android: `TokenStorage` adds `expires_at`, `session_id`, `session_context`; `device_identity` prefs (`device_id`, `install_id`) excluded from backup; Block Store entry key `pantopus.account_hint` JSON `{ v:1, accounts:[…max 3…], resumeGrant?, grantUserId?, issuedAt }`, `setShouldBackupToCloud(false)`.

## Client behaviour (both platforms)
- Proactive refresh when `expiresAt - now < 120 s` (never on the refresh endpoint itself); single-flight preserved.
- Cold start: L1 → L2 → L3 per design §3; reinstall ALWAYS L2 (gesture) — never silent, never wipe.
- L2 gate: iOS `LAContext.evaluatePolicy(.deviceOwnerAuthentication)`; Android `BiometricPrompt(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)`. No OS lock ⇒ L3.
- Explicit sign-out (local): call `/logout` with proof, wipe tokens/expiresAt/sessionId, keep hints; "Not you? Remove" wipes hints (+ Block Store deleteBytes on Android).
- Security-code sign-out shows the security message, keeps hints.
- After login/resume/app-update/push-token change: `POST /api/auth/devices/register`.
- 403 `STEP_UP_REQUIRED` interceptor: run step-up UI (device_key if enrolled & interactive, else password), retry once with `X-Step-Up`.
