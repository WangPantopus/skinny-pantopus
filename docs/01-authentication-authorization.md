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

1. **Issued by**: Supabase Auth on signup/signin
2. **Format**: Standard JWT with Supabase claims (`sub`, `email`, `role`, `exp`)
3. **Verification**: `supabase.auth.getUser(token)` on every request
4. **Refresh**: Via `pantopus_refresh` cookie (web) or refresh token (mobile)
5. **Expiry**: Managed by Supabase (configurable per project)

### Cookie Configuration

| Cookie | Purpose | Flags |
|--------|---------|-------|
| `pantopus_access` | JWT access token | httpOnly, Secure (prod), SameSite |
| `pantopus_refresh` | Refresh token | httpOnly, Secure (prod), SameSite |
| `pantopus_csrf` | CSRF double-submit token | Secure (prod), SameSite |

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
