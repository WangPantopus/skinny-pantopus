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

Route: `backend/routes/users.js:1910`. Rate-limited via `refreshLimiter`.

### Request

```json
{ "refreshToken": "<jwt>" }
```

Mobile clients send the stored refresh token in the body. Web clients
can omit the body and the backend reads `pantopus_refresh` from cookies.

### Response — 200

```json
{
  "ok": true,
  "accessToken": "<new_jwt>",
  "refreshToken": "<rotated_jwt>",
  "expiresIn": 3600,
  "expiresAt": 1800000000
}
```

Token fields are absent in cookie-transport mode (server sets fresh
cookies and returns `{ ok: true }`). Mobile clients should detect
absence and re-prompt.

### Errors

| Status | Body | Mobile mapping |
|---|---|---|
| 400 | `{ "error": "refreshToken is required" }` | `.serverError(msg)` |
| 401 | `{ "error": "Session expired. Please sign in again." }` | `.invalidCredentials` (signs out) |
| 401 | `{ "error": "Session invalidated. Please sign in again.", "code": "TOKEN_REUSE" }` | `.invalidCredentials` (signs out) — refresh-token reuse detected, all sessions terminated server-side |
| 5xx | `{ "error": "Failed to refresh session" }` | `.serverError(msg)` (signs out) |

Mobile `AuthRepository.refreshSession()` / `AuthManager.refreshSession()`
always `signOut()` on failure regardless of mapping, so the UI returns
to the login screen.

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
