# Backend Request Lifecycle, Authorization, Route Design, and Versioning

This document is written as an interview-style walkthrough of the backend in
[`backend/app.js`](../../backend/app.js). It assumes the speaker built the
system and is explaining not only what happens, but why the design exists, what
risks it carries, and how to harden it as the API surface grows.

## Executive Summary

The backend is an Express monolith with a large number of product domains mounted
from one process: identity, homes, businesses, payments, mail, chats, posts,
marketplace, personas, AI, webhooks, internal jobs, and public preview surfaces.

The central request lifecycle is:

1. Establish infrastructure-level request safety: CORS, security headers, raw
   webhook body handling, body parsing, cookies, request logging, and APM.
2. Serve public liveness endpoints and metrics.
3. Attach request IDs for `/api`.
4. Apply coarse global write rate limiting and stricter endpoint-family limiters.
5. Dispatch to domain routers.
6. Let domain routers enforce authentication and object authorization.
7. Fall through to 404 or global error handling.

The most important design point is that the backend mostly uses Supabase
`service_role` for database access inside routes. That means the backend is
not relying on RLS as the primary access-control boundary for most product
operations. The backend authenticates the caller, computes authorization in
server code, and then uses service-role access to perform controlled reads and
writes. That is a valid architecture, but it raises the bar: every sensitive
route must prove both authentication and object-level authorization before it
touches data.

The highest-risk area in `app.js` is route precedence. Several routers share
the same mount prefix and several contain broad dynamic routes such as
`/:id`, `/:username`, `/:businessId`, or `/:handle`. Express resolves routes in
registration order, so route shadowing is a real bug class in this codebase.
There are comments and tests to guard against known collisions, but as the API
surface grows, this should be enforced by route manifest tests and stricter
route-shape conventions.

The second important caveat is rate limiting. The global write limiter is mounted
before route-level authentication. That is good for cheap pre-auth abuse
protection, but it means `req.user` is normally not set when the limiter runs.
So the global limiter is effectively IP-keyed today, even though the comments in
`rateLimiter.js` describe authenticated-user buckets. A better final shape is
two-stage limiting: pre-auth IP buckets plus post-auth user buckets.

## 1. Walk Me Through The Request Lifecycle In `backend/app.js`

At a high level, `backend/app.js` is both the application composition root and
the runtime bootstrap. It imports all route modules, configures middleware,
mounts route families, starts Socket.IO, starts background jobs, and installs
process-level shutdown and crash handlers.

### 1.1 Environment and Core App Initialization

The app first chooses an env file:

- `.env` if present.
- `.env.dev` otherwise.

Then it initializes:

- `express()`
- an HTTP server from the Express app
- Socket.IO attached to that server
- Supabase anon and service-role clients
- the logger, APM, rate limiters, routes, and jobs

This file is intentionally the place where ordering is visible. That matters
because Express middleware order is behavior.

### 1.2 Trust Proxy and Origin Handling

Before request middleware, the app derives allowed browser origins from:

- `APP_URL`
- `APP_URLS`
- local development defaults when not in production
- sibling dev ports for the configured app URL

The app also configures `trust proxy`. In production the default is one trusted
proxy hop unless explicitly overridden.

That matters for two things:

- CORS decisions use the normalized origin allowlist.
- IP-based rate limiting depends on `req.ip`, which depends on Express proxy
  trust configuration.

The warning for `TRUST_PROXY=true` is important. A fully permissive trust-proxy
setting can allow spoofed forwarded IPs and weaken rate limiting. The code
normalizes `true` to one trusted hop, which is the conservative default for
most one-load-balancer deployments.

### 1.3 CORS

The first request middleware is CORS:

```js
app.use(cors(corsOptions));
```

The CORS policy:

- Allows configured origins.
- Allows no-origin requests, which covers same-origin requests, health checks,
  server-to-server clients, curl, and many mobile/non-browser clients.
- Uses `credentials: true`, which is required because web clients may use
  httpOnly cookies.
- Logs blocked origins.

This is a browser boundary, not a complete security boundary. A non-browser
client can call the API regardless of CORS. Real security still comes from auth,
CSRF, signatures, object authorization, and rate limiting.

Socket.IO gets a parallel CORS policy during initialization. That avoids the
classic mismatch where REST calls are allowed but websocket handshakes fail.

### 1.4 Security Headers

The next middleware is:

```js
app.use(helmet());
```

`helmet` applies common HTTP response headers such as:

- `X-Content-Type-Options`
- frame protections
- referrer and cross-origin policies depending on default helmet config
- HSTS in appropriate environments

This is defense in depth. It does not authenticate anything, but it lowers the
risk of browser-side exploitation.

### 1.5 Raw Webhooks Before JSON Parsing

Three webhook families are mounted before the JSON and urlencoded body parsers:

- `/api/webhooks/stripe`
- `/api/v1/webhooks/lob`
- `/api/internal/email-inbound`

They use `express.raw()` because their authenticity depends on verifying a
signature over the exact bytes that the sender signed.

This ordering is non-negotiable. If JSON parsing ran first, the raw bytes would
be lost or transformed, and signatures could fail or become unverifiable.

Stripe is especially strict: `stripe.webhooks.constructEvent(rawBody, sig,
secret)` needs the original raw body. Lob uses a timestamp/signature scheme.
Email inbound uses an HMAC over raw bytes with `X-Pantopus-Signature`.

