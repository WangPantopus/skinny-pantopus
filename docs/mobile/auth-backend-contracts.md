# Auth Backend Contracts (T6.1a)

Reference for the seven auth endpoints the mobile clients consume. Every
request body, response shape, and error code below was verified against
`backend/routes/users.js` at the cited line. P4 (Forgot / Reset / Error)
and P5 (Verify email) read this doc as the source of truth for client →
backend wire shapes.

All endpoints expect / return `application/json`. Tokens are returned in
the response body on mobile (bearer transport); the cookie transport
codepath at `applyAuthTransport` only kicks in for `x-token-transport:
cookie` clients (web). All endpoints are unauthenticated (no `Bearer`
header), with the exception of `/refresh` which can read the
`pantopus_refresh` cookie if no body is supplied.

> **2026-08 — persistent login & trusted devices.** §1 (`/login`) and §7
> (`/refresh`) gained *additive* fields (`device`, `DPoP`, `sessionId`,
> `session`), and a new router `/api/auth/*` (devices, sessions, step-up,
> resume, security prefs/events) is documented in **§8** below. The pinned
> wire contract lives in `docs/persistent-login/CONTRACT.md` and **wins over
> this file** if they ever disagree; the rationale is in
> `docs/persistent-login/persistent-login-design-2026-08-18.md`. Every
> pre-existing field keeps its name and meaning; old clients (no `device`,
> no `DPoP`) keep working while the backend runs `AUTH_DEVICE_BINDING=optional`.

---

## 1. `POST /api/users/login`

Route: `backend/routes/users.js:1492`. Validation: `loginSchema`
(`backend/routes/users.js:727`).

### Request

```json
{ "email": "alice@example.com", "password": "hunter22" }
```

| Field | Joi rule | Notes |
|---|---|---|
| `email` | required, valid email | |
| `password` | required, string | No length check here; register enforces `PASSWORD_MIN_LENGTH`. |

### Response — 200

```json
{
  "message": "Login successful",
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "expiresIn": 3600,
  "expiresAt": 1800000000,
  "user": {
    "id": "u_…", "email": "alice@example.com",
    "username": "alice", "name": "Alice Doe",
    "firstName": "Alice", "middleName": null, "lastName": "Doe",
    "phoneNumber": null, "address": null, "city": null,
    "state": null, "zipcode": null,
    "accountType": "individual", "role": "user",
    "verified": true,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

Token fields are absent in cookie-transport mode. The `user` envelope is
the same shape returned by `/register` (see §2).

**Additive since 2026-08 (persistent login).** Native clients MAY add a
`device` descriptor to the request body and a `DPoP` header (see §8.1);
the response then also carries the server-side session and device
registry echo. Web (cookie transport) gets only `sessionId`.

```json
// request (native, optional extras)
{ "email": "…", "password": "…",
  "device": { "deviceId": "uuidv4", "platform": "ios", "installId": "hex32",
              "name": "Ying's iPhone", "model": "iPhone16,2", "osVersion": "18.5",
              "appVersion": "1.4.0 (312)", "hasOsLock": true,
              "keyBacking": "secure_enclave", "attestation": null } }
// response extras (all existing fields unchanged)
{ "sessionId": "<uuid>",
  "session": { "id": "<uuid>", "context": "interactive" },
  "device": { "id": "<uuid>", "deviceId": "<client uuid>", "isNew": true, "trustLevel": "unverified" } }
