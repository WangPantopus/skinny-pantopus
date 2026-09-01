# Authentication & Authorization

> Detailed documentation of the Pantopus authentication, authorization, and security middleware systems.

---

## 1. Authentication Architecture

### Provider: Supabase Auth

All authentication is managed by **Supabase Auth**, which provides JWT-based authentication backed by PostgreSQL.

```
 Client                        Backend                         Supabase
 +--------+                   +----------+                    +----------+
 |        | -- POST /signup -->|          | -- signUp() ------>|          |
 |        |                   |          |<-- JWT + refresh --|          |
 |        |<-- Set cookies ---|          |                    |          |
 |        |                   |          |                    |          |
 |        | -- GET /api/x --->|          |                    |          |
 |        |   Cookie/Bearer   | verifyTk | -- getUser(jwt) -->|          |
 |        |                   |          |<-- user data ------|          |
 |        |<-- 200 + data ----|          |                    |          |
 +--------+                   +----------+                    +----------+
```

### Token Delivery Methods

| Method | Transport | Client Type | CSRF Required |
|--------|-----------|-------------|---------------|
| **Bearer Token** | `Authorization: Bearer <jwt>` header | Mobile (iOS/Android) | No |
| **httpOnly Cookie** | `pantopus_access` cookie | Web browsers | Yes |

### Token Lifecycle

1. **Issued by**: Supabase Auth on signup/signin (`/api/users/login`, `/oauth/callback`, `/oauth/token`, `/oauth/native`, `/api/auth/resume`)
2. **Format**: Standard JWT with Supabase claims (`sub`, `email`, `role`, `exp`, `session_id`, `iat`)
3. **Verification**: `supabase.auth.getUser(token)` on every request **plus** (persistent-login layer, §1.1) an `AuthSession` registry check on the JWT `session_id` and a per-user `sessions_valid_after` watermark
4. **Refresh**: Via `pantopus_refresh` cookie (web) or refresh token in the JSON body (mobile). Access JWT lifetime 3600 s; rotation on (`enable_refresh_token_rotation=true`, 10 s reuse interval). Native clients refresh proactively when `expiresAt − now < 120 s`.
5. **Expiry**: access token per Supabase config; **refresh tokens now have an inactivity ceiling enforced at our `/refresh`** — 90 d for `trusted` devices, 30 d for `unverified` (401 `SESSION_EXPIRED_INACTIVE`). Web refresh cookie stays 7 d (sliding: every successful refresh re-issues it).

### 1.1 Sessions, trusted devices and device binding (persistent login, 2026-08)

> Design: `docs/persistent-login/persistent-login-design-2026-08-18.md`; pinned wire contract (wins over prose): `docs/persistent-login/CONTRACT.md`; new-endpoint reference: `docs/mobile/auth-backend-contracts.md` §8.

Supabase Auth remains the only session authority. On top of it the backend keeps a thin **Pantopus-owned registry** (migration `160_auth_devices.sql`):

| Table | One row per | Why |
|---|---|---|
| `AuthSession` | Supabase session (`id` = JWT `session_id`), incl. **web** sessions (platform `web`, `device_id NULL`) | list / revoke individual sessions, "Where you're logged in", per-session `revoked_reason`, refresh-token hash + previous hash for reuse detection, `last_seen_at/ip/user_agent`, inactivity clock |
| `AuthDevice` | (user, hardware key) — iOS Secure Enclave / Android Keystore P-256 key | device-bound refresh, trust level, per-device revoke, push-token linkage |
| `AuthResumeGrant` | single-use, sha256-hashed Android reinstall grant (Block Store) | "Continue as X" after reinstall on Android |
| `AuthSecurityEvent` | login / logout / reuse / revoke / password change / step-up … | user-visible security activity + emails |
| `AuthChallenge`, `AuthDpopJti` | short-lived nonces / DPoP replay cache | step-up + proof replay protection |
| `User.sessions_valid_after`, `User.security_prefs` | watermark + `{allowRestoreGrants, newDeviceEmail}` | instant global revoke; user prefs |