The security model for these endpoints is not user JWT auth. It is provider or
service-to-service authenticity:

- Stripe: Stripe signature and webhook secret.
- Lob: Lob signature when configured.
- Email inbound: shared HMAC secret.

### 1.6 Body and Cookie Parsing

After raw webhook routes:

```js
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());
```

Most app routes expect parsed JSON. Cookies are parsed after body parsing and
after raw webhook routes.

Cookie parsing matters because `verifyToken` supports two auth transports:

- Bearer token in `Authorization`.
- httpOnly cookie named `pantopus_access`.

Bearer takes precedence over cookies. That is deliberate because mobile clients
can carry stale cookies accidentally, while a Bearer token is an explicit auth
choice for that request.

### 1.7 CSRF Placement

CSRF protection is not installed globally in `app.js`. Instead, it is invoked
inside `verifyToken` after the auth method has been determined:

```js
csrfProtection(req, res, next);
```

That allows the CSRF middleware to enforce only the web-cookie case:

- Safe methods (`GET`, `HEAD`, `OPTIONS`) skip CSRF.
- Bearer-authenticated requests skip CSRF.
- Cookie-authenticated mutating requests require a double-submit CSRF token.
- The CSRF token must also be bound to the authenticated user.

This is the right split. CSRF is a browser-cookie risk. It should not block
mobile Bearer-token calls.

### 1.8 Request Logging and APM

Every request logs method, path, IP, and user agent.

APM is mounted before routes and records:

- route key
- duration
- count
- 5xx errors
- p50, p95, p99, max
- slow request logs

The APM middleware records metrics on `res.finish`, so it captures the final
status code and duration after the handler completes.

### 1.9 Health Endpoints

Three health-ish endpoints exist before the `/api` middleware stack:

- `GET /`
- `GET /health`
- `GET /api/health/metrics`

`/` is a basic status payload.

`/health` verifies that Supabase can be queried and returns 503 when the database
check fails. This is appropriate for platform health checks, although in a
high-scale environment I would make sure it cannot overload the database.

`/api/health/metrics` returns process and in-memory APM metrics. It is currently
not authenticated because it is mounted before request IDs, rate limiting, and
auth. That is useful for local development and quick ops debugging, but I would
not expose it publicly in production.

### 1.10 Request ID

The request ID middleware is mounted only under `/api`:

```js
app.use('/api', requestIdMiddleware);
```

It accepts an incoming `x-request-id` or creates a UUID. This gives downstream
handlers a correlation ID, although the current global error response does not
yet include it in the client payload.

### 1.11 Global and Family Rate Limiting

Next, the app applies:

- global write limiter to all `/api`
- financial limiter to `/api/payments` and `/api/wallet`
- content limiter to `/api/posts`, `/api/listings`, `/api/reviews`
- home creation limiter to `/api/homes`
- auth endpoint limiter to `/api/users/login` and `/api/users/register`
- preview limiter to `/api/public`

The global write limiter skips `GET`, `HEAD`, and `OPTIONS`.

Important caveat: because the global limiter is before route-level `verifyToken`,
it usually cannot see `req.user`. Its key function is:

```js
keyGenerator: (req) => req.user?.id || req.ip
```

At that point, `req.user` is normally undefined. So it keys by IP for most
protected routes.

That is not necessarily wrong if the goal is pre-auth flood protection, but the
comment saying "60 requests per minute per authenticated user" is misleading for
this mount order.

### 1.12 Route Dispatch

After middleware, `app.js` mounts domain route families. Most auth happens inside
those routers rather than at the `app.js` mount point.

Examples:

- `/api/users`
- `/api/gigs`
- `/api/homes`
- `/api/posts`
- `/api/chat`
- `/api/payments`
- `/api/businesses`
- `/api/personas`
- `/api/listings`
- `/api/v1/address`
- `/api/v1` landlord/tenant flows
- `/api/admin`
- `/api/internal`
- `/api/ai`
- `/api/activities/support-trains`

This makes the route file responsible for deciding whether a specific endpoint is:

- public
- optional-auth
- user-authenticated
- admin-only
- internal-key protected
- provider-signed

That gives flexibility, but it also makes auditability harder unless there is a
generated route manifest or explicit route classification registry.

### 1.13 Socket.IO

The app attaches `io` to the Express app:

```js
app.set('io', io);
```

Route handlers use that to emit events after writes, for example chat or gig
updates. Socket authentication is implemented separately in
`backend/socket/chatSocketio.js`, where the socket handshake token is verified
with Supabase auth.

### 1.14 404 and Global Error Handling

If no mounted route handles a request, the 404 handler returns:

```json
{
  "error": "Route not found",
  "path": "...",
  "method": "..."
}
```

Unhandled errors then reach the final error middleware, which logs:

- message
- stack
- path
- method

and returns:

```json
{
  "error": "..."
}
```

In development it also includes stack traces.

That is a reasonable baseline, but error semantics are not fully centralized yet.
Many route handlers still directly return ad hoc `{ error: "..." }` responses.

## 2. Why Are Many Route-Order Comments Needed?

They are needed because this backend has multiple routers mounted at the same
prefix and many of those routers contain broad dynamic routes.