```

`device` is `null` in the response when the client sent no descriptor.
The same additions apply to `POST /oauth/callback`, `POST /oauth/token`
and the new `POST /api/users/oauth/native`
(`{ provider:"apple"|"google", idToken, nonce?, accessToken?, device? }`).
Binding of the device key to the session happens **only** in these
credential-issuing routes (and `/api/auth/resume`) — never on a
bearer-only endpoint.

### Errors

| Status | Body | Mobile mapping |
|---|---|---|
| 401 | `{ "error": "Invalid email or password" }` | `AuthError.invalidCredentials` |
| 403 | `{ "error": "Please verify your email before signing in.", "needsVerification": true }` | Currently `.serverError(msg)`; P4 may add a dedicated case driven off `needsVerification` |
| 404 | `{ "error": "User profile not found", "code": "PROFILE_NOT_FOUND" }` | `.serverError(msg)` |
| 429 | rate-limited | `.rateLimited` |
| 5xx | server error | `.serverError(msg)` |

---

## 2. `POST /api/users/register`

Route: `backend/routes/users.js:1177`. Validation: `registerSchema`
(`backend/routes/users.js:710`).

### Request

```json
{
  "email": "new@example.com",
  "password": "strongpass123",
  "phoneNumber": "+15551234567",
  "username": "newuser",
  "firstName": "New",
  "middleName": null,
  "lastName": "User",
  "dateOfBirth": "1990-01-15",
  "address": "123 Main St",
  "city": "Cambridge",
  "state": "MA",
  "zipcode": "02139",
  "accountType": "individual",
  "invite_code": "abc123"
}
```

| Field | Joi rule | Notes |
|---|---|---|
| `email` | required, valid email | |
| `password` | required, `PASSWORD_MIN_LENGTH` ≤ len ≤ `PASSWORD_MAX_LENGTH` | Backend defines `PASSWORD_MIN_LENGTH = 8` (verify in `config`). Mobile clients should enforce min 10 per the design's strength meter. |
| `phoneNumber` | E.164: `^\+[1-9]\d{1,14}$` | Optional but if present must be E.164. |
| `username` | required, alphanumeric + `_`, len 3–30 | |
| `firstName` / `lastName` | required, len 1–255 | |
| `middleName` | optional, len 1–255, empty string and null allowed | |
| `dateOfBirth` | ISO date, ≤ now, enforces 18+ if present | Mobile sends `"YYYY-MM-DD"`. |
| `address` | len 5–255 | |
| `city` | len 2–100 | |
| `state` | len 2–50 | |
| `zipcode` | len 3–20 | |
| `accountType` | `"individual"` \| `"business"`, default `"individual"` | iOS / Android `AccountType` enum: `.personal` → `"individual"`, `.business` → `"business"`. |
| `invite_code` | alphanumeric, len 6–12 | Snake-case key. Mobile DTO uses `inviteCode` and maps via `CodingKeys` / `@Json(name = "invite_code")`. |

### Response — 201

```json
{
  "message": "Registration successful. Please verify your email before signing in.",
  "requiresEmailVerification": true,
  "user": { /* same shape as login's user */ }
}
```

`user.verified` is always `false` on a fresh register. The verification
email is sent server-side via the app's SMTP transport using
`admin.generateLink`.

### Errors

| Status | Body | Mobile mapping |
|---|---|---|
| 400 | `{ "error": "Email already registered" }` | `.emailAlreadyExists` |
| 400 | `{ "error": "Username already taken" }` | `.serverError(msg)` |
| 400 | `{ "error": "Phone number already in use" }` | `.serverError(msg)` |
| 400 | `{ "error": "You must be at least 18 years old to register" }` | `.serverError(msg)` |
| 400 | `{ "error": "Invalid date of birth" }` | `.serverError(msg)` |
| 400 | Joi validation error (e.g. password length) | message contains "password" → `.weakPassword` |
| 429 | rate-limited (`registerLimiter`) | `.rateLimited` |
| 503 | `{ "error": "Authentication service temporarily unavailable. Please try again." }` | `.serverError(msg)` |
| 500 | `{ "error": "Failed to create user profile…" }` | `.serverError(msg)` |

Backend rolls back the auth-user insert on DB failure (`supabaseAdmin.auth.admin.deleteUser`).

---

## 3. `POST /api/users/forgot-password`

Route: `backend/routes/users.js:3197`. Validation: `forgotPasswordSchema`
(`backend/routes/users.js:741`).

### Request

```json
{ "email": "alice@example.com" }
```

### Response — 200 (always)

```json
{ "message": "If that email exists, a password reset link has been sent." }
```

The backend **never** discloses whether the account exists. Treat 200
as "queued if applicable".

### Errors

| Status | Body | Mobile mapping |
|---|---|---|
| 429 | rate-limited (`forgotPasswordLimiter`) | `.rateLimited` |
| 5xx | even on internal failure backend returns the generic 200 message; only transport / 5xx escapes | `.serverError(msg)` / `.networkError` |

---

## 4. `POST /api/users/reset-password`

Route: `backend/routes/users.js:3247`. Validation: `resetPasswordSchema`
(`backend/routes/users.js:745`).

### Request

```json
{ "token": "<hashed_token_or_jwt>", "newPassword": "newstrong123" }
```

| Field | Joi rule | Notes |
|---|---|---|
| `token` | required, string | Backend auto-detects: 3-dot string ⇒ JWT access token (mid-session reset); otherwise treated as a Supabase recovery `token_hash`. |
| `newPassword` | required, `PASSWORD_MIN_LENGTH` ≤ len ≤ `PASSWORD_MAX_LENGTH` | |
| `email` | optional | Accepted but unused in the hashed-token codepath. |

### Response — 200

```json
{ "message": "Password reset successful. You can now sign in." }
```

### Errors

| Status | Body | Mobile mapping |
|---|---|---|
| 400 | `{ "error": "Invalid or expired reset token" }` | `.serverError(msg)` (P4 may add a dedicated case) |
| 400 | `{ "error": "Unable to reset password" }` | `.serverError(msg)` |
| 400 | `{ "error": "Invalid reset session" }` | `.serverError(msg)` |
| 400 | Joi validation error (password length) | `.weakPassword` (mobile mapping on message match) |
| 500 | `{ "error": "Failed to reset password" }` | `.serverError(msg)` |

---

## 5. `POST /api/users/verify-email`

Route: `backend/routes/users.js:3115`. Validation: `verifyEmailSchema`
(`backend/routes/users.js:755`).

### Request

The schema accepts either path:

```json
{ "tokenHash": "<hashed_supabase_otp>", "type": "signup" }
```

or

```json
{ "token": "<otp_code>", "email": "alice@example.com", "type": "signup" }
```

| Field | Joi rule | Notes |
|---|---|---|
| `tokenHash` | optional | The email-link variant. Required if `token` is absent (`.or('tokenHash', 'token')`). |
| `token` | optional | The OTP-code variant. If supplied, `email` is required. |
| `email` | required when `token` is set | |
| `type` | `'signup'` \| `'email'` \| `'magiclink'`, default `'signup'` | `'signup'` for new registrations; `'magiclink'` for resend-verification flows; `'email'` for email-change. |

Mobile clients only ship `tokenHash` (link-based). The deep-link
verification surface receives the hashed OTP from `/verify-email?token=…`
and POSTs it as `tokenHash`.

### Response — 200

```json
{ "message": "Email verified successfully. You can now sign in.", "verified": true }
```

Backend revokes the just-issued session via `revokeSessionByAccessToken`,
so verifying does **not** sign the user in. Caller routes to login.

### Errors

| Status | Body | Mobile mapping |
|---|---|---|
| 400 | `{ "error": "Email and code are required when tokenHash is not provided" }` | `.serverError(msg)` |
| 400 | `{ "error": "Invalid or expired verification link/code" }` | `.serverError(msg)` |
| 500 | `{ "error": "Failed to verify email" }` | `.serverError(msg)` |

---

## 6. `POST /api/users/resend-verification`

Route: `backend/routes/users.js:3049`. Validation: `resendVerificationSchema`
(`backend/routes/users.js:751`).

### Request

```json
{ "email": "alice@example.com" }
```

### Response — 200 (always)

```json
{ "message": "If that email exists, a verification email has been sent." }
```

Like forgot-password, the backend silently no-ops if the account is
missing or already verified, to prevent enumeration.

### Errors

| Status | Body | Mobile mapping |
|---|---|---|
| 429 | rate-limited (`resendVerificationLimiter`) | `.rateLimited` |
| 5xx | exceptional only — backend tries hard to return 200 | `.serverError(msg)` |

---

## 7. `POST /api/users/refresh`

Route: `backend/routes/users.js` (`router.post('/refresh', …)`). Rate-limited via `refreshLimiter`.

### Request

```json
{ "refreshToken": "<jwt>", "deviceId": "<uuid, optional>", "sessionId": "<uuid, optional>" }
```

Mobile clients send the stored refresh token in the body. Web clients
can omit the body and the backend reads `pantopus_refresh` from cookies.

**Additive since 2026-08:** native clients that hold a device key also send
`deviceId` + `sessionId` and a `DPoP` header whose payload carries
`rth = base64url(sha256(refreshToken))` (§8.1). Native clients refresh
**proactively** when `expiresAt − now < 120 s` (never on the refresh
endpoint itself) and keep the existing single-flight mutex — Supabase
treats a parallel replay as reuse.

Server order (design §6.3, contract): **(1) resolve the session** by
`sha256(refreshToken)` → `AuthSession.refresh_token_hash`, else the
previous hash, else `sessionId`; refuse if revoked; enforce the inactivity
ceiling (90 d `trusted` / 30 d `unverified`); **(2) if the session is
bound to a device key**, verify the DPoP proof against *that* key (`rth`
must match); **(3)** `refreshSession` (GoTrue rotates); **(4)** persist
the new hashes / `last_refresh_at` / `last_seen_at` / IP. Unbound legacy
sessions are accepted while `AUTH_DEVICE_BINDING=optional`; a legacy
session is adopted onto the presenting key only if `bound_at_issue=false`
and it was issued before `DPOP_CUTOVER`.

### Response — 200

```json
{
  "ok": true,
  "accessToken": "<new_jwt>",
  "refreshToken": "<rotated_jwt>",
  "expiresIn": 3600,
  "expiresAt": 1800000000,
  "sessionId": "<uuid>",
  "session": { "id": "<uuid>", "context": "interactive" }
}
```

Token fields are absent in cookie-transport mode (server sets fresh
cookies and returns `{ ok: true, sessionId }`). Mobile clients should detect
absence and re-prompt. Persist `expiresAt`, `sessionId` and
`session.context` next to the tokens.

### Errors

| Status | Body | Mobile mapping |
|---|---|---|
| 400 | `{ "error": "refreshToken is required" }` | `.serverError(msg)` |
| 401 | `{ "error": "Session expired. Please sign in again." }` (no `code`, or `code: "UNAUTHORIZED"`) | plain expiry: wipe tokens, keep the display hint, login prefilled |
| 401 | `{ "error": "Session invalidated. Please sign in again.", "code": "TOKEN_REUSE" }` | **security sign-out** ¹ — refresh-token reuse detected; *that* session is revoked, the bound device gets `require_step_up=true`, a security event + email/push go out. (Earlier text said "all sessions terminated" — that was Supabase's token-family revocation, not a Pantopus-wide revoke.) |
| 401 | `code: "DEVICE_MISMATCH"` | security sign-out ¹ — proof did not match the key bound to that session; session revoked |
| 401 | `code: "DEVICE_REVOKED"` / `"SESSION_REVOKED"` | security sign-out ¹ — removed from another device / Lockdown / password reset watermark |
| 401 | `code: "SESSION_EXPIRED_INACTIVE"` | security sign-out ¹ — idle > 90 d (trusted) / 30 d (unverified) |
| 401 | `code: "DPOP_REQUIRED"` | security sign-out ¹ — binding enforced and no proof (`AUTH_DEVICE_BINDING=required`) |
| 401 | `code: "DPOP_INVALID"` / `"DPOP_REPLAY"` | rebuild the proof once (fresh `jti`/`iat`), then treat as invalid |
| 5xx | `{ "error": "Failed to refresh session" }` | `.serverError(msg)` — **transient**: keep tokens, stay on the cached identity (offline-first) |

¹ *Security sign-out* (contract): wipe tokens / `expiresAt` / `sessionId`,
**keep** the non-secret account hint, show *"You were signed out for
security. Sign in again."* — never a generic "session expired".

Mobile `AuthRepository.refreshTokens()` / `AuthManager.performRefresh()`
map `code` → `SessionEndReason`; only definitive 401s sign the user out,
transient failures keep the cached session (see design §7.2).

---

## 8. Persistent login — `/api/auth/*` and additive contracts (2026-08)

Source of truth: `docs/persistent-login/CONTRACT.md` (this section
mirrors it; if they disagree the contract file wins). Backend:
`backend/routes/authDevices.js` (mounted at `/api/auth`),
`backend/middleware/dpop.js`, `backend/middleware/stepUp.js`,
`backend/services/authDeviceService.js`, `authSessionService.js`.

### 8.1 Headers

| Header | Who sends it | Meaning |
|---|---|---|
| `Authorization: Bearer <access>` | native (unchanged) | access JWT |
| `X-Client-Platform` | unchanged | |
| `X-Device-Id: <deviceId uuid>` | native, every request once a device identity exists | correlates requests with the `AuthDevice` row |
| `DPoP: <jwt>` | native, on `/login`, `/oauth/*`, `/refresh`, `/logout`, `/api/auth/resume`, `/devices/register`, `/step-up-key` | ES256 `dpop+jwt`, embedded JWK `{kty:"EC",crv:"P-256",x,y}` (base64url, no padding); payload `{ jti: uuid, htm: "POST", htu: "<scheme>://<host>[:port]<path>" (no query), iat: unix s, rth?: b64url(sha256(refreshToken)) }`; signature raw `r‖s` (64 B) base64url. `rth` REQUIRED on `/refresh` and `/logout` when a `refreshToken` is sent. Server compares `htu` with `PUBLIC_API_BASE_URL + path` (or `<proto>://<host>` from the request), accepts `iat` within ±300 s, `jti` single-use for 10 min. |
| `X-Step-Up: <stepUpToken>` | any client | opaque token from `POST /api/auth/step-up` or `POST /api/users/reauthenticate` |

### 8.2 Error envelope and codes

`{ "error": "<human message>", "code": "<CODE>" }`.

401: `TOKEN_REUSE`, `DEVICE_MISMATCH`, `DEVICE_REVOKED`, `SESSION_REVOKED`,
`SESSION_EXPIRED_INACTIVE`, `DPOP_REQUIRED`, `DPOP_INVALID`, `DPOP_REPLAY`,
`RESUME_GRANT_INVALID`, `UNAUTHORIZED` (generic).
403: `STEP_UP_REQUIRED` with `{ "purpose": "…", "methods": ["password","device_key"] }`.
409: `DEVICE_NOT_BOUND` (from `/devices/register` on an unbound session).

Clients treat `TOKEN_REUSE | DEVICE_MISMATCH | DEVICE_REVOKED |
SESSION_REVOKED | SESSION_EXPIRED_INACTIVE | DPOP_REQUIRED` as *security
sign-out* (see §7 footnote). On 403 `STEP_UP_REQUIRED` the client runs the
step-up UI (`device_key` if a step-up key is enrolled and the session is
`interactive`, else password), then retries **once** with `X-Step-Up`.

### 8.3 Existing routes — additive changes

| Route | Change |
|---|---|
| `POST /api/users/login`, `/oauth/callback`, `/oauth/token`, `POST /api/users/oauth/native` (new) | optional `device` + `DPoP`; response adds `sessionId`, `session:{id,context}`, `device` (§1). Web (cookie transport): backend still inserts an `AuthSession` row (platform `web`); response adds `sessionId` only. |
| `POST /api/users/refresh` | §7 above. |
| `POST /api/users/logout` | body `{ scope: "local"\|"others"\|"global", deviceId?, refreshToken? }`, optional Bearer, optional `DPoP`. `local` (default; unauthenticated allowed): cookie clearing + revoke the presented access JWT **always**; row side effects (revoke that `AuthSession`, clear the binding, delete `PushToken` rows for `deviceId`, revoke that device's resume grants) **only with proof** — a valid Bearer whose session is bound to `deviceId`, OR `refreshToken` whose hash resolves to a session bound to a device whose key verifies the `DPoP` (with `rth`). `others` / `global`: require verifyToken (+CSRF on cookies) AND `X-Step-Up` (purpose `revoke_sessions`). Response `{ success:true, revoked?: n }`. Both native apps now call this on sign-out (they used to be local-only). |
| `POST /api/users/reauthenticate` | response adds `{ stepUpToken, expiresAt, purpose:"generic" }` — i.e. reauthenticate == step-up method `password` with wildcard purpose. |
| `POST /api/users/password` | after the update, all *other* sessions/devices/grants are revoked and an email is sent. |
| `POST /api/users/reset-password` | after the update, *all* sessions revoked + `sessions_valid_after` watermark + all devices/grants revoked, then the recovery session is revoked as before. |
| `DELETE /api/users/account` | requires `X-Step-Up` (purpose `delete_account`, or wildcard from reauthenticate). OAuth-only accounts (no password) may use `device_key` step-up from an *interactive* session. |

### 8.4 New router `/api/auth`

| Method / path | Auth | Body → Response |
|---|---|---|
| `POST /api/auth/challenge` | none (30 / 15 min / IP) | `{ purpose:"step_up"\|"resume"\|"attestation" }` → `{ challengeId, challenge (b64url 32 B), expiresAt }` |
| `POST /api/auth/devices/register` | Bearer + DPoP (thumbprint == the session's bound key; unbound sessions → 409 `DEVICE_NOT_BOUND`) | `{ device, pushToken?, pushProvider?:"fcm"\|"apns" }` → `{ device:{ id, deviceId, trustLevel, trustedAt }, resumeGrant?: "<b64url>" (Android only, when `allowRestoreGrants`) }`. Metadata + push-token linkage only — **never creates or rotates a binding**. Idempotent; call after login / resume / app update / push-token change. |
| `GET /api/auth/devices` | Bearer | → `{ devices:[{ id, deviceId, platform, name, model, osVersion, appVersion, isCurrent, trustLevel, trustedAt, lastSeenAt, lastIp?, createdAt }], sessions:[{ id, platform:"web"\|…, userAgent, isCurrent, lastSeenAt, issuedAt }], events:[{ id, type, createdAt, deviceId?, meta }] }` |
| `DELETE /api/auth/devices/:id` | Bearer + `X-Step-Up` (`revoke_device`) | → `{ ok:true }` — device + its sessions revoked, push tokens deleted, grants revoked, sockets kicked, "device removed" email |
| `POST /api/auth/sessions/revoke-others` | Bearer + `X-Step-Up` (`revoke_sessions`) | → `{ revoked:n }` |
| `POST /api/auth/sessions/revoke-all` ("Lockdown") | Bearer + `X-Step-Up` (`revoke_sessions`) | → `{ ok:true }`; global sign-out + `sessions_valid_after=now()` + all grants revoked — the caller signs itself out afterwards |
| `POST /api/auth/resume` | none (5 / 15 min / IP + per grant) + DPoP required | `{ grant, device }` → login-shaped `{ accessToken, refreshToken, expiresIn, expiresAt, user, sessionId, session:{ id, context:"restored" }, device, resumeGrant:"<new>" }`; 401 `RESUME_GRANT_INVALID` when used / expired / revoked / `allowRestoreGrants=false` |
| `POST /api/auth/step-up` | Bearer (10 / 15 min / user) | `{ purpose, method:"password", password }` or `{ purpose, method:"device_key", challengeId, signature }` → `{ stepUpToken, expiresAt, purpose }`; 403 `STEP_UP_REQUIRED`-style `{ methods }` when the method is not available for this account/session |
| `POST /api/auth/step-up-key` | Bearer + DPoP (bound key); session must be `interactive` | `{ publicKeyJwk, keyBacking }` → `{ ok:true }` (stores `step_key_jwk`, `step_key_enrolled_via:'interactive'`) |
| `GET /api/auth/security-prefs` / `PATCH …` | Bearer (PATCH + `X-Step-Up` `change_security_prefs`) | `{ allowRestoreGrants:bool, newDeviceEmail:bool }` (defaults `true`/`true`) |
| `GET /api/auth/security-events` | Bearer | `?limit=50` → `{ events }` |

**Step-up tokens.** Purposes: `delete_account`, `revoke_device`,
`revoke_sessions`, `change_security_prefs`, `generic` (wildcard, from
reauthenticate). Token = `base64url(payloadJson) + "." +
base64url(HMAC-SHA256(STEP_UP_SECRET, payloadJson))`, payload
`{ uid, sid, purpose, method, jti, exp }`, 5 min, one-shot for
`delete_account | revoke_device | revoke_sessions`. `device_key` step-up:
the server verifies an ES256 signature over the raw challenge bytes with
`AuthDevice.step_key_jwk`; requires `step_key_enrolled_via='interactive'`
**and** current session `context='interactive'` (a `restored` session must
present a password). The DPoP device key is never biometry-gated; the
step-up key IS biometry-gated.

**Session context.** `interactive` = a real credential was shown
(password / OAuth / native IdP); `restored` = minted from an Android resume
grant. Restored sessions can browse and chat but cannot delete the
account, revoke devices/sessions or change security prefs until a password
is presented once (which flips the session to `interactive`).

### 8.5 Client storage keys (for the parity checklist)

- iOS Keychain (`KeychainStore`, same service): `deviceId`, `deviceKey`
  (Secure Enclave `dataRepresentation`), `stepUpKey`, `installId`,
  `expiresAt`, `sessionId`, `sessionContext`, `accountHints` (JSON array,
  most-recent-first, max 3: `{userId, displayName, avatarUrl, maskedEmail,
  lastMethod, lastSeenAt}`), `appLockEnabled.<uid>`. Install marker file
  `Library/Application Support/.pantopus-install` (contains `installId`,
  excluded from backup).
- Android: `TokenStorage` adds `expires_at`, `session_id`,
  `session_context`; `device_identity` prefs (`device_id`, `install_id`)
  excluded from backup; Block Store entry `pantopus.account_hint` JSON
  `{ v:1, accounts:[…max 3…], resumeGrant?, grantUserId?, issuedAt }` with
  `setShouldBackupToCloud(false)`.

### 8.6 Client behaviour (both platforms)

- Proactive refresh when `expiresAt − now < 120 s`; single-flight preserved.
- Cold start: L1 (still logged in) → L2 ("Continue as X" + OS biometric /
  passcode) → L3 (OS remembers the account: AutoFill / passkey / SIWA /
  Credential Manager) — design §3. Reinstall is ALWAYS L2 (one gesture) —
  never silent, never a wipe. No OS lock ⇒ L3.
- Explicit local sign-out calls `/logout` with proof, wipes tokens /
  `expiresAt` / `sessionId`, keeps the account hint; "Not you? Remove"
  wipes hints (+ Block Store `deleteBytes` on Android).
- After login / resume / app update / push-token change:
  `POST /api/auth/devices/register`.

---

## Notes for P4 / P5

- The `403 + needsVerification: true` login response is the soft-gate
  trigger (Q4). When `AuthError` lands a dedicated case for this in P4,
  the login VM should route to `AuthRoute.verifyEmail` instead of the
  generic error surface.
- Verify-email deep links carry the hashed OTP at
  `/verify-email?token_hash=…&type=signup`. The mobile deep-link router
  needs to extract `token_hash` and pass it to
  `AuthManager.verifyEmail(token:)`. Routing wiring lands in P5.
- Reset-password deep links carry `/reset-password?token_hash=…`.
  Route to `AuthRoute.resetPassword(token:)` and call
  `AuthManager.resetPassword(token:newPassword:)` on submit.
- Password strength enforcement is client-side. Backend only validates
  length (`PASSWORD_MIN_LENGTH` / `PASSWORD_MAX_LENGTH`). The design's
  three-band strength meter (Weak / Fair / Strong) is purely UX guidance
  — backend accepts any length-compliant string.

## Backend gap discovered — Q4 soft-gate conflict

The Q4 decision (`docs/t6-open-questions-decisions.md:96-121`) says **new
users sign in immediately on Create Account success**, with a persistent
banner gating posting until verified. Current backend behaviour
contradicts this:

- `POST /api/users/register` (line 1437) returns `requiresEmailVerification: true`
  but **no tokens** — the user is created but not signed in.
- `POST /api/users/login` (lines 1521-1531) returns `403 + needsVerification: true`
  if `auth.user.email_confirmed_at` is null, blocking sign-in entirely.

So a fresh user cannot enter the app until they verify their email — the
opposite of "sign in immediately on Create Account success". To honour
Q4 the backend needs one of:

1. **Issue session on `/register`** — return `accessToken` / `refreshToken`
   alongside the user payload, conditional on a `softGate=true` flag the
   mobile client sends. Drop the 403 in `/login`, surface `verified: false`
   instead and let the client banner-gate posting.
2. **Drop the 403 in `/login`** — always issue the session, surface
   `verified: false` in the response, gate posting on the client side via
   the existing `user.verified` field.

Option 2 is smaller and reversible. **Filed as a follow-up for T6.0c
backend prep before P4 / P5 land** — without it, the verify-email screen
becomes a hard-gate dead-end on first launch, which contradicts the soft-
gate spec. Until the backend lands the change, the mobile client surfaces
the 403 + `needsVerification` reply as `.serverError("Please verify your
email…")` and routes to `AuthRoute.verifyEmail`, which is functionally a
hard gate (P3 stub behaviour). P4 picks up the soft-gate UX once the
backend ships option 2.

### T6.1c status (P5)

The Verify-email surface now first-class implements the soft-gate **UI**
contract: the tertiary "I'll do this later" link renders by default on
both iOS (`VerifyEmailView(softGate: true, …)`) and Android (the
`SOFT_GATE_KEY` SavedStateHandle arg defaults to `true`), so on the day
the backend ships option 2 above no UI change is needed — the screen
simply stops being the only place a fresh user can land. Until then,
"I'll do this later" still pops back to login (where the 403 will
re-route), so the worst-case is one extra friction step rather than a
dead end.

The deep-link router on both platforms now accepts
`pantopus://auth/verify-email?token=…&email=…` and
`pantopus://auth/reset-password?token=…`. Both routes also tolerate the
bare `/verify-email?token=…` / `/reset-password?token=…` shapes the
older Supabase recovery template emits, and the `token_hash` Supabase
param name as a synonym for `token`. See
`DeepLinkRouterTests` (iOS) and `DeepLinkRouterTest` (Android) for
the full smoke matrix.