**Device binding (native only).** At *credential issuance* (`/login`, `/oauth/*`, `/api/auth/resume`) a native client sends a `device` descriptor and a `DPoP: <ES256 dpop+jwt>` proof (RFC 9449, embedded JWK, `jti/htm/htu/iat`, plus `rth = b64url(sha256(refreshToken))` on `/refresh` and `/logout`). The server binds the session to that key. On `/refresh` it **first resolves the session** (refresh-token hash → previous hash → `sessionId`) and only then verifies the proof against *that* session's bound key — never "find a device by client-supplied id". A wrong/absent proof on a bound session ⇒ 401 `DEVICE_MISMATCH` and the session is revoked. **No bearer-only endpoint may create or rotate a binding** (`/api/auth/devices/register` requires a proof whose thumbprint equals the session's bound key and only updates metadata). The DPoP key is *not* biometry-gated (background refresh must work); a separate biometry-bound **step-up key** provides server-verifiable presence. Feature flag `AUTH_DEVICE_BINDING=off|optional|required` (default `optional`; legacy clients keep working until `required`, and unbound sessions may be adopted only if issued before `DPOP_CUTOVER`).

**Session context.** `AuthSession.context` is `interactive` (password / OAuth / native IdP shown) or `restored` (minted from a resume grant). Restored sessions can browse and chat but cannot delete the account, revoke devices/sessions or change security prefs until a password (or, later, passkey/native IdP) is presented once.

**Web sessions.** Cookie transport is unchanged for the browser; the backend still inserts an `AuthSession` row (platform `web`) so browsers appear in "Where you're logged in" (`/app/settings/security`) and can be revoked from any device.

**Step-up (`X-Step-Up`).** Sensitive actions require an opaque, purpose-bound, 5-minute token from `POST /api/auth/step-up` (`method: password` — or `device_key` for interactive-enrolled biometric keys on interactive native sessions) or from `POST /api/users/reauthenticate` (wildcard purpose). Purposes: `delete_account`, `revoke_device`, `revoke_sessions`, `change_security_prefs`, `generic`; one-shot for the destructive three. Missing/expired ⇒ 403 `STEP_UP_REQUIRED {purpose, methods}`. Web only offers `password` (no hardware key in a browser); OAuth-only web accounts must set a password first or confirm from the app.

### 1.2 Revocation semantics