Express is order-sensitive:

```js
app.use('/api/businesses', businessRoutes);
app.use('/api/businesses', businessSeatRoutes);
```

If `businessRoutes` contains `GET /:businessId`, then a request like:

```text
GET /api/businesses/my-seats
```

can be interpreted as:

```text
businessId = "my-seats"
```

and never reach the intended static `/my-seats` route.

That is why `app.js` has comments like:

- block routes must be before user routes for `/blocked`
- magic task routes must be before gig routes for static paths
- specialized home routers must be before `homeRoutes`, which has `/:id`
- business discovery/founding/seats must be before `businessRoutes`
- persona UUID-gated routers must be before handle-based persona routes
- internal briefing must be before `/api/internal`

These are not cosmetic comments. They are documenting correctness constraints.

## 3. What Bug Class Does This Imply In The Route Design?

The bug class is route shadowing, also called route precedence collision.

The pattern is:

1. A broad dynamic route is registered first.
2. A more specific static route is registered later.
3. Express sends the request to the broad dynamic route.
4. The wrong handler runs.
5. The caller may receive a confusing 404, a wrong 403, wrong data, or in the
   worst case, a weaker authorization policy.

Examples of risky route shapes in this codebase:

| Prefix | Broad Pattern | Static Or Specialized Pattern At Risk |
|---|---:|---|
| `/api/users` | `/:username` | `/blocked`, `/me/*`, `/public/*`, `/username/:username` |
| `/api/homes` | `/:id` | `/my-homes`, `/primary`, `/invitations`, `/my-ownership-claims` |
| `/api/businesses` | `/:businessId` | `/my-businesses`, `/my-seats`, `/seats/*`, `/search`, `/map` |
| `/api/personas` | `/:handle` | `/:id/tiers`, `/:id/payments`, `/:id/dms`, `/me/*` |
| `/api/internal` | `/*` internal routes | `/briefing/*`, `/email-inbound` |

The serious security angle is that route shadowing can become an authorization
bypass or data exposure when the wrong route has weaker auth assumptions.

For example, if a static management route is accidentally captured by a public
profile route, the request may not receive the intended role checks. Or the
opposite can happen: a valid static route becomes unavailable because it is
treated as an object ID.

The existing test `backend/tests/unit/routePrecedence.test.js` proves this risk
is already understood. It asserts that `businessSeatRoutes` is mounted before
`businessRoutes`, because `businessRoutes` has `/:businessId` catch-all style
routes.

## 4. How Do You Prevent Route Shadowing As The API Surface Grows?

I would use a layered strategy: route-shape discipline, type constraints, route
manifest tests, and review rules.

### 4.1 Prefer Disjoint Route Shapes

The strongest prevention is to avoid ambiguous route shapes.

Better:

```text
/api/business-seat/me
/api/business-seat/invites/:token
/api/businesses/:businessId
```

Riskier:

```text
/api/businesses/my-seats
/api/businesses/:businessId
```

The first shape makes it impossible for `my-seats` to be parsed as a business
ID because it lives under a different resource prefix.

### 4.2 Keep Collection-Level Actions Before Object-Level Actions

When sharing a router is unavoidable:

1. Static collection routes first.
2. Typed subresources next.
3. Generic object routes last.

Inside a router:

```js
router.get('/my-seats', ...)
router.get('/seats/invite-details', ...)
router.get('/:businessId/seats', ...)
router.get('/:businessId', ...)
```

At `app.js` level, mount specialized routers before broad routers.

### 4.3 Constrain Params By Type

Use UUID gates for ID-based management routes. The persona tier routes already
do this because Express 5 and `path-to-regexp` 8 no longer support the old
inline regex shorthand in the same way.

The pattern is:

```js
router.use((req, _res, next) => {
  if (!UUID_RE.test(req.params.id || '')) return next('router');
  return next();
});
```

That lets:

```text
/api/personas/UUID/tiers
```

go to owner management, while:

```text
/api/personas/handle/tiers
```

falls through to the public handle route.

### 4.4 Generate A Route Manifest In CI

Comments are helpful, but CI should enforce the contract.

I would add a test that:

1. Loads the Express app.
2. Walks `app._router.stack` and nested router stacks.
3. Emits a manifest of method, path, middleware names, and source router.
4. Compares known critical paths to expected handlers.
5. Fails if a new dynamic route precedes a known static route under the same
   prefix.

The manifest should make it obvious that:

```text
GET /api/businesses/my-seats
```

resolves to `businessSeats`, not `businesses`.

### 4.5 Add Lints For Broad Params

For route modules with `/:id` or `/:businessId`, enforce a local rule:

- all static paths must appear before the first broad dynamic route
- no new static route can be added after `/:id`
- catch-all routes must be visibly last

This can be a lightweight Jest test using router stack order, similar to the
current `routePrecedence.test.js`.

### 4.6 Make Route Ownership Explicit

As the API grows, each route should have metadata:

```js
{
  method: 'GET',
  path: '/api/homes/:id',
  auth: 'user',
  objectAuth: 'home.member',
  public: false,
}
```

That metadata can power docs, auth audits, and tests. It also makes route
additions more deliberate.

## 5. Why Is `/api/health/metrics` Exposed The Way It Is?

It is exposed as a lightweight in-process operational endpoint. It returns:

- uptime
- memory RSS
- APM route metrics
- address verification metrics

Because it is mounted before `/api` request ID and rate-limiting middleware, it
is not treated like a normal authenticated API route.

That is convenient for:

- local development
- smoke testing
- simple uptime dashboards
- quick debugging without needing a user session

But there is a difference between health and metrics.

### 5.1 `/health` Can Be Public

`GET /health` is a liveness/readiness endpoint. It returns coarse state:

- healthy or unhealthy
- database connected or disconnected
- timestamp

That is normal to expose to load balancers and uptime monitors.

### 5.2 `/api/health/metrics` Should Not Be Public In Production

`/api/health/metrics` reveals operational details:

- route names and route shapes
- traffic counts
- latency percentiles
- 5xx rates
- memory use
- address verification behavior

That can help an attacker understand:

- what endpoints exist
- where the expensive routes are
- which routes are failing
- which features are active

In production, I would require one of:

- platform admin auth via `verifyToken` and `requireAdmin`
- an internal monitoring key
- network-level restriction to the private VPC or monitoring system
- separate metrics export to Prometheus/OpenTelemetry rather than public JSON

The best final design:

```text
/health                 public liveness, minimal payload
/ready                  optional readiness, minimal payload
/api/admin/metrics      admin-only app metrics
/internal/metrics       internal network or monitoring token
```

For this repo specifically, I would move or wrap `/api/health/metrics` in
production:

```js
if (process.env.NODE_ENV === 'production') {
  app.get('/api/health/metrics', verifyToken, requireAdmin, metricsHandler);
} else {
  app.get('/api/health/metrics', metricsHandler);
}
```

or better, use one consistent protected route and let local development provide
an admin token.

## 6. Why Is The Global Write Rate Limiter Mounted Before Route-Level Auth?

The intent is good: reject write floods before doing expensive work.

Authentication is not free. Verifying a token can involve:

- parsing headers/cookies
- Supabase auth call
- role lookup
- role cache access
- CSRF checks

If an attacker sends a high-volume unauthenticated write flood, the cheapest
possible rejection point is before auth. That is why a coarse global write
limiter belongs early.

This is especially important because many route handlers use service-role DB
queries and external services. A pre-auth limiter prevents some bad traffic from
ever reaching those layers.

## 7. Does That Mean The Global Limiter Keys By IP Instead Of User?

Yes, in practice, for most protected routes.

The limiter is configured as:

```js
keyGenerator: (req) => req.user?.id || req.ip
```

But it is mounted in `app.js` before routes, and protected routes usually set
`req.user` only when their route-level `verifyToken` middleware runs. Therefore,
when the global limiter executes, `req.user` usually does not exist.

So the global write limiter is effectively:

```text
per IP, before auth
```

not:

```text
per authenticated user
```

The route-level limiters that run after `verifyToken` can key by user if they
are mounted inside a router after auth, but the app-level family limiters in
`app.js` are also before route-level auth. So `/api/payments`,
`/api/wallet`, `/api/posts`, `/api/listings`, `/api/reviews`, and `/api/homes`
family limiters are likewise usually IP-keyed at that stage.

### 7.1 How I Would Improve It

I would split rate limiting into two explicit stages:

1. **Pre-auth limiter**
   - mounted early
   - keyed by IP
   - coarse limits
   - protects auth and parsing costs

2. **Post-auth limiter**
   - mounted inside protected routers after `verifyToken`
   - keyed by `req.user.id`
   - product-specific limits
   - protects business actions per account

For example:

```js
app.use('/api', preAuthWriteIpLimiter);

router.use(verifyToken);
router.use(postAuthUserWriteLimiter);
```

For public optional-auth routes, I would keep IP limiting and optionally add a
secondary account bucket when `optionalAuth` succeeds.

## 8. Which Routes Are Service-Role-Backed, User-Token-Backed, Or Mixed?

The repo has two Supabase client types:

- `backend/config/supabase.js`: anon key client.
- `backend/config/supabaseAdmin.js`: service-role client that bypasses RLS.

Most product routes import `supabaseAdmin`, so they are service-role-backed
after backend authorization.

### 8.1 Provider-Signed Or Internal-Service Routes

These are not user JWT routes:

| Route Family | Auth Mechanism | Backing |
|---|---|---|
| `/api/webhooks/stripe` | Stripe signature | service role |
| `/api/v1/webhooks/lob` | Lob signature if secret configured | service role through mail vendor service |
| `/api/internal/email-inbound` | HMAC shared secret | service/job code |
| `/api/internal/briefing/*` | internal API key | service role |
| `/api/internal/*` | internal API key | internal job code |

These routes represent trusted systems calling us, not users.

### 8.2 Public Or Public-ish Service-Role Routes

These routes do not require a user token, but still use server-side service-role
queries:

| Route Family | Examples | Notes |
|---|---|---|
| `/api/public` | preview gigs/listings/posts | IP-limited preview surface |
| `/api/b` | public business page | SEO-friendly public business pages |
| `/api/homes/guest/:token` | guest pass | token/passcode gated |
| `/api/homes/shared/:token` | scoped shared resource | token/passcode gated |
| selected profile reads | users, businesses, personas | often optional-auth to tailor visibility |
| selected discovery reads | geo, business map, listings browse | public or optional-auth depending route |