| Trigger | Effect |
|---|---|
| `POST /api/users/logout` `scope:local` (default; unauthenticated allowed) | **always**: clear cookies + revoke the presented access JWT (`admin.signOut(jwt,'local')`). Row side effects (revoke that `AuthSession`, clear the binding, delete that device's `PushToken`s, revoke its resume grants) **only with proof**: a valid Bearer whose session is bound to `deviceId`, or `refreshToken` + `DPoP(rth)`. |
| `logout` `scope:others` / `global`, `POST /api/auth/sessions/revoke-others` / `revoke-all` | verifyToken (+CSRF on cookies) **and** `X-Step-Up` (`revoke_sessions`) → `admin.signOut(bearer, scope)` + rows revoked + devices/grants revoked + event; `global` also sets `sessions_valid_after = now()` (rejects even unexpired JWTs). |
| `DELETE /api/auth/devices/:id` | verifyToken + `X-Step-Up` (`revoke_device`) → device + its sessions revoked, push tokens deleted, grants revoked, sockets kicked, "device removed" email. |
| `POST /api/users/password` | after the update: all **other** sessions/devices/grants revoked, email sent. |
| `POST /api/users/reset-password` | **all** sessions revoked + watermark + all devices/grants revoked. |
| Refresh-token reuse (`TOKEN_REUSE`), `DEVICE_MISMATCH` | session revoked, bound device `require_step_up=true`, event, email/push to other devices. |
| `DELETE /api/users/account` | requires `X-Step-Up` (`delete_account`); revokes all sessions and push tokens before `admin.deleteUser`. |

Revocation is checked on every request (`verifyToken` → `AuthSession.revoked_at` with a 15 s in-process cache, plus the watermark folded into the existing 60 s role cache) and refused at `/refresh`; the socket server disconnects sockets of a revoked `session_id`.

### 1.3 Error codes (JSON `{ error, code }`)

| Status | `code` | Meaning | Client action |
|---|---|---|---|
| 401 | `TOKEN_REUSE` | refresh token replayed / rotated away | security sign-out ¹ |
| 401 | `DEVICE_MISMATCH` | DPoP proof does not match the key bound to that session | security sign-out ¹ |
| 401 | `DEVICE_REVOKED` | device removed by the user / server | security sign-out ¹ |
| 401 | `SESSION_REVOKED` | session revoked (per-session, others/global, watermark) | security sign-out ¹ |
| 401 | `SESSION_EXPIRED_INACTIVE` | idle beyond 90 d (trusted) / 30 d (unverified) | security sign-out ¹ |
| 401 | `DPOP_REQUIRED` | binding enforced (`AUTH_DEVICE_BINDING=required`) and no proof | security sign-out ¹ |
| 401 | `DPOP_INVALID` / `DPOP_REPLAY` | malformed / wrong `htu`/`htm`/`iat` / replayed `jti` | retry once with a fresh proof, then treat as invalid |
| 401 | `RESUME_GRANT_INVALID` | Android resume grant used/expired/revoked | fall back to L3 (login prefilled) |
| 401 | `UNAUTHORIZED` | generic | existing refresh-then-login flow |
| 403 | `STEP_UP_REQUIRED` `{purpose, methods}` | sensitive action needs `X-Step-Up` | run step-up UI, retry once |

¹ *Security sign-out*: wipe tokens/`expiresAt`/`sessionId`, keep the non-secret display hint, show "You were signed out for security. Sign in again." — never a generic "session expired".

### 1.4 Backend feature flags / env

`AUTH_DEVICE_BINDING` (`off|optional|required`, default `optional`), `AUTH_RESUME_GRANTS` (`on|off`), `DPOP_CUTOVER` (ISO date; default far future), `PUBLIC_API_BASE_URL` (DPoP `htu` comparison), `STEP_UP_SECRET` (required in production; falls back to `CSRF_SECRET` with a warning), `AUTH_INACTIVITY_DAYS_TRUSTED=90`, `AUTH_INACTIVITY_DAYS_UNVERIFIED=30`, `AUTH_RESUME_GRANT_DAYS=90`.

### 1.5 Web session recovery (Next middleware)

The Next.js middleware (`frontend/apps/web/src/middleware.ts`) can only see the 1-hour `pantopus_access` cookie and the 30-day `pantopus_session=1` flag — the 7-day `pantopus_refresh` cookie is path-scoped to `/api/users/refresh` and invisible to it. Historically "flag present, access missing" cleared **all** cookies before any refresh attempt, so web persistence was weaker than the 7-day cookie implied. Since 2026-08 that state is treated as *maybe signed in*: `/app/*` (and `/`) are redirected to the same-origin route **`/session/refresh?redirectTo=…`** which calls `POST /api/users/refresh` through `refreshAuthSession()` (the single-flight mutex in `frontend/packages/api/src/client.ts`, so a page-level 401 retry and the middleware hand-off can never race into `TOKEN_REUSE`). Success ⇒ full navigation back to `redirectTo`; a definitive 401 ⇒ `POST /api/users/logout` (which clears the path-scoped refresh cookie too) then `/login?redirectTo=…` (or the public twin, e.g. `/gigs/:id`); a transient failure keeps the cookies and offers Retry. A sessionStorage guard stops a redirect loop if a "successful" refresh does not produce an access cookie. Auth pages (`/login`, …) simply render with the stale cookies (a fresh login overwrites them). Web still has no device binding: browsers appear as `AuthSession` rows and can be revoked, but the refresh cookie remains a bearer secret protected by httpOnly + SameSite + CSRF (device cookies are a Phase-4 item).

### Cookie Configuration

| Cookie | Purpose | Flags |
|--------|---------|-------|
| `pantopus_access` | JWT access token (1 h) | httpOnly, Secure (prod), SameSite=Lax, path `/` |
| `pantopus_refresh` | Refresh token (7 d, re-issued on every refresh) | httpOnly, Secure (prod), SameSite=Lax, path `/api/users/refresh` |
| `pantopus_csrf` | CSRF double-submit token (24 h, HMAC(userId)) | Secure (prod), SameSite=Lax, JS-readable |
| `pantopus_session` | `1` — JS-readable "was signed in" hint (30 d); never authority | Secure (prod), SameSite=Lax |

### Auth Config Functions (`config/auth.js`)

| Function | Purpose |
|----------|---------|
| `signUp(email, password)` | Create new account via Supabase |
| `signIn(email, password)` | Authenticate and get tokens |
| `signOut()` | Invalidate session |
| `resetPassword(email)` | Trigger password reset email |
| `updatePassword(newPassword)` | Change password (authenticated) |
| `resendConfirmationEmail(email)` | Re-send email verification |

---

## 2. Middleware Chain

### Global Middleware Order (app.js)

```
Request
  |
  v
[1] CORS (dynamic origin check)
  |
  v
[2] Helmet (security headers)
  |
  v
[3] Webhook raw body handlers (Stripe, Lob) -- mounted BEFORE JSON parser
  |
  v
[4] Body Parser (JSON 20MB limit, URL-encoded)
  |
  v
[5] Cookie Parser
  |
  v
[6] Request Logger (method, path, IP, User-Agent)
  |
  v
[7] APM Middleware (response time tracking)
  |
  v
[8] Request ID (crypto.randomUUID per request)
  |
  v
[9] Global Rate Limiters (write: 60/min, read: unlimited)
  |
  v
[10] Route-specific middleware (verifyToken, requireAdmin, etc.)
  |
  v
Route Handler
```

### Per-Route Authentication Pattern

```javascript
// Standard protected endpoint
router.post('/endpoint', verifyToken, handler)

// Admin-only endpoint
router.get('/admin/data', verifyToken, verifyToken.requireAdmin, handler)

// Optional auth (works with or without login)
router.get('/public/feed', optionalAuth, handler)

// Business permission check
router.patch('/biz/:id', verifyToken, requireBusinessSeat('catalog.edit'), handler)

// Home authority check
router.post('/home/:id/task', verifyToken, requireAuthority, handler)
```

---

## 3. Token Verification (`middleware/verifyToken.js`)

### Flow

```
Request arrives
  |
  +-- Has Authorization: Bearer <token>?
  |     YES -> req._authMethod = 'bearer'
  |     NO  -> Has pantopus_access cookie?
  |               YES -> req._authMethod = 'cookie'
  |               NO  -> Return 401
  |
  v
supabase.auth.getUser(token)
  |
  +-- Invalid/expired? -> Return 401
  |
  v
Lookup role from cache (60s TTL, 1000 entries)
  |
  +-- Cache miss? -> Query User table for role + account_type
  |
  v
req.user = {
  id,
  email,
  emailConfirmed,
  role,          // 'user' or 'admin'
  accountType    // user account type
}
  |
  v
If req._authMethod === 'cookie' AND method is POST/PUT/PATCH/DELETE:
  -> Run CSRF protection
  |
  v
next()
```

### Role Cache

| Setting | Value |
|---------|-------|
| TTL | 60 seconds |
| Max entries | 1,000 |
| Default role | `'user'` (on cache miss + DB error) |
| Invalidation | `invalidateRoleCache(userId)` |

---

## 4. Optional Auth (`middleware/optionalAuth.js`)

Lighter-weight version of verifyToken for public endpoints that benefit from knowing the user.

| Aspect | verifyToken | optionalAuth |
|--------|-------------|--------------|
| Returns 401 on invalid token | Yes | No |
| Sets req.user on failure | N/A | `null` |
| Fetches role/accountType | Yes | No |
| Token cache TTL | 60s | 15s |
| Token cache max | 1,000 | 500 |
| Use case | Protected routes | Public routes with personalization |

---

## 5. CSRF Protection (`middleware/csrfProtection.js`)

### Strategy: Double-Submit Cookie + HMAC Session Binding

```
 Browser                        Server
 +-------+                     +--------+
 |       | -- POST request --->|        |
 |       |   Cookie: csrf=ABC  |        |
 |       |   Header: x-csrf=ABC|        |
 |       |                     |  [1] cookie === header? (double-submit)
 |       |                     |  [2] token === HMAC(secret, userId)? (binding)
 |       |                     |  [3] crypto.timingSafeEqual (timing-safe)
 |       |<-- 200 or 403 -----|        |
 +-------+                     +--------+
```

### Rules

| Condition | CSRF Check |
|-----------|------------|
| GET / HEAD / OPTIONS | Skipped |
| Bearer-authenticated (mobile) | Skipped |
| Cookie-authenticated + unsafe method | **Enforced** |

### Token Generation (`utils/csrf.js`)

```
Token = HMAC-SHA256(CSRF_SECRET, userId)
Output: 64-character hex string
```

- **Production**: `CSRF_SECRET` env var required (process exits if missing)
- **Development**: Random 32-byte secret generated at startup

---

## 6. Authorization Systems

### 6.1 Platform Roles (User-Level)

| Role | Access |
|------|--------|
| `user` | Standard user (default) |
| `admin` | Platform administrator (full access to admin routes) |

Checked via `verifyToken.requireAdmin` middleware.

### 6.2 Business IAM (`middleware/requireBusinessSeat.js` + `utils/seatPermissions.js`)

```
 Business Role Hierarchy
 +-------+
 | owner | -- rank 50 (all 46 permissions)
 +-------+
     |
 +-------+
 | admin | -- rank 40
 +-------+
     |
 +--------+
 | editor | -- rank 30
 +--------+
     |
 +-------+
 | staff | -- rank 20
 +-------+
     |
 +--------+
 | viewer | -- rank 10
 +--------+
```

#### Permission Resolution Order

```
1. Seat-level override (BusinessPermissionOverride for seat)
   -> If explicit grant/deny found, use it
2. User-level override (BusinessPermissionOverride for user)
   -> If explicit grant/deny found, use it
3. Role default (BusinessRolePermission for role_base)
   -> Use role's default permission set
```

#### Permission Categories (46 total)

| Category | Example Permissions |
|----------|-------------------|
| **Team** | team.view, team.invite, team.manage |
| **Catalog** | catalog.view, catalog.edit, catalog.manage |
| **Finance** | finance.view, finance.manage |
| **Pages** | pages.view, pages.edit, pages.publish |
| **Profile** | profile.view, profile.edit |
| **Location** | location.view, location.edit |
| **Analytics** | analytics.view |
| **Settings** | settings.view, settings.manage |

#### Identity Firewall (Seat-Based)

```
 User --[SeatBinding]--> BusinessSeat --[role_base]--> Permissions
                              |
                         is_active: true
                         display_name
                         contact_method
```

- Each user gets a **BusinessSeat** with a `role_base` and optional `display_name`
- **SeatBinding** links the user to their seat
- Seats can be deactivated (soft-delete) without removing the user
- Invite flow: Create seat -> Generate token -> User accepts -> SeatBinding created

#### Data Attached to Request

```javascript
req.businessSeat        // The BusinessSeat record
req.businessPermissions // Array of permission strings
req.isBusinessOwner     // Boolean
req.businessUserId      // The business account's user ID
```

### 6.3 Home IAM (`utils/homePermissions.js`)

```
 Home Role Hierarchy
 +-------+
 | owner | -- rank 60 (all permissions)
 +-------+
     |
 +-------+
 | admin | -- rank 50
 +-------+
     |
 +---------+
 | manager | -- rank 40
 +---------+
     |
 +--------+
 | member | -- rank 30
 +--------+
     |
 +--------------------+
 | restricted_member  | -- rank 20
 +--------------------+
     |
 +-------+
 | guest | -- rank 10
 +-------+
```

#### Home Permissions

| Permission | Access Level |
|-----------|-------------|
| home.edit | Edit home metadata |
| finance.view | View bills/expenses |
| finance.manage | Pay/manage bills |
| access.manage | Manage access controls |
| members.manage | Add/remove members |
| tasks.edit | Edit tasks |
| tasks.manage | Create/assign tasks |
| sensitive.view | View sensitive data |

#### Resolution: Same override-first pattern as Business IAM

```
1. HomePermissionOverride (explicit grant/deny per user)
2. HomeRolePermission (defaults for role_base)
```

### 6.4 Home Authority (`middleware/requireAuthority.js`)

Verifies a user has **verified ownership authority** over a home. Resolution chain:

```
1. Direct User Authority
   HomeAuthority WHERE subject_type='user' AND subject_id=userId AND status='verified'

2. Seat-Based Business Authority (preferred)
   SeatBinding -> BusinessSeat -> HomeAuthority
   WHERE business holds verified authority AND seat is_active=true

3. Legacy BusinessTeam Authority (fallback)
   BusinessTeam -> HomeAuthority
   WHERE business holds verified authority AND membership is_active=true
```

Attaches `req.authority` = matched HomeAuthority record.

### 6.5 Support Train Permissions (`middleware/supportTrainPermissions.js`)

Three middleware factories:

| Middleware | Purpose |
|-----------|---------|
| `loadSupportTrain` | Load activity + train from DB |
| `requireSupportTrainRole(roles)` | Check organizer/co-organizer/delegate |
| `requireSupportTrainViewer` | Check any viewing access |

Access paths for viewers:
1. Primary organizer
2. Recipient
3. Co-organizer or delegate
4. Helper with active reservation

---

## 7. Rate Limiting (`middleware/rateLimiter.js`)

Uses `express-rate-limit` with per-endpoint configurations.

### Rate Limit Policies

| Limiter | Window | Auth Limit | Anon Limit | Applied To |
|---------|--------|------------|------------|------------|
| **globalWriteLimiter** | 60s | 60/min | 30/min | All POST/PUT/PATCH/DELETE |
| **financialWriteLimiter** | 60s | 10/min | - | `/api/payments`, `/api/wallet` |
| **contentCreationLimiter** | 60s | 20/min | - | `/api/posts`, `/api/listings`, `/api/reviews` |
| **homeCreationLimiter** | 1h | 5/hour | - | `POST /api/homes` |
| **authEndpointLimiter** | 60s | - | 20/min | `/api/users/login`, `/api/users/register` |
| **ownershipClaimLimiter** | 15m | 10/15m | - | Home ownership claims |
| **postcardLimiter** | 1h | 3/hour | - | Verification code requests |
| **verificationAttemptLimiter** | 15m | 10/15m | - | Verification code submission |
| **addressValidationLimiter** | 1h | 10/hour | - | Address validation |
| **addressClaimLimiter** | 24h | 3/day | - | Address claim creation |
| **landlordLeaseLimiter** | 15m | 20/15m | - | Lease management |
| **aiChatLimiter** | 1h | 20/hour | - | AI streaming chat |
| **aiDraftLimiter** | 1h | 30/hour | - | AI draft generation |
| **supportTrainWriteLimiter** | 5m | 30/5m | - | Support Train writes |
| **supportTrainDraftLimiter** | 5m | 10/5m | - | Support Train AI drafts |

### Key Strategy

- **Authenticated**: Keyed by `req.user.id` (per-user limits)
- **Anonymous**: Keyed by `req.ip` (per-IP limits)
- **HTTP Headers**: Standard draft-7 rate limit headers returned
- **Skip**: Most limiters skip GET/HEAD/OPTIONS (read-only)

---

## 8. Input Validation (`middleware/validate.js`)

### Joi Schema Validation

```javascript
// Usage in route
router.post('/endpoint', verifyToken, validate(schema), handler)

// Schema example
const schema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  price: Joi.number().positive().max(99999).required(),
  category: Joi.string().valid(...VALID_CATEGORIES).required()
});
```

### Validation Behavior

| Setting | Value |
|---------|-------|
| `abortEarly` | false (collect all errors) |
| `allowUnknown` | false (reject unknown fields) |
| `stripUnknown` | true (remove before validation) |

### Error Response Format

```json
{
  "error": "Validation failed",
  "message": "Please correct the highlighted fields.",
  "details": [
    {
      "field": "price",
      "message": "\"price\" must be a positive number",
      "code": "number.positive",
      "rejectedValue": -5
    }
  ]
}
```

---

## 9. CORS Configuration

### Dynamic Origin Resolution

```
Development:
  - http://localhost:3000
  - http://127.0.0.1:3000
  - http://localhost:3001
  - http://localhost:4010

Production:
  - APP_URL (primary)
  - APP_URLS (comma-separated additional origins)
  - Sibling ports: 3000, 3001, 4010 on same hostname
```

| Setting | Value |
|---------|-------|
| Credentials | `true` (allow cookies) |
| Options status | 200 |

---

## 10. Webhook Authentication

### Stripe Webhooks (`/api/webhooks/stripe`)

- **Body**: `express.raw()` (must be raw for signature verification)
- **Verification**: HMAC using `STRIPE_WEBHOOK_SECRET`
- **Idempotency**: `StripeWebhookEvent` table (event_id dedup)
- **Mounted before**: JSON body parser in middleware chain

### Lob Webhooks (`/api/v1/webhooks/lob`)

- **Body**: `express.raw()` (must be raw for signature verification)
- **Verification**: HMAC using `LOB_WEBHOOK_SECRET`
- **Mounted before**: JSON body parser in middleware chain

---

## 11. Security Headers (Helmet)

Applied globally via `helmet()` middleware:

| Header | Purpose |
|--------|---------|
| `X-Content-Type-Options: nosniff` | Prevent MIME sniffing |
| `X-Frame-Options: SAMEORIGIN` | Clickjacking protection |
| `X-XSS-Protection: 0` | Disable legacy XSS filter |
| `Strict-Transport-Security` | HSTS (HTTPS enforcement) |
| `Content-Security-Policy` | CSP directives |
| `Referrer-Policy` | Control referer header leakage |

---

## 12. Audit Logging

| Table | Scope | Events Logged |
|-------|-------|--------------|
| `HomeAuditLog` | Per home | Member add/remove, role change, lockdown, ownership transfer |
| `BusinessAuditLog` | Per business | Seat operations (via `writeSeatAuditLog`) |
| `SeatAuditLog` | Per business | Seat create/update/deactivate, permission changes |
| `PaymentAudit` | Per payment | State transitions, capture/refund events |
| `AddressVerificationAttempt` | Per address | Verification attempts, code submissions |

---

## 13. Address Verification Pipeline (Multi-Provider)

```
 User Input (address, city, state, zip)
   |
   v
 [Layer 1] Normalize + Hash (SHA-256 for dedup)
   |
   v
 [Layer 2] Google Address Validation API
   |         -> geocoding, component normalization
   |
   v
 [Layer 3] Smarty Postal Validation
   |         -> USPS DPV match, RDI residential/commercial
   |
   v
 [Layer 4] Decision Engine
   |         -> verdict: OK, MISSING_UNIT, LOW_CONFIDENCE,
   |                     UNDELIVERABLE, BUSINESS, SERVICE_ERROR
   |
   v
 [Shadow] Google Places (optional)
   |       -> place type classification comparison
   |
 [Shadow] ATTOM Parcel Intel (optional)
   |       -> parcel/unit data comparison
   |
   v
 HomeAddress record (canonical, deduplicated)
```

### Mail Verification Flow

```
 User requests verification
   |
   v
 [Rate Check] 2 starts/24h per user, 5 attempts/7d per address
   |
   v
 Generate 6-digit code + SHA-256 hash
   |
   v
 Dispatch postcard via LOB (or mock in dev)
   |
   v
 User enters code
   |
   v
 [Verify] timing-safe SHA-256 comparison, max 5 attempts
   |
   v
 Create HomeOccupancy record on success
```

---

*See [02-api-routes-and-services.md](./02-api-routes-and-services.md) for complete API endpoint documentation.*