The key requirement for these routes is field-level serialization and visibility
checks. Since service role bypasses RLS, a public route must never return raw DB
rows without a serializer or explicit field selection.

### 8.3 User-Authenticated Service-Role Routes

Most product routes are in this category:

| Domain | Route Families | Typical Auth |
|---|---|---|
| Users/account | `/api/users` protected subroutes | `verifyToken` |
| Homes | `/api/homes` | `verifyToken` plus home IAM checks |
| Home ownership | `/api/homes/*ownership*` | `verifyToken`, ownership/authority checks |
| Mailbox | `/api/mailbox`, `/api/mailbox/v2/*` | `verifyToken`, mail ownership/access checks |
| Businesses | `/api/businesses` | `verifyToken`, business IAM/seat checks |
| Business seats | `/api/businesses/my-seats`, `/seats/*`, `/:businessId/seats` | `verifyToken`, seat permission checks |
| Payments/wallet | `/api/payments`, `/api/wallet` | `verifyToken`, payer/payee/admin checks |
| Chats | `/api/chat` | `verifyToken`, participant checks |
| Posts | `/api/posts` | `verifyToken` for writes, optional/public reads |
| Marketplace | `/api/listings`, `/api/marketplace`, offers/trades | mixed, object ownership checks |
| Identity | `/api/privacy`, `/api/identity-center`, `/api/identity` | `verifyToken`, identity policy |
| Personas | `/api/personas`, persona subrouters | mixed public/owner/fan checks |
| Uploads | `/api/upload` | `verifyToken`, ownership checks per media target |
| AI | `/api/ai` | `verifyToken`, rate-limited expensive calls |
| Admin | `/api/admin`, `/api/admin/verification`, `/api/admin/payment-ops` | `verifyToken` plus `requireAdmin` |

### 8.4 Mixed User-Token And Service-Role Routes

Mixed routes use optional auth or combine anon auth operations with service-role
data operations.

Examples:

- `users.js`
  - registration/login/oauth/reset flows use auth clients and admin auth APIs
  - public profile routes use `optionalAuth`
  - protected profile/account routes use `verifyToken`
  - admin cleanup uses `verifyToken.requireAdmin`

- `gigs.js`
  - public browse style endpoints may use `optionalAuth`
  - writes and owner/worker views use `verifyToken`
  - database access often uses `supabaseAdmin`

- `listings.js`
  - browse/discover/autocomplete can use `optionalAuth`
  - create/update/delete use `verifyToken`
  - service role handles server-side reads/writes

- `posts.js`
  - feed/map may use optional auth for personalization
  - writes and private views require auth
  - visibility policy determines what the viewer can see

- `personas.js`
  - public persona/tiers/posts are optional-auth
  - creator management and fan membership actions require auth
  - service-role queries are filtered by persona policy

### 8.5 Pure User-Token/Auth-Client Operations

The pure user-token part is mainly authentication itself:

- `verifyToken` uses the anon Supabase client to verify a JWT.
- `optionalAuth` uses the anon Supabase client to soft-verify a token.
- login uses password auth.
- OAuth token exchange uses Supabase auth APIs.
- refresh/logout/reset flows use a mix of auth client and admin APIs depending
  on operation.

Once the route is inside product data, service role is common.

## 9. What Is The Backend Authorization Model Beyond "The Route Checks It"?

The model has several reusable layers.

### 9.1 Identity Authentication

`verifyToken` establishes the user:

- extracts Bearer token or `pantopus_access` cookie
- verifies token with Supabase
- loads role and account type
- caches role for 60 seconds
- attaches `req.user`
- runs CSRF for cookie-authenticated writes

This gives every protected route a normalized identity:

```js
req.user = {
  id,
  email,
  emailConfirmed,
  role,
  accountType
}
```

### 9.2 Platform Admin Authorization

`requireAdmin` is a platform-level role check:

```js
req.user.role === 'admin'
```

It is used for admin routes such as verification review, payment ops, and admin
refunds.

### 9.3 Object-Level Authorization

Because service role bypasses RLS, object-level authorization is the core of the
backend model.

Examples:

- A payment refund route must verify the caller is the payer/payee or admin
  depending on the action.
- A chat route must verify the caller is a participant in the room.
- A home route must verify the caller is an owner, occupant, invited member, or
  has the required home permission.
- A business route must verify the caller has membership, seat access, or a
  specific business permission.
- A persona owner route must verify the persona belongs to `req.user.id`.
- A listing offer route must verify the offer belongs to the listing and the
  actor is buyer/seller as appropriate.

Authentication answers:

```text
Who are you?
```

Object authorization answers:

```text
Why are you allowed to act on this object?
```

Both must be true.

### 9.4 Home IAM

`backend/utils/homePermissions.js` centralizes home access.

It models:

- active occupancy
- legacy owner
- verified `HomeOwner`
- IAM owner role
- role hierarchy
- base role permissions
- per-user permission overrides
- old boolean permission compatibility

Important design choices:

- Owner-like identities have all permissions.
- Non-owners must have active occupancy and a granted permission.
- Overrides are checked before role defaults.

This avoids scattering `if owner_id === userId` logic across every home route.

### 9.5 Business IAM

`backend/utils/businessPermissions.js` provides the legacy business-team model:

- `BusinessTeam`
- `BusinessRolePermission`
- `BusinessPermissionOverride`
- role hierarchy
- explicit permission strings such as `profile.edit`, `team.manage`,
  `finance.view`

This lets business routes authorize actions at permission granularity rather
than just "member or owner".

### 9.6 Seat-Based Business Identity Firewall

`backend/utils/seatPermissions.js` adds the seat-based model:

- `BusinessSeat`
- `SeatBinding`
- per-seat role
- per-seat permission overrides
- per-user override fallback during migration

The critical invariant is privacy: `SeatBinding` is only used to resolve the
authenticated user's own seat. It should never be used to reveal which real user
is behind another business seat.

This is an authorization model and a privacy model.

### 9.7 Landlord and Property Authority

`requireAuthority` checks whether the caller has verified authority over a home:

- direct user `HomeAuthority`
- business authority through a seat
- legacy business team fallback

This is separate from normal home membership. A landlord/property manager can
have authority to perform lease operations without being a household member.

### 9.8 Visibility Policy

`backend/utils/visibilityPolicy.js` centralizes content visibility rules:

- public
- neighborhood
- connections
- home
- private
- blocked users
- shared home
- relationship graph

That is used where the question is not "can you mutate this object?" but "can
you see this object or field?"

### 9.9 Identity Policy and Serializers

The identity firewall adds field-level and identity-context controls:

- local profile vs persona vs business vs home identity
- allowed audiences per identity type
- safe serializers that strip forbidden personal fields
- privacy gates that prevent raw personal selects and legacy aliases

This matters because many routes are service-role-backed. The serializer is the
last line between an internal row and a public response.

### 9.10 Audit Logging

Sensitive identity and permission mutations write audit logs:

- persona create/update
- feature flag changes
- home IAM changes
- business/seat changes
- membership and block actions

Audit logging is not authorization, but it is part of a defensible authorization
system because it makes privileged mutations reviewable after the fact.

## 10. How Do You Test Every Sensitive Endpoint Has Both Authentication And Object-Level Authorization?

I would test this at three levels: static route inventory, middleware presence,
and behavioral access matrices.

### 10.1 Generate A Route Inventory

First, create a route manifest:

```text
method, full_path, router_file, middleware_chain, auth_class, object_auth_class
```

Then classify each route:

- `public`
- `optional-auth`
- `user-auth`
- `admin`
- `internal-key`
- `provider-signed`

CI should fail when:

- a new mutating route is unclassified
- a sensitive route lacks `verifyToken`, `requireAdmin`, internal auth, or a
  provider signature
- a route under sensitive prefixes is public by accident

Sensitive prefixes include:

- `/api/payments`
- `/api/wallet`
- `/api/homes`
- `/api/mailbox`
- `/api/chat`
- `/api/privacy`
- `/api/identity-center`
- `/api/admin`
- `/api/upload`
- `/api/businesses/*/private`
- `/api/personas/:id/*` owner routes

### 10.2 Test No-Token Behavior

For every sensitive endpoint:

- no token should return 401
- invalid token should return 401
- cookie-authenticated write without CSRF should return 403
- Bearer-authenticated write should not require CSRF

This proves authentication is actually wired.

### 10.3 Test Wrong-User Behavior

For every object endpoint, test at least:

- owner/member can access
- unrelated user cannot access
- lower role cannot perform higher-role action
- deleted/disabled membership cannot access
- object from another parent cannot be smuggled into the route

The last case is important:

```text
POST /api/listings/:listingId/offers/:offerId/accept
```

must prove `offerId` belongs to `listingId`.

That prevents cross-object confused deputy bugs.

### 10.4 Test Side Effects Do Not Happen On Denial

A good auth test should not stop at status code. It should assert:

- DB row was not inserted/updated/deleted
- Stripe was not called
- push notification was not sent
- audit log was not written except for denied-action logs if intentionally used
- Socket.IO event was not emitted

This is especially important for money, messages, and invitations.

### 10.5 Test Non-Owner Existence Hiding

For privacy-sensitive resources, wrong-user access should often return 404
rather than 403.

Examples:

- private persona owner routes
- private mailbox items
- private home resources
- invite tokens
- identity bridge settings

This prevents object enumeration.

### 10.6 Keep Exploit Regression Tests

The repo already has strong examples:

- `backend/tests/integration/auth-exploits.test.js`
- `backend/tests/integration/chatAccessControl.test.js`
- `backend/tests/paysCriticalRoutes.test.js`
- `backend/tests/paysRoutesHardening.test.js`
- `backend/tests/unit/privacy/privacyGates.test.js`
- `backend/tests/unit/routePrecedence.test.js`

Those are the right categories:

- auth bypass regression
- object authorization
- route precedence
- privacy field leaks
- payment safety
- route-specific business invariants

I would expand this with a generated "sensitive endpoint manifest" test so we
are not relying on humans to remember to add new tests.

### 10.7 Test With The Real Middleware Chain

Some unit tests extract handlers directly. That is useful for focused object
policy tests, but it can miss middleware wiring bugs.

For auth coverage, I want Supertest integration tests that mount the router with:

- JSON parser
- cookie parser when needed
- real or mocked `verifyToken`
- actual route order
- actual validators where feasible

The highest confidence comes from testing the same middleware sequence that
production uses.

## 11. Where Do You Centralize Error Semantics For Clients?

Today the answer is: partially centralized, but not fully.

### 11.1 What Is Centralized Now

Centralized pieces:

- validation errors in `backend/middleware/validate.js`
- auth errors in `verifyToken`
- CSRF errors in `csrfProtection`
- rate-limit errors in `rateLimiter.js`
- 404 handling in `app.js`
- global unhandled error handling in `app.js`
- `AppError` and `asyncHandler` exist in `backend/errorHandler.js`

The validation response is the most client-friendly shape:

```json
{
  "error": "Validation failed",
  "message": "Please correct the highlighted fields.",
  "details": [
    {
      "field": "email",
      "message": "Please enter a valid email address.",
      "code": "string.email",
      "rejectedValue": "..."
    }
  ]
}
```

### 11.2 What Is Not Centralized Yet

Many routes still return ad hoc errors:

```js
return res.status(403).json({ error: 'Only the gig owner can view offers' });
return res.status(404).json({ error: 'Mail not found' });
return res.status(500).json({ error: 'Failed to fetch mailbox' });
```

This is easy to write, but it creates inconsistent client semantics:

- sometimes there is a `code`
- sometimes only `error`
- sometimes `message`
- sometimes details
- sometimes provider messages leak through
- sometimes 404 and 403 are chosen differently across domains

### 11.3 The Target Error Contract

I would standardize on:

```json
{
  "code": "HOME_ACCESS_DENIED",
  "message": "You do not have access to this home.",
  "details": {},
  "requestId": "..."
}
```

Fields:

- `code`: stable machine-readable code
- `message`: safe user-facing summary
- `details`: optional structured data for validation or retry behavior
- `requestId`: support/debug correlation

### 11.4 Typed Errors

Routes and services should throw typed errors:

```js
throw new AppError({
  status: 403,
  code: 'HOME_ACCESS_DENIED',
  message: 'You do not have access to this home.',
  expose: true,
});
```

or use helpers:

```js
throw forbidden('HOME_ACCESS_DENIED', 'You do not have access to this home.');
throw notFound('MAIL_NOT_FOUND', 'Mail not found.');
throw validationError(details);
```

The global error handler then becomes the only place that maps errors to client
JSON.

### 11.5 Error Semantics By Class

Recommended standard:

| Status | Meaning | Client Behavior |
|---:|---|---|
| 400 | invalid input, malformed request | fix request |
| 401 | missing/invalid/expired auth | re-authenticate |
| 403 | authenticated but not allowed | do not retry unchanged |
| 404 | not found or intentionally hidden | show absent/inaccessible |
| 409 | state conflict | refresh and retry if applicable |
| 410 | expired/revoked link/resource | stop using token |
| 422 | valid JSON but domain validation failed | show field/domain error |
| 429 | rate limited | back off |
| 500 | unexpected server error | retry/support |
| 503 | dependency/config unavailable | retry later |

For privacy-sensitive resources, 404 should be used intentionally to hide
existence from unauthorized callers.

## 12. What Is The API Versioning Strategy? I See Both `/api` And `/api/v1`

The current repo has three patterns:

- `/api`: legacy/default mobile API and most product routes
- `/api/v1`: newer address validation, landlord/tenant, and Lob webhook routes
- `/api/v2`: offers v2

This is workable but not fully formalized.

### 12.1 What `/api` Means Today

`/api` is the de facto current production API. It is not "unversioned because
it is throwaway"; it is the compatibility contract that existing clients depend
on.

Most of the app lives here:

- users
- homes
- businesses
- posts
- gigs
- mailbox
- chat
- payments
- wallet
- listings
- personas
- support trains

Breaking `/api` breaks deployed clients.

### 12.2 What `/api/v1` Means Today

`/api/v1` appears to have been introduced for newer, more explicitly designed
domains:

- address validation pipeline under `/api/v1/address`
- landlord and tenant flows under `/api/v1`
- Lob webhook under `/api/v1/webhooks/lob`

That suggests a migration toward explicit versioning for newer surfaces.

### 12.3 What `/api/v2` Means Today

`/api/v2` is currently used for offers v2:

```js
app.use('/api/v2', require('./routes/offersV2'));
```

This is endpoint-level evolution rather than a whole-platform v2.

### 12.4 My Versioning Policy

I would formalize this policy:

1. Additive response fields do not require a new version.
2. New endpoints can go into the current version.
3. Breaking request/response changes require a versioned path.
4. Version by resource family, not necessarily by whole app.
5. Keep old versions as compatibility shims during a defined deprecation window.
6. Document lifecycle states: active, deprecated, sunset.

### 12.5 What Counts As Breaking

Breaking changes include:

- removing a field
- changing field type
- changing auth requirement
- changing pagination semantics
- changing error codes in a way clients depend on
- changing id shape or route shape
- changing visibility semantics
- changing default sorting/filtering if clients rely on it

Non-breaking changes include:

- adding nullable fields
- adding new endpoints
- adding optional request fields
- adding new enum values only if clients are defensive

### 12.6 Recommended Future Shape

I would aim for:

```text
/api                 existing legacy/default contract
/api/v1              explicitly versioned stable contract for new clients
/api/v1/address      address validation
/api/v1/landlord     landlord resources
/api/v1/tenants      tenant resources
/api/v1/webhooks     provider webhooks if versioned externally
/api/v2/<resource>   only for breaking resource-level changes
```

Eventually, we could migrate clients from `/api` to `/api/v1`, but I would not
do that as a big-bang rewrite. I would use compatibility wrappers:

```js
app.use('/api/homes', legacyHomeRoutes);
app.use('/api/v1/homes', v1HomeRoutes);
```

Then retire legacy routes only after telemetry shows old clients are gone.

### 12.7 Versioning and Error Contracts

Error semantics should be versioned too. A stable v1 should guarantee:

- `code`
- `message`
- `details`
- `requestId`

Legacy `/api` can continue returning ad hoc shapes until migrated.

## 13. How I Would Explain This In An Interview

If asked to walk through this backend, I would frame it this way:

This backend is intentionally centralized at the Express layer. `app.js` is the
composition root, and request behavior is determined by middleware order. The
first priority is preserving request integrity: CORS and Helmet for browser
safety, raw body routes before JSON parsing for webhook signatures, then normal
JSON/cookie parsing. After that we add observability, health endpoints, request
IDs, and rate limiting.

Authentication is route-level because the product has several auth modes:
public previews, optional-auth discovery, user-authenticated product actions,
admin actions, internal jobs, and provider-signed webhooks. `verifyToken` is the
main user auth primitive. It normalizes Bearer and cookie auth, sets `req.user`,
loads role metadata, and enforces CSRF only when the request is cookie-auth and
mutating.

Authorization is not delegated blindly to the route handler. The system has
domain policy modules: home IAM, business IAM, seat-based business identity,
landlord authority, visibility policy, identity serializers, and audit logging.
Because most product routes use service role to talk to Supabase, object-level
authorization in server code is mandatory. That is the core security contract:
never use service role without proving the caller's relationship to the object.

The route design has a known sharp edge: shared prefixes and broad dynamic
params. We have comments and tests because Express is first-match-wins. The
right long-term fix is route-shape discipline plus route manifest tests, not
more comments forever.

For metrics, I would keep public health minimal and protect operational metrics
in production. For rate limiting, I would preserve the early IP limiter but add
post-auth user limiters so the code matches the intended per-user behavior.

For versioning, I would treat `/api` as the existing compatibility contract and
move deliberate new stable surfaces into `/api/v1`, using `/api/v2` only for
real breaking changes at a resource boundary.

## 14. Concrete Hardening Backlog

If I were continuing the backend hardening work, I would prioritize:

1. Protect `/api/health/metrics` in production.
2. Rename or split the global limiter comments/config so pre-auth IP limiting
   and post-auth user limiting are explicit.
3. Add a route manifest generator and CI check for auth class and route
   precedence.
4. Add a sensitive-endpoint registry with required auth and object-auth policy.
5. Move route handlers toward typed `AppError` and one centralized client error
   shape.
6. Include `requestId` in every error response.
7. Add route-level generated docs that show auth mode and version status.
8. Convert ambiguous static routes under broad prefixes into disjoint resource
   prefixes over time.
9. Add production monitoring export for APM metrics rather than exposing process
   metrics directly.
10. Formalize `/api`, `/api/v1`, and `/api/v2` lifecycle rules in the public API
    docs.

## 15. Quick Reference Answers

### Request Lifecycle

CORS, Helmet, raw signed webhooks, JSON parsing, cookies, logging, APM, health,
request ID, rate limiting, routes, Socket.IO context, 404, global error handler.

### Why Route-Order Comments

Because same-prefix routers and broad params can shadow static routes. The
comments document correctness constraints in Express registration order.

### Bug Class

Route shadowing and precedence collisions, potentially causing wrong handler,
wrong auth policy, wrong 404/403, or data exposure.

### How To Prevent Shadowing

Disjoint route shapes, static-before-dynamic ordering, UUID gates, manifest
tests, route classification metadata, and CI checks.

### Metrics Endpoint

Currently public for operational convenience. In production it should require
admin/internal auth or move behind monitoring infrastructure.

### Global Limiter Before Auth

It cheaply blocks write floods before auth and DB work. But because it runs
before `verifyToken`, it is effectively IP-keyed today.

### Service Role vs User Token

Most product routes are user-authenticated but service-role-backed. Auth flows
use user/anon auth clients. Webhooks and internal routes use signatures or
internal keys. Public/optional-auth routes still often use service role and must
serialize carefully.

### Authorization Model

`verifyToken` establishes identity. Domain policy modules enforce object access:
home IAM, business IAM, seat permissions, landlord authority, visibility policy,
identity policy, serializers, and audit logs.

### Testing Sensitive Endpoints

Generate route inventory, classify auth mode, test no-token and wrong-user
cases, assert no side effects on denial, test privacy 404 behavior, keep exploit
regressions and privacy gates.

### Error Semantics

Currently partially centralized. Target should be typed errors and one stable
client shape with `code`, `message`, `details`, and `requestId`.

### API Versioning

`/api` is the existing compatibility surface. `/api/v1` is emerging for newer
stable domains. `/api/v2` should be reserved for breaking resource-level
changes. Additive changes do not need a new version.
